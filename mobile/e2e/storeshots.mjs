// App Store 用のスクリーンショット（1206×2622、6枚）を作る。Web 版の画面を撮り、見出しと iPhone の枠を付ける。
// 実行: npm run build:web && node e2e/storeshots.mjs <出力先>（素材だけ見るときは --raw を付ける）
// 1日目に10語を学習してから、時計を2日目に進めて撮る（2日目は 復習 + 新しい単語 = 20語になる）。
import { mkdirSync, writeFileSync } from "node:fs";
import { serveDist, launch } from "./helpers.mjs";

const out = process.argv[2] || "storeshots";
const rawOnly = process.argv.includes("--raw");
mkdirSync(out, { recursive: true });

// 画面の大きさ（CSS px）。iPhone 16 Pro / 17 の 402×874 から、枠側で描くステータスバーの 54px を引いた高さ
const SCREEN = { width: 402, height: 820 };
const DAY1 = new Date("2026-10-26T08:00:00+09:00");
const DAY2 = new Date("2026-10-27T08:00:00+09:00");

/** 見出し（1行ずつ）。sub は小さい2段目、badge は1枚目の帯 */
const SLIDES = [
  { key: "home", lines: ["目標スコアを選ぶだけで", "今日の20語が決まる"], badge: "登録不要・広告なし" },
  { key: "resume", lines: ["途中でやめても", "続きから"] },
  { key: "undo", lines: ["右へスワイプで「覚えた」", "左へ「まだ」"], sub: "4秒以内なら取り消せる" },
  { key: "answer", lines: ["答えを開くと", "例文も自動で読み上げ"] },
  { key: "listen", lines: ["耳だけ復習", "単語 → 意味 → 例文"] },
  { key: "result", lines: ["今日はここまで", "明日の予定もわかる"] },
];

const server = await serveDist();
const browser = await launch();
const ctx = await browser.newContext({ viewport: SCREEN, deviceScaleFactor: 3, colorScheme: "light" });
// 読み上げは音を出さない。耳だけ復習を撮るときは、読み終わらせずに止めておく（window.__hold）
await ctx.addInitScript(() => {
  const ss = window.speechSynthesis;
  if (ss) {
    ss.speak = (u) => { if (!window.__hold) setTimeout(() => u.onend && u.onend(new Event("end")), 5); };
    ss.cancel = () => {};
  }
});
// 時計は止めずに日付だけ合わせる（止めると、判定の直後に入力を受け付けない 250ms が終わらない）
await ctx.clock.install({ time: DAY1 });
let page = await ctx.newPage();
page.setDefaultTimeout(8000);
const wait = (ms = 350) => page.waitForTimeout(ms);
const learned = () => page.getByLabel("覚えたとして保存して次へ").click();
const notYet = () => page.getByLabel("まだとして保存して次へ").click();
const tapCenter = async () => { await page.mouse.click(SCREEN.width / 2, Math.round(SCREEN.height * 0.55)); await wait(250); };
const raw = {};
const grab = async (key) => {
  await wait(500);
  raw[key] = await page.screenshot();
  writeFileSync(`${out}/raw_${key}.png`, raw[key]);
};
const resultShown = async () => (await page.getByText("今日はここまで", { exact: true }).filter({ visible: true }).count()) > 0;
/**
 * 結果の画面が出るまで、答えを開いてから「覚えた」で進める。
 * 答えを開かずに「覚えた」にすると「もう知っている語」として1週間先まで出ないので、翌日の復習に入れるために開く。
 * 「まだ」はその場でまた出てくるので使わない。
 */
const finish = async () => {
  for (let i = 0; i < 40; i++) {
    if (await resultShown()) return;
    await tapCenter();
    await learned();
    await wait(300);
  }
  throw new Error("結果の画面が出ませんでした");
};
const done = () => page.getByText("今日はここまで", { exact: true }).filter({ visible: true }).last().click();

// 1日目: 目標700点で、今日の10語を学習する
await page.goto(server.url);
await wait(800);
await page.getByLabel("目標スコア 700点").click();
await wait();
await page.getByText(/今日の学習を始める/).click();
await wait();
await finish();
await done();
await wait();

// 2日目: 復習と新しい単語で20語
// 一度閉じて、翌朝に開き直したところを撮る
await page.close();
await ctx.clock.setSystemTime(DAY2);
page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.goto(server.url);
await wait(800);
await grab("home");
await page.getByText(/今日の学習を始める/).click();
await wait();
await tapCenter();
await grab("answer");
await learned();
await wait(200);
// 2枚目の答えを開いて右へ少しスワイプした途中（「覚えた」のスタンプと、1枚目の「取り消す」が並ぶ）
await tapCenter();
const cx = SCREEN.width / 2, cy = Math.round(SCREEN.height * 0.4);
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(cx + i * 15, cy + i * 2);
await grab("undo");
for (let i = 5; i >= 0; i--) await page.mouse.move(cx + i * 15, cy + i * 2);
await page.mouse.up();
await wait();
await notYet();
await wait();
await tapCenter();
await learned();
await wait();
await page.getByLabel("戻る").first().click();
await wait();
await grab("resume");
await page.getByText(/続きから/).click();
await wait();
await finish();
await grab("result");
await done();
await wait();
await page.evaluate(() => { window.__hold = true; });
await page.getByText(/耳だけ復習/).first().click();
await wait(800);
await grab("listen");

await ctx.close();
await server.close();
if (rawOnly) {
  await browser.close();
  console.log(`素材の保存先: ${out}`);
  process.exit(0);
}

// 見出しと枠を付ける（1206×2622）
const frame = await browser.newPage({ viewport: { width: 1206, height: 2622 }, deviceScaleFactor: 1 });
for (const [i, s] of SLIDES.entries()) {
  await frame.setContent(slideHtml(s, raw[s.key].toString("base64")));
  await frame.waitForTimeout(300);
  await frame.screenshot({ path: `${out}/${i + 1}.png` });
}
await browser.close();
console.log(`保存先: ${out}（1.png〜${SLIDES.length}.png）`);

function slideHtml(s, png) {
  // 枠の寸法は、画面の幅（SW）と iPhone の画面（402×874pt）の比から決める
  const SW = 892;
  const k = SW / SCREEN.width;
  const statusH = Math.round(54 * k);
  const shotH = Math.round(SCREEN.height * k);
  const bezel = 24;
  const radius = Math.round(55 * k);
  const top = s.sub || s.badge ? 600 : 560;
  const sub = s.sub ? `<div class="sub">${s.sub}</div>` : "";
  const badge = s.badge ? `<div class="badge">${s.badge}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1206px;height:2622px;overflow:hidden;background:#ffd43b;position:relative;
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}
  .blob{position:absolute;border-radius:120px}
  .coral{left:-150px;top:1040px;width:330px;height:330px;background:#fd7566;transform:rotate(-14deg)}
  .blue{right:-150px;top:1960px;width:330px;height:330px;background:#5daee4;transform:rotate(12deg)}
  .head{position:absolute;left:0;right:0;top:${s.badge ? 100 : 140}px;text-align:center;color:#1c3d8c}
  .line{font-size:96px;font-weight:800;line-height:1.3;letter-spacing:2px}
  .sub{font-size:60px;font-weight:800;margin-top:14px}
  .badge{display:inline-block;margin-top:24px;padding:10px 40px;border-radius:999px;background:#1c3d8c;color:#fff;font-size:46px;font-weight:700;letter-spacing:4px}
  .phone{position:absolute;left:${(1206 - SW - bezel * 2) / 2}px;top:${top}px;padding:${bezel}px;background:#15181c;
    border-radius:${radius + bezel}px;box-shadow:0 30px 80px rgba(80,60,0,.25)}
  .screen{width:${SW}px;height:${statusH + shotH}px;border-radius:${radius}px;overflow:hidden;position:relative;background:#f5f6f2}
  .status{height:${statusH}px;display:flex;align-items:center;justify-content:space-between;padding:${Math.round(statusH * 0.18)}px 70px 0 100px;color:#111;
    font-family:-apple-system,"SF Pro Text","Helvetica Neue",sans-serif;font-weight:600;font-size:38px}
  .island{position:absolute;top:${Math.round(11 * k)}px;left:50%;transform:translateX(-50%);width:${Math.round(125 * k)}px;height:${Math.round(37 * k)}px;border-radius:${Math.round(19 * k)}px;background:#000}
  .shot{display:block;width:${SW}px;height:${shotH}px}
  .home{position:absolute;bottom:${Math.round(8 * k)}px;left:50%;transform:translateX(-50%);width:${Math.round(139 * k)}px;height:${Math.round(5 * k)}px;border-radius:6px;background:#111}
  </style></head><body>
  <div class="blob coral"></div><div class="blob blue"></div>
  <div class="head">${s.lines.map((l) => `<div class="line" style="font-size:${lineSize(l)}px">${l}</div>`).join("")}${sub}${badge}</div>
  <div class="phone"><div class="screen">
    <div class="status"><span>9:41</span><span>${icons()}</span></div>
    <div class="island"></div>
    <img class="shot" src="data:image/png;base64,${png}">
    <div class="home"></div>
  </div></div>
  </body></html>`;
}

/** 見出しの文字の大きさ。長い行は、左右に余白が残るよう小さくする（全角1文字 ≒ 1em） */
function lineSize(line) {
  return Math.min(96, Math.floor(1040 / [...line].length));
}

function icons() {
  const bars = [10, 16, 22, 28].map((h, i) => `<rect x="${i * 11}" y="${28 - h}" width="8" height="${h}" rx="2" fill="#111"/>`).join("");
  return `<svg width="44" height="28" viewBox="0 0 44 28" style="margin-right:16px">${bars}</svg>` +
    `<svg width="40" height="28" viewBox="0 0 40 28" style="margin-right:16px"><path d="M20 26l5-6a8 8 0 0 0-10 0z M9 14a16 16 0 0 1 22 0l-3 3a12 12 0 0 0-16 0z M3 8a24 24 0 0 1 34 0l-3 3a20 20 0 0 0-28 0z" fill="#111"/></svg>` +
    `<svg width="62" height="28" viewBox="0 0 62 28"><rect x="1" y="3" width="54" height="22" rx="7" fill="none" stroke="#111" stroke-width="2" opacity=".45"/><rect x="5" y="7" width="46" height="14" rx="4" fill="#111"/><rect x="57" y="10" width="4" height="8" rx="2" fill="#111" opacity=".45"/></svg>`;
}
