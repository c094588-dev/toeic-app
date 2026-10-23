// appstore/report.mjs のテスト（API には接続しない）
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { makeToken, parseReport, summarizeDay, formatReport, shiftDate, yesterdayPT, APP_ID } from "./report.mjs";

test("トークンは ES256 で署名され、Apple が求める項目を持つ", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const token = makeToken({ keyId: "ABC123", issuerId: "issuer-1", privateKeyPem: pem, now: 1_700_000_000_000 });
  const [h, p, s] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "ES256", kid: "ABC123", typ: "JWT" });
  const payload = JSON.parse(Buffer.from(p, "base64url"));
  assert.equal(payload.iss, "issuer-1");
  assert.equal(payload.aud, "appstoreconnect-v1");
  assert.equal(payload.exp - payload.iat, 1200);
  const ok = verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  assert.ok(ok);
});

const sample = [
  ["Provider", "Product Type Identifier", "Units", "Country Code", "Apple Identifier"].join("\t"),
  ["APPLE", "1", "3", "JP", APP_ID].join("\t"),
  ["APPLE", "1", "1", "US", APP_ID].join("\t"),
  ["APPLE", "3", "2", "JP", APP_ID].join("\t"),
  ["APPLE", "7", "5", "JP", APP_ID].join("\t"),
  ["APPLE", "1", "9", "JP", "999"].join("\t"),
].join("\n");

test("レポートを読み、このアプリの新規・再ダウンロード・アップデートを数える", () => {
  const rows = parseReport(sample);
  assert.equal(rows.length, 5);
  assert.deepEqual(summarizeDay(rows), {
    firstDownload: 4,
    redownload: 2,
    update: 5,
    byCountry: { JP: 3, US: 1 },
  });
});

test("日付の計算", () => {
  assert.equal(shiftDate("2026-10-31", 1), "2026-11-01");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  // 日本時間の 10/23 08:00 は、太平洋時間ではまだ 10/22 なので「昨日」は 10/21
  assert.equal(yesterdayPT(new Date("2026-10-22T23:00:00Z")), "2026-10-21");
});

test("日本語のレポートに合計・前の期間との差・累計・集計中が出る", () => {
  const day = (date, n) => ({ date, summary: { firstDownload: n, redownload: 0, update: 0, byCountry: { JP: n } } });
  const text = formatReport({
    recent: [day("2026-10-21", 5), day("2026-10-22", 3), { date: "2026-10-23", summary: null }],
    previous: [day("2026-10-18", 1)],
    sinceRelease: [day("2026-10-21", 5), day("2026-10-22", 3)],
    latest: "2026-10-23",
  });
  assert.match(text, /新規ダウンロード: \*\*8件\*\*（その前の1日間は 1件、\+7件）/);
  assert.match(text, /累計: \*\*8件\*\*/);
  assert.match(text, /JP 8件/);
  assert.match(text, /\| 2026-10-23 \| 集計中/);
});
