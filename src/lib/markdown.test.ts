import assert from "node:assert/strict";
import { test } from "node:test";
import { numbersBacked } from "./agent/prose.ts";
import { parseBlocks, parseInline, plainOf } from "./markdown.ts";

test("inline: bold, italic, code and safe links; the rest stays text", () => {
  assert.deepEqual(parseInline("**Lucy Dacus** leads at *0.67*, see `fit`"), [
    { t: "b", c: [{ t: "text", v: "Lucy Dacus" }] },
    { t: "text", v: " leads at " },
    { t: "i", c: [{ t: "text", v: "0.67" }] },
    { t: "text", v: ", see " },
    { t: "code", v: "fit" },
  ]);
  assert.deepEqual(parseInline("[Qloo](https://qloo.com)"), [{ t: "a", href: "https://qloo.com", c: [{ t: "text", v: "Qloo" }] }]);
  // no javascript: links, no raw HTML, unclosed marks stay as typed
  assert.equal(plainOf(parseInline("[x](javascript:alert(1)) <b>hi</b> 2 * 3 and **open")), "[x](javascript:alert(1)) <b>hi</b> 2 * 3 and **open");
  assert.equal(parseInline("<img src=x onerror=1>")[0].t, "text");
  assert.equal(plainOf(parseInline("snake_case_name stays")), "snake_case_name stays");
});

test("blocks: paragraphs, bullets and numbered lists", () => {
  const b = parseBlocks("Lucy Dacus is the pick.\n\n- **Why:** fans rank her 2nd\n- Runner-up: Julia Jacklin\n  close behind\n\n1. Hold the date\n2. Send the proposal\n\nNext: draft it.");
  assert.deepEqual(b.map((x) => x.t), ["p", "ul", "ol", "p"]);
  if (b[1].t !== "ul" || b[2].t !== "ol") return assert.fail();
  assert.equal(b[1].items.length, 2);
  assert.equal(plainOf(b[1].items[1]), "Runner-up: Julia Jacklin close behind");
  assert.equal(b[2].start, 1);
  // lines of one paragraph join
  assert.deepEqual(parseBlocks("one\ntwo"), [{ t: "p", c: [{ t: "text", v: "one two" }] }]);
});

test("the number check reads the raw text, so bold numbers are still backed", () => {
  assert.ok(numbersBacked("**Lucy Dacus** leads at **0.78** fit.", [{ fit: 0.78 }]));
  assert.ok(!numbersBacked("**0.91** fit", [{ fit: 0.78 }]));
});
