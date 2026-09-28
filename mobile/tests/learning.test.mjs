import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeQuiz, mark, parseProgress, studyWords } from "../src/learning.ts";
const words = JSON.parse(
  readFileSync(new URL("../../words.json", import.meta.url)),
);
const ids = new Set(words.map((w) => w.No));
test("教材は1,500語でIDが一意、TOEICのみ", () => {
  assert.equal(words.length, 1500);
  assert.equal(ids.size, 1500);
  assert.deepEqual(
    [...new Set(words.map((w) => w.score_band))].sort(),
    [500, 600, 700, 800, 900],
  );
});
test("各レベルで重複しない10問・4つの異なる選択肢・正解を生成", () => {
  for (const band of [500, 600, 700, 800, 900])
    for (let run = 0; run < 20; run++) {
      const quiz = makeQuiz(words, band, { mastered: [], notYet: [] });
      assert.equal(quiz.length, 10);
      assert.equal(new Set(quiz.map((q) => q.word.No)).size, 10);
      for (const q of quiz) {
        assert.equal(q.word.score_band, band);
        assert.equal(new Set(q.choices).size, 4);
        assert.equal(q.choices[q.correctIndex], q.word.meaning);
      }
    }
});
test("未習得が十分なら習得済みをクイズに出さない", () => {
  const mastered = words
    .filter((w) => w.score_band === 500)
    .slice(0, 490)
    .map((w) => w.No);
  assert.ok(
    makeQuiz(words, 500, { mastered, notYet: [] }).every(
      (q) => !mastered.includes(q.word.No),
    ),
  );
});
test("誤答で習得を取り消し、再習得でまだを削除する", () => {
  const missed = mark({ mastered: [1], notYet: [] }, 1, false);
  assert.deepEqual(missed, { mastered: [], notYet: [1] });
  assert.deepEqual(mark(missed, 1, true), { mastered: [1], notYet: [] });
});
test("全習得後は空キュー、空の進捗はそのまま復元する", () => {
  assert.equal(
    studyWords(words, 500, { mastered: [...ids], notYet: [] }, true).length,
    0,
  );
  assert.deepEqual(
    parseProgress('{"version":1,"mastered":[],"notYet":[]}', ids),
    { mastered: [], notYet: [] },
  );
});
test("壊れた保存形式を黙って上書きしない・不明IDを除外する", () => {
  assert.throws(() => parseProgress("{}", ids));
  assert.throws(() => parseProgress("broken", ids));
  assert.deepEqual(
    parseProgress('{"version":1,"mastered":[1,1,99999],"notYet":[1,2]}', ids),
    { mastered: [1], notYet: [2] },
  );
});
test("教材が空でもクイズ生成は停止しない", () =>
  assert.deepEqual(makeQuiz([], 500, { mastered: [], notYet: [] }), []));

test("全例文に日本語訳があり、英語の例文も保持されている", () => {
  for (const w of words) {
    assert.ok(typeof w.example === "string" && w.example.trim(), `英語例文: ${w.No}`);
    assert.ok(typeof w.example_ja === "string" && /[ぁ-んァ-ヶ一-龯]/u.test(w.example_ja), `日本語訳: ${w.No}`);
  }
});
