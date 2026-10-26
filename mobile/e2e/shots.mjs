// 主要画面のスクリーンショットを、画面サイズ・配色ごとに撮る（改善前／後の比較、ストア用の確認に使う）
// 実行: npm run build:web && node e2e/shots.mjs <出力先>
import { mkdirSync } from "node:fs";
import { serveDist, launch, openPage, SIZES } from "./helpers.mjs";

const out = process.argv[2] || "shots";
mkdirSync(out, { recursive: true });
const server = await serveDist();
const browser = await launch();
for (const [name, size] of Object.entries(SIZES)) {
  for (const scheme of name === "std" ? ["light", "dark"] : ["light"]) {
    const t = await openPage(browser, server.url, { size, scheme });
    const { page } = t;
    const shot = (n) => page.screenshot({ path: `${out}/${name}_${scheme}_${n}.png` });
    await page.waitForTimeout(400);
    await shot("0_first");
    await page.getByLabel("目標スコア 700点").click();
    await page.waitForTimeout(300);
    await shot("1_home");
    await page.getByText(/今日の学習を始める/).click();
    await page.waitForTimeout(400);
    await shot("2_card");
    await t.tapCenter(0.55);
    await shot("3_answer");
    await page.getByLabel("覚えたとして保存して次へ").click();
    await page.waitForTimeout(300);
    await shot("3b_undo");
    for (let i = 0; i < 9; i++) {
      await page.getByLabel(i % 3 === 2 ? "まだとして保存して次へ" : "覚えたとして保存して次へ").click();
      await page.waitForTimeout(300);
    }
    await shot("6_result");
    await page.getByText(/今日はここまで/).last().click();
    await page.waitForTimeout(300);
    await shot("1c_home_done");
    await page.getByText(/500点レベル/).first().click();
    await page.waitForTimeout(300);
    await shot("4_menu");
    await page.getByText(/4択クイズ/).first().click();
    await page.waitForTimeout(300);
    await shot("5_quiz");
    await page.locator("[role=button]").filter({ hasText: /^B/ }).first().click();
    await page.waitForTimeout(200);
    await shot("5b_quiz_answer");
    await page.getByLabel("戻る").click();
    await page.getByText(/耳だけ復習/).first().click();
    await page.waitForTimeout(500);
    await shot("8_listen");
    await page.getByLabel("戻る").click();
    await page.getByLabel("戻る").click();
    await page.getByLabel("設定").click();
    await page.waitForTimeout(300);
    await shot("7_settings");
    await page.getByLabel("戻る").click();
    await page.getByText("マイ単語帳").first().click();
    await page.waitForTimeout(300);
    await shot("9_mywords");
    await page.getByText("単語を登録する").click();
    await page.waitForTimeout(300);
    await shot("9b_wordform");
    await t.close();
  }
}
await browser.close();
await server.close();
console.log(`保存先: ${out}`);
