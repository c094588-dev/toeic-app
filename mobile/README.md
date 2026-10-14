# TOEIC 単語ノート / React Native + Expo

iOS・Android・Web共通のTOEIC単語アプリです。以前のSwift版とWeb版（`index.html`）は削除しました（gitの履歴には残っています）。

## 公開URL

- 本番（`main`）: https://toeic-app.trainer-jonny.workers.dev
- `main` 以外のブランチは `https://<ブランチ名>-toeic-app.trainer-jonny.workers.dev` にプレビューが作られます（公開設定は [CLOUDFLARE.md](CLOUDFLARE.md)）。

## 起動

Node.js 24 LTSを使用します。リポジトリ全体を取得してください（親ディレクトリのwords.jsonを共有）。

```sh
git switch main
cd mobile
npm ci
npm start
```

Expo SDK 57対応のExpo GoでQRコードを開きます。手元のExpo Goが対応していない場合は、SDKを無理に下げず、開発ビルドを利用してください。MacでXcodeが設定済みなら `npx expo run:ios`、Android SDKが設定済みなら `npx expo run:android` でローカル開発ビルドを作成できます。

ブラウザで確認する場合は `npm run web`。

## 機能

- 500〜900点の5レベル、合計1,500語（ルートwords.jsonが正本）
- 未習得のみ／苦手な単語だけ／全単語のフラッシュカード、意味・例文・発音（英語→日本語、日本語→英語）
- 苦手な単語を優先して出題（`src/learning.ts` の `priority`）。苦手度は「まだ」・クイズの誤答で+1、クイズ正解で-1、「覚えた」で0。苦手な単語 → 新しい単語 → 覚えた単語の順で、同じ種類の中では苦手度が高いほど・最後に見てから日が経つほど先に出す
- 10問4択クイズ。苦手な単語を優先し、誤答は「まだ」に戻す
- 単語の自動発音（オン／オフ切り替え）
- 結果と復習一覧、再挑戦
- 端末内への進捗保存、保存エラーの表示と再試行
- OSに合わせたライト／ダーク表示、スクロール対応、Android戻る操作

未習得を全て覚えた場合は、勝手に全問へ切り替えず完了画面を表示します。クイズ正解だけでは「覚えた」に変更しません（移植元と同じ仕様）。学習セッションの途中位置は保存しません。

## 検証

```sh
npm test
npm run typecheck
npx expo export --platform all
```

`expo export` は各プラットフォームのJavaScriptバンドル生成です。署名付きネイティブビルド・実機テスト・ストア審査の代わりにはなりません。

## 移行・公開前の残作業

- 以前のSwift版（iCloud）・Web版（localStorage）の学習記録は引き継いでいません。新アプリの保存領域は独立しています。
- iPhone／Androidの実機で音声・振動・大きい文字設定・オフライン再起動を確認する。
- ストア用の正式なアプリ名、アイコン、Bundle ID／Android packageを確定する。
- 開発者アカウント、署名、プライバシーポリシー、教材の利用権等を確認して公開準備を行う。
- iCloudによる同期は移植していません。将来の両OS間同期は別途設計する。
- キッズ版は別アプリとして今後作成する。出題・進捗ロジックは `src/learning.ts` に分離済み。

EASアカウントの作成・ストアへの提出・既存アプリの置換は、この変更では行っていません。
