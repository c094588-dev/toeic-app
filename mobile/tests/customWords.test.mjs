// 自分で登録する単語（マイ単語帳）のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CUSTOM_ID_BASE,
  MY_BAND,
  emptyCustomWords,
  findDuplicate,
  isCustomId,
  makeCustomWord,
  parseCustomWords,
  serializeCustomWords,
  validateCustomWord,
} from "../src/customWords.ts";
import {
  forgetWord,
  makeQuiz,
  mark,
  parseProgress,
  studyWords,
  todayPlan,
} from "../src/learning.ts";
const BANDS = [500, 600, 700, 800, 900];
const words = JSON.parse(readFileSync(new URL("../../words.json", import.meta.url)));
const input = (over = {}) => ({
  word: "deadline",
  meaning: "締め切り",
  example: "",
  example_ja: "",
  score_band: MY_BAND,
  ...over,
});

test("登録する単語の番号は、収録単語の番号と重ならない", () => {
  assert.ok(Math.max(...words.map((w) => w.No)) < CUSTOM_ID_BASE);
  assert.ok(isCustomId(CUSTOM_ID_BASE + 1));
  assert.ok(!isCustomId(1500));
});

test("入力のチェック: 英単語と意味は必須、登録先はマイ単語帳か500〜900", () => {
  assert.equal(validateCustomWord(input(), BANDS), null);
  assert.equal(validateCustomWord(input({ word: "  " }), BANDS), "英単語を入力してください。");
  assert.equal(validateCustomWord(input({ meaning: "" }), BANDS), "意味を入力してください。");
  assert.equal(validateCustomWord(input({ score_band: 700 }), BANDS), null);
  assert.equal(validateCustomWord(input({ score_band: 650 }), BANDS), "登録先を選んでください。");
  assert.match(validateCustomWord(input({ word: "a".repeat(61) }), BANDS), /60文字以内/);
});

test("登録した単語は前後の空白・改行を整える", () => {
  const w = makeCustomWord(input({ word: "  take   over ", meaning: "引き継ぐ\n", example: " I will take over. " }), CUSTOM_ID_BASE + 1);
  assert.deepEqual(
    { word: w.word, meaning: w.meaning, example: w.example, example_ja: w.example_ja, score_band: w.score_band },
    { word: "take over", meaning: "引き継ぐ", example: "I will take over.", example_ja: "", score_band: MY_BAND },
  );
});

test("同じ英単語があれば見つける（大文字・小文字は区別しない、編集中の単語自身は除く）", () => {
  const mine = makeCustomWord(input({ word: "Shinkansen", meaning: "新幹線" }), CUSTOM_ID_BASE + 1);
  const all = [...words, mine];
  const builtin = words.find((w) => w.word === "customer");
  assert.equal(findDuplicate(all, " Customer ")?.No, builtin.No);
  assert.equal(findDuplicate(all, "shinkansen")?.No, mine.No);
  assert.equal(findDuplicate(all, "shinkansen", mine.No), undefined);
  assert.equal(findDuplicate(all, ""), undefined);
});

test("保存データの読み書き: 形のおかしい単語は捨て、次の番号は重ならない", () => {
  assert.deepEqual(parseCustomWords(null, BANDS), emptyCustomWords());
  const a = makeCustomWord(input(), CUSTOM_ID_BASE + 1);
  const b = makeCustomWord(input({ word: "invoice", meaning: "請求書", score_band: 600 }), CUSTOM_ID_BASE + 2);
  const restored = parseCustomWords(serializeCustomWords({ words: [a, b], nextId: CUSTOM_ID_BASE + 3 }), BANDS);
  assert.deepEqual(restored, { words: [a, b], nextId: CUSTOM_ID_BASE + 3 });
  const broken = JSON.stringify({
    version: 1,
    nextId: 1,
    words: [a, { ...b, No: 5 }, { ...b, No: CUSTOM_ID_BASE + 9, score_band: 650 }, { ...a }, null],
  });
  assert.deepEqual(parseCustomWords(broken, BANDS), { words: [a], nextId: CUSTOM_ID_BASE + 2 });
  assert.throws(() => parseCustomWords("{}", BANDS));
});

const mine = [
  makeCustomWord(input({ word: "deadline" }), CUSTOM_ID_BASE + 1),
  makeCustomWord(input({ word: "takeover", meaning: "買収" }), CUSTOM_ID_BASE + 2),
  makeCustomWord(input({ word: "kickoff", meaning: "開始", score_band: 700 }), CUSTOM_ID_BASE + 3),
];
const all = [...words, ...mine];

test("進捗の読み込み: 関数で判定すると、登録した単語の記録も残る", () => {
  const known = (id) => words.some((w) => w.No === id) || isCustomId(id);
  const raw = JSON.stringify({
    version: 2,
    mastered: [1, CUSTOM_ID_BASE + 1],
    notYet: [999_999],
    stats: { [CUSTOM_ID_BASE + 1]: { miss: 0, seen: 1 } },
  });
  const p = parseProgress(raw, known);
  assert.deepEqual(p.mastered, [1, CUSTOM_ID_BASE + 1]);
  assert.deepEqual(p.notYet, []);
  assert.deepEqual(Object.keys(p.stats).sort(), ["1", String(CUSTOM_ID_BASE + 1)]);
});

test("単語を削除すると、その単語の記録も消える", () => {
  let p = mark({ mastered: [], notYet: [] }, CUSTOM_ID_BASE + 1, false);
  p = mark(p, 1, true);
  const after = forgetWord(p, CUSTOM_ID_BASE + 1);
  assert.deepEqual(after.notYet, []);
  assert.deepEqual(after.mastered, [1]);
  assert.equal(after.stats[CUSTOM_ID_BASE + 1], undefined);
});

test("マイ単語帳とレベルに入れた単語で学習できる", () => {
  const empty = { mastered: [], notYet: [] };
  assert.deepEqual(
    studyWords(all, MY_BAND, empty, "all").map((w) => w.word).sort(),
    ["deadline", "takeover"],
  );
  assert.ok(studyWords(all, 700, empty, "all").some((w) => w.word === "kickoff"));
});

test("マイ単語帳の単語が少なくても、4択クイズは全ての単語から選択肢を作る", () => {
  const quiz = makeQuiz(all, MY_BAND, { mastered: [], notYet: [] });
  assert.equal(quiz.length, 2);
  for (const q of quiz) {
    assert.equal(q.word.score_band, MY_BAND);
    assert.equal(new Set(q.choices).size, 4);
    assert.equal(q.choices[q.correctIndex], q.word.meaning);
  }
});

test("今日の学習: マイ単語帳の新しい単語を先に出す", () => {
  const plan = todayPlan(all, { mastered: [], notYet: [] }, 500, 20);
  assert.deepEqual(plan.words.slice(0, 2).map((w) => w.word).sort(), ["deadline", "takeover"]);
  assert.ok(plan.words.slice(2).every((w) => w.score_band === 500));
  // 目標スコアより上のレベルに入れた単語は出さない
  assert.ok(!plan.words.some((w) => w.word === "kickoff"));
});
