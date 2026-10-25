import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATCH_UP_DUE,
  CONFIDENT_STEP,
  DAILY_GOAL,
  INTERVAL_DAYS,
  MAX_STEP,
  NEW_WORDS_MAX,
  daysUntilDue,
  isDue,
  isRetained,
  isWeak,
  makeQuiz,
  mark,
  markQuizCorrect,
  meaningsOverlap,
  parseProgress,
  quizFrom,
  restoreProgress,
  startOfDay,
  studiedToday,
  studyWords,
  newWordsToday,
  todayPlan,
  touch,
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
test("復習の時期でない習得済みはクイズに出さず、時期が来た習得済みは新しい単語より先に出す", () => {
  const now = 100 * 24 * 60 * 60 * 1000;
  const mastered = words
    .filter((w) => w.score_band === 500)
    .slice(0, 490)
    .map((w) => w.No);
  // 全部きのう覚えた（次の復習はまだ先）→ 未習得の10語だけが出る
  const fresh = Object.fromEntries(mastered.map((id) => [id, { miss: 0, seen: now - 1, step: 1, due: now + 1 }]));
  assert.ok(
    makeQuiz(words, 500, { mastered, notYet: [], stats: fresh }, 10, now).every(
      (q) => !mastered.includes(q.word.No),
    ),
  );
  // 3語だけ復習の時期が来ている → その3語が先に出る
  const stats = { ...fresh };
  for (const id of mastered.slice(0, 3)) stats[id] = { miss: 0, seen: now - 10, step: 1, due: now - 1 };
  const quiz = makeQuiz(words, 500, { mastered, notYet: [], stats }, 10, now);
  assert.deepEqual(quiz.map((q) => q.word.No).filter((id) => mastered.includes(id)).sort(), mastered.slice(0, 3).sort());
});
test("誤答で習得を取り消し、再習得でまだを削除する", () => {
  // 記録のない覚えた単語は段階 3 とみなす。「まだ」で 2 段下がり、段階 1・すぐ出す
  const missed = mark({ mastered: [1], notYet: [] }, 1, false, 1000);
  assert.deepEqual(missed, { mastered: [], notYet: [1], stats: { 1: { miss: 1, seen: 1000, step: 1, due: 1000, first: 1000 } } });
  // 覚え直すと 1 段上がり（段階 2 = 3 日後）、次の復習はその日の 0 時基準
  const again = mark(missed, 1, true, 2000);
  assert.deepEqual([again.mastered, again.notYet], [[1], []]);
  assert.deepEqual(again.stats[1], { miss: 0, seen: 2000, step: 2, due: startOfDay(2000) + 3 * 24 * 60 * 60 * 1000, first: 1000 });
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
  const p = parseProgress('{"version":1,"mastered":[1,1,99999],"notYet":[1,2]}', ids, 5000);
  assert.deepEqual([p.mastered, p.notYet], [[1], [2]]);
  // 記録のない単語には、いま復習に出るよう段階を補う（覚えた=3、まだ=1）
  assert.deepEqual(Object.keys(p.stats).sort(), ["1", "2"]);
  assert.equal(p.stats[1].step, CONFIDENT_STEP);
  // 更新で一度に時期が来た単語は 14 日に分けて出す（番号 1 は 1 日後）
  assert.equal(p.stats[1].due, startOfDay(5000) + DAY);
  assert.deepEqual([p.stats[2].step, p.stats[2].miss], [1, 1]);
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
  const r = restoreProgress('{"version":1,"mastered":[1],"notYet":[2]}', ids);
  assert.equal(r.corrupt, false);
  assert.deepEqual([r.progress.mastered, r.progress.notYet], [[1], [2]]);
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
  assert.deepEqual(p.stats, { 1: { miss: 2, seen: 5, step: 1, due: startOfDay(5) + DAY } });
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

test("全ての単語: 復習の時期が来た覚えた単語は新しい単語より先、時期でない覚えた単語は最後", () => {
  const [a, b] = band500;
  const p = {
    mastered: [a, b],
    notYet: [],
    stats: { [a]: { miss: 0, seen: NOW }, [b]: { miss: 0, seen: NOW - 20 * DAY } },
  };
  const order = studyWords(words, 500, p, "all", NOW).map((w) => w.No);
  assert.equal(order[0], b);
  assert.equal(order[order.length - 1], a);
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
// 正午を「今」にして、日付の境目をまたがないようにする
const NOON = new Date(2026, 9, 18, 12).getTime();

test("今日の学習: 何も学習していなければ、低いレベルの新しい単語を上限（1日10語）まで", () => {
  const plan = todayPlan(words, { mastered: [], notYet: [] }, 700, DAILY_GOAL, NOON);
  assert.equal(plan.words.length, NEW_WORDS_MAX);
  assert.equal(new Set(plan.words.map((w) => w.No)).size, NEW_WORDS_MAX);
  assert.ok(plan.words.every((w) => w.score_band === 500));
  assert.deepEqual([plan.weak, plan.review, plan.fresh, plan.dueLeft], [0, 0, NEW_WORDS_MAX, 0]);
});

test("今日の学習: 復習（まだ → 時期が来た覚えた単語、最大16）→ 新しい単語（最低4）の順", () => {
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
  // 苦手 15 語（段階 0）が先、次に 7 日たった覚えた単語（段階 3）が 1 語、新しい単語 4 語。残り 9 語は明日以降
  assert.deepEqual([plan.weak, plan.review, plan.fresh, plan.dueLeft], [15, 16, 4, 9]);
  assert.ok(ids.slice(0, 15).every((id) => weak.includes(id)));
  assert.ok(old.includes(ids[15]));
  assert.ok(ids.slice(16).every((id) => !weak.includes(id) && !old.includes(id) && !recent.includes(id)));
  assert.equal(ids.length, 20);
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

test("今日の学習: 今日すでに学習した単語は出さない。新しい単語の上限に達したら、その日はもう増えない", () => {
  const first = todayPlan(words, { mastered: [], notYet: [] }, 500, DAILY_GOAL, NOON);
  assert.equal(first.words.length, NEW_WORDS_MAX);
  // 今日初めて記録が付いた（first が今日）新しい単語 10 語
  const stats = Object.fromEntries(first.words.map((w) => [w.No, { miss: 0, seen: NOON - 60_000, step: 1, due: NOON + DAY, first: NOON - 60_000 }]));
  const p = { mastered: first.words.map((w) => w.No), notYet: [], stats };
  assert.equal(studiedToday(p, NOON), NEW_WORDS_MAX);
  const second = todayPlan(words, p, 500, DAILY_GOAL, NOON);
  assert.ok(second.words.every((w) => !stats[w.No]));
  assert.equal(second.words.length, 0);
});

test("今日学習した数は、今日の記録だけを数える", () => {
  const p = {
    mastered: [1],
    notYet: [2],
    stats: { 1: { miss: 0, seen: NOON - 60_000 }, 2: { miss: 1, seen: NOON - DAY } },
  };
  assert.equal(studiedToday(p, NOON), 1);
});


// ---- 間隔反復 ----

test("覚えたを重ねるたびに段階が上がり、次の復習が 1 → 3 → 7 日後と延びる", () => {
  let p = { mastered: [], notYet: [], stats: {} };
  let t = NOW;
  for (let i = 1; i <= 3; i++) {
    p = mark(p, 1, true, t);
    assert.equal(p.stats[1].step, i);
    assert.equal(daysUntilDue(p.stats[1], t), INTERVAL_DAYS[i]);
    assert.equal(isDue(p, 1, t), false);
    t = p.stats[1].due + 60_000; // 時期が来たらすぐ復習
    assert.equal(isDue(p, 1, t), true);
  }
});

test("時期の前に見た「覚えた」は段階を上げない（同じ日に何度見ても間隔が延びない）", () => {
  const p = mark({ mastered: [], notYet: [], stats: {} }, 1, true, NOW);
  const again = mark(p, 1, true, NOW + 60_000);
  assert.deepEqual([again.stats[1].step, again.stats[1].due], [p.stats[1].step, p.stats[1].due]);
});

test("長く放っても思い出せた単語は、経過した日数に見合う段まで一気に上がる", () => {
  const p = mark({ mastered: [], notYet: [], stats: {} }, 1, true, NOW); // 段階 1
  const later = mark(p, 1, true, NOW + 60 * DAY); // 60 日後に正解 → 60 日の段(6)の次
  assert.equal(later.stats[1].step, 7);
  assert.ok(later.stats[1].step <= MAX_STEP);
});

test("答えを見ずに覚えた初見の単語は 7 日後の段から。見てから覚えたら翌日", () => {
  const sure = mark({ mastered: [], notYet: [], stats: {} }, 1, true, NOW, { confident: true });
  assert.equal(sure.stats[1].step, CONFIDENT_STEP);
  const seen = mark({ mastered: [], notYet: [], stats: {} }, 1, true, NOW);
  assert.equal(seen.stats[1].step, 1);
});

test("「まだ」は段階を 2 つ下げ（全部は戻さない）、すぐ出す。定着は段階 5 から", () => {
  let p = { mastered: [1], notYet: [], stats: { 1: { miss: 0, seen: NOW - DAY, step: 5, due: NOW } } };
  assert.equal(isRetained(p, 1), true);
  p = mark(p, 1, false, NOW);
  assert.deepEqual([p.stats[1].step, p.stats[1].due, p.notYet, isRetained(p, 1)], [3, NOW, [1], false]);
});

test("答えを見ただけ（判定なし）は seen だけ更新し、覚えた単語には何もしない", () => {
  const p = touch({ mastered: [], notYet: [2], stats: { 2: { miss: 1, seen: NOW - DAY, step: 0, due: NOW - DAY } } }, 2, NOW);
  assert.deepEqual(p.stats[2], { miss: 1, seen: NOW, step: 0, due: NOW - DAY });
  assert.equal(studiedToday(p, NOW), 1);
  const m = { mastered: [1], notYet: [], stats: { 1: { miss: 0, seen: NOW - 9 * DAY, step: 3, due: NOW - 2 * DAY } } };
  assert.equal(touch(m, 1, NOW), m);
});

test("4択の選択肢に、語義の重なる単語（顧客／顧客、取引先）は使わない", () => {
  assert.equal(meaningsOverlap("顧客", "顧客、取引先"), true);
  assert.equal(meaningsOverlap("請求書", "請求書（代金の）"), true);
  assert.equal(meaningsOverlap("顧客", "取引先"), false);
  const target = words.find((w) => w.word === "customer");
  for (let i = 0; i < 20; i++) {
    const [q] = quizFrom([target], words.filter((w) => w.score_band === 500), words);
    for (const choice of q.choices) if (choice !== target.meaning) assert.equal(meaningsOverlap(choice, target.meaning), false);
  }
});

test("復習が溜まりすぎている（60 語超）か、おさらい指定なら、新しい単語を出さない", () => {
  const due = band500.slice(0, CATCH_UP_DUE + 5);
  const stats = Object.fromEntries(due.map((id) => [id, { miss: 0, seen: NOON - 10 * DAY, step: 3, due: NOON - 3 * DAY }]));
  const plan = todayPlan(words, { mastered: due, notYet: [], stats }, 500, DAILY_GOAL, NOON);
  assert.deepEqual([plan.fresh, plan.review, plan.words.length], [0, 20, 20]);
  const few = band500.slice(0, 3);
  const stats2 = Object.fromEntries(few.map((id) => [id, { miss: 0, seen: NOON - 10 * DAY, step: 3, due: NOON - 3 * DAY }]));
  const catchUp = todayPlan(words, { mastered: few, notYet: [], stats: stats2 }, 500, DAILY_GOAL, NOON, Math.random, { catchUp: true });
  assert.deepEqual([catchUp.fresh, catchUp.review, catchUp.words.length], [0, 3, 3]);
});

test("復習は段階の低い（記憶が不安定な）単語から", () => {
  const [a, b, c] = band500;
  const stats = {
    [a]: { miss: 0, seen: NOON - 20 * DAY, step: 4, due: NOON - 6 * DAY },
    [b]: { miss: 0, seen: NOON - 2 * DAY, step: 1, due: NOON - DAY },
    [c]: { miss: 0, seen: NOON - 5 * DAY, step: 2, due: NOON - 2 * DAY },
  };
  const plan = todayPlan(words, { mastered: [a, b, c], notYet: [], stats }, 500, DAILY_GOAL, NOON);
  assert.deepEqual(plan.words.slice(0, 3).map((w) => w.No), [b, c, a]);
});
test("今日の学習: 目標達成後の「さらに10語」は、新しい単語の上限を超えて出せる", () => {
  const first = todayPlan(words, { mastered: [], notYet: [] }, 500, DAILY_GOAL, NOON);
  let p = { mastered: [], notYet: [] };
  for (const w of first.words) p = mark(p, w.No, true, NOON);
  assert.equal(todayPlan(words, p, 500, 10, NOON).words.length, 0);
  const more = todayPlan(words, p, 500, 10, NOON, Math.random, { more: true });
  assert.equal(more.words.length, 10);
  assert.equal(more.fresh, 10);
  assert.ok(more.words.every((w) => !first.words.includes(w)));
});

test("更新で一度に復習の時期が来た「覚えた」単語は、14日に分けて出す（段階の記録がある単語は動かさない）", () => {
  const many = band500.slice(0, 28);
  const raw = JSON.stringify({ version: 1, mastered: many, notYet: [] });
  const p = parseProgress(raw, ids, NOON);
  const dueDays = new Set(many.map((id) => Math.round((p.stats[id].due - startOfDay(NOON)) / DAY)));
  assert.ok(dueDays.size >= 10, `${dueDays.size} 日に分かれる`);
  assert.ok(many.every((id) => p.stats[id].due >= startOfDay(NOON) && p.stats[id].due < startOfDay(NOON) + 14 * DAY));
  assert.ok(todayPlan(words, p, 500, DAILY_GOAL, NOON).fresh >= 4, "更新直後でも新しい単語が出る");
  const kept = parseProgress(JSON.stringify({ version: 2, mastered: [1], notYet: [], stats: { 1: { miss: 0, seen: NOON - 30 * DAY, step: 4, due: NOON - 16 * DAY } } }), ids, NOON);
  assert.equal(kept.stats[1].due, NOON - 16 * DAY);
  // 未来の時刻は「いま」に丸める
  const future = parseProgress(JSON.stringify({ version: 2, mastered: [], notYet: [2], stats: { 2: { miss: 1, seen: NOON + 5 * DAY } } }), ids, NOON);
  assert.equal(future.stats[2].seen, NOON);
});

test("復習に失敗しても、新しい単語の上限は減らない（新しい単語は「初めて記録が付いた日」で数える）", () => {
  const old = band500.slice(0, 5);
  const stats = {};
  for (const id of old) stats[id] = { miss: 0, seen: NOON - 10 * DAY, step: 3, due: NOON - 3 * DAY };
  let p = { mastered: [...old], notYet: [], stats };
  for (const id of old) p = mark(p, id, false, NOON);
  assert.equal(newWordsToday(p, NOON), 0);
  assert.equal(studiedToday(p, NOON), 5);
  assert.equal(todayPlan(words, p, 500, DAILY_GOAL, NOON).fresh, NEW_WORDS_MAX);
});

test("答えを見ただけの語は、今日の学習数にも新しい単語にも数えない。判定すれば数える", () => {
  const id = band500[0];
  let p = touch({ mastered: [], notYet: [], stats: {} }, id, NOON);
  assert.equal(studiedToday(p, NOON), 0);
  assert.equal(newWordsToday(p, NOON), 0);
  assert.ok(!todayPlan(words, p, 500, DAILY_GOAL, NOON).words.some((w) => w.No === id), "同じ日にはもう出さない");
  p = mark(p, id, true, NOON);
  assert.equal(studiedToday(p, NOON), 1);
  assert.equal(newWordsToday(p, NOON), 1);
  assert.equal(p.stats[id].first, NOON);
});
