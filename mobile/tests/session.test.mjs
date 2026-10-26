// 学習の途中位置（セッション）の保存・復元のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSession, serializeSession, sessionRemaining } from "../src/session.ts";
const words = JSON.parse(readFileSync(new URL("../../words.json", import.meta.url)));
const byId = new Map(words.map((w) => [w.No, w]));
const now = new Date("2026-10-25T12:00:00").getTime();
const session = {
  mode: "today",
  band: 500,
  ids: [1, 2, 3, 4, 5],
  index: 2,
  reverse: false,
  tally: { learned: 1, notYet: 1, skipped: 0 },
  startedAt: now - 60_000,
  updatedAt: now - 30_000,
};

test("保存した途中位置を同じ内容で読み戻せる", () => {
  assert.deepEqual(parseSession(serializeSession(session), byId, now), session);
  assert.equal(sessionRemaining(session), 3);
});

test("壊れたデータ・前の日のデータ・残りがないデータは null", () => {
  assert.equal(parseSession(null, byId, now), null);
  assert.equal(parseSession("{", byId, now), null);
  assert.equal(parseSession(JSON.stringify({ version: 2, ...session }), byId, now), null);
  assert.equal(parseSession(serializeSession({ ...session, mode: "bogus" }), byId, now), null);
  // 前の日の夜に保存したものは、翌朝には復元しない。同じ日の朝のものは復元する
  assert.equal(parseSession(serializeSession({ ...session, updatedAt: new Date("2026-10-24T23:50:00").getTime() }), byId, now), null);
  assert.ok(parseSession(serializeSession({ ...session, updatedAt: new Date("2026-10-25T00:10:00").getTime() }), byId, now));
  assert.equal(parseSession(serializeSession({ ...session, index: 5 }), byId, now), null);
});

test("消えた単語は飛ばし、位置を詰め直す", () => {
  const raw = serializeSession({ ...session, ids: [1, 2, 999_999, 4, 5], index: 2 });
  const restored = parseSession(raw, byId, now);
  assert.deepEqual(restored.ids, [1, 2, 4, 5]);
  assert.equal(restored.index, 2);
  assert.equal(sessionRemaining(restored), 2);
});
