import assert from "node:assert/strict";
import { test } from "node:test";
import demo from "../demo-seed.json" with { type: "json" };
import { opSchema } from "./sync.ts";

test("every demo chat passes the sync schema, so an import never fails on shape", () => {
  for (const [id, r] of Object.entries(demo.replies)) {
    const conversation = { id, title: r.title, mode: "auto", updatedAt: Date.now(), messages: [{ id: `${id}-q`, role: "user", text: "q", createdAt: 1 }, { id: `${id}-a`, role: "assistant", text: r.text, createdAt: 2, steps: r.steps, artifacts: r.artifacts }] };
    const parsed = opSchema.safeParse({ op: "conversation.put", conversation });
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 2)));
  }
});

test("bad writes are refused before they reach the database", () => {
  assert.equal(opSchema.safeParse({ op: "member.invite", email: "nope", role: "Owner" }).success, false);
  assert.equal(opSchema.safeParse({ op: "workspace.patch", patch: { plan: "free" } }).success, false);
  assert.equal(opSchema.safeParse({ op: "drop.everything" }).success, false);
});
