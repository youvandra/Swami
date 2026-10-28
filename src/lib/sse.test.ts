import assert from "node:assert/strict";
import { test } from "node:test";
import { readEvents } from "./sse.ts";

test("frames split across chunks come out whole and in order", async () => {
  const text = 'event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\n';
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < text.length; i += 7) c.enqueue(enc.encode(text.slice(i, i + 7)));
      c.close();
    },
  });
  const out: { n: number }[] = [];
  for await (const e of readEvents<{ n: number }>(body)) out.push(e);
  assert.deepEqual(out, [{ n: 1 }, { n: 2 }]);
});
