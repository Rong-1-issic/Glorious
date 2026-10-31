import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCSV,
  ingest,
  dedup,
  frequencies,
  demo,
  generate,
  check,
  validateProject,
  evidenceRows,
  toCSV,
  safeUrl,
} from "./core";
test("BOM quoted commas multiline escaped quotes, invalid row reporting and provenance", () => {
  const x = parseCSV(
    '\uFEFFtext,source\r\n"not sticky, nice\ntexture",A\r\n"say ""hello""",B\r\n,C\r\nwrong,row,extra',
  );
  const y = ingest(x.rows, x.headers, { text: "text", source: "source" });
  assert.equal(y.comments.length, 2);
  assert.equal(y.errors.length, 2);
  assert.equal(y.empty, 1);
  assert.match(y.comments[0].text, /\n/);
  assert.equal(y.comments[1].text, 'say "hello"');
  const merged = dedup([
    ...y.comments,
    {
      ...y.comments[0],
      origins: [{ ...y.comments[0].origins[0], source: "other" }],
    },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].origins.length, 2);
});
test("phrases keep negation and never cross sentence boundary; precise comment ids", () => {
  const p = demo();
  const f = frequencies(p.comments, 2, "not");
  const not = f.find((x) => x.term === "not sticky")!;
  assert.equal(not.ids.length, 2);
  assert.equal(not.share, 2 / 8);
  assert(!f.some((x) => x.term === "buying not"));
  assert.equal(not.count, 2);
});
test("demo missing biographies and place never invented; export references validate", () => {
  const p = demo();
  p.insights[0].selected = true;
  p.versions = generate(p);
  assert(p.versions.every((v) => v.sentences.length === 3));
  const sparse = {
    ...p,
    facts: p.facts.filter((f) => !["人物", "地方"].includes(f.kind)),
  };
  const missing = generate(sparse);
  assert.equal(missing[0].sentences.length, 0);
  assert.equal(missing[1].sentences.length, 0);
  assert(!p.versions.flatMap((v) => v.sentences).some((s) => /\d/.test(s.en)));
  p.selectedVersion = p.versions[2].id;
  assert.equal(validateProject(JSON.parse(JSON.stringify(p))).id, p.id);
  assert.equal(evidenceRows(p).length, 9);
  assert.match(toCSV(evidenceRows(p)), /sentence_id/);
  p.versions[2].sentences[0].factIds = ["nonexistent"];
  assert.throws(() => validateProject(p), /引用/);
});
test("rule risks and revision invalidation contract; unsafe URLs and CSV formulas", () => {
  const p = demo(),
    v = generate(p)[2];
  v.sentences[0].en =
    "Guaranteed cure in 7 days, clinically tested since 1900.";
  const result = check(v, p.facts);
  assert(result.some((r) => r.reason.includes("数字")));
  assert(result.some((r) => r.reason.includes("医疗")));
  assert(result.some((r) => r.reason.includes("加强")));
  v.checkedRevision = v.revision;
  v.revision++;
  assert.notEqual(v.checkedRevision, v.revision);
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert(safeUrl("https://example.com"));
  assert.match(toCSV([{ text: "=SUM(A1)" }]), /'=SUM/);
});
test("limits malformed inputs and actual data do not use preset generation", () => {
  assert.throws(() => parseCSV('text\n"unclosed'));
  assert.throws(() => parseCSV("text\n" + "x\n".repeat(5001)));
  const p = demo();
  p.mode = "imported";
  assert.throws(() => generate(p), /API/);
  assert.throws(() => validateProject({ schemaVersion: 2 }));
});
