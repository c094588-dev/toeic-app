// 有料プランの土台: いまは無効で、すべての機能が無料のまま使えること
import { test } from "node:test";
import assert from "node:assert/strict";
import { PREMIUM_ENABLED, canUse, noEntitlement } from "../src/premium.ts";

test("課金は無効のまま（フラグが false）", () => {
  assert.equal(PREMIUM_ENABLED, false);
});

test("フラグが無効なら、未購入でも全機能を使える", () => {
  const none = noEntitlement();
  assert.deepEqual(none, { premium: false, source: "none", available: false });
  for (const feature of ["wordPacks", "backup", "insights"]) assert.equal(canUse(feature, none), true);
});
