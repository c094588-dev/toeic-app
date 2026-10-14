# TOEIC 単語ノート

TOEIC 500〜900点レベルの英単語1,500語を、フラッシュカードと4択クイズで覚えるアプリです。React Native（Expo）で作っており、iOS・Android・Webに対応しています。

- 公開中のWeb版: https://toeic-app.trainer-jonny.workers.dev

## 構成

| パス | 内容 |
| --- | --- |
| `mobile/` | アプリ本体（Expo）。起動・テスト方法は [mobile/README.md](mobile/README.md) |
| `words.json` | 単語データ（1,500語、例文と日本語訳つき）。アプリが直接読み込む |
| `package.json` / `wrangler.jsonc` | Cloudflare でリポジトリ直下からビルド・公開するための入口。設定は [mobile/CLOUDFLARE.md](mobile/CLOUDFLARE.md) |

`main` ブランチを更新すると、Cloudflare Workers Builds で本番へ自動公開されます。

キッズ向けの英単語アプリは別リポジトリ（kids-word-app）で開発しています。
