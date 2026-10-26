# 次にやること（英単語ノート 1.1 以降）

作成日: 2026-10-25。上から順に。「あなた」はオーナー（開発者本人）の作業、「開発」はコードの作業。

## 1. この PR を出すまで（あなた）

1. PR の Cloudflare プレビューで一通り触る: https://claude-busy-gates-pwhg2v-toeic-app.trainer-jonny.workers.dev
   - 初回 → 目標 600 点 → 今日の学習 → 答え → 覚えた → 取り消す → 戻る → 続きから → 最後まで → 今日はここまで
   - 500 点レベル → 4 択クイズ、耳だけ復習（音が出ます）
   - 設定 → 日本語 → 英語 → 学習
2. 既存の学習記録がある端末（Web 版）で、更新後に記録が残っていることを確認する（ホームのレベルの「n / 500」と設定の「覚えた n 語」）。
3. よければ「マージして」。マージ後に本番ビルド（`Version ID`）を確認して報告します。

## 2. iPhone 版 1.1.0 を出すまで（あなた＋開発）

1. Mac で開発ビルドを作って実機確認（[QA_REPORT.md](QA_REPORT.md) の「確認できていないこと」の表）。特に **消音スイッチでの発音**、**耳だけ復習の画面ロック中の継続**、**大きい文字**、**VoiceOver**。
   ```sh
   git switch claude/busy-gates-pwhg2v && git pull
   cd mobile && npm ci && npx expo run:ios --device
   ```
2. 問題がなければ EAS でビルドと提出（前回と同じ手順）。
   ```sh
   cd mobile
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```
3. （2026-10-26 済み）App Store Connect で 1.1.0 を作り、[appstore/README.md](../appstore/README.md) の「このバージョンの新機能（1.1.0）」「説明」「プロモーション用テキスト」「キーワード」を貼る。
4. （2026-10-26 済み。App Store Connect へのアップロードはオーナー）スクリーンショットを撮り直す（6 枚、1206×2622）。作り方は [appstore/README.md](../appstore/README.md) の「作り方」（`node e2e/storeshots.mjs ../appstore/screenshots`）。
5. （2026-10-26 済み）審査メモは 1.0 のものを流用し、「続きから」「耳だけ復習」「取り消し」の操作を 1 行ずつ足す。

## 3. 続けて価値が出る開発（優先順）

| 優先 | 内容 | 規模 | 理由 |
| --- | --- | --- | --- |
| P1 | バックアップの書き出し／読み込み（JSON 1 ファイルを共有シート／ファイルで） | 中 | 機種変更で記録が消える。競合の不満 #9。iCloud 同期の前段 |
| P1 | 1 日 1 回の静かなリマインド（opt-in、時刻指定、「今日の 20 語を用意しました」。`expo-notifications` のローカル通知のみ） | 中 | 継続率に最も効く。催促にしない |
| P1 | 500 点レベル No.157〜500 の TOEIC らしくない日常語 60〜80 語を、ビジネス語に差し替え（自作例文、No は変えない。意味が変わる語は新しい No） | 大（データ） | 教材としての信頼感 |
| P1 | Web 版に App Store への導線（Smart App Banner `app-id=6824718074`、ホーム下部のリンク）と `index.html` の `lang="ja"` | 小 | 無料の入口から iPhone へ |
| P2 | 学習結果の共有カード（画像を共有シートへ。Web は `navigator.share`） | 中 | 唯一のバイラル導線 |
| P2 | 例文穴埋め 4 択（Part 5 形式。`cloze.ts` は実装済み） | 中 | 定着の確認の手がかりを変える |
| P2 | 苦手の常連（「まだ」が 6 回以上）の扱い: 最短 3 日に、例文穴埋めを先に見せる | 小 | 毎日同じ語に出続けられない |
| P2 | 復習の正答率で新しい単語の上限を自動調整（< 75% → 4 語、> 90% → 12 語） | 小 | 設定なしで負荷を合わせる |
| P2 | `isDue`／`isWeak` の Set 化（`todayPlan` の計算を 1/3 に） | 小 | 最悪ケース（notYet 1,500 語）で数 ms → 1ms 未満 |
| P2 | 設定に「レビューで応援する」リンク（`itms-apps://apps.apple.com/app/id6824718074?action=write-review`） | 小 | 回数制限の対象外 |
| P2 | 第三者監査で残した小さな指摘: Reduce Motion 時もスワイプのスタンプを出す、最後のカードも取り消せるようにする、耳だけ復習の一時停止後は語の先頭から読み直す、耳だけ復習の「まだ」にも取り消し、「おさらい」が数語で終わる日の文言、Ionicons フォント 390KB を SVG 5 本に置き換え | 小〜中 | 使い勝手の細部 |
| P3 | 有料プラン「プラス」の第 2 段階（RevenueCat、商品登録、サンドボックス、App プライバシーとポリシーの改訂）。[MONETIZATION_PLAN.md](MONETIZATION_PLAN.md) の条件（主柱 2 つ）がそろってから | 中 | 課金は収益の柱ではなく土台 |
| P3 | 週次サマリーの匿名計測（識別子なし、設定でオフ可） | 小〜中 | 学習開始率・完了率を知る |
| P3 | Android（12 名 × 14 日のクローズドテストが必要） | 中 | iOS で固まってから |

## 4. 前から残っている依頼（あなた）

- ダウンロード数のレポート: 環境の設定に `ASC_KEY_ID`・`ASC_ISSUER_ID`・`ASC_API_KEY_BASE64`・`ASC_VENDOR_NUMBER` を登録し、通信先 `api.appstoreconnect.apple.com` を許可する（[appstore/README.md](../appstore/README.md)）。値はチャットやリポジトリに書かない。
- 例文の自動生成（AI）: Cloudflare Worker 経由の案を出したまま。やるならモデルと予算の判断待ち。本アプリは「AI を売りにしない」方針なので、やるとしても登録画面の補助に限る。
- 不要なブランチ `codex/react-native-expo` の削除、toeic-word-app のアーカイブ、kids-word-app の既定ブランチ設定（こちらからは権限がなく 403）。

## 5. 決めごと（守る）

- 保存形式 `toeic.progress.v1` は version 2 のまま項目を足す。番号は上げない。
- 無料でできることを後から減らさない。課金は「あとから足す機能」だけ。
- 設定項目を増やさない。学習の調整は自動で。
- 連続日数・ハート・催促通知・広告・ランキングは入れない。
- TOEIC は ETS の登録商標。表記と免責文を維持する。
