import assert from "node:assert/strict";
import { test } from "node:test";
import { limiter } from "./ratelimit.ts";

test("allows max calls per window per key, then reopens", () => {
  let t = 0;
  const l = limiter(2, 1000, () => t);
  assert.equal(l.take("a"), true);
  assert.equal(l.take("a"), true);
  assert.equal(l.take("a"), false);
  assert.equal(l.take("b"), true);
  assert.equal(l.retryAfter("a"), 1);
  t = 1001;
  assert.equal(l.take("a"), true);
});
