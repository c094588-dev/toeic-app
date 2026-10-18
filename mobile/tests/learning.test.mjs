import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isWeak,
  makeQuiz,
  mark,
  markQuizCorrect,
  parseProgress,
  restoreProgress,
  studyWords,
} from "../src/learning.ts";
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
  const missed = mark({ mastered: [1], notYet: [] }, 1, false, 1000);
  assert.deepEqual(missed, { mastered: [], notYet: [1], stats: { 1: { miss: 1, seen: 1000 } } });
  assert.deepEqual(mark(missed, 1, true, 2000), {
    mastered: [1],
    notYet: [],
    stats: { 1: { miss: 0, seen: 2000 } },
  });
});
test("全習得後は空キュー、空の進捗はそのまま復元する", () => {
  assert.equal(
    studyWords(words, 500, { mastered: [...ids], notYet: [] }, "unmastered").length,
    0,
  );
  assert.deepEqual(
    parseProgress('{"version":1,"mastered":[],"notYet":[]}', ids),
    { mastered: [], notYet: [], stats: {} },
  );
});
test("壊れた保存形式を黙って上書きしない・不明IDを除外する", () => {
  assert.throws(() => parseProgress("{}", ids));
  assert.throws(() => parseProgress("broken", ids));
  assert.deepEqual(
    parseProgress('{"version":1,"mastered":[1,1,99999],"notYet":[1,2]}', ids),
    { mastered: [1], notYet: [2], stats: {} },
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

test("壊れた保存データは空の進捗で再開し、corrupt で知らせる", () => {
  assert.deepEqual(restoreProgress("broken", ids), {
    progress: { mastered: [], notYet: [], stats: {} },
    corrupt: true,
  });
  assert.deepEqual(restoreProgress("{}", ids).corrupt, true);
  assert.deepEqual(restoreProgress(null, ids), {
    progress: { mastered: [], notYet: [], stats: {} },
    corrupt: false,
  });
  assert.deepEqual(
    restoreProgress('{"version":1,"mastered":[1],"notYet":[2]}', ids),
    { progress: { mastered: [1], notYet: [2], stats: {} }, corrupt: false },
  );
});

// ---- 苦手な単語を優先する ----
const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;
const band500 = words.filter((w) => w.score_band === 500).map((w) => w.No);

test("苦手度: まだ・誤答で上がり、クイズ正解で下がり、覚えたで0に戻る", () => {
  let p = mark({ mastered: [], notYet: [] }, 1, false, NOW);
  p = mark(p, 1, false, NOW);
  assert.equal(p.stats[1].miss, 2);
  p = markQuizCorrect(p, 1, NOW);
  assert.equal(p.stats[1].miss, 1);
  assert.deepEqual(p.notYet, [1]);
  assert.equal(isWeak(p, 1), true);
  p = markQuizCorrect(p, 1, NOW);
  assert.equal(isWeak(p, 1), false);
  assert.equal(mark(p, 1, true, NOW).stats[1].miss, 0);
});

test("以前の保存形式(version 1)の「まだ」は苦手な単語として扱う", () => {
  const p = parseProgress('{"version":1,"mastered":[],"notYet":[5]}', ids);
  assert.equal(isWeak(p, 5), true);
});

test("壊れた単語記録は読み込まない", () => {
  const p = parseProgress(
    '{"version":2,"mastered":[],"notYet":[],"stats":{"1":{"miss":2,"seen":5},"2":{"miss":-1,"seen":5},"3":{"miss":"x","seen":5},"99999":{"miss":1,"seen":1}}}',
    ids,
  );
  assert.deepEqual(p.stats, { 1: { miss: 2, seen: 5 } });
});

test("覚えていない単語: 苦手な単語が先、苦手度が高いほど先、その後に新しい単語", () => {
  const [a, b, c] = band500;
  const p = {
    mastered: [],
    notYet: [a, b],
    stats: { [a]: { miss: 1, seen: NOW }, [b]: { miss: 4, seen: NOW } },
  };
  const order = studyWords(words, 500, p, "unmastered", NOW).map((w) => w.No);
  assert.deepEqual(order.slice(0, 2), [b, a]);
  assert.equal(order.length, 500);
  assert.ok(order.includes(c));
});

test("同じ苦手度なら、最後に見てから日が経った単語が先", () => {
  const [a, b] = band500;
  const p = {
    mastered: [],
    notYet: [a, b],
    stats: { [a]: { miss: 2, seen: NOW }, [b]: { miss: 2, seen: NOW - 10 * DAY } },
  };
  for (let i = 0; i < 20; i++)
    assert.deepEqual(studyWords(words, 500, p, "weak", NOW).map((w) => w.No), [b, a]);
});

test("全ての単語: 覚えた単語は後ろ。久しぶりの覚えた単語は最近の覚えた単語より先", () => {
  const [a, b] = band500;
  const p = {
    mastered: [a, b],
    notYet: [],
    stats: { [a]: { miss: 0, seen: NOW }, [b]: { miss: 0, seen: NOW - 20 * DAY } },
  };
  const order = studyWords(words, 500, p, "all", NOW).map((w) => w.No);
  assert.deepEqual(order.slice(-2), [b, a]);
});

test("苦手な単語だけ: 苦手な単語のみ出る", () => {
  const [a, b, c] = band500;
  const p = { mastered: [c], notYet: [a, b], stats: { [a]: { miss: 1, seen: NOW }, [b]: { miss: 0, seen: NOW } } };
  assert.deepEqual(studyWords(words, 500, p, "weak", NOW).map((w) => w.No), [a]);
});

test("クイズ: 苦手な単語が10語以上あれば、10問すべて苦手な単語から出す", () => {
  const weak = band500.slice(100, 115);
  const p = {
    mastered: [],
    notYet: weak,
    stats: Object.fromEntries(weak.map((id) => [id, { miss: 1, seen: NOW }])),
  };
  for (let run = 0; run < 20; run++) {
    const quiz = makeQuiz(words, 500, p, 10, NOW);
    assert.equal(quiz.length, 10);
    assert.ok(quiz.every((q) => weak.includes(q.word.No)));
  }
});

// ---- 今日の学習 ----
import { todayPlan, studiedToday, DAILY_GOAL } from "../src/learning.ts";
// 正午を「今」にして、日付の境目をまたがないようにする
const NOON = new Date(2026, 9, 18, 12).getTime();

test("今日の学習: 何も学習していなければ、目標スコア以下の低いレベルの新しい単語20語", () => {
  const plan = todayPlan(words, { mastered: [], notYet: [] }, 700, DAILY_GOAL, NOON);
  assert.equal(plan.words.length, 20);
  assert.equal(new Set(plan.words.map((w) => w.No)).size, 20);
  assert.ok(plan.words.every((w) => w.score_band === 500));
  assert.deepEqual([plan.weak, plan.review, plan.fresh], [0, 0, 20]);
});

test("今日の学習: 苦手な単語(最大10) → 復習時期の覚えた単語(最大5) → 新しい単語の順", () => {
  const weak = band500.slice(0, 15);
  const old = band500.slice(20, 30);
  const recent = band500.slice(30, 35);
  const stats = {};
  for (const id of weak) stats[id] = { miss: 1, seen: NOON - 2 * DAY };
  for (const id of old) stats[id] = { miss: 0, seen: NOON - 10 * DAY };
  for (const id of recent) stats[id] = { miss: 0, seen: NOON - 1 * DAY };
  const p = { mastered: [...old, ...recent], notYet: weak, stats };
  const plan = todayPlan(words, p, 500, DAILY_GOAL, NOON);
  const ids = plan.words.map((w) => w.No);
  assert.deepEqual([plan.weak, plan.review, plan.fresh], [10, 5, 5]);
  assert.ok(ids.slice(0, 10).every((id) => weak.includes(id)));
  assert.ok(ids.slice(10, 15).every((id) => old.includes(id)));
  assert.ok(ids.slice(15).every((id) => !weak.includes(id) && !old.includes(id) && !recent.includes(id)));
});

test("今日の学習: 目標スコアより上のレベルは出さない", () => {
  const plan = todayPlan(words, { mastered: [], notYet: [] }, 500, DAILY_GOAL, NOON);
  assert.ok(plan.words.every((w) => w.score_band <= 500));
});

test("今日の学習: 低いレベルを覚え終えたら、次のレベルの新しい単語に進む", () => {
  const stats = Object.fromEntries(band500.map((id) => [id, { miss: 0, seen: NOON - DAY }]));
  const p = { mastered: band500, notYet: [], stats };
  const plan = todayPlan(words, p, 700, DAILY_GOAL, NOON);
  assert.ok(plan.words.every((w) => w.score_band === 600));
});

test("今日の学習: 今日すでに学習した単語は、2回目では後回し", () => {
  const first = todayPlan(words, { mastered: [], notYet: [] }, 500, DAILY_GOAL, NOON);
  const stats = Object.fromEntries(first.words.map((w) => [w.No, { miss: 0, seen: NOON - 60_000 }]));
  const p = { mastered: first.words.map((w) => w.No), notYet: [], stats };
  assert.equal(studiedToday(p, NOON), 20);
  const second = todayPlan(words, p, 500, DAILY_GOAL, NOON);
  assert.ok(second.words.every((w) => !stats[w.No]));
});

test("今日学習した数は、今日の記録だけを数える", () => {
  const p = {
    mastered: [],
    notYet: [],
    stats: { 1: { miss: 0, seen: NOON - 60_000 }, 2: { miss: 1, seen: NOON - DAY } },
  };
  assert.equal(studiedToday(p, NOON), 1);
});
