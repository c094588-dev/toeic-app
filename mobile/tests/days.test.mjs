// 日ごとの学習記録のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpDay, dayKey, daysSinceLastStudy, lastSevenDays, parseDailyGoal, parseDayLog } from "../src/days.ts";
const noon = new Date("2026-10-25T12:00:00").getTime();

test("日付のキーはローカル日付", () => {
  assert.equal(dayKey(noon), "2026-10-25");
  assert.equal(dayKey(new Date("2026-10-25T00:30:00").getTime()), "2026-10-25");
});

test("学習するたびに今日の数が増え、60日より前は捨てる", () => {
  let log = bumpDay({}, noon);
  log = bumpDay(log, noon + 60_000);
  assert.deepEqual(log, { "2026-10-25": 2 });
  const old = { "2026-08-01": 5, "2026-10-20": 3 };
  assert.deepEqual(bumpDay(old, noon), { "2026-10-25": 1, "2026-10-20": 3 });
});

test("直近7日の点と、最後に学習してからの日数", () => {
  const log = { "2026-10-25": 1, "2026-10-23": 4, "2026-10-19": 2 };
  assert.deepEqual(lastSevenDays(log, noon), [true, false, false, false, true, false, true]);
  assert.equal(daysSinceLastStudy(log, noon), 0);
  assert.equal(daysSinceLastStudy({ "2026-10-10": 1 }, noon), 15);
  assert.equal(daysSinceLastStudy({}, noon), null);
});

test("壊れた保存データは空から", () => {
  assert.deepEqual(parseDayLog("{x"), {});
  assert.deepEqual(parseDayLog(JSON.stringify({ "2026-10-25": 3, bad: 1, "2026-10-24": -1 })), { "2026-10-25": 3 });
});

test("その日の目標: 今日の分だけ読み、別の日・壊れた値は捨てる", () => {
  const now = Date.now();
  assert.equal(parseDailyGoal(JSON.stringify({ day: dayKey(now), goal: 12 }), now), 12);
  assert.equal(parseDailyGoal(JSON.stringify({ day: dayKey(now - 86400000), goal: 12 }), now), null);
  assert.equal(parseDailyGoal(JSON.stringify({ day: dayKey(now), goal: 0 }), now), null);
  assert.equal(parseDailyGoal("{broken", now), null);
  assert.equal(parseDailyGoal(null, now), null);
});
