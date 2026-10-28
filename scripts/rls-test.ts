// Proves the row-level security in supabase/migrations on a throwaway local Postgres.
// Run: node scripts/rls-test.ts (needs initdb, pg_ctl and psql on PATH).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "swami-rls-"));
// unix socket paths max out near 100 characters, so the socket gets a short directory of its own
const sock = mkdtempSync("/tmp/srls-");
const port = String(55000 + Math.floor(Math.random() * 900));
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LC_ALL: "C" } });
const psql = (sql: string) => run("psql", ["-h", sock, "-p", port, "-d", "postgres", "-U", "postgres", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-c", sql]).trim();

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const V = "00000000-0000-0000-0000-00000000000c";
const as = (user: string, sql: string) => {
  try {
    return { ok: true, out: psql(`set role authenticated; set request.jwt.claim.sub = '${user}'; ${sql}`) };
  } catch (e) {
    return { ok: false, out: String((e as { stderr?: string }).stderr ?? e) };
  }
};

let failed = 0;
const check = (name: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : ` · ${detail}`}`);
  if (!cond) failed++;
};

try {
  run("initdb", ["-D", dir, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-locale"]);
  run("pg_ctl", ["-D", dir, "-o", `-k ${sock} -p ${port} -c listen_addresses=''`, "-w", "start", "-l", join(dir, "log")]);
  run("psql", ["-h", sock, "-p", port, "-d", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-f", "supabase/test/auth-stub.sql"]);
  for (const f of readdirSync("supabase/migrations").sort()) run("psql", ["-h", sock, "-p", port, "-d", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-f", join("supabase/migrations", f)]);

  // two sign-ups get a workspace each through the trigger
  psql(`insert into auth.users (id, email) values ('${A}', 'a@one.example'), ('${B}', 'b@two.example')`);
  const wsA = psql(`select workspace_id from members where user_id = '${A}'`);
  const wsB = psql(`select workspace_id from members where user_id = '${B}'`);
  check("each new user owns a new workspace", !!wsA && !!wsB && wsA !== wsB);

  check("A reads their own workspace", as(A, `select count(*) from workspaces`).out === "1");
  check("A writes a project", as(A, `insert into projects (id, workspace_id, name, kind, tone) values ('pa', '${wsA}', 'A show', 'show', '#fff')`).ok);
  check("A writes a chat and a message", as(A, `insert into conversations (id, workspace_id, title) values ('ca', '${wsA}', 'A chat'); insert into messages (id, conversation_id, role, text) values ('ma', 'ca', 'user', 'hi')`).ok);
  check("B sees none of A's projects", as(B, `select count(*) from projects`).out === "0");
  check("B sees none of A's messages", as(B, `select count(*) from messages`).out === "0");
  check("B cannot write into A's workspace", !as(B, `insert into projects (id, workspace_id, name, kind, tone) values ('pb', '${wsA}', 'x', 'show', '#fff')`).ok);
  check("B cannot add a message to A's chat", !as(B, `insert into messages (id, conversation_id, role, text) values ('mb', 'ca', 'user', 'x')`).ok);
  check("B's update of A's project changes nothing", as(B, `update projects set name = 'hacked' where id = 'pa' returning id`).out === "");
  check("B cannot make themselves a member of A's workspace", !as(B, `insert into members (workspace_id, user_id, email, role) values ('${wsA}', '${B}', 'b@two.example', 'Owner')`).ok);
  check("nobody reads the Qloo cache", !as(A, `select count(*) from qloo_cache`).ok);

  // an invite: the Owner adds a Viewer by email; signing up links the row and creates no new workspace
  check("A invites a viewer", as(A, `insert into members (workspace_id, email, role, status) values ('${wsA}', 'v@one.example', 'Viewer', 'invited')`).ok);
  psql(`insert into auth.users (id, email) values ('${V}', 'v@one.example')`);
  check("the invitee joins A's workspace only", psql(`select string_agg(workspace_id::text, ',') from members where user_id = '${V}'`) === wsA);
  check("the viewer reads A's project", as(V, `select count(*) from projects`).out === "1");
  check("the viewer cannot edit it", as(V, `update projects set name = 'x' where id = 'pa' returning id`).out === "");
  check("the viewer cannot invite", !as(V, `insert into members (workspace_id, email, role) values ('${wsA}', 'z@z.example', 'Editor')`).ok);
  // an invite for someone who already has an account: it waits until they accept on their next login
  check("A invites B", as(A, `insert into members (workspace_id, email, role, status) values ('${wsA}', 'b@two.example', 'Editor', 'invited')`).ok);
  check("B sees nothing of A's until accepting", as(B, `select count(*) from projects`).out === "0");
  check("B accepts the invite", as(B, `select accept_invites()`).out === "1");
  check("B now reads A's project and keeps their own workspace", as(B, `select count(*) from projects`).out === "1" && as(B, `select count(*) from workspaces`).out === "2");
  check("the accepted invite is the workspace B opens next", psql(`select workspace_id from members where user_id = '${B}' order by joined_at desc limit 1`) === wsA);
  check("accepting twice changes nothing", as(B, `select accept_invites()`).out === "0");

  check("only an Owner deletes the workspace", as(V, `delete from workspaces returning id`).out === "" && as(A, `select count(*) from workspaces`).out === "1");
} finally {
  try {
    run("pg_ctl", ["-D", dir, "-m", "immediate", "stop"]);
  } catch {}
  rmSync(dir, { recursive: true, force: true });
  rmSync(sock, { recursive: true, force: true });
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
