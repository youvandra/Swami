import assert from "node:assert/strict";
import { test } from "node:test";
import demo from "../demo-seed.json" with { type: "json" };
import type { Artifact, Conversation } from "../agent/types.ts";
import type { Project } from "../model.ts";
import { conversationToRows, projectToRow, rowToProject, rowsToConversations } from "./rows.ts";

const reply = (demo.replies as Record<string, { artifacts: Artifact[] }>).demo;
const conv: Conversation = {
  id: "c1",
  title: "Openers · Marlow Vane",
  projectId: "p1",
  mode: "auto",
  updatedAt: Date.UTC(2026, 9, 28, 12),
  entities: { "marlow vane": "fa-marlow-vane" },
  messages: [
    { id: "m1", role: "user", text: "Find an opener", createdAt: Date.UTC(2026, 9, 28, 11, 59) },
    { id: "m2", role: "assistant", text: "Halcyon Drive leads.", createdAt: Date.UTC(2026, 9, 28, 12), steps: [{ label: "Scored", ms: 3, status: "done" }], artifacts: reply.artifacts },
  ],
};

test("a conversation survives the trip to rows and back", () => {
  const r = conversationToRows(conv, "ws", "u");
  assert.equal(r.messages.length, 2);
  assert.deepEqual(r.artifacts.map((a) => [a.message_id, a.position]), reply.artifacts.map((_, i) => ["m2", i]));
  const [back] = rowsToConversations([r.conversation], [...r.messages].reverse(), [...r.artifacts].reverse());
  assert.deepEqual(back, conv);
});

test("a chat without project or entities stays without them", () => {
  const bare: Conversation = { id: "c2", title: "t", mode: "auto", updatedAt: 0, messages: [] };
  const r = conversationToRows(bare, "ws", null);
  assert.equal(r.conversation.project_id, null);
  assert.deepEqual(rowsToConversations([r.conversation], [], []), [bare]);
});

test("a project survives the trip", () => {
  const p: Project = { id: "p1", name: "Show", kind: "show", tone: "#fff", headliner: "H", city: "C", date: "Mar 14", venue: "V", capacity: 900, createdAt: 1000, updatedAt: 2000 };
  assert.deepEqual(rowToProject(projectToRow(p, "ws")), p);
});

test("an edited question keeps its versions through rows and the sync schema", async () => {
  const { conversationSchema } = await import("./sync.ts");
  const [q, a] = conv.messages;
  const edited: Conversation = {
    ...conv,
    messages: [{ ...q, text: "Find an opener in Austin", branches: { active: 1, list: [{ text: q.text, after: [a] }, { text: "Find an opener in Austin", after: [] }] } }, { ...a, id: "m3" }],
  };
  const r = conversationToRows(edited, "ws", "u");
  assert.equal(r.messages[0].branches?.list[0].after[0].id, "m2");
  assert.equal(r.messages[1].branches, undefined, "messages without versions send no branches key");
  const back = rowsToConversations([r.conversation], r.messages, r.artifacts)[0];
  assert.deepEqual(back.messages[0].branches, edited.messages[0].branches);
  assert.ok(conversationSchema.safeParse(edited).success);
});
