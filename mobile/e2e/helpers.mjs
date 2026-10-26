// Web 版（expo export の dist/）をブラウザで動かす E2E の共通部品
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff2": "font/woff2" };

/** dist/ を配信する小さなサーバー（SPA なので見つからないものは index.html） */
export async function serveDist() {
  if (!existsSync(path.join(DIST, "index.html")))
    throw new Error("mobile/dist がありません。先に `npm run build:web` を実行してください。");
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = path.join(DIST, decodeURIComponent(url.pathname));
    if (!existsSync(file) || file.endsWith("/")) file = path.join(DIST, "index.html");
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

/** iPhone の代表的な画面サイズ（CSS px） */
export const SIZES = {
  se: { width: 375, height: 667 },
  std: { width: 390, height: 844 },
  max: { width: 430, height: 932 },
};

export async function launch() {
  return chromium.launch({ executablePath: process.env.E2E_CHROMIUM || undefined });
}

/**
 * 新しいページを開く。読み上げは記録するだけで音は出さない。
 * `storage` に localStorage の初期値を渡せる（既存ユーザーの保存データの再現など）。
 */
export async function openPage(browser, url, { size = SIZES.std, scheme = "light", storage = {}, touch = false } = {}) {
  const ctx = await browser.newContext({
    viewport: size,
    colorScheme: scheme,
    deviceScaleFactor: 2,
    hasTouch: touch,
    isMobile: touch,
  });
  await ctx.addInitScript((storage) => {
    const ss = window.speechSynthesis;
    if (ss) {
      ss.speak = (u) => { (window.__spoken = window.__spoken || []).push(u.text); setTimeout(() => u.onend && u.onend(new Event("end")), 5); };
      ss.cancel = () => {};
    }
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, storage);
  const page = await ctx.newPage();
  // 見つからない要素は早めに諦める（失敗の原因がすぐ分かるように）
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForTimeout(600);
  return {
    page,
    ctx,
    errors,
    body: () => page.textContent("body"),
    spoken: () => page.evaluate(() => window.__spoken || []),
    storage: (key) => page.evaluate((k) => localStorage.getItem(k), key),
    tapCenter: async (y = 0.6) => { const v = page.viewportSize(); await page.mouse.click(v.width / 2, Math.round(v.height * y)); await page.waitForTimeout(250); },
    swipe: async (dx, y = 0.55) => {
      const v = page.viewportSize(); const x = v.width / 2; const yy = Math.round(v.height * y);
      await page.mouse.move(x, yy); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, yy);
      await page.mouse.up(); await page.waitForTimeout(400);
    },
    close: () => ctx.close(),
  };
}

/** 小さなテストランナー（node:test は使わず、順番に流して件数を数える） */
export function suite(name) {
  const results = [];
  return {
    async test(title, fn) {
      try { await fn(); results.push({ title, ok: true }); console.log(`  ✓ ${title}`); }
      catch (e) { results.push({ title, ok: false, error: e }); console.log(`  ✗ ${title}\n    ${String(e.message || e).slice(0, 700).replace(/\n/g, "\n    ")}`); }
    },
    report() {
      const fail = results.filter((r) => !r.ok);
      console.log(`${name}: ${results.length - fail.length} / ${results.length} 件成功`);
      return fail.length === 0;
    },
  };
}
