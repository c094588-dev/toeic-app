# Claude への指示

## 言語（最重要）
- **ユーザーへの返答・説明・質問・報告は、すべて日本語で書く。** 英語で返答しない（何度も指摘されている）。
- コミットメッセージ・PRのタイトルと本文・コードのコメントも日本語で書く。
- コード中の識別子（変数名・関数名など）は英語のままでよい。

## 進め方
- 作業は `claude/busy-gates-pwhg2v` ブランチで行い、`main` へのPRを作る。
- PRを作ったら、Cloudflare のプレビュー（https://claude-busy-gates-pwhg2v-toeic-app.trainer-jonny.workers.dev）のビルド完了を待ち、URLを伝えて確認してもらう。
- **「マージして」と言われるまでマージしない。** マージ後は本番ビルドの成功（check run の summary に `Version ID` が出る）を確認して報告する。
- `main` への push のたびに、Cloudflare は本番用とプレビュー用（`previews/main`）の2つのビルドを動かす。本番に出たかは `Version ID` 付きの方で判断する。

## プロジェクト
- アプリ本体は `mobile/`（React Native + Expo）。単語データは直下の `words.json`（1,500語）。
- 確認コマンド（`mobile/` で実行）: `npm run check`（型チェック＋単体テスト）、`npm run build:web && npm run e2e`（Web 版の E2E。Chromium は `E2E_CHROMIUM=/opt/pw-browsers/chromium` で指定できる）、`npm run shots -- <出力先>`（スクリーンショット）
- 設計の背景と残作業は `docs/`（特に `docs/NEXT_ACTIONS.md`、`docs/QA_REPORT.md`）を先に読む。
- 本番: https://toeic-app.trainer-jonny.workers.dev （Cloudflare Workers Builds、本番ブランチは `main`）
- 詳しくは [README.md](README.md)、[mobile/README.md](mobile/README.md)、[mobile/CLOUDFLARE.md](mobile/CLOUDFLARE.md)。
