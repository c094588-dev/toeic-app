# 英単語ノート / React Native + Expo

iOS・Android・Web共通のTOEIC単語アプリです。以前のSwift版とWeb版（`index.html`）は削除しました（gitの履歴には残っています）。

## 公開URL

- 本番（`main`）: https://toeic-app.trainer-jonny.workers.dev
- `main` 以外のブランチは `https://<ブランチ名>-toeic-app.trainer-jonny.workers.dev` にプレビューが作られます（公開設定は [CLOUDFLARE.md](CLOUDFLARE.md)）。

## 起動

Node.js 22 以降（README は 24 LTS を推奨）を使用します。リポジトリ全体を取得してください（親ディレクトリのwords.jsonを共有）。

```sh
git switch main
cd mobile
npm ci
npm start
```

Expo SDK 57対応のExpo GoでQRコードを開きます。手元のExpo Goが対応していない場合は、SDKを無理に下げず、開発ビルドを利用してください。MacでXcodeが設定済みなら `npx expo run:ios`、Android SDKが設定済みなら `npx expo run:android` でローカル開発ビルドを作成できます。

ブラウザで確認する場合は `npm run web`。

## 構成

| パス | 内容 |
| --- | --- |
| `App.tsx` | 状態と画面遷移（どの画面を出すか、学習・クイズ・耳だけ復習の進行、単語の登録） |
| `src/learning.ts` | 出題と記録の純粋ロジック（間隔反復、今日の学習の選定、4択の生成）。UI に依存しない |
| `src/session.ts` / `useSession.ts` | 学習の途中位置の保存と再開（同じ日のうちだけ） |
| `src/useProgress.ts` | 進捗の保存（`toeic.progress.v1`、version 2 のまま項目を追加）。壊れたデータは退避してから空で始める |
| `src/customWords.ts` / `useCustomWords.ts` | 自分で登録した単語 |
| `src/days.ts` / `useDays.ts` | 日ごとの学習語数（7日の点、しばらくぶりの判定）とその日の目標語数 |
| `src/review.ts` / `useReview.ts` | App Store のレビュー依頼のタイミング（3回目の達成から、120日以上空けて、年3回まで） |
| `src/listen.ts` / `speech.ts` | 耳だけ復習の読み上げ順と、音声合成の呼び出し |
| `src/premium.ts` | 有料プランの土台。`PREMIUM_ENABLED = false` で課金は無効 |
| `src/theme.ts` / `ui.tsx` / `copy.ts` | デザイントークン（色・間隔・文字）、共通部品、画面の文言 |
| `src/components/` | ヘッダー・画面枠・アイコン・答えの面 |
| `src/screens/` | ホーム・学習・結果・レベル・クイズ・耳だけ復習・設定・単語の登録・有料プラン案内 |
| `tests/` | 単体テスト（`node --test`） |
| `e2e/` | Web 版の E2E（Playwright）とスクリーンショット撮影 |

## 機能

- 500〜900点の5レベル、合計1,500語（ルートwords.jsonが正本）。すべてに例文と訳
- **今日の学習**: 目標スコア（500〜900点）を選ぶと、1日20語を自動で組む。復習の時期が来た単語（記憶が不安定なものから）→ 新しい単語（1日10語まで、マイ単語帳 → 低いレベルの順）。出せる単語が少ない日はその数が目標になる（その日のあいだ固定）
- **続きから**: 学習の途中位置を1カードごとに保存し、同じ日のうちなら「続きから（9 / 20）」で同じ列・同じ位置に戻る（`toeic.session.v1`）
- **学習カード**: 画面のどこをタップしても答え、もう一度タップで次へ（判定なしでも「見た」として記録）。右スワイプ「覚えた」、左スワイプ「まだ」、同じボタンが下にある。判定直後4秒は「取り消す」。答えを見ずに「覚えた」にした語は既知語として7日後から
- **間隔反復**: 「覚えた」を重ねるほど次の復習までの間隔が延びる（1→3→7→14→30→60→120→240日）。「まだ」は段階を2つ下げてすぐ出す。画面には「3日ぶり」「復習」のバッジだけ出し、仕組みの言葉は出さない（`src/learning.ts`）
- **結果画面**: 覚えた／まだ／判定なしの数、今日の学習のメーター、明日の予告、「まだの単語をもう一度」「さらに10語」「今日はここまで」
- **しばらくぶり**: 最後の学習から7日以上、または復習待ちが60語を超えると、新しい単語を出さず「おさらいから始める」
- **苦手だけ復習**: 目標以下の全レベルから苦手な単語だけ（ホームから1タップ）
- **耳だけ復習**: 単語 →（思い出す間）→ 意味 → 例文を自動で読み上げ。一時停止・次へ・「まだ」。聞いただけでは記録しない
- **レベル別**: 覚えていない単語／苦手な単語だけ／すべての単語、英語→日本語と日本語→英語（設定に保存）、10問4択クイズ（語義の重なる語は誤選択肢にしない。誤答は「まだ」に戻す）
- **マイ単語帳**: 英単語・意味（必須）と例文・訳（任意）を登録。「マイ単語帳」か500〜900点のレベルに入れ、カード・クイズ・今日の学習に出る。編集・削除（削除すると学習記録も消す）。番号は100万より大きい番号を振る
- **設定**: 目標スコア、自動発音、日本語→英語で出題、学習の記録（覚えた／定着／苦手）、プライバシーポリシー・サポート
- 消音スイッチでも発音、OSに合わせたライト／ダーク、Dynamic Type の上限、Reduce Motion、VoiceOver のラベル・見出し・読み上げ、Android 戻る操作
- 進捗は端末内にだけ保存。保存エラーの表示と再試行。以前の保存形式（version 1/2）をそのまま読み、記録を1語も捨てない

クイズ正解だけでは「覚えた」に変更しません（認識は想起より軽く扱う）。

## 検証

```sh
npm run check          # 型チェック + 単体テスト
npm run build:web      # Web 版を dist/ に書き出す
npm run e2e            # dist/ をブラウザで動かす E2E（Playwright。初回は npx playwright install chromium）
npm run shots -- out/  # 主要画面のスクリーンショット（3サイズ × ライト/ダーク）
npx expo export --platform all
```

`expo export` は各プラットフォームのJavaScriptバンドル生成です。署名付きネイティブビルド・実機テスト・ストア審査の代わりにはなりません。実機でしか確認できない項目は [docs/QA_REPORT.md](../docs/QA_REPORT.md) にまとめています。push と PR では GitHub Actions（`.github/workflows/check.yml`）が同じ検証を回します。

## 保存データの約束

- `toeic.progress.v1` の形式は version 2 のまま項目を足す（旧アプリでも読める）。不明な番号の単語は捨て、壊れたデータは `*.corrupt` に退避してから空で始める。
- `toeic.session.v1`（途中位置）、`toeic.days.v1`（日ごとの語数）、`toeic.goal.v1`（その日の目標）、`toeic.review.v1`（レビュー依頼）、`toeic.settings.v1`、`toeic.customWords.v1` は別のキーに持ち、進捗の読み書きには触れない。

## 移行・公開前の残作業

- 以前のSwift版（iCloud）・Web版（localStorage）の学習記録は引き継いでいません。新アプリの保存領域は独立しています。
- iPhoneの実機で、消音スイッチでの発音、耳だけ復習の画面ロック中の継続、大きい文字設定、VoiceOver、Reduce Motion、触覚を確認する（[docs/QA_REPORT.md](../docs/QA_REPORT.md)）。
- iCloudによる同期・バックアップは未実装（[docs/NEXT_ACTIONS.md](../docs/NEXT_ACTIONS.md)）。
- キッズ版は別アプリとして今後作成する。出題・進捗ロジックは `src/learning.ts` に分離済み。
