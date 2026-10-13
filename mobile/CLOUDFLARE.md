# CloudflareでWeb版を公開する

Workers BuildsとGitHubを接続して公開する設定です。サーバー処理は使わず、ExpoのWeb出力だけを配信します。

## Cloudflare側の設定

Workers & Pagesからアプリケーションを作成し、GitHubリポジトリをインポートします。

| 項目 | 設定値 |
| --- | --- |
| リポジトリ | c094588-dev/toeic-app |
| 本番ブランチ | main |
| Worker名 | toeic-app |
| ルートディレクトリ | 空（リポジトリ直下）または mobile |
| ビルドコマンド | npm run build:web |
| デプロイコマンド | npx wrangler@4 deploy |

依存関係はmobile/package-lock.jsonからインストールされます。Worker名はwrangler.jsoncのnameと一致させます。アカウントはCloudflareの画面で選択し、認証情報をリポジトリに書き込まないでください。

公開が成功するとCloudflareに表示されるworkers.devのURLを共有できます。mainブランチへの更新は公開サイトへ自動反映されます。

## 確認事項

- iPhone Safariでレベル選択、カードの意味表示、次の単語への遷移を確認する。
- 単語と英文の音声ボタンが読み上げだけを行うことを確認する。
- 「覚えた」を記録し、ページ再読み込み後の進捗を確認する。
- 学習記録はブラウザ内保存。確認用URLから新URLへは自動移行されない。
- 同期・ログイン・オフライン対応は未実装。

## ローカル確認

```sh
cd mobile
npm ci
npm run build:web
npx wrangler@4 deploy --dry-run
```

## うまくいかないとき

ルートディレクトリはどちらの設定でもビルドできます。空の場合はリポジトリ直下の `package.json`（`mobile/` で `npm ci` とビルドを実行）と `wrangler.jsonc`（`mobile/dist` を配信）が使われ、`mobile` の場合は `mobile/` 内の同名ファイルが使われます。2つの `wrangler.jsonc` は内容（Worker名など）をそろえてください。

本番ブランチ（main）以外のブランチやPRでは、Cloudflareが `npx wrangler preview` でプレビューを作成します。このコマンドは `wrangler.jsonc` に `"previews": {}` がないと「missing a `previews` block」で失敗するため、2つの `wrangler.jsonc` の両方に入れています。削除しないでください。

本番ブランチの設定を変えた直後は、すでに始まっていたビルドがプレビュー扱いのまま終わることがあります。ビルド履歴のURLが `.../production/previews/main/...` になっていたら本番へは公開されていないので、もう一度ビルドしてください。

参考: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
