// 耳だけ復習の読み上げ順と、途中で止める動きのテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { listenScript, runListen } from "../src/listen.ts";
const w = (No, word, example = "") => ({ No, word, meaning: `${word}の意味`, example, example_ja: "", score_band: 500, importance: "" });

test("英単語 → 間 → 日本語の意味 → 例文 の順で読む。例文がなければ飛ばす", () => {
  const s = listenScript(w(1, "invoice", "Please pay the invoice."));
  assert.deepEqual(s.map((u) => [u.text, u.lang]), [
    ["invoice", "en-US"],
    ["invoiceの意味", "ja-JP"],
    ["Please pay the invoice.", "en-US"],
  ]);
  assert.ok(s[0].pauseAfter >= 1000, "思い出す間がある");
  assert.equal(listenScript(w(2, "budget")).length, 2);
});

test("列を順に読み、止めたら途中でやめる", async () => {
  const spoken = [];
  let stopped = false;
  const speak = async (u) => {
    spoken.push(u.text);
    if (spoken.length === 4) stopped = true; // 2語目の最初の読み上げで止める
  };
  const shown = [];
  const done = await runListen(
    [w(1, "a", "ex a"), w(2, "b", "ex b"), w(3, "c")],
    speak,
    async () => {},
    { stopped: () => stopped, waitWhilePaused: async () => {} },
    (i) => shown.push(i),
  );
  assert.deepEqual(shown, [0, 1]);
  assert.deepEqual(spoken, ["a", "aの意味", "ex a", "b"]);
  assert.equal(done, 1);
});

test("一時停止中は次を読まない。再開したら続きから", async () => {
  const spoken = [];
  let paused = true;
  let resume;
  const control = {
    stopped: () => false,
    waitWhilePaused: () => (paused ? new Promise((r) => (resume = r)) : Promise.resolve()),
  };
  const run = runListen([w(1, "a")], async (u) => { spoken.push(u.text); }, async () => {}, control, () => {}, 0);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(spoken, []);
  paused = false;
  resume();
  assert.equal(await run, 1);
  assert.deepEqual(spoken, ["a", "aの意味"]);
});
