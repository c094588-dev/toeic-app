import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Speech from "expo-speech";
import { setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import data from "../words.json";
import {
  BANDS,
  DAILY_GOAL,
  isWeak,
  makeQuiz,
  studiedToday,
  studyWords,
  todayPlan,
  type Question,
  type StudyMode,
  type Word,
} from "./src/learning";
import { clozeExample } from "./src/cloze";
import { useProgress } from "./src/useProgress";
import { useCustomWords } from "./src/useCustomWords";
import {
  LIMITS,
  MY_BAND,
  findDuplicate,
  isCustomId,
  isCustomWord,
  validateCustomWord,
  type CustomWordInput,
} from "./src/customWords";
const builtinWords: Word[] = data;
const validIds = new Set(builtinWords.map((w) => w.No));
/** 進捗に残してよい単語の番号（収録単語と、自分で登録した単語） */
const isKnownId = (id: number) => validIds.has(id) || isCustomId(id);
const SETTINGS_KEY = "toeic.settings.v1";
const bands = BANDS;
const labels = [
  "基礎を、確かな力に。",
  "仕事の英語に、一歩先へ。",
  "表現の幅を、もっと広く。",
  "難しい文も、読み解く力へ。",
  "高得点へ、最後のひと押し。",
];
type Screen = "home" | "mode" | "study" | "studyResult" | "quiz" | "result" | "wordForm";
/** レベルの名前（マイ単語帳は MY_BAND） */
const bandName = (b: number) => (b === MY_BAND ? "マイ単語帳" : `${b}点レベル`);
/** 1500 → "1,500" */
const formatCount = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const emptyForm = (band: number): CustomWordInput => ({
  word: "",
  meaning: "",
  example: "",
  example_ja: "",
  score_band: band,
});
/** 学習カードをこの距離（px）以上、左右に動かしたら「まだ」「覚えた」を記録する */
const SWIPE_DISTANCE = 90;
export default function App() {
  return (
    <SafeAreaProvider>
      <LearningApp />
    </SafeAreaProvider>
  );
}
function LearningApp() {
  const dark = useColorScheme() === "dark";
  const c = dark
    ? {
        bg: "#111B22",
        card: "#1C2932",
        ink: "#F2F6F5",
        muted: "#A8BABD",
        line: "#34454C",
        border: "#667C83",
        track: "#3E5158",
        accent: "#80DACC",
        soft: "#243E3F",
        wrong: "#FFA487",
        wrongBorder: "#E0876B",
      }
    : {
        bg: "#F5F6F2",
        card: "#FFFFFF",
        ink: "#172F36",
        muted: "#55696D",
        line: "#E0E7E4",
        border: "#7C8C87",
        track: "#D3DCD8",
        accent: "#176F66",
        soft: "#E7F2EE",
        wrong: "#9A4329",
        wrongBorder: "#A9502F",
      };
  // 英単語は1行に収まる大きさにする（長い単語が途中で折り返されないように）
  const { width: screenWidth } = useWindowDimensions();
  function wordFontSize(value: string) {
    const longest = Math.max(...value.split(/\s+/).map((t) => t.length), 1);
    const available = Math.min(screenWidth, 600) - 44 - 48;
    return Math.max(22, Math.min(40, Math.floor(available / (longest * 0.64))));
  }
  const {
    progress,
    ready,
    error,
    notice,
    dismissNotice,
    record,
    recordQuizCorrect,
    forget,
    retry,
  } = useProgress(isKnownId);
  // 自分で登録した単語（マイ単語帳、または 500〜900 のレベルに入れたもの）
  const {
    customWords,
    ready: customReady,
    error: customError,
    add: addCustomWord,
    edit: editCustomWord,
    remove: removeCustomWord,
  } = useCustomWords(BANDS);
  const words = useMemo(() => [...builtinWords, ...customWords], [customWords]);
  // レベルごとの苦手な単語の数
  const weakByBand = useMemo(() => {
    const counts = new Map<number, number>();
    for (const w of words)
      if (isWeak(progress, w.No))
        counts.set(w.score_band, (counts.get(w.score_band) ?? 0) + 1);
    return counts;
  }, [progress, words]);
  // レベルごとの習得数（配列の includes を毎回回さないよう Set で集計）
  const masteredByBand = useMemo(() => {
    const masteredSet = new Set(progress.mastered);
    const counts = new Map<number, number>();
    for (const w of words)
      if (masteredSet.has(w.No))
        counts.set(w.score_band, (counts.get(w.score_band) ?? 0) + 1);
    return counts;
  }, [progress.mastered, words]);
  // 覚えた単語の数（削除した単語の記録は数えない）
  const masteredTotal = [...masteredByBand.values()].reduce((sum, n) => sum + n, 0);
  const [screen, setScreen] = useState<Screen>("home");
  const [band, setBand] = useState(500);
  const [queue, setQueue] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // true: 日本語の意味から英単語を思い出す（逆向きカード）
  const [reverseCards, setReverseCards] = useState(false);
  // 単語が表示されたら自動で発音する（イヤホン利用を想定して既定はオン）
  const [autoSpeak, setAutoSpeak] = useState(true);
  // 目標スコア（500〜900）。未設定なら null
  const [target, setTarget] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  // 単語の登録・編集の画面
  const [form, setForm] = useState<CustomWordInput>(() => emptyForm(MY_BAND));
  // 編集中の単語の番号（新しく登録するときは null）
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [formSaved, setFormSaved] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 登録画面を閉じたときに戻る画面
  const [formFrom, setFormFrom] = useState<Screen>("home");
  const duplicate = useMemo(
    () => (screen === "wordForm" ? findDuplicate(words, form.word, editingId ?? undefined) : undefined),
    [screen, words, form.word, editingId],
  );
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : null;
        if (typeof saved?.autoSpeak === "boolean") setAutoSpeak(saved.autoSpeak);
        if (BANDS.includes(saved?.target)) setTarget(saved.target);
      })
      .catch(() => {});
  }, []);
  function saveSettings(next: { autoSpeak: boolean; target: number | null }) {
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  }
  function toggleAutoSpeak() {
    const next = !autoSpeak;
    setAutoSpeak(next);
    if (!next) void Speech.stop();
    saveSettings({ autoSpeak: next, target });
  }
  function chooseTarget(score: number) {
    setTarget(score);
    setEditingTarget(false);
    saveSettings({ autoSpeak, target: score });
  }
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<Word[]>([]);
  // 学習の種類（レベル別の各モード、または「今日の学習」）
  const [studyMode, setStudyMode] = useState<StudyMode | "today">("unmastered");
  const isToday = studyMode === "today" && (screen === "study" || screen === "studyResult");
  const doneToday = useMemo(() => studiedToday(progress), [progress]);
  // 今日の残り語数（目標達成後は「もう少し」10語ずつ）
  const todaySize = doneToday >= DAILY_GOAL ? 10 : Math.max(5, DAILY_GOAL - doneToday);
  const plan = useMemo(
    () => (target ? todayPlan(words, progress, target, todaySize) : null),
    [target, progress, todaySize, words],
  );
  const answerLock = useRef(false);
  const fade = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  // 学習画面: タップで答えの表示・次へ、左右のスワイプで「まだ」（左）「覚えた」（右）
  const swipeX = useRef(new Animated.Value(0)).current;
  const studyActions = useRef({ tap: () => {}, mark: (_mastered: boolean) => {} });
  studyActions.current = {
    tap: studyTap,
    mark: (mastered) => {
      if (answerLock.current) return;
      // 次のカードは元の位置からフェードインさせる
      fade.setValue(0);
      swipeX.setValue(0);
      advanceCard(mastered);
    },
  };
  // 指を動かしたか（動かしてから元の位置に戻した場合はタップにしない）
  const studyMoved = useRef(false);
  const studyPan = useRef(
    PanResponder.create({
      // 学習画面のどこから触っても受け取る（中のボタンは、ボタンの方が優先される）
      onStartShouldSetPanResponder: () => true,
      // ボタンの上から始めても、横に動かしたらスワイプとして受け取る
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) >= 10 && Math.abs(g.dx) > Math.abs(g.dy),
      // 横に動かし始めたら、縦のスクロールに取られないようにする
      onPanResponderTerminationRequest: (_, g) => Math.abs(g.dx) < 10,
      onPanResponderGrant: () => {
        studyMoved.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) >= 10 || Math.abs(g.dy) >= 10) studyMoved.current = true;
        swipeX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        const flicked = Math.abs(g.vx) > 0.6 && Math.abs(g.dx) > 40;
        if (Math.abs(g.dx) >= SWIPE_DISTANCE || flicked) {
          studyActions.current.mark(g.dx > 0);
        } else if (!studyMoved.current) {
          swipeX.setValue(0);
          studyActions.current.tap();
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;
  const word = queue[index];
  const question = questions[index];
  const total = words.filter((w) => w.score_band === band).length;
  const mastered = masteredByBand.get(band) ?? 0;
  const weak = weakByBand.get(band) ?? 0;
  const title =
    screen === "home"
      ? "英単語ノート"
      : screen === "wordForm"
        ? editingId === null
          ? "単語を登録"
          : "単語を編集"
        : isToday
          ? "今日の学習"
          : band === MY_BAND
            ? "マイ単語帳"
            : `TOEIC ${band}点`;
  function go(next: Screen) {
    void Speech.stop();
    setScreen(next);
  }
  function back() {
    if (screen === "wordForm") go(formFrom);
    else go(screen === "mode" || isToday ? "home" : "mode");
  }
  // ---- 単語の登録・編集 ----
  /** 登録画面を開く。word を渡すとその単語の編集、渡さなければ newBand に新しく登録 */
  function openWordForm(word?: Word, newBand = MY_BAND) {
    setFormFrom(screen);
    setEditingId(word ? word.No : null);
    setForm(
      word
        ? {
            word: word.word,
            meaning: word.meaning,
            example: word.example,
            example_ja: word.example_ja,
            score_band: word.score_band,
          }
        : emptyForm(newBand),
    );
    setFormError("");
    setFormSaved("");
    setConfirmDelete(false);
    go("wordForm");
  }
  function saveWordForm() {
    const problem = validateCustomWord(form, BANDS);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (editingId !== null) {
      editCustomWord(editingId, form);
      go(formFrom);
      return;
    }
    const added = addCustomWord(form);
    // 続けて登録しやすいよう、登録先はそのままで入力欄だけ空にする
    setForm(emptyForm(form.score_band));
    setFormError("");
    setFormSaved(`「${added.word}」を${bandName(added.score_band)}に登録しました。続けて登録できます。`);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }
  function deleteWordForm() {
    if (editingId === null) return;
    // 1回目は確認を出し、もう一度押したら削除する（Web では確認ダイアログが出せないため）
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    removeCustomWord(editingId);
    forget(editingId);
    go(formFrom);
  }
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "home") return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [screen]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    swipeX.setValue(0);
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [screen, index]);
  useEffect(() => {
    // iPhone のマナーモード（消音スイッチ）でも発音が聞こえるようにする。
    // 音楽などほかのアプリの音は止めずに重ねて鳴らす
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(
      () => {},
    );
  }, []);
  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );
  function speak(text: string) {
    speakAll([text]);
  }
  /** 続けて読み上げる（単語 → 例文など）。前の読み上げは止める */
  function speakAll(texts: string[]) {
    void Speech.stop();
    for (const t of texts)
      Speech.speak(t, { language: "en-US", rate: 0.88, onError: () => {} });
  }
  // 自動発音はタップの処理の中で呼ぶ（スマホのブラウザは操作直後でないと音を出せないため）
  function autoSpeakWord(value: string | undefined) {
    if (autoSpeak && value) speak(value);
  }
  function startStudy(mode: StudyMode | "today") {
    const next =
      mode === "today"
        ? todayPlan(words, progress, target ?? BANDS[0], todaySize).words
        : studyWords(words, band, progress, mode);
    setStudyMode(mode);
    setQueue(next);
    setIndex(0);
    setRevealed(false);
    answerLock.current = false;
    go("study");
    if (!reverseCards) autoSpeakWord(next[0]?.word);
  }
  function startQuiz() {
    const next = makeQuiz(words, band, progress);
    setQuestions(next);
    setIndex(0);
    setSelected(null);
    setCorrect(0);
    setWrong([]);
    answerLock.current = false;
    go("quiz");
    autoSpeakWord(next[0]?.word.word);
  }
  /**
   * カードの答えを表示し、出てきた例文を自動で読み上げる。
   * 逆向きカードでは、ここで初めて英単語が出るので「単語 → 例文」の順に読む
   */
  function reveal() {
    if (!word || revealed) return;
    setRevealed(true);
    if (autoSpeak)
      speakAll((reverseCards ? [word.word, word.example] : [word.example]).filter(Boolean));
  }
  function studyTap() {
    if (revealed) advanceCard();
    else reveal();
  }
  /** 次のカードへ。markAs を指定すると「覚えた」(true) /「まだ」(false) を記録する */
  function advanceCard(markAs?: boolean) {
    if (!word || answerLock.current) return;
    answerLock.current = true;
    if (markAs !== undefined) record(word.No, markAs);
    void Haptics.selectionAsync().catch(() => {});
    void Speech.stop();
    setRevealed(false);
    if (index + 1 >= queue.length) go("studyResult");
    else {
      setIndex(index + 1);
      if (!reverseCards) autoSpeakWord(queue[index + 1]?.word);
    }
  }
  useEffect(() => {
    answerLock.current = false;
  }, [index, screen]);
  function answer(choice: number) {
    if (!question || answerLock.current || selected !== null) return;
    answerLock.current = true;
    setSelected(choice);
    if (choice === question.correctIndex) {
      setCorrect((n) => n + 1);
      recordQuizCorrect(question.word.No);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    } else {
      setWrong((list) => [...list, question.word]);
      record(question.word.No, false);
    }
  }
  function nextQuestion() {
    if (selected === null) return;
    void Speech.stop();
    setSelected(null);
    if (index + 1 >= questions.length) go("result");
    else {
      setIndex(index + 1);
      autoSpeakWord(questions[index + 1]?.word.word);
    }
  }
  const text = (value: string, size = 16, color = c.ink) => (
    <Text style={{ color, fontSize: size, lineHeight: size * 1.5 }}>
      {value}
    </Text>
  );
  function button(
    label: string,
    onPress: () => void,
    secondary = false,
    disabled = false,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          s.button,
          {
            backgroundColor: secondary ? c.soft : c.accent,
            opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text
          style={[
            s.buttonText,
            { color: secondary ? c.accent : dark ? "#102A28" : "#FFFFFF" },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
  function meter(value: number, max: number) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max, now: value }}
        style={[s.track, { backgroundColor: c.track }]}
      >
        <View
          style={{
            width: `${max ? Math.min(100, (value / max) * 100) : 0}%`,
            height: 5,
            backgroundColor: c.accent,
            borderRadius: 5,
          }}
        />
      </View>
    );
  }
  function heading(kicker: string, main: string, subtitle: string, compact = false) {
    return (
      <View style={[s.heading, compact && { paddingVertical: 4, gap: 8 }]}>
        {!!kicker && text(kicker, 14, c.accent)}
        <Text style={[s.hero, compact && s.heroCompact, { color: c.ink }]}>{main}</Text>
        {text(subtitle, 16, c.muted)}
      </View>
    );
  }
  /** スワイプ中にカードの上に出す「覚えた」「まだ」の目印 */
  function swipeStamp(
    label: string,
    color: string,
    side: { left: number } | { right: number },
    inputRange: number[],
    outputRange: number[],
  ) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          s.swipeStamp,
          side,
          {
            borderColor: color,
            backgroundColor: c.card,
            opacity: swipeX.interpolate({ inputRange, outputRange, extrapolate: "clamp" }),
          },
        ]}
      >
        <Text style={[s.swipeStampText, { color }]}>{label}</Text>
      </Animated.View>
    );
  }
  function wordCard(w: Word, showMeaning: boolean) {
    const studying = screen === "study";
    // 学習中のタップは画面全体で受けるので、カード内は表示だけ
    function tappable(content: React.ReactNode) {
      return <View style={{ flexGrow: 1, flexShrink: 1 }}>{content}</View>;
    }
    function audioButton(value: string, label: string) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="英語で読み上げます"
          onPress={() => speak(value)}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.soft,
            opacity: pressed ? 0.65 : 1,
            flexShrink: 0,
          })}
        >
          <Text accessible={false} style={{ fontSize: 21 }}>🔊</Text>
        </Pressable>
      );
    }
    const size = wordFontSize(w.word);
    const reverse = studying && reverseCards;
    const englishWord = (
      <View style={{ alignItems: "center", gap: 12 }}>
        {tappable(
          <Text
            selectable={!studying}
            numberOfLines={w.word.includes(" ") ? 2 : 1}
            style={[s.word, { color: c.ink, fontSize: size, lineHeight: Math.round(size * 1.3) }]}
          >
            {w.word}
          </Text>
        )}
        {!studying && audioButton(w.word, `${w.word}の発音を聞く`)}
      </View>
    );
    const cardContent = (
      <>
        {reverse
          ? tappable(
              <Text style={[s.meaningText, s.reversePrompt, { color: c.ink }]}>
                {w.meaning}
              </Text>,
            )
          : englishWord}
        {reverse && !showMeaning && !!w.example && (
          <View style={[s.meaning, { borderTopColor: c.line }]}>
            {text("例文（空欄に入る英単語は？）", 14, c.accent)}
            {tappable(text(clozeExample(w.word, w.example), 17, c.ink))}
          </View>
        )}
        {showMeaning && (
          <View style={[s.meaning, { borderTopColor: c.line }]}>
            {reverse
              ? englishWord
              : tappable(<Text style={[s.meaningText, { color: c.ink }]}>{w.meaning}</Text>)}
            {(!!w.example || !!w.example_ja) && (
              <View style={{ gap: 8 }}>
                {!!w.example && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {tappable(text(w.example, 17, c.ink))}
                    {audioButton(w.example, "英語の例文を聞く")}
                  </View>
                )}
                {!!w.example_ja && tappable(text(w.example_ja, 16, c.muted))}
              </View>
            )}
          </View>
        )}
        {studying && (
          <Pressable accessibilityRole="button" onPress={studyTap}>
            <Text style={[s.hint, { color: c.muted }]}>
              {showMeaning
                ? "右にスワイプで「覚えた」、左で「まだ」\nタップすると記録せずに次へ"
                : reverse
                  ? "画面のどこかをタップして英単語を表示"
                  : "画面のどこかをタップして意味を表示"}
            </Text>
          </Pressable>
        )}
      </>
    );
    return (
      <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>
        {studying && (isWeak(progress, w.No) || isCustomWord(w)) && (
          <View style={s.badges}>
            {isWeak(progress, w.No) && (
              <View style={[s.weakBadge, { borderColor: c.wrongBorder }]}>
                <Text style={[s.weakBadgeText, { color: c.wrong }]}>苦手な単語</Text>
              </View>
            )}
            {isCustomWord(w) && (
              <View style={[s.weakBadge, { borderColor: c.border }]}>
                <Text style={[s.weakBadgeText, { color: c.muted }]}>自分で登録</Text>
              </View>
            )}
          </View>
        )}
        {cardContent}
      </View>
    );
  }
  function targetChips() {
    return (
      <View style={s.chips}>
        {BANDS.map((score) => {
          const on = target === score;
          return (
            <Pressable
              key={score}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`目標スコア ${score}点`}
              onPress={() => chooseTarget(score)}
              style={({ pressed }) => [
                s.chip,
                {
                  borderColor: on ? c.accent : c.border,
                  backgroundColor: on ? c.accent : c.card,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  { color: on ? (dark ? "#102A28" : "#FFFFFF") : c.ink, fontWeight: on ? "700" : "500" },
                ]}
              >
                {score}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  /** ホームの「今日の学習」。目標スコアに合わせて、その日に学習する単語をおまかせで選ぶ */
  /** ホームの「マイ単語帳」 */
  function myWordbookCard() {
    const n = words.filter((w) => w.score_band === MY_BAND).length;
    const m = masteredByBand.get(MY_BAND) ?? 0;
    const weakCount = weakByBand.get(MY_BAND) ?? 0;
    return (
      <View style={[s.level, { backgroundColor: c.card, borderColor: c.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`マイ単語帳、${n}語中${m}語習得`}
          onPress={() => {
            setBand(MY_BAND);
            go("mode");
          }}
          style={({ pressed }) => ({ gap: 10, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={s.row}>
            <Text style={[s.levelNumber, { color: c.ink, fontSize: 24 }]}>マイ単語帳</Text>
            {text("→", 24, c.accent)}
          </View>
          {text(n > 0 ? "自分で登録した単語を覚える。" : "覚えたい単語を、自分で登録できます。", 16, c.muted)}
          {n > 0 && meter(m, n)}
          {n > 0 && (
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              {text(`${m} / ${n} 語を習得`, 14, c.muted)}
              {weakCount > 0 && text(`苦手 ${weakCount}語`, 14, c.wrong)}
            </View>
          )}
        </Pressable>
        {button("＋ 単語を登録する", () => openWordForm(), true, !customReady)}
      </View>
    );
  }
  /** 学習メニューの下に出す、登録した単語の一覧（マイ単語帳では全て、レベルではそのレベルの分） */
  function registeredWordsCard() {
    const list = customWords.filter((w) => band === MY_BAND || w.score_band === band).reverse();
    const description =
      band === MY_BAND
        ? list.length > 0
          ? `全部で${list.length}語。タップすると編集できます。各レベルに入れた単語もここに出ます。`
          : "英単語と意味を入れるだけで登録できます。"
        : list.length > 0
          ? `${list.length}語。タップすると編集できます。`
          : "このレベルに、自分で単語を足せます。";
    return (
      <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>
        {text(band === MY_BAND ? "登録した単語" : "このレベルに登録した単語", 24)}
        {text(description, 16, c.muted)}
        {list.length > 0 && (
          <View>
            {list.map((w) => (
              <Pressable
                key={w.No}
                accessibilityRole="button"
                accessibilityLabel={`${w.word}、${w.meaning}。編集する`}
                onPress={() => openWordForm(w)}
                style={({ pressed }) => [
                  s.row,
                  s.wordRow,
                  { borderTopColor: c.line, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View style={{ flexShrink: 1, gap: 2 }}>
                  <Text style={[s.wordRowWord, { color: c.ink }]}>{w.word}</Text>
                  {text(w.meaning, 15, c.muted)}
                </View>
                {band === MY_BAND && text(bandName(w.score_band), 13, c.accent)}
              </Pressable>
            ))}
          </View>
        )}
        {button(
          band === MY_BAND ? "＋ 単語を登録する" : "＋ このレベルに単語を登録する",
          () => openWordForm(undefined, band),
          band !== MY_BAND,
          !customReady,
        )}
      </View>
    );
  }
  /** 登録画面の入力欄 */
  function formField(
    label: string,
    key: "word" | "meaning" | "example" | "example_ja",
    props: TextInputProps,
  ) {
    return (
      <View style={{ gap: 6 }}>
        {text(label, 15, c.ink)}
        <TextInput
          value={form[key]}
          onChangeText={(value) => {
            setForm((f) => ({ ...f, [key]: value }));
            setFormError("");
            setFormSaved("");
            setConfirmDelete(false);
          }}
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          style={[
            s.input,
            props.multiline && s.inputMultiline,
            { color: c.ink, borderColor: c.border, backgroundColor: c.bg },
          ]}
          {...props}
        />
      </View>
    );
  }
  /** 登録先（マイ単語帳・各レベル）を選ぶボタン */
  function bandChips() {
    const chip = (b: number) => {
      const on = form.score_band === b;
      return (
        <Pressable
          key={b}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          accessibilityLabel={`登録先 ${bandName(b)}`}
          onPress={() => setForm((f) => ({ ...f, score_band: b }))}
          style={({ pressed }) => [
            s.chip,
            b === MY_BAND && { flexBasis: "auto", flexGrow: 0 },
            {
              borderColor: on ? c.accent : c.border,
              backgroundColor: on ? c.accent : c.card,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={[
              s.chipText,
              { color: on ? (dark ? "#102A28" : "#FFFFFF") : c.ink, fontWeight: on ? "700" : "500" },
            ]}
          >
            {b === MY_BAND ? "マイ単語帳" : b}
          </Text>
        </Pressable>
      );
    };
    return (
      <View style={{ gap: 6 }}>
        {chip(MY_BAND)}
        <View style={s.chips}>{BANDS.map(chip)}</View>
      </View>
    );
  }
  function todayCard() {
    if (!target || editingTarget)
      return (
        <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {text("目標スコアを選んでください", 22)}
          {text(
            "目標までのレベルから、「今日の学習」で毎日20語をおまかせで出します。あとで変えられます。",
            16,
            c.muted,
          )}
          {targetChips()}
          {target && button("キャンセル", () => setEditingTarget(false), true)}
        </View>
      );
    const reached = doneToday >= DAILY_GOAL;
    return (
      <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={s.row}>
          {text("今日の学習", 22)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`目標スコア ${target}点。タップして変更`}
            onPress={() => setEditingTarget(true)}
            style={({ pressed }) => [
              s.pill,
              { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[s.pillText, { color: c.accent }]}>目標 {target}点 ›</Text>
          </Pressable>
        </View>
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            {text(reached ? "今日の目標、達成！" : "今日の進み具合", 16, reached ? c.accent : c.ink)}
            <Text style={[s.todayCount, { color: c.accent }]}>
              {doneToday}
              <Text style={{ fontSize: 16 }}> / {DAILY_GOAL}語</Text>
            </Text>
          </View>
          {meter(Math.min(doneToday, DAILY_GOAL), DAILY_GOAL)}
        </View>
        {plan &&
          text(
            [
              plan.weak > 0 && `苦手 ${plan.weak}語`,
              plan.review > 0 && `復習 ${plan.review}語`,
              plan.fresh > 0 && `新しい単語 ${plan.fresh}語`,
            ]
              .filter(Boolean)
              .join("・") || "出せる単語がありません",
            16,
            c.muted,
          )}
        {button(
          reached ? "もう少し学習する" : doneToday > 0 ? "今日の学習を続ける" : "今日の学習を始める",
          () => startStudy("today"),
        )}
      </View>
    );
  }
  /** 画面下に固定するボタン欄（親指が届きやすい位置に主な操作を置く） */
  function footer(content: React.ReactNode) {
    return (
      <View style={[s.footer, { backgroundColor: c.bg, borderTopColor: c.line }]}>
        <View style={s.footerInner}>{content}</View>
      </View>
    );
  }
  function autoSpeakToggle() {
    return (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: autoSpeak }}
        accessibilityLabel="単語を自動で発音"
        onPress={toggleAutoSpeak}
        style={({ pressed }) => [
          s.pill,
          {
            borderColor: autoSpeak ? c.accent : c.border,
            backgroundColor: autoSpeak ? c.soft : c.card,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[s.pillText, { color: autoSpeak ? c.accent : c.muted }]}>
          {autoSpeak ? "🔊 自動発音 オン" : "🔇 自動発音 オフ"}
        </Text>
      </Pressable>
    );
  }
  function footerAudioButton(value: string, disabled: boolean) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="発音を聞く"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => speak(value)}
        style={({ pressed }) => [
          s.footerAudio,
          {
            backgroundColor: c.soft,
            borderColor: c.border,
            opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text accessible={false} style={{ fontSize: 26 }}>🔊</Text>
      </Pressable>
    );
  }
  function markButton(label: string, a11yLabel: string, value: boolean) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onPress={() => advanceCard(value)}
        style={({ pressed }) => [
          s.markButton,
          {
            backgroundColor: value ? c.accent : c.card,
            borderColor: value ? c.accent : c.wrongBorder,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text
          style={[
            s.buttonText,
            { color: value ? (dark ? "#102A28" : "#FFFFFF") : c.wrong },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={[s.header, { borderBottomColor: c.line }]}>
        {screen !== "home" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="前の画面に戻る"
            onPress={back}
            style={s.back}
          >
            {text("‹ 戻る", 16, c.accent)}
          </Pressable>
        ) : (
          <Text style={[s.brand, { color: c.ink }]}>{title}</Text>
        )}
        {screen !== "home" && (
          <Text style={[s.brand, { color: c.ink }]}>{title}</Text>
        )}
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          s.content,
          screen === "study" && word && { flexGrow: 1, paddingBottom: 0 },
        ]}
      >
        {!!notice && (
          <View style={[s.notice, { backgroundColor: c.soft }]}>
            {text(notice, 16)}
            {button("閉じる", dismissNotice, true)}
          </View>
        )}
        {!!error && (
          <View style={[s.notice, { backgroundColor: c.soft }]}>
            {text(error, 16)}
            {button("再試行", retry, true)}
          </View>
        )}
        {!ready ? (
          <View style={s.heading}>
            {text(
              error ? "進捗を確認しています" : "学習の準備をしています…",
              20,
            )}
          </View>
        ) : (
          <Animated.View
            style={{ opacity: fade, gap: 18, flexGrow: screen === "study" && word ? 1 : 0 }}
          >
            {screen === "home" && (
              <>
                {heading(
                  "",
                  "今日のひとことが、\n明日の自信に。",
                  "今日の学習か、レベルを選びましょう。",
                  true,
                )}
                <View style={[s.summary, { backgroundColor: c.soft }]}>
                  <View style={s.row}>
                    {text("覚えた単語", 16, c.ink)}
                    <Text style={[s.stat, { color: c.accent }]}>
                      {formatCount(masteredTotal)}
                      <Text style={{ fontSize: 16 }}> / {formatCount(words.length)}</Text>
                    </Text>
                  </View>
                  {meter(masteredTotal, words.length)}
                </View>
                {todayCard()}
                {myWordbookCard()}
                {bands.map((b, i) => {
                  const n = words.filter((w) => w.score_band === b).length;
                  const m = masteredByBand.get(b) ?? 0;
                  return (
                    <Pressable
                      key={b}
                      accessibilityRole="button"
                      accessibilityLabel={`TOEIC ${b}点レベル、${n}語中${m}語習得`}
                      onPress={() => {
                        setBand(b);
                        go("mode");
                      }}
                      style={({ pressed }) => [
                        s.level,
                        {
                          backgroundColor: c.card,
                          borderColor: c.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <View style={s.row}>
                        <Text style={[s.levelNumber, { color: c.ink }]}>
                          {b}
                          <Text style={{ fontSize: 16 }}> 点レベル</Text>
                        </Text>
                        {text("→", 24, c.accent)}
                      </View>
                      {text(labels[i], 16, c.muted)}
                      {meter(m, n)}
                      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                        {text(`${m} / ${n} 語を習得`, 14, c.muted)}
                        {(weakByBand.get(b) ?? 0) > 0 &&
                          text(`苦手 ${weakByBand.get(b)}語`, 14, c.wrong)}
                      </View>
                    </Pressable>
                  );
                })}
                {text("進捗はこの端末に保存されます。", 14, c.muted)}
                {text(
                  "TOEIC は ETS の登録商標です。このアプリは ETS の承認・推奨を受けたものではありません。",
                  14,
                  c.muted,
                )}
              </>
            )}
            {screen === "mode" && (
              <>
                {heading(
                  "学習メニュー",
                  band === MY_BAND ? "自分だけの、単語帳。" : `${band}点への、一歩。`,
                  total === 0
                    ? "まだ単語がありません。覚えたい単語を登録しましょう。"
                    : `${total}語のうち、${mastered}語を習得済み。${weak > 0 ? `苦手な単語は${weak}語。` : ""}`,
                )}
                {total > 0 && (
                <>
                <View
                  style={[
                    s.card,
                    { backgroundColor: c.card, borderColor: c.line },
                  ]}
                >
                  {text("覚える", 24)}
                  {text(
                    reverseCards
                      ? "日本語の意味から英単語を思い出して、答え合わせ。"
                      : "意味を思い出してから、答え合わせ。苦手な単語から先に出します。",
                    16,
                    c.muted,
                  )}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {([false, true] as const).map((rev) => {
                      const on = reverseCards === rev;
                      return (
                        <Pressable
                          key={String(rev)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={rev ? "日本語から英単語を答える" : "英単語から日本語を答える"}
                          onPress={() => setReverseCards(rev)}
                          style={({ pressed }) => [
                            s.toggle,
                            {
                              borderColor: on ? c.accent : c.border,
                              backgroundColor: on ? c.accent : c.card,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.toggleText,
                              {
                                color: on ? (dark ? "#102A28" : "#FFFFFF") : c.ink,
                                fontWeight: on ? "700" : "500",
                              },
                            ]}
                          >
                            {rev ? "日本語 → 英語" : "英語 → 日本語"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {button(`覚えていない単語（${total - mastered}語）`, () =>
                    startStudy("unmastered"),
                  )}
                  {weak > 0 &&
                    button(`苦手な単語だけ（${weak}語）`, () => startStudy("weak"), true)}
                  {button(
                    `全ての単語（${total}語）`,
                    () => startStudy("all"),
                    true,
                  )}
                </View>
                <View
                  style={[
                    s.card,
                    { backgroundColor: c.card, borderColor: c.line },
                  ]}
                >
                  {text("確かめる", 24)}
                  {text(
                    `4択・${Math.min(10, total)}問。苦手な単語を優先して出題します。`,
                    16,
                    c.muted,
                  )}
                  {button("4択クイズを始める →", startQuiz)}
                  {text("間違えた単語は「まだ」に戻ります。", 14, c.muted)}
                </View>
                </>
                )}
                {registeredWordsCard()}
              </>
            )}
            {screen === "wordForm" && (
              <>
                {heading(
                  "",
                  editingId === null ? "単語を登録" : "単語を編集",
                  "英単語と意味は必ず入れてください。例文はなくても登録できます。",
                  true,
                )}
                {!!formSaved && (
                  <View style={[s.notice, { backgroundColor: c.soft, marginBottom: 0 }]}>
                    {text(formSaved, 15, c.ink)}
                  </View>
                )}
                {!!customError && text(customError, 15, c.wrong)}
                <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>
                  {formField("英単語", "word", {
                    placeholder: "例：deadline",
                    autoCapitalize: "none",
                    autoCorrect: false,
                    maxLength: LIMITS.word,
                  })}
                  {!!duplicate &&
                    text(
                      `「${duplicate.word}」は${bandName(duplicate.score_band)}に${isCustomWord(duplicate) ? "登録済み" : "収録されています"}。このまま登録することもできます。`,
                      14,
                      c.wrong,
                    )}
                  {formField("意味", "meaning", { placeholder: "例：締め切り", maxLength: LIMITS.meaning })}
                  {formField("例文（なくても可）", "example", {
                    placeholder: "例：The deadline is this Friday.",
                    autoCapitalize: "sentences",
                    multiline: true,
                    maxLength: LIMITS.example,
                  })}
                  {formField("例文の訳（なくても可）", "example_ja", {
                    placeholder: "例：締め切りは今週の金曜日です。",
                    multiline: true,
                    maxLength: LIMITS.example_ja,
                  })}
                  <View style={{ gap: 8 }}>
                    {text("登録先", 15, c.ink)}
                    {bandChips()}
                  </View>
                  {!!formError && text(formError, 15, c.wrong)}
                  {button(editingId === null ? "登録する" : "保存する", saveWordForm, false, !customReady)}
                  {editingId !== null &&
                    button(confirmDelete ? "本当に削除する" : "この単語を削除する", deleteWordForm, true)}
                  {confirmDelete && text("削除すると、この単語の学習記録も消えます。", 14, c.wrong)}
                </View>
              </>
            )}
            {screen === "study" &&
              (word ? (
                // 画面のどこをタップしても答えの表示・次へ進める（片手・親指で操作しやすく）。
                // 左右にスワイプすると「まだ」「覚えた」を記録して次へ
                <View {...studyPan.panHandlers} style={s.studyArea}>
                  <View style={s.row}>
                    <View style={{ flexShrink: 1 }}>
                      {text(
                        `${isToday ? "今日の学習" : "フラッシュカード"}${reverseCards ? "（日本語 → 英語）" : ""}`,
                        14,
                        c.accent,
                      )}
                      {text(`${index + 1} / ${queue.length}`, 16, c.muted)}
                    </View>
                    {autoSpeakToggle()}
                  </View>
                  {meter(index, queue.length)}
                  <Animated.View
                    style={{
                      transform: [
                        { translateX: swipeX },
                        {
                          rotate: swipeX.interpolate({
                            inputRange: [-300, 0, 300],
                            outputRange: ["-6deg", "0deg", "6deg"],
                          }),
                        },
                      ],
                    }}
                  >
                    {wordCard(word, revealed)}
                    {swipeStamp("覚えた ✓", c.accent, { left: 16 }, [0, SWIPE_DISTANCE], [0, 1])}
                    {swipeStamp("まだ", c.wrong, { right: 16 }, [-SWIPE_DISTANCE, 0], [1, 0])}
                  </Animated.View>
                </View>
              ) : (
                <>
                  {isToday ? (
                    <>
                      {heading("今日の学習", "出せる単語がありません", "目標スコアを上げると、新しい単語が増えます。")}
                      {button("ホームに戻る", () => go("home"))}
                    </>
                  ) : (
                    <>
                      {heading(
                        "すべて習得",
                        "このレベルは習得済み！",
                        "全ての単語でおさらいすることもできます。",
                      )}
                      {button("全ての単語を復習する", () => startStudy("all"))}
                    </>
                  )}
                </>
              ))}
            {screen === "studyResult" && (
              <>
                {heading(
                  "おつかれさまでした",
                  isToday && doneToday >= DAILY_GOAL ? "今日の目標、達成！" : "ひと区切り、完了。",
                  isToday
                    ? `今日は${doneToday}語を学習しました（目標 ${DAILY_GOAL}語）。`
                    : `${queue.length}語を確認しました。少しずつ、確かな力に。`,
                )}
                {button(isToday ? "もう少し学習する" : "もう一度学習する", () => startStudy(studyMode))}
                {isToday
                  ? button("ホームに戻る", () => go("home"), true)
                  : button(band === MY_BAND ? "マイ単語帳のメニューに戻る" : "レベルのメニューに戻る", () => go("mode"), true)}
              </>
            )}
            {screen === "quiz" &&
              (question ? (
                <>
                  <View style={s.row}>
                    <View style={{ flexShrink: 1 }}>
                      {text(`4択クイズ ${index + 1} / ${questions.length}問`, 14, c.accent)}
                      {text(`正解 ${correct}`, 16, c.muted)}
                    </View>
                    {autoSpeakToggle()}
                  </View>
                  {meter(index, questions.length)}
                  {wordCard(question.word, selected !== null)}
                  {question.choices.map((choice, i) => {
                    const isCorrect =
                      selected !== null && i === question.correctIndex;
                    const isWrong = selected === i && !isCorrect;
                    return (
                      <Pressable
                        key={i}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: selected !== null }}
                        disabled={selected !== null}
                        onPress={() => answer(i)}
                        style={[
                          s.choice,
                          {
                            backgroundColor: isCorrect ? c.soft : c.card,
                            borderColor: isWrong
                              ? c.wrongBorder
                              : isCorrect
                                ? c.accent
                                : c.border,
                          },
                        ]}
                      >
                        {text(
                          `${isCorrect ? "✓" : isWrong ? "×" : String.fromCharCode(65 + i)}   ${choice}`,
                          17,
                          isWrong ? c.wrong : c.ink,
                        )}
                      </Pressable>
                    );
                  })}
                </>
              ) : (
                <>
                  {text("出題できる単語がありません。")}
                  {button("戻る", () => go("mode"))}
                </>
              ))}
            {screen === "result" && (
              <>
                {heading(
                  "クイズの結果",
                  `${correct} / ${questions.length}`,
                  correct === questions.length
                    ? "全問正解！その調子です。"
                    : "思い出すたび、記憶は少しずつ強くなる。",
                )}
                {wrong.length > 0 && (
                  <>
                    {text("復習する単語", 20)}
                    {wrong.map((w) => (
                      <View
                        key={w.No}
                        style={[
                          s.level,
                          { backgroundColor: c.card, borderColor: c.line },
                        ]}
                      >
                        <View style={s.row}>
                          <Text style={[s.brand, { color: c.ink, flex: 1 }]}>
                            {w.word}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${w.word}の発音を聞く`}
                            onPress={() => speak(w.word)}
                            style={s.back}
                          >
                            {text("🔊 発音", 16, c.accent)}
                          </Pressable>
                        </View>
                        {text(w.meaning, 16, c.muted)}
                      </View>
                    ))}
                  </>
                )}
                {button("もう一度挑戦する", startQuiz)}
                {button("メニューに戻る", () => go("mode"), true)}
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>
      {ready &&
        screen === "study" &&
        word &&
        footer(
          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* 逆向きカードでは、答えを出す前に発音すると答えが分かってしまうので押せなくする */}
            {footerAudioButton(word.word, reverseCards && !revealed)}
            {markButton("まだ", "まだとして保存して次へ", false)}
            {markButton("覚えた ✓", "覚えたとして保存して次へ", true)}
          </View>,
        )}
      {ready &&
        screen === "quiz" &&
        question &&
        selected !== null &&
        footer(
          <>
            <Text
              style={[
                s.feedback,
                { color: selected === question.correctIndex ? c.accent : c.wrong },
              ]}
            >
              {selected === question.correctIndex
                ? "✓ 正解です！"
                : "× 不正解。「まだ」に追加しました。"}
            </Text>
            {button(
              index + 1 === questions.length ? "結果を見る" : "次の問題 →",
              nextQuestion,
            )}
          </>,
        )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontSize: 18, fontWeight: "700" },
  back: { minHeight: 44, minWidth: 48, justifyContent: "center" },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: 22,
    paddingBottom: 44,
  },
  heading: { gap: 12, paddingVertical: 18 },
  hero: {
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  heroCompact: { fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  reversePrompt: { fontSize: 26, lineHeight: 38, textAlign: "center", marginTop: 20 },
  toggle: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  toggleText: { fontSize: 15, lineHeight: 20, textAlign: "center" },
  chips: { flexDirection: "row", gap: 6 },
  chip: {
    flexBasis: 0,
    flexGrow: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  chipText: { fontSize: 17, lineHeight: 22 },
  todayCount: { fontSize: 26, fontWeight: "700" },
  badges: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: -8 },
  wordRow: { borderTopWidth: 1, paddingVertical: 12, gap: 12 },
  wordRowWord: { fontSize: 18, lineHeight: 26, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    minHeight: 50,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: "top" },
  weakBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  weakBadgeText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  // userSelect: Web でカードをマウスでドラッグしたとき、文字が選択されないようにする
  studyArea: { flexGrow: 1, gap: 18, paddingBottom: 44, userSelect: "none" },
  swipeStamp: {
    position: "absolute",
    top: 16,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  swipeStampText: { fontSize: 18, lineHeight: 26, fontWeight: "800" },
  pill: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pillText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  footerAudio: {
    width: 56,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 15, lineHeight: 22, textAlign: "center", paddingTop: 4 },
  footer: { borderTopWidth: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16 },
  footerInner: { width: "100%", maxWidth: 556, alignSelf: "center", gap: 10 },
  markButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  feedback: { fontSize: 17, lineHeight: 24, fontWeight: "700", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summary: { borderRadius: 20, padding: 22, gap: 16 },
  stat: { fontSize: 30, fontWeight: "700" },
  track: { height: 5, borderRadius: 5, overflow: "hidden" },
  level: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 10 },
  levelNumber: { fontSize: 28, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 26, padding: 24, gap: 20 },
  word: {
    fontWeight: "700",
    textAlign: "center",
    marginTop: 20,
  },
  meaning: { borderTopWidth: 1, paddingTop: 24, gap: 16 },
  meaningText: { fontSize: 24, fontWeight: "600" },
  button: {
    minHeight: 54,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  choice: {
    minHeight: 60,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  notice: { borderRadius: 16, padding: 18, gap: 12, marginBottom: 16 },
});
