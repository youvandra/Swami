import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./safe-next.ts";

test("safeNext keeps paths on this site and drops everything that leaves it", () => {
  assert.equal(safeNext("/app/c/abc?x=1"), "/app/c/abc?x=1");
  assert.equal(safeNext("/app/projects#top"), "/app/projects#top");
  for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(safeNext(bad), "/app", String(bad));
  }
  assert.equal(safeNext("//evil.com", "/"), "/");
});
