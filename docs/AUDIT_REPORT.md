> 第三者監査エージェント（G）の報告書。2026-10-25 19:10 UTC 時点の作業ツリーに対するもので、ここに挙がった Go の条件 10 件はその後すべて修正した（対応は [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) の「第三者監査」）。行番号は監査時点のもの。

# Agent G：第三者監査報告 ― 英単語ノート 全面改善

監査日時: 2026-10-25 19:10 UTC 時点の作業ツリー（未コミット）。**監査中も作業ツリーが更新され続けていた**（`days.ts`/`useDays.ts`/`App.tsx` 19:00、`PlusScreen.tsx` 19:03、`learning.ts`/`useReview.ts`/`SettingsScreen.tsx`/`e2e` 19:08）。本報告の行番号・所見は 19:10 時点のものです。
確認手段: コード精読（全ファイル）、`npm test`（62件 pass）、`npx tsc --noEmit`（OK）、`node e2e/app.e2e.mjs`（18/18 成功、19:03 時点のビルド）、独自プローブ（`review/g/probe1.mjs`＝SRS 境界、`review/g/probe_ui.mjs`＝Playwright で UI 7項目、`review/g/contrast.mjs`＝コントラスト）、スクリーンショット 改善前24枚／改善後56枚の目視。
凡例: **[確認]** コード・テスト・実測で確かめた事実 ／ **[推定]** 実機未検証の見立て。

---

## 総合判定: **条件付き Go**

- **P0（データ消失・クラッシュ・致命的誤動作）は確認できなかった。** 保存形式の互換、中断再開、取り消し、SRS、耳だけ復習の競合、連打ロックを個別に検証し、いずれも破綻なし [確認]。
- ただし **P1 が 4 件**: (1) VoiceOver では答えを出す操作が存在しない、(2) 初回画面・設定の目標チップが「500／点」と全サイズで2行に折れる、(3) 「今日の目標」の数字が途中で縮む／再開ボタンの分母と食い違う、(4) 答えを見てタップで流すだけで「20 / 20 達成」になり新語の枠も消費する。いずれも修正コストは小〜中。(1)(2) は PR 前に、(3)(4) は遅くともマージ前に直すべき。
- 改善前 48点 → 改善後 **74点**。学習効率・中断再開・取り消し・結果画面・アクセシビリティ属性の追加は実質的な前進。残りは「数字の一貫性」と「実機でしか確認できない項目」。

### 採点表（100点満点）

| 項目（配点） | 前 | 後 | 根拠（後の減点理由を中心に） |
|---|---:|---:|---|
| 直感的に使える（25） | 15 | 20 | 後: 初回2タップで学習開始、ホーム主ボタン1つ、「続きから（n / N）」で1タップ再開（E2E「中断と再開」、`se_light_1_home.png`）。減点: 目標の分母が「0 / 10語」→途中「5 / 15語」→終了「20 / 20語」と動く（probe_ui [2]）、初回文言「1日20語まで」と初日「10語」の不一致（`copy.ts:11`）、結果画面の題と見出しがどちらも「ひと区切り」（`StudyResultScreen.tsx:29,32`）。前: スローガン＋「0 / 1,500」が最上段、タップ素通りが無記録（`before/se_light_1_home.png`） |
| スキマ時間に使える（15） | 7 | 12 | 後: セッション保存（`useSession.ts`、1カードごと）、30秒＝1〜3枚でも記録と再開が成立、「今日はここまで」で終わりを明言（`se_light_6_result.png`）。減点: 日付をまたぐと途中位置は捨てられる（`session.ts:59`、設計上の判断）、レベル別学習を始めると今日の途中位置が上書きされる（`beginStudy` → `sessionStore.save`）。前: 途中位置なし、再開すると別の列 |
| デザイン品質（15） | 8 | 11 | 後: トークン化（`theme.ts` 9書体・4角丸・4pt刻み）、単語48pt固定位置、影なし、ダークも破綻なし（`std_dark_3_answer.png`）。減点: **目標チップの2行折れ**（`se/std/max_light_0_first.png`、`*_7_settings.png`、probe_ui [6] 文字高52px＝2行）、7日の点の空円が 1.5:1 で見えにくい（`theme.ts:70 track`、contrast.mjs）、耳だけ復習の説明文が画面中央に浮く（`se_light_8_listen.png`）。前: 文字サイズ13種・角丸7種混在、SEでヒントが「ま／だ」で折れる |
| 学習効率（15） | 5 | 11 | 後: Leitner 式 1→3→7→14→30→60→120→240日、「まだ」で2段戻し、遅延ボーナス、新語上限10／日、復習60超で新語停止、7日ぶりは「おさらい」（`learning.ts:42-60,204-246,491-533`、単体テスト11件）。減点: 復習に失敗した語が `newWordsToday` に数えられ新語枠を食う（`learning.ts:445-448`、probe1 A）、判定なしの素通り（`touch`）も新語枠と目標を消費（probe1 H）、同セッション内の再出題なし。前: 「覚えた」1回で7日固定、復習枠5語／日 |
| 速度・安定性（10） | 7 | 8 | 後: 単体62件・E2E18件が CI で回る（`.github/workflows/check.yml`）、壊れた保存データは退避して空で開始（`useProgress.ts:35-41`）、listen の run 番号で古いループの setState を遮断（`App.tsx:443-466`、probe_ui [7]）。減点: Web バンドル 1.19MB＋Ionicons フォント 390KB（使用アイコン5種のため）、実機未計測。前: CI なし、E2E なし |
| アクセシビリティ（10） | 3 | 6 | 後: role/label を全ボタンに付与（E2E で44pt・名前を検査）、`maxFontSizeMultiplier`（text 1.6／button 1.3／display 1.2）、Reduce Motion で傾き停止、progressbar 役割。減点: **VoiceOver で「意味を見る」操作が無い**（`StudyScreen.tsx:195` は `accessible={false}` の PanResponder のみ、probe_ui [1] のボタン一覧にも無い）、Reduce Motion 時はスワイプの視覚フィードバックがゼロ（`StudyScreen.tsx:72` で `swipeX` を更新しないためスタンプも出ない）、空の点のコントラスト。前: `maxFontSizeMultiplier` 0件、Reduce Motion 非対応 |
| 継続率・収益性（10） | 3 | 6 | 後: 7日の点（責めない設計、`days.ts`）、達成直後のレビュー依頼（3回目以降・120日間隔・年3回、`review.ts`）、有料土台はフラグ `false` で未配線（`premium.ts:9`、`App.tsx:723`）。減点: リマインダー（通知）なし、共有なし、収益はゼロのまま（方針どおり）。前: 継続の仕掛けなし |
| **合計** | **48** | **74** | |

---

## P0（データ消失・クラッシュ・致命的誤動作）― 該当なし。検証の記録

| 観点 | 結果 | 根拠 |
|---|---|---|
| (a) 保存形式の互換 | 問題なし [確認] | `parseProgress` は version 1/2/3 を読み、`step/due` の無い記録は `migrateStat` で補う（`learning.ts:66-70,73-130`）。v1 の mastered 700／notYet 800 を読み込んでも 1,500 件すべて残り、再保存→再読込でも欠けない（probe1 F）。保存は `version: 2` のまま（`useProgress.ts:55`）で、**改善前のパーサ（`{miss, seen}` だけ取り出す）でも読める**＝ダウングレード安全（`git show before-redesign:mobile/src/learning.ts` で確認）。壊れたデータは `toeic.progress.v1.corrupt` に退避してから空で開始、E2E「以前の保存形式（version 1）」も通る |
| (b) 中断と再開 | 問題なし [確認] | 1カードごとに `sessionStore.save`、終了で `clear`。日付違い・壊れ・残りゼロは `null`（`session.ts:36-80`、テスト3件）。消えた登録単語は飛ばして位置を詰める（`resume()` でも再フィルタ）。Agent F が指摘した「登録単語の読み込み前に検証して落とす」は `wordsReady` 引数で解消済み（`useSession.ts:11-23`、probe_ui [4] でマイ単語帳だけのセッションを reload → 「続きから（1 / 2）」） |
| (c) 取り消し | 問題なし [確認] | `undoMark` が進捗（`restore`）・日ごとの記録（`unbump`）・セッション（`studyRef`＋`save`）の3点を戻す（`App.tsx:377-385`）。probe_ui [5]: 取り消し後 index 0、tally 0、days `{}`、mastered `[]`。E2E でも確認 |
| (d) SRS の計算 | 問題なし [確認] | 境界: 23:59 の「覚えた」は翌0:00に due（probe1 I）、時期前の「覚えた」は段を上げない、「まだ」は 2 段戻し・即時 due、`markQuizCorrect` は記録なし→段1、notYet で期限内なら段+1（probe1 G）。新語上限 `NEW_WORDS_MAX=10`、「さらに10語」は上限超過を許可、復習 60 超で新語停止（テストあり） |
| (e) 耳だけ復習の競合 | 問題なし [確認] | `run` 番号と `stopped` で古いループの `setListen` を遮断、`speakAsync` は onDone/onStopped/onError＋長さ比例のガードで必ず解決（`speech.ts:17-44`）。一時停止→戻る→再開始で「1 / 20」から正常に開始、エラー無し（probe_ui [7]）。skip は `skipTo = at+1` で連打しても1語ずつ |
| (f) 二重タップ | 同一カードの二重記録なし [確認] | `lock` を判定時に立て、`screen`/`session.index`/`qIndex` の変化で解除（`App.tsx:219-221`）。デッドロックになる経路（最後のカード、クイズ最終問、再開）は画面遷移で解除されることを追った。※「次のカードまで判定してしまう」は P2-6 |

---

## P1（PR 前〜マージ前に直す）

### P1-1. VoiceOver では答えを出せない（アクセシビリティ）
- 根拠: `StudyScreen.tsx:195` のカード領域は `accessible={false}` の `View` に `panHandlers` を付けただけで、`onTap`（意味を見る／次へ）を呼ぶアクセシブルな要素が無い。probe_ui [1] の学習画面ボタン一覧は「戻る／自動発音／発音を聞く／まだ／覚えた」のみ。VoiceOver 利用者は意味を見られないまま「覚えた／まだ」を押すしかなく、ヒント「タップで意味を見る」が誤案内になる [確認: コード／推定: 実機挙動]。
- 修正: `StudyScreen.tsx` のカード（`Animated.View`、197行）に `accessible accessibilityRole="button" accessibilityLabel={revealed ? "次のカードへ" : "意味を見る"} accessibilityHint="ダブルタップで表示" onAccessibilityTap={p.onTap}` を付ける（Web は `onPress` 付き `Pressable` に置き換え）。合わせて E2E「学習画面に『意味を見る』役割のボタンがある」を1行追加。

### P1-2. 目標スコアのチップが「500／点」と2行に折れる（初回画面・設定、全サイズ）
- 根拠: `se/std/max_light_0_first.png`、`*_7_settings.png`。probe_ui [6]: SE で chip 52×54px、文字高 52px（1行なら約26px）。原因は `ui.tsx:179` の `flexBasis:0, flexGrow:1` ＋ `paddingHorizontal:12` に対し5枚横並びで内側が約28pxしか残らないこと。新規ユーザーが最初に見る画面での崩れで、ブランド印象を直接下げる。
- 修正（いずれか）: (a) `HomeScreen.tsx:65` / `SettingsScreen.tsx:44` のラベルを `${score}` にし `accessibilityLabel` の「目標スコア 500点」は維持、(b) `Chip` の `Text` に `numberOfLines={1} adjustsFontSizeToFit` を付け `paddingHorizontal` を `space.sm` に。E2E の 44pt 検査に「チップの高さ ≤ 52」を足して再発防止。

### P1-3. 「今日の目標」の分母が途中で縮み、再開ボタンの分母と食い違う
- 根拠 [確認]: probe_ui [2]（復習10＋新語10の日）: 開始前「0 / 20語」→ 復習5語を「まだ」にしてホームへ戻ると「**5 / 15語**」、同じ画面の主ボタンは「**続きから（5 / 20）**」。終わると「20 / 20語」。原因は `learning.ts:445-448` の `newWordsToday` が「今日見た step≤1 の語」を数えるため、復習に失敗した語（段3→1）が新語扱いになり `newCap` が減る（`learning.ts:507`）。19:00 に入った `days.goalToday`（`App.tsx:146-152`、`days.ts:53-67`）は「増える」方向は止めたが「縮む」方向は `min(..., doneToday + available)` で残っている。
- 影響: ユーザーの言葉で言えば「目標が勝手に減った／増えた」。前回ブリーフの「意味不明な数字」そのもの。
- 修正: (1) `App.tsx:147` を `const goalToday = days.goalToday ?? Math.max(1, Math.min(DAILY_GOAL, doneToday + available))`、`reached = doneToday > 0 && (doneToday >= goalToday || available === 0)` に（その日の目標は固定、出せる語が尽きたら達成）。(2) `newWordsToday` を「今日初めて記録が付いた語」に限定する。保存形式を変えずに済む近似: `s.seen >= start && (s.step ?? 0) <= 1 && s.miss === 0 && !notYet.has(id)` ＝ 今日「覚えた」にした新語＋クイズ初出のみ。失敗した復習は `miss ≥ 1` で除外される。(3) 文言: `copy.ts:11` の「（1日20語まで）」を「復習と新しい単語で1日20語まで。新しい単語は1日10語まで」に。単体テスト「復習に失敗しても新語の上限は減らない」を追加。

### P1-4. 答えを見てタップで流すだけで「達成」になり、新語の枠も消費する
- 根拠 [確認]: `studyTap`（`App.tsx:329-343`）は答え表示後のタップで `touchWord` → `seen=now, step=0`。probe1 H: 10語を判定なしで流すと `newWordsToday=10`、`studiedToday=10`、その日の新語は 0、翌日は「復習 10」として出る。結果画面は「判定なし 10」と見せるので改善前より誠実だが、ホームは「10 / 10語 達成」になる。Agent C が改善前の最大の落とし穴と指摘した点が、形を変えて残っている。
- 修正（小）: `studiedToday`/`newWordsToday` から「判定なしだけの語」（`!mastered && !notYet && miss===0 && step===0`）を除外し、`touch` は「今日もう一度出さない」目的だけに使う。ヒント `copy.ts:37` の「タップで次へ」は「タップで飛ばす（記録なし）」に。

---

## P2（次のリリースまでに）

1. **操作ヒントが永久に消えない**: `App.tsx:296` は `hintsSeen < 3` のときだけ +1 し、表示条件 `App.tsx:591` は `hintsSeen <= 3` → 3 で止まって常に表示（probe_ui [1]: hintsSeen=3 でもヒント表示、保存値も 3 のまま）。`<=` を `<` に。
2. **「さらに10語」の文言が固定**（`copy.ts:19,60`）: 出せる語が少ないと 3語でも「さらに10語」。probe1 E では 0 語でもボタンが出うる（`more && plan.words.length>0` で結果画面は守られるがホームの `secondary` は `plan.words.length===0` 時に消える＝整合はしている）。`more: (n) => \`さらに${n}語\`` に。
3. **結果画面の題と見出しが重複**: レベル別の学習後は Frame の題「ひと区切り」＋見出し「ひと区切り」（`StudyResultScreen.tsx:29,32`）。題は「学習の結果」か `bandName(band)` に。
4. **7日の点の空円が見えにくい**: `HomeScreen.tsx:129` の `borderColor: c.track`（白地で 1.5:1、WCAG 1.4.11 の 3:1 未満）。`c.border`（3.5:1）に。
5. **Reduce Motion でスワイプの手応えが無い**: `StudyScreen.tsx:72` で `swipeX` を更新しないため「覚えた／まだ」スタンプも出ない。平行移動・回転だけ止め、スタンプの不透明度は `crossed` の state で出す。
6. **「覚えた」ボタンの連打で次のカードも判定される** [推定]: `lock` は再描画で解除されるため、2回目のタップ（数十ms後）は次のカードに効く。`advance` 後 250ms はロックを保つ（`setTimeout` で解除）。
7. **最後のカードは取り消せない**: `finishStudy` → `go()` が `clearUndo()`（`App.tsx:223-227`）。結果画面にも「取り消す」を 4 秒出すか、`go` の clearUndo を結果画面では呼ばない。
8. **一時停止で切れた読み上げは再開時に繰り返さない**: 単語の途中で止めると再開後は意味から始まる（`listen.ts:43-50`、`speakOrSkip`）。再開時に現在の語の先頭から読み直す（`skipTo` と同様に `restartAt` を持つ）。
9. **達成時の触覚とレビュー依頼は 20 語固定**（`App.tsx:213` が `DAILY_GOAL`）: 初日（目標10）や「おさらい」（目標3）では鳴らない・頼まない。`goalToday` と `reached` の立ち上がりで判定する。
10. **目標を上げてもその日の目標は増えない**（`days.goalToday` 固定の副作用）。設定で目標スコアを変えたら `setGoalToday` を取り直す。
11. **「おさらい」3語で「今日の目標、達成」**（probe_ui [3]）: 7日ぶりの復帰が 3 語で終わる。意図どおりなら文言を「おさらい 3語、完了。続けるなら さらに10語」に。
12. **耳だけ復習の「まだ」は取り消せず、覚えた語を即「まだ」に落とす**（`App.tsx:481-488`）。4 秒の取り消しトーストを listen にも。
13. **Web バンドル**: Ionicons フォント 390KB をアイコン5種のために配信（`dist/assets/.../Ionicons.*.ttf`）。`expo-image`/SVG 5本に置き換えれば −25%。
14. **文言の小さな不統一**: ホームの内訳「苦手 N語」は `notYet` 全部を数える（`learning.ts:528`）が、カードの「苦手」バッジは `miss>0` のみ（`isWeak`）。どちらかに揃える。
15. **CLAUDE.md が `docs/NEXT_ACTIONS.md`・`docs/QA_REPORT.md` を参照するが存在しない**（19:10 時点）。作るか参照を消す。
16. **レベル別学習を始めると「今日の学習」の途中位置が消える**（セッション1本の設計）。許容範囲だが、ホームの「続きから」が突然レベル別の続きになるので、ボタン文言に「（500点レベル）」を添える。

---

## UX・文言（要点）

- **1タップ再開**: 成立 [確認]。ホーム主ボタンが「続きから（n / N）」になり、同じ列・同じ位置・同じ集計に戻る（E2E）。
- **30秒／1分／3分**: 30秒＝起動→1タップ→2〜3枚（自動発音あり）。1分＝8枚前後、1語ごとに保存されるので途中で閉じてよい。3分＝20枚＋結果。いずれも成立。ただし「今日はここまで」まで行かないと達成表示が出ない日（分母が動く日）があり P1-3 の修正で安定する。
- **片手操作**: 判定はフッター 56pt の2ボタン＋スワイプ、答えは全面タップ。戻るは左上のみ（iOS の端スワイプ戻るは未実装＝許容）。
- **マイクロコピー**: 「まだ／覚えた」「続きから」「今日はここまで」「もう一度」「さらにN語」は一貫して動詞止め・短い。良い。気になる点は P1-3（20語）、P2-3（ひと区切り重複）、P2-2（さらに10語）、「判定なし」という語（「見ただけ」のほうが自然）。

## デザイン・アクセシビリティ（要点）

- HIG: 44pt は全ボタンで満たす（E2E 検査）。ヘッダー 48pt・中央題・左戻る・右1操作は iOS 慣習どおり。余白は 16/24 で統一。階層は「題 → カード → 行」で明快。
- Dynamic Type: 上限 text 1.6／button 1.3／display 1.2（`theme.ts:34`）。英単語は `adjustsFontSizeToFit` と `minimumFontScale 0.5` で1行に収まる計算（最長15文字 × 24pt < 343pt）。**AX サイズでの実機確認は未実施** [推定: 崩れにくい]。
- VoiceOver: P1-1 以外は良好。`Row`・`Chip`・`IconButton` に label、週の点は1つのまとまり、progressbar 役割。装飾「›」は親の label に隠れる [推定: iOS]。
- Reduce Motion: 検出と傾き停止はある。P2-5。
- ダーク: 全ペア 5.7:1 以上（contrast.mjs）。ライトは muted 5.8:1、accent 6.0:1、wrong 6.5:1 で AA 合格。
- 小さい iPhone（375×667）: ホーム主ボタン・学習の判定ボタンは画面内（E2E se/light）。クイズは選択肢 D まで初期表示で収まる（改善前は切れていた）。崩れは P1-2 のチップのみ。

## 安全性チェックリスト

| 項目 | 結果 |
|---|---|
| ユーザーデータの削除 | 削除は「登録単語の削除」を2段階確認したときの `forget(id)` のみ。進捗のリセット機能なし。壊れたデータは退避 [確認] |
| 課金の有効化 | `PREMIUM_ENABLED = false`（`premium.ts:9`）。`PlusScreen` は `onPlus={PREMIUM_ENABLED ? … : undefined}`（`App.tsx:723`）で未配線、設定の行も出ない（`SettingsScreen.tsx:96`）。`tests/premium.test.mjs` がフラグ false を固定 [確認] |
| 既存機能の有料化 | なし。`canUse` は常に true [確認] |
| 秘密情報 | コード・設定・CI に API キー・証明書・パスワードなし。`appstore/report.mjs` は環境変数名のみ [確認] |
| 外部の有料サービス | なし。追加依存は `expo-store-review`（Apple 標準 API）、`@expo/vector-icons`、`playwright`（dev）[確認] |
| CI の危険なコマンド | `.github/workflows/check.yml` は typecheck/test/build/e2e のみ。`playwright install --with-deps` は CI 内の apt のみ [確認] |
| 商標表記 | 設定画面に「TOEIC は ETS の登録商標です…」（`copy.ts:106`）。アプリ内で TOEIC の語はここだけ。`appstore/README.md` にも日英の表記あり [確認] |
| 権限・バックグラウンド | `UIBackgroundModes: ["audio"]` 追加（`app.json`）。耳だけ復習が画面上にあるので審査上の説明は立つ [推定]。通信・解析なし |
| 単語データ | `words.json` は 7 語の訳・例文の手直しのみ（番号不変、進捗に影響なし）。市販教材の転載は見当たらない [確認] |

## テスト品質

- **単体（62件）が担保**: 保存形式 v1/v2 の読み込みと欠落なし、壊れたデータ、SRS の段階・遅延ボーナス・時期前据え置き・2段戻し、今日の学習の選定（順序・上限・おさらい・さらに10語）、4択の語義重複回避、セッションの保存・復元・日付違い・消えた単語、日ごとの記録、読み上げ順と停止・一時停止、レビュー依頼の間隔、課金フラグ。
- **E2E（18件）が担保**: 初回→目標→学習→取り消し→スワイプ→reload 再開→結果→まだをもう一度→達成後ホーム、レベル別（逆向き・クイズ・耳だけ）、マイ単語帳 CRUD、v1 データ、3サイズ×配色で主ボタンの可視・44pt・名前・コンソールエラーなし。
- **担保していない**: P1-3/P1-4 の数字の一貫性（テストが現状の挙動を固定していない）、取り消しの日ごとの記録（E2E は進捗のみ）、ヒントの消え方、登録単語を含むセッションの reload（probe で代替）、Dynamic Type、VoiceOver のフォーカス順、Reduce Motion、触覚、消音スイッチ、バックグラウンド再生、iOS 実機のスワイプと縦スクロールの競合（`onPanResponderTerminationRequest`）。

## 未検証の項目（実機でしか確認できない）

1. 消音スイッチ ON で発音が鳴るか（`playsInSilentMode`）。
2. 画面ロック・バックグラウンドで耳だけ復習が続くか（`UIBackgroundModes: audio` ＋ `shouldPlayInBackground`。AVSpeechSynthesizer がバックグラウンドで継続するかは要実機）、電話割り込みからの復帰。
3. VoiceOver の読み上げ順・P1-1 の修正後の操作性、Switch/Chip の selected 読み上げ。
4. Dynamic Type の AX1〜AX5 で学習画面・ホーム・設定の崩れ、ヘッダー題の省略。
5. 触覚（判定・閾値・達成）の強さと頻度。
6. スワイプ中に答えの ScrollView が縦スクロールを奪わないか（iOS のネイティブ ScrollView と JS レスポンダの競合）。
7. `StoreReview.requestReview` が達成直後に出る体験（開発ビルドでは毎回出る）。
8. SF Pro／ヒラギノでの行の折り返し（スクショは Chromium の Arial/Noto）。
9. 低速端末（iPhone SE 2）でのカード切替の体感と起動時間。

## 良かった点（短く）

- ロジックと画面の分離が徹底し（`learning.ts`/`session.ts`/`days.ts`/`listen.ts` は純関数）、境界条件がテストで固定されている。保存形式を上げずにフィールド追加で互換を守った判断は正しい。
- 「続きから」「取り消す」「今日はここまで」「まだの単語をもう一度」の4点で、スキマ時間の体験が実際に変わった。結果画面の数字が3つまでに抑えられている。
- 壊れたデータの退避、書き込みの直列化、listen の run 番号、`speakAsync` のガードなど、落ちない作りへの配慮が一貫している。
- 課金は土台だけ・無料機能は無料のまま、という方針がコードとテストで担保されている。

## Go の条件（直すべき順）

1. **P1-1** `StudyScreen.tsx:195-245` カードに `accessibilityRole="button"`＋`onAccessibilityTap={p.onTap}`（Web は Pressable）。
2. **P1-2** `HomeScreen.tsx:65`／`SettingsScreen.tsx:44` のチップ文言を `${score}` に（label は「目標スコア N点」維持）か、`ui.tsx:187` に `numberOfLines={1} adjustsFontSizeToFit`。
3. **P1-3** `App.tsx:147-148` 目標を `days.goalToday` で固定し `available===0` で達成扱い。`learning.ts:445-448` `newWordsToday` から失敗した復習（`miss≥1`）を除外。`copy.ts:11` の「1日20語まで」を新語10／合計20の説明に。
4. **P1-4** `learning.ts:439-448` `studiedToday`/`newWordsToday` から判定なしだけの語を除外。`copy.ts:37` を「タップで飛ばす（記録なし）」。
5. **P2-1** `App.tsx:591` `<=` → `<`。
6. **P2-2** `copy.ts:19,60` `more` を語数つきに（呼び出し側は `plan.words.length`）。
7. **P2-3** `StudyResultScreen.tsx:29` の題を「学習の結果」に。
8. **P2-4** `HomeScreen.tsx:129` 空の点の枠を `c.border` に。
9. **P2-6** `App.tsx:358-369` `advance` 後 250ms はロック維持。
10. **P2-15** `CLAUDE.md` の存在しない `docs/NEXT_ACTIONS.md`・`docs/QA_REPORT.md` 参照を直す。

上記 1〜4 を直し、`npm run check` と `npm run e2e` が通れば PR として出してよい。5〜10 は同じ PR に入れられる規模（各 1〜10 行）。
