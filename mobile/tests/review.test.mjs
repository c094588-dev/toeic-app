// レビュー依頼のタイミングのテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyReviewState, onGoalReached, parseReviewState, ASK_AFTER_GOALS, ASK_INTERVAL_DAYS } from "../src/review.ts";
const DAY = 24 * 60 * 60 * 1000;
const t0 = 1_800_000_000_000;

test("3回目の目標達成で初めて頼み、そのあと120日は頼まない", () => {
  let s = emptyReviewState();
  for (let i = 1; i < ASK_AFTER_GOALS; i++) {
    const r = onGoalReached(s, t0 + i * DAY);
    assert.equal(r.ask, false, `${i}回目`);
    s = r.state;
  }
  let r = onGoalReached(s, t0 + 3 * DAY);
  assert.equal(r.ask, true);
  assert.deepEqual(r.state.asked, [t0 + 3 * DAY]);
  r = onGoalReached(r.state, t0 + 50 * DAY);
  assert.equal(r.ask, false);
  r = onGoalReached(r.state, t0 + (3 + ASK_INTERVAL_DAYS) * DAY);
  assert.equal(r.ask, true);
});

test("1年に3回まで", () => {
  let s = { goals: 10, asked: [t0, t0 + 130 * DAY, t0 + 260 * DAY] };
  assert.equal(onGoalReached(s, t0 + 364 * DAY).ask, false);
  // 最初の依頼から1年たてば、また頼める
  assert.equal(onGoalReached(s, t0 + 390 * DAY).ask, true);
});

test("壊れた保存データは空から始める", () => {
  assert.deepEqual(parseReviewState(null), { goals: 0, asked: [] });
  assert.deepEqual(parseReviewState("{bad"), { goals: 0, asked: [] });
  assert.deepEqual(parseReviewState(JSON.stringify({ goals: 2, asked: [1, "x"] })), { goals: 2, asked: [1] });
});
