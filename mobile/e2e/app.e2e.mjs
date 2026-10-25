// Web 版（dist/）をブラウザで動かして、主要な流れを通す E2E。
// 実行: npm run build:web && npm run e2e
import assert from "node:assert/strict";
import { serveDist, launch, openPage, SIZES, suite } from "./helpers.mjs";

const server = await serveDist();
const browser = await launch();
const s = suite("E2E");
const BACK = "戻る";
const text = async (t) => (await t.body()).replace(/\s+/g, " ");

// ---- 初回起動 → 目標 → 今日の学習 → 中断と再開 → 結果 ----
{
  const t = await openPage(browser, server.url);
  const { page } = t;
  await s.test("初回起動: 目標スコアを選ぶ画面が出て、エラーがない", async () => {
    assert.match(await text(t), /目標スコアは？/);
    const chip = await page.getByLabel("目標スコア 500点").boundingBox();
    assert.ok(chip && chip.height <= 52, `目標のチップが1行に収まる (${chip?.height})`);
    assert.deepEqual(t.errors, []);
  });
  await s.test("目標を選ぶと今日の学習が組まれ、設定が保存される", async () => {
    await page.getByLabel("目標スコア 600点").click();
    await page.waitForTimeout(300);
    const body = await text(t);
    assert.match(body, /今日の学習/);
    assert.match(body, /0 \/ 10語/, "初日は新しい単語10語が目標");
    assert.match(body, /今日の学習を始める（10語）/);
    assert.equal(JSON.parse(await t.storage("toeic.settings.v1")).target, 600);
  });
  let firstWord = "";
  await s.test("学習: タップで意味、ボタンで判定、取り消しで戻る", async () => {
    await page.getByText(/今日の学習を始める/).click();
    await page.waitForTimeout(400);
    assert.match(await text(t), /1 \/ 10/);
    const session = JSON.parse(await t.storage("toeic.session.v1"));
    firstWord = session.ids[0];
    assert.match(await text(t), /タップで意味を見る/);
    assert.equal(await page.getByLabel("意味を見る").count(), 1, "VoiceOver 用の「意味を見る」ボタンがある");
    await t.tapCenter(0.55);
    assert.match(await text(t), /タップで飛ばす/, "答えが出てヒントが変わる");
    assert.equal(await page.getByLabel("次のカードへ").count(), 1);
    await page.getByLabel("覚えたとして保存して次へ").click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /2 \/ 10/);
    assert.match(await text(t), /を覚えたにしました/);
    await page.getByText("取り消す").click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /1 \/ 10/, "取り消すと前のカードに戻る");
    const progress = JSON.parse(await t.storage("toeic.progress.v1"));
    assert.deepEqual(progress.mastered, [], "取り消したので記録は残らない");
  });
  await s.test("学習: 左スワイプで「まだ」。記録に段階と次回の時期が付く", async () => {
    await t.swipe(-160);
    assert.match(await text(t), /2 \/ 10/);
    const progress = JSON.parse(await t.storage("toeic.progress.v1"));
    assert.deepEqual(progress.notYet, [firstWord]);
    const stat = progress.stats[firstWord];
    assert.equal(stat.miss, 1);
    assert.equal(typeof stat.step, "number");
    assert.equal(typeof stat.due, "number");
  });
  await s.test("中断と再開: 画面を閉じても「続きから」で同じ位置に戻る", async () => {
    await page.reload();
    await page.waitForTimeout(800);
    const body = await text(t);
    assert.match(body, /続きから（1 \/ 10）/);
    assert.match(body, /1 \/ 10語/, "今日の学習数も残っている");
    await page.getByText(/続きから/).click();
    await page.waitForTimeout(400);
    assert.match(await text(t), /2 \/ 10/);
    assert.deepEqual(t.errors, []);
  });
  await s.test("今日の学習を終えると結果が出て、まだの単語をもう一度できる", async () => {
    // 答えを見てから「覚えた」にする（見ずに覚えたにした語は「知っていた語」として、新しい単語の枠を使わない）
    for (let i = 0; i < 9; i++) {
      await t.tapCenter(0.55);
      await page.getByLabel("覚えたとして保存して次へ").click();
      await page.waitForTimeout(150);
    }
    const body = await text(t);
    assert.match(body, /今日はここまで/);
    assert.match(body, /覚えた 9・まだ 1/);
    assert.match(body, /今日の学習 10 \/ 10語 達成/);
    assert.match(body, /明日は 復習 \d+語/);
    assert.equal(await t.storage("toeic.session.v1"), null, "終わったら途中位置は消える");
    await page.getByText(/まだの単語をもう一度（1語）/).click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /1 \/ 1/);
    await t.tapCenter(0.55);
    await page.getByLabel("覚えたとして保存して次へ").click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /覚えた 1・まだ 0/);
    await page.getByText(/今日はここまで/).last().click();
    await page.waitForTimeout(300);
  });
  await s.test("達成後のホーム: 達成の表示、さらに10語、7日の点", async () => {
    const body = await text(t);
    assert.match(body, /今日の目標、達成/);
    assert.match(body, /さらに10語/);
    assert.match(body, /この7日で1日/);
    assert.doesNotMatch(body, /今日の学習を始める/);
    await page.getByText("さらに10語").click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /1 \/ 10/, "新しい単語の上限を超えて出せる");
    await page.getByLabel(BACK).click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /続きから（0 \/ 10）/);
    assert.deepEqual(t.errors, []);
  });
  await t.close();
}

// ---- レベル別: 覚える・逆向き・クイズ・耳だけ復習 ----
{
  const t = await openPage(browser, server.url, { storage: { "toeic.settings.v1": { target: 500, autoSpeak: true } } });
  const { page } = t;
  await s.test("レベル画面: 語数と学習の入口がそろっている", async () => {
    await page.getByText(/500点レベル/).first().click();
    await page.waitForTimeout(300);
    const body = await text(t);
    assert.match(body, /500語のうち 0語を習得/);
    assert.match(body, /覚えていない単語（500語）/);
    assert.match(body, /4択クイズ（10問）/);
    assert.match(body, /耳だけ復習（20語）/);
    assert.match(body, /このレベルに登録した単語/);
  });
  await s.test("日本語 → 英語: 答えを出すまで英単語を隠し、発音ボタンも押せない", async () => {
    await page.getByLabel("日本語から英単語を答える").click();
    await page.getByText(/覚えていない単語（500語）/).click();
    await page.waitForTimeout(300);
    const session = JSON.parse(await t.storage("toeic.session.v1"));
    assert.equal(session.reverse, true);
    assert.match(await text(t), /タップで英単語を見る/);
    assert.equal(await t.spoken().then((a) => a.length), 0, "逆向きでは自動発音しない");
    await t.tapCenter(0.55);
    assert.match(await text(t), /タップで飛ばす/);
    assert.ok((await t.spoken()).length > 0, "答えを出したら読み上げる");
    await page.getByLabel(BACK).click();
    await page.waitForTimeout(300);
    assert.equal(JSON.parse(await t.storage("toeic.settings.v1")).reverse, true, "向きは設定として残る");
    await page.getByLabel("英単語から日本語を答える").click();
  });
  await s.test("4択クイズ: 10問答えると結果。間違えた単語は「まだ」になる", async () => {
    await page.getByText(/4択クイズ（10問）/).click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /1 \/ 10/);
    for (let i = 0; i < 10; i++) {
      await page.locator("[role=button]").filter({ hasText: /^A/ }).first().click();
      await page.waitForTimeout(150);
      assert.match(await text(t), /正解|不正解/);
      await page.getByText("次へ", { exact: true }).click();
      await page.waitForTimeout(150);
    }
    const body = await text(t);
    assert.match(body, /クイズの結果/);
    assert.match(body, /\d+ \/ 10/);
    const correctCount = Number(body.match(/(\d+) \/ 10/)[1]);
    const progress = JSON.parse(await t.storage("toeic.progress.v1"));
    assert.equal(Object.keys(progress.stats).length, 10, "答えた単語には記録が付く");
    assert.equal(progress.notYet.length, 10 - correctCount, "間違えた単語は「まだ」になる");
    await page.getByText("メニューに戻る").click();
    await page.waitForTimeout(300);
  });
  await s.test("耳だけ復習: 単語 → 意味 → 例文を読み上げ、一時停止・次へ・終わるが効く", async () => {
    await page.getByText(/耳だけ復習（20語）/).click();
    await page.waitForTimeout(600);
    assert.match(await text(t), /耳だけ復習/);
    assert.match(await text(t), /1 \/ 20/);
    const spoken = await t.spoken();
    assert.ok(spoken.length >= 1, "読み上げが始まる");
    await page.getByLabel("一時停止").click();
    await page.waitForTimeout(200);
    assert.match(await text(t), /一時停止/);
    await page.getByLabel("再開").click();
    await page.getByText("次へ", { exact: true }).click();
    await page.waitForTimeout(400);
    assert.match(await text(t), /2 \/ 20/);
    await page.getByLabel(BACK).click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /500点レベル/);
    assert.deepEqual(t.errors, []);
  });
  await t.close();
}

// ---- マイ単語帳 ----
{
  const t = await openPage(browser, server.url, { storage: { "toeic.settings.v1": { target: 600, autoSpeak: false } } });
  const { page } = t;
  await s.test("マイ単語帳: 登録 → 学習 → 編集 → 削除", async () => {
    await page.getByText("マイ単語帳").first().click();
    await page.waitForTimeout(300);
    await page.getByText("単語を登録する").click();
    await page.waitForTimeout(300);
    await page.getByLabel("英単語").fill("deadline");
    await page.getByLabel("意味").fill("締め切り");
    await page.getByText("登録する", { exact: true }).click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /「deadline」をマイ単語帳に登録しました/);
    await page.getByLabel(BACK).click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /1語のうち 0語を習得/);
    await page.getByText(/覚えていない単語（1語）/).click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /自分で登録/);
    await page.getByLabel("覚えたとして保存して次へ").click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /覚えた 1/);
    await page.getByText("メニューに戻る").click();
    await page.waitForTimeout(300);
    await page.getByLabel(/deadline、締め切り。編集する/).click();
    await page.waitForTimeout(300);
    await page.getByText("この単語を削除する").click();
    assert.match(await text(t), /本当に削除する/);
    await page.getByText("本当に削除する").click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /まだ単語がありません/);
    const progress = JSON.parse(await t.storage("toeic.progress.v1"));
    assert.deepEqual(progress.mastered, [], "削除した単語の記録も消える");
    assert.deepEqual(t.errors, []);
  });
  await s.test("登録先をレベルにすると、そのレベルの学習に入る", async () => {
    await page.getByText("単語を登録する").click();
    await page.getByLabel("英単語").fill("synergy");
    await page.getByLabel("意味").fill("相乗効果");
    await page.getByLabel("登録先 700点レベル").click();
    await page.getByText("登録する", { exact: true }).click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /「synergy」を700点レベルに登録しました/);
    await page.getByLabel(BACK).click();
    await page.getByLabel(BACK).click();
    await page.waitForTimeout(300);
    await page.getByText(/700点レベル/).first().click();
    await page.waitForTimeout(300);
    assert.match(await text(t), /301語のうち/);
    assert.match(await text(t), /synergy/);
  });
  await t.close();
}

// ---- 既存ユーザーの保存データ ----
{
  const v1 = { version: 1, mastered: [1, 2, 3], notYet: [4] };
  const t = await openPage(browser, server.url, { storage: { "toeic.progress.v1": v1, "toeic.settings.v1": { target: 500, autoSpeak: false } } });
  await s.test("以前の保存形式（version 1）を読み、記録を1語も失わずに今日の学習に組む", async () => {
    const body = await text(t);
    // 覚えた 3 語は更新の分散で 1〜3 日後に回り、まだの 1 語がきょうの復習になる
    assert.match(body, /苦手 1語・復習 1語・新しい単語 10語/);
    assert.match(body, /苦手だけ復習（1語）/);
    const progress = JSON.parse(await t.storage("toeic.progress.v1"));
    assert.deepEqual(progress.mastered, [1, 2, 3]);
    assert.deepEqual(progress.notYet, [4]);
    assert.deepEqual(t.errors, []);
  });
  await t.close();
}

// ---- 画面サイズ・配色・アクセシビリティ ----
for (const [name, size] of Object.entries(SIZES)) {
  for (const scheme of name === "std" ? ["light", "dark"] : ["light"]) {
    const t = await openPage(browser, server.url, { size, scheme, storage: { "toeic.settings.v1": { target: 700, autoSpeak: false } } });
    const { page } = t;
    await s.test(`${name}/${scheme}: 主ボタンが画面内にあり、ボタンは44pt以上、名前がある`, async () => {
      const start = page.getByText(/今日の学習を始める/);
      const box = await start.boundingBox();
      assert.ok(box && box.y + box.height <= size.height, `主ボタンがスクロールなしで見える (${box?.y})`);
      const check = async () => {
        const buttons = await page.locator("[role=button]").all();
        for (const b of buttons) {
          const bb = await b.boundingBox();
          if (!bb || bb.width === 0) continue;
          const label = (await b.getAttribute("aria-label")) || (await b.textContent());
          assert.ok(label && label.trim(), "ボタンに名前がある");
          assert.ok(bb.height >= 44 || bb.width >= 44, `ボタンが小さすぎる: ${label} ${bb.width}x${bb.height}`);
        }
      };
      await check();
      await start.click();
      await page.waitForTimeout(300);
      await check();
      await t.tapCenter(0.55);
      await check();
      const mark = await page.getByLabel("覚えたとして保存して次へ").boundingBox();
      assert.ok(mark && mark.y + mark.height <= size.height, "判定ボタンが画面内");
      assert.deepEqual(t.errors, []);
    });
    await t.close();
  }
}

await browser.close();
await server.close();
process.exit(s.report() ? 0 : 1);
