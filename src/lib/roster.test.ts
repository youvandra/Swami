import assert from "node:assert/strict";
import { test } from "node:test";
import { ROSTER_MAX_ACTS, parseRoster } from "./roster.ts";

test("one act per line, with bullets and numbering", () => {
  assert.deepEqual(parseRoster("- Halcyon Drive\n2. Pia Marsh\n\n• Fieldwork"), [{ name: "Halcyon Drive" }, { name: "Pia Marsh" }, { name: "Fieldwork" }]);
});

test("act and genre separated by a comma", () => {
  assert.deepEqual(parseRoster("Halcyon Drive, Indie rock\nPia Marsh, Alt R&B"), [
    { name: "Halcyon Drive", genre: "Indie rock" },
    { name: "Pia Marsh", genre: "Alt R&B" },
  ]);
});

test("CSV with a header picks the named columns", () => {
  const csv = 'id,Genre,Artist\n1,Folk pop,"The Low Orchard"\n2,"Garage, lo-fi",Copper Hours';
  assert.deepEqual(parseRoster(csv), [
    { name: "The Low Orchard", genre: "Folk pop" },
    { name: "Copper Hours", genre: "Garage, lo-fi" },
  ]);
});

test("duplicates are dropped, case-insensitively", () => {
  assert.deepEqual(parseRoster("Fieldwork\nfieldwork\nFIELDWORK"), [{ name: "Fieldwork" }]);
});

test("long lists stop at the act limit", () => {
  const text = Array.from({ length: 900 }, (_, i) => `Act ${i}`).join("\n");
  assert.equal(parseRoster(text).length, ROSTER_MAX_ACTS);
});
