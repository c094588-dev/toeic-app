# CloudflareでWeb版を公開する

Workers BuildsとGitHubを接続して公開する設定です。サーバー処理は使わず、ExpoのWeb出力だけを配信します。

## Cloudflare側の設定

Workers & Pagesからアプリケーションを作成し、GitHubリポジトリをインポートします。

| 項目 | 設定値 |
| --- | --- |
| リポジトリ | c094588-dev/toeic-app |
| 本番ブランチ | codex/react-native-expo |
| Worker名 | toeic-word-note |
| ルートディレクトリ | mobile |
| ビルドコマンド | npm run build:web |
| デプロイコマンド | npx wrangler@4 deploy |

依存関係はmobile/package-lock.jsonからインストールされます。Worker名はwrangler.jsoncのnameと一致させます。アカウントはCloudflareの画面で選択し、認証情報をリポジトリに書き込まないでください。

公開が成功するとCloudflareに表示されるworkers.devのURLを共有できます。現在のmainブランチにはこのモバイル版がないため、必ず上記のブランチを選択してください。このブランチへの更新は公開サイトへ自動反映されます。

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

参考: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
