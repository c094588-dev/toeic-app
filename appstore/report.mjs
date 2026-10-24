// App Store Connect API から英単語ノートのダウンロード数を取り出し、日本語のレポートにまとめる。
//
// 使い方: node appstore/report.mjs [--days 7] [--since 2026-10-21] [--json]
// 必要な環境変数:
//   ASC_KEY_ID          API キーの「キーID」
//   ASC_ISSUER_ID       API キーの「Issuer ID」
//   ASC_API_KEY_BASE64  ダウンロードした .p8 ファイルを base64 にした文字列
//   ASC_VENDOR_NUMBER   「支払いと財務報告」に表示されるベンダー番号
// API キーには、売上レポートを読める役割（Sales など）が必要。
import { createPrivateKey, sign } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const API = "https://api.appstoreconnect.apple.com";
/** App Store Connect のアプリID（英単語ノート） */
export const APP_ID = "6824718074";
/** 公開日（累計を数え始める日） */
export const RELEASE_DATE = "2026-10-21";

/** 売上レポートの「Product Type Identifier」の種類 */
const KINDS = {
  firstDownload: ["1", "1F", "1T"],
  redownload: ["3", "3F", "3T"],
  update: ["7", "7F", "7T"],
};

/** API に送るトークン（ES256 の JWT、有効期限は最長20分） */
export function makeToken({ keyId, issuerId, privateKeyPem, now = Date.now() }) {
  const base64url = (value) => Buffer.from(value).toString("base64url");
  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iss: issuerId, iat, exp: iat + 1200, aud: "appstoreconnect-v1" }),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(privateKeyPem),
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${signature.toString("base64url")}`;
}

/** タブ区切りのレポートを、見出しをキーにしたオブジェクトの配列にする */
export function parseReport(tsv) {
  const [head, ...lines] = tsv.trim().split(/\r?\n/);
  const keys = head.split("\t");
  return lines
    .filter((line) => line.trim())
    .map((line) => {
      const cells = line.split("\t");
      return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ""]));
    });
}

/** 1日分の行から、このアプリの新規・再ダウンロード・アップデートの数と国別の新規数を数える */
export function summarizeDay(rows, appId = APP_ID) {
  const day = { firstDownload: 0, redownload: 0, update: 0, byCountry: {} };
  for (const row of rows) {
    if (row["Apple Identifier"] !== appId) continue;
    const units = Number(row["Units"]) || 0;
    const type = row["Product Type Identifier"];
    for (const [kind, types] of Object.entries(KINDS)) {
      if (!types.includes(type)) continue;
      day[kind] += units;
      if (kind === "firstDownload") {
        const country = row["Country Code"] || "??";
        day.byCountry[country] = (day.byCountry[country] ?? 0) + units;
      }
    }
  }
  return day;
}

/** 日付（YYYY-MM-DD）を n 日ずらす */
export function shiftDate(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 太平洋時間（Apple のレポートの基準）での「昨日」 */
export function yesterdayPT(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
  return shiftDate(today, -1);
}

/**
 * 1日分の売上レポートを取得する。
 * 返り値: { status: "ok", rows } / { status: "none" }（その日のダウンロードが0件）/ { status: "pending" }（まだ集計中）
 */
async function fetchDay(date, token, vendorNumber) {
  const params = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportType]": "SALES",
    "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": vendorNumber,
    "filter[reportDate]": date,
    "filter[version]": "1_0",
  });
  const res = await fetch(`${API}/v1/salesReports?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" },
  });
  if (res.ok) return { status: "ok", rows: parseReport(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) };
  const text = await res.text();
  if (res.status === 404) return { status: /not available/i.test(text) ? "pending" : "none" };
  const hint =
    res.status === 401
      ? "（キーID・Issuer ID・鍵の中身が正しいか確認してください）"
      : res.status === 403
        ? "（API キーに売上レポートを読む権限がない可能性があります）"
        : "";
  throw new Error(`売上レポートを取得できませんでした（${date}、HTTP ${res.status}）${hint}\n${text.slice(0, 300)}`);
}

const total = (days, kind) => days.reduce((sum, d) => sum + (d.summary?.[kind] ?? 0), 0);

/** 取得した日ごとの集計を、日本語の Markdown にする */
export function formatReport({ recent, previous, sinceRelease, latest }) {
  const lines = [];
  const first = recent[0].date;
  lines.push(`## 英単語ノート ダウンロード数（${first} 〜 ${latest}）`, "");
  lines.push("| 日付 | 新規 | 再ダウンロード | アップデート |", "| --- | ---: | ---: | ---: |");
  for (const d of recent) {
    if (!d.summary) lines.push(`| ${d.date} | 集計中 | | |`);
    else lines.push(`| ${d.date} | ${d.summary.firstDownload} | ${d.summary.redownload} | ${d.summary.update} |`);
  }
  const now = total(recent, "firstDownload");
  const before = total(previous, "firstDownload");
  const diff = now - before;
  lines.push(
    "",
    `- この${recent.length}日間の新規ダウンロード: **${now}件**（その前の${previous.length}日間は ${before}件、${diff >= 0 ? "+" : ""}${diff}件）`,
    `- 公開（${RELEASE_DATE}）からの新規ダウンロードの累計: **${total(sinceRelease, "firstDownload")}件**`,
  );
  const byCountry = {};
  for (const d of recent)
    for (const [c, n] of Object.entries(d.summary?.byCountry ?? {})) byCountry[c] = (byCountry[c] ?? 0) + n;
  const top = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) lines.push(`- 国別（この${recent.length}日間の新規）: ${top.map(([c, n]) => `${c} ${n}件`).join("、")}`);
  if (recent.some((d) => !d.summary))
    lines.push("- 「集計中」の日は、Apple の集計がまだ終わっていません（1〜2日遅れで反映されます）。");
  return lines.join("\n");
}

function readEnv() {
  const env = (name) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
    return value;
  };
  return {
    keyId: env("ASC_KEY_ID"),
    issuerId: env("ASC_ISSUER_ID"),
    privateKeyPem: Buffer.from(env("ASC_API_KEY_BASE64"), "base64").toString("utf8"),
    vendorNumber: env("ASC_VENDOR_NUMBER"),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const days = Number(option("--days", "7"));
  const since = option("--since", RELEASE_DATE);
  const { vendorNumber, ...key } = readEnv();
  const token = makeToken(key);
  const latest = yesterdayPT();

  // 公開日（または前の期間の初日のうち早い方）から昨日まで、1日ずつ取得する
  const start = [since, shiftDate(latest, -(days * 2 - 1))].sort()[0];
  const all = [];
  for (let date = start; date <= latest; date = shiftDate(date, 1)) {
    const day = await fetchDay(date, token, vendorNumber);
    all.push({
      date,
      summary:
        day.status === "ok"
          ? summarizeDay(day.rows)
          : day.status === "none"
            ? summarizeDay([])
            : null,
    });
  }
  const recent = all.filter((d) => d.date > shiftDate(latest, -days));
  const previous = all.filter((d) => d.date <= shiftDate(latest, -days) && d.date > shiftDate(latest, -days * 2));
  const sinceRelease = all.filter((d) => d.date >= since);
  if (args.includes("--json")) console.log(JSON.stringify({ latest, recent, previous, sinceRelease }, null, 2));
  else console.log(formatReport({ recent, previous, sinceRelease, latest }));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
