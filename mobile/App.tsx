import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import data from "../words.json";
import appJson from "./app.json";
import {
  BANDS,
  CATCH_UP_AFTER_DAYS,
  DAILY_GOAL,
  daysSinceSeen,
  isDue,
  isWeak,
  makeQuiz,
  orderByPriority,
  retainedCount,
  shuffle,
  studiedToday,
  studyWords,
  todayPlan,
  weakWordsAcross,
  type Progress,
  type Question,
  type StudyMode,
  type Word,
} from "./src/learning";
import { MY_BAND, findDuplicate, isCustomId, isCustomWord, validateCustomWord, type CustomWordInput } from "./src/customWords";
import type { StudySession } from "./src/session";
import { lastSevenDays, daysSinceLastStudy, goalFor } from "./src/days";
import { runListen } from "./src/listen";
import { PREMIUM_ENABLED } from "./src/premium";
import { speakEnglish, stopSpeech, speakAsync, sleep } from "./src/speech";
import { useProgress } from "./src/useProgress";
import { useCustomWords } from "./src/useCustomWords";
import { useSession } from "./src/useSession";
import { useSettings } from "./src/useSettings";
import { useDays } from "./src/useDays";
import { useToday } from "./src/useToday";
import { useReview } from "./src/useReview";
import { useReduceMotion } from "./src/useReduceMotion";
import { fontScale, type, useTheme } from "./src/theme";
import { copy } from "./src/copy";
import { HomeScreen } from "./src/screens/HomeScreen";
import { StudyScreen } from "./src/screens/StudyScreen";
import { StudyResultScreen } from "./src/screens/StudyResultScreen";
import { QuizResultScreen, QuizScreen } from "./src/screens/QuizScreen";
import { LevelScreen } from "./src/screens/LevelScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ListenScreen } from "./src/screens/ListenScreen";
import { WordFormScreen } from "./src/screens/WordFormScreen";
import { PlusScreen } from "./src/screens/PlusScreen";

const builtinWords: Word[] = data;
const validIds = new Set(builtinWords.map((w) => w.No));
/** 進捗に残してよい単語の番号（収録単語と、自分で登録した単語） */
const isKnownId = (id: number) => validIds.has(id) || isCustomId(id);
const VERSION: string = appJson.expo.version;
const DAY = 24 * 60 * 60 * 1000;
/** 「苦手だけ復習」（レベルをまたぐ）のときの band。戻り先はホーム */
const ACROSS = -1;
/** 学習画面の操作ヒントを見せる回数（この回数の学習を終えたら消す） */
const HINT_SESSIONS = 3;
/** 「取り消す」を出しておく時間 */
const UNDO_MS = 4000;
/** 耳だけ復習で一度に読み上げる語数 */
const LISTEN_SIZE = 20;

type Screen = "home" | "settings" | "plus" | "level" | "study" | "studyResult" | "quiz" | "quizResult" | "listen" | "wordForm";
type Tally = StudySession["tally"];
type Undo = { message: string; progress: Progress; session: StudySession; bumped: boolean };
type LastResult = { mode: StudySession["mode"]; band: number; ids: number[]; tally: Tally };
type Listen = { queue: Word[]; index: number; paused: boolean; finished: boolean; from: Screen };

/** VoiceOver に状態の変化を読み上げてもらう（画面に出るだけでは読まれないもの） */
function announce(text: string) {
  try {
    AccessibilityInfo.announceForAccessibility(text);
  } catch {
    // Web など、対応していない環境では何もしない
  }
}
const emptyForm = (band: number): CustomWordInput => ({ word: "", meaning: "", example: "", example_ja: "", score_band: band });
const bandName = (b: number) => (b === MY_BAND ? copy.home.myWords : `${b}点レベル`);

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const theme = useTheme();
  const { c, dark } = theme;
  const reduceMotion = useReduceMotion();
  const { settings, update: updateSettings } = useSettings();
  const {
    progress,
    ready: progressReady,
    error: progressError,
    notice,
    dismissNotice,
    record,
    touchWord,
    restore,
    recordQuizCorrect,
    forget,
    retry,
  } = useProgress(isKnownId);
  const {
    customWords,
    ready: customReady,
    error: customError,
    add: addCustomWord,
    edit: editCustomWord,
    remove: removeCustomWord,
  } = useCustomWords(BANDS);
  const words = useMemo(() => [...builtinWords, ...customWords], [customWords]);
  const wordsById = useMemo(() => new Map(words.map((w) => [w.No, w])), [words]);
  const sessionStore = useSession(wordsById, progressReady && customReady);
  const days = useDays();
  // 今日の日付。開いたまま日付が変わったら、今日の学習語数・予定・目標を新しい日で組み直す
  const today = useToday();
  const review = useReview();

  // ---- 集計 ----
  const masteredSet = useMemo(() => new Set(progress.mastered), [progress.mastered]);
  const weakByBand = useMemo(() => {
    const counts = new Map<number, number>();
    for (const w of words) if (isWeak(progress, w.No)) counts.set(w.score_band, (counts.get(w.score_band) ?? 0) + 1);
    return counts;
  }, [progress, words]);
  const masteredByBand = useMemo(() => {
    const counts = new Map<number, number>();
    for (const w of words) if (masteredSet.has(w.No)) counts.set(w.score_band, (counts.get(w.score_band) ?? 0) + 1);
    return counts;
  }, [masteredSet, words]);
  const totalByBand = useMemo(() => {
    const counts = new Map<number, number>();
    for (const w of words) counts.set(w.score_band, (counts.get(w.score_band) ?? 0) + 1);
    return counts;
  }, [words]);
  const masteredTotal = [...masteredByBand.values()].reduce((sum, n) => sum + n, 0);
  const target = settings.target;
  // today は中で使わないが、日付が変わったら数え直すために依存に入れる
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doneToday = useMemo(() => studiedToday(progress), [progress, today]);
  const sinceLast = daysSinceLastStudy(days.log);
  // しばらくぶり: 新しい単語は出さず、覚えた単語のおさらいから
  const catchUp = doneToday === 0 && sinceLast !== null && sinceLast >= CATCH_UP_AFTER_DAYS;
  // 今日の残り分（復習と、1日の上限までの新しい単語）
  const basePlan = useMemo(
    () => (target ? todayPlan(words, progress, target, Math.max(5, DAILY_GOAL - doneToday), Date.now(), Math.random, { catchUp }) : null),
    // today は中で使わないが、日付が変わったら組み直すために依存に入れる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, progress, doneToday, words, catchUp, today],
  );
  // 今日の目標は20語。出せる単語がそれより少ない日（始めたばかり・復習が少ない日）は、出せる分までを目標にする。
  // その日に初めて組んだ語数で固定する（答えを見ずに「覚えた」にした語は新しい単語の枠を使わないため、固定しないと目標が途中で増えて見える）
  const available = basePlan?.words.length ?? 0;
  // 目標は today の日付で取り出す（上の語数・予定と同じ日付で比べ、別の日の値を混ぜない）
  const storedGoal = goalFor(days.goal, today);
  const goalToday = storedGoal ?? Math.max(1, Math.min(DAILY_GOAL, doneToday + available));
  // 目標に届いたか、出せる語が尽きたら達成
  const reached = doneToday > 0 && (doneToday >= goalToday || available === 0);
  const allReady = progressReady && customReady && days.ready;
  const { setGoalToday } = days;
  useEffect(() => {
    if (allReady && target && basePlan && storedGoal === null && doneToday + available > 0) setGoalToday(goalToday, today);
  }, [allReady, target, basePlan, storedGoal, setGoalToday, doneToday, available, goalToday, today]);
  // 目標達成後の「さらに10語」は、新しい単語の上限を超えてよい
  const morePlan = useMemo(
    () => (target && reached ? todayPlan(words, progress, target, 10, Date.now(), Math.random, { more: true }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, progress, words, reached, today],
  );
  const plan = reached ? morePlan : basePlan;
  const weakAcross = useMemo(() => (target ? weakWordsAcross(words, progress, target).length : 0), [words, progress, target]);
  const notYetSet = useMemo(() => new Set(progress.notYet), [progress.notYet]);
  const hasRecord = useCallback(
    (w: Word) => masteredSet.has(w.No) || notYetSet.has(w.No) || !!progress.stats?.[w.No],
    [masteredSet, notYetSet, progress.stats],
  );
  const listenPool = useMemo(() => (target ? words.filter((w) => w.score_band <= target && hasRecord(w)) : []), [words, target, hasRecord]);

  // ---- 画面 ----
  const [screen, setScreen] = useState<Screen>("home");
  const [band, setBand] = useState(BANDS[0]);
  const [revealed, setRevealed] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [listen, setListen] = useState<Listen | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<Word[]>([]);
  const [hideCustomError, setHideCustomError] = useState(false);
  // 単語の登録・編集
  const [form, setForm] = useState<CustomWordInput>(() => emptyForm(MY_BAND));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [formSaved, setFormSaved] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formFrom, setFormFrom] = useState<Screen>("home");
  const duplicate = useMemo(
    () => (screen === "wordForm" ? findDuplicate(words, form.word, editingId ?? undefined) : undefined),
    [screen, words, form.word, editingId],
  );

  // 学習の途中位置（保存されたものと同じ内容を、操作の中で同期的に読むための控え）
  const studyRef = useRef<StudySession | null>(null);
  const lock = useRef(false);
  // 判定の直後しばらくは次のカードの判定を受けない（連打で2枚進まないように）
  const lockUntil = useRef(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishCount = useRef(0);
  const prevDone = useRef(doneToday);
  const session = sessionStore.session;
  const current = session ? (wordsById.get(session.ids[session.index]) ?? null) : null;

  useEffect(() => {
    // iPhone の消音スイッチでも発音が聞こえるように。ほかのアプリの音は止めない。
    // 耳だけ復習は画面を消しても続ける（UIBackgroundModes: audio）
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers", shouldPlayInBackground: true }).catch(() => {});
    return () => stopSpeech();
  }, []);
  // 今日の目標に届いたとき（1日1回）
  const { goalReached } = review;
  useEffect(() => {
    if (prevDone.current < goalToday && doneToday >= goalToday && doneToday > 0) {
      goalReached();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    prevDone.current = doneToday;
  }, [doneToday, goalToday, goalReached]);
  useEffect(() => {
    lock.current = false;
  }, [screen, session?.index, qIndex]);

  function go(next: Screen) {
    stopSpeech();
    clearUndo();
    setScreen(next);
  }
  /** 学習・クイズ・耳だけ復習から戻る先 */
  function origin(mode: StudySession["mode"], b: number): Screen {
    return mode === "today" || b === ACROSS ? "home" : "level";
  }
  function back() {
    switch (screen) {
      case "wordForm":
        return go(formFrom);
      case "study":
      case "studyResult": {
        const s = studyRef.current ?? lastResult;
        return go(s ? origin(s.mode, s.band) : "home");
      }
      case "quiz":
      case "quizResult":
        return go("level");
      case "listen":
        return stopListen();
      default:
        return go("home");
    }
  }
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "home") return false;
      back();
      return true;
    });
    return () => sub.remove();
  });
  function speak(text: string) {
    speakEnglish([text]);
  }
  // 自動発音はタップの処理の中で呼ぶ（スマホのブラウザは操作直後でないと音を出せないため）
  function autoSpeakWord(value: string | undefined) {
    if (settings.autoSpeak && value) speak(value);
  }
  function toggleAutoSpeak() {
    const next = !settings.autoSpeak;
    updateSettings({ autoSpeak: next });
    if (!next) stopSpeech();
  }

  // ---- 学習（カード）----
  function clearUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndo(null);
  }
  function beginStudy(mode: StudySession["mode"], b: number, queue: Word[]) {
    if (queue.length === 0) return;
    const now = Date.now();
    const s: StudySession = {
      mode,
      band: b,
      ids: queue.map((w) => w.No),
      index: 0,
      reverse: settings.reverse,
      tally: { learned: 0, notYet: 0, skipped: 0 },
      startedAt: now,
      updatedAt: now,
    };
    studyRef.current = s;
    sessionStore.save(s);
    setBand(b);
    setRevealed(false);
    if (settings.hintsSeen < HINT_SESSIONS) updateSettings({ hintsSeen: settings.hintsSeen + 1 });
    go("study");
    if (!s.reverse) autoSpeakWord(queue[0]?.word);
  }
  function startToday() {
    if (!plan || !target) return;
    beginStudy("today", ACROSS, plan.words);
  }
  function startWeakAcross() {
    if (!target) return;
    beginStudy("weak", ACROSS, weakWordsAcross(words, progress, target));
  }
  function startLevel(mode: StudyMode) {
    beginStudy(mode, band, studyWords(words, band, progress, mode));
  }
  function retryNotYet() {
    if (!lastResult) return;
    const ids = lastResult.ids.filter((id) => progress.notYet.includes(id));
    beginStudy(lastResult.mode === "today" ? "weak" : lastResult.mode, lastResult.band, ids.map((id) => wordsById.get(id)!).filter(Boolean));
  }
  /** 保存されていた途中位置から再開する */
  function resume() {
    if (!session) return;
    const ids = session.ids.filter((id, i) => i < session.index || wordsById.has(id));
    const s = { ...session, ids, index: Math.min(session.index, ids.length) };
    if (s.index >= s.ids.length) {
      sessionStore.clear();
      return;
    }
    studyRef.current = s;
    sessionStore.save(s);
    setBand(s.band);
    setRevealed(false);
    go("study");
    if (!s.reverse) autoSpeakWord(wordsById.get(s.ids[s.index])?.word);
  }
  function reveal() {
    const w = current;
    const s = studyRef.current;
    if (!w || !s || revealed) return;
    setRevealed(true);
    if (settings.autoSpeak) speakEnglish(s.reverse ? [w.word, w.example] : [w.example]);
  }
  function studyTap() {
    if (!revealed) return reveal();
    const w = current;
    const s = studyRef.current;
    if (!w || !s || lock.current || Date.now() < lockUntil.current) return;
    lock.current = true;
    // 判定せずに次へ: 見たことだけ記録する（覚えた単語は変えない）
    const counted = !masteredSet.has(w.No);
    if (counted) {
      touchWord(w.No);
      days.bump();
    }
    clearUndo();
    advance(s, { ...s.tally, skipped: s.tally.skipped + 1 });
  }
  function markCard(mastered: boolean) {
    const w = current;
    const s = studyRef.current;
    if (!w || !s || lock.current || Date.now() < lockUntil.current) return;
    lock.current = true;
    const before = progress;
    record(w.No, mastered, { confident: mastered && !revealed });
    days.bump();
    void Haptics.selectionAsync().catch(() => {});
    if (undoTimer.current) clearTimeout(undoTimer.current);
    announce(copy.study.undone(w.word, mastered));
    setUndo({ message: copy.study.undone(w.word, mastered), progress: before, session: s, bumped: true });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
    advance(s, mastered ? { ...s.tally, learned: s.tally.learned + 1 } : { ...s.tally, notYet: s.tally.notYet + 1 });
  }
  function advance(s: StudySession, tally: Tally) {
    stopSpeech();
    lockUntil.current = Date.now() + 250;
    setRevealed(false);
    if (s.index + 1 >= s.ids.length) {
      finishStudy({ ...s, tally });
      return;
    }
    const next = { ...s, index: s.index + 1, tally };
    studyRef.current = next;
    sessionStore.save(next);
    if (!next.reverse) autoSpeakWord(wordsById.get(next.ids[next.index])?.word);
  }
  function finishStudy(s: StudySession) {
    finishCount.current += 1;
    setLastResult({ mode: s.mode, band: s.band, ids: s.ids, tally: s.tally });
    studyRef.current = null;
    sessionStore.clear();
    go("studyResult");
  }
  function undoMark() {
    if (!undo) return;
    restore(undo.progress);
    if (undo.bumped) days.unbump();
    studyRef.current = undo.session;
    sessionStore.save(undo.session);
    setRevealed(true);
    clearUndo();
  }

  // ---- クイズ ----
  function startQuiz() {
    const next = makeQuiz(words, band, progress);
    if (next.length === 0) return;
    setQuestions(next);
    setQIndex(0);
    setSelected(null);
    setCorrect(0);
    setWrong([]);
    go("quiz");
    autoSpeakWord(next[0]?.word.word);
  }
  const question = questions[qIndex];
  function answer(choice: number) {
    if (!question || lock.current || selected !== null) return;
    lock.current = true;
    setSelected(choice);
    days.bump();
    announce(choice === question.correctIndex ? copy.quiz.correct : copy.quiz.wrong);
    if (choice === question.correctIndex) {
      setCorrect((n) => n + 1);
      recordQuizCorrect(question.word.No);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setWrong((list) => [...list, question.word]);
      record(question.word.No, false);
    }
  }
  function nextQuestion() {
    if (selected === null) return;
    stopSpeech();
    setSelected(null);
    if (qIndex + 1 >= questions.length) go("quizResult");
    else {
      setQIndex(qIndex + 1);
      autoSpeakWord(questions[qIndex + 1]?.word.word);
    }
  }

  // ---- 耳だけ復習 ----
  const listenCtl = useRef({ stopped: true, paused: false, skipTo: 0, at: 0, run: 0 });
  function listenQueueFor(pool: Word[], fallback: Word[]): Word[] {
    const ordered = orderByPriority(pool, progress).slice(0, LISTEN_SIZE);
    if (ordered.length >= LISTEN_SIZE) return ordered;
    const chosen = new Set(ordered.map((w) => w.No));
    return [...ordered, ...shuffle(fallback.filter((w) => !chosen.has(w.No))).slice(0, LISTEN_SIZE - ordered.length)];
  }
  function startListen(queue: Word[], from: Screen) {
    if (queue.length === 0) return;
    const ctl = listenCtl.current;
    ctl.stopped = false;
    ctl.paused = false;
    ctl.skipTo = 0;
    ctl.at = 0;
    const run = ++ctl.run;
    setListen({ queue, index: 0, paused: false, finished: false, from });
    go("listen");
    const live = () => !ctl.stopped && ctl.run === run;
    // 「次へ」で飛ばしたあとは、その単語の残りを読まずに次へ進む
    const speakOrSkip = (u: Parameters<typeof speakAsync>[0]) => (ctl.at < ctl.skipTo ? Promise.resolve() : speakAsync(u));
    const sleepOrSkip = async (ms: number) => {
      const until = Date.now() + ms;
      while (Date.now() < until && live() && ctl.at >= ctl.skipTo) await sleep(Math.min(100, until - Date.now()));
    };
    const waitWhilePaused = async () => {
      while (ctl.paused && live()) await sleep(150);
    };
    runListen(
      queue,
      speakOrSkip,
      sleepOrSkip,
      { stopped: () => !live(), waitWhilePaused },
      (i) => {
        ctl.at = i;
        if (live()) setListen((l) => (l ? { ...l, index: i } : l));
      },
    )
      .then(() => {
        if (live()) setListen((l) => (l ? { ...l, index: queue.length, finished: true } : l));
      })
      .catch(() => {});
  }
  function listenPause() {
    const ctl = listenCtl.current;
    ctl.paused = !ctl.paused;
    if (ctl.paused) stopSpeech();
    setListen((l) => (l ? { ...l, paused: ctl.paused } : l));
  }
  function listenSkip() {
    const ctl = listenCtl.current;
    ctl.skipTo = ctl.at + 1;
    ctl.paused = false;
    stopSpeech();
    setListen((l) => (l ? { ...l, paused: false } : l));
  }
  function listenNotYet() {
    const w = listen?.queue[listen.index];
    if (!w || listen.finished) return;
    record(w.No, false);
    days.bump();
    void Haptics.selectionAsync().catch(() => {});
    listenSkip();
  }
  function stopListen() {
    const ctl = listenCtl.current;
    ctl.stopped = true;
    stopSpeech();
    const from = listen?.from ?? "home";
    setListen(null);
    go(from);
  }

  // ---- 単語の登録・編集 ----
  function openWordForm(word?: Word, newBand = MY_BAND) {
    setFormFrom(screen);
    setEditingId(word ? word.No : null);
    setForm(word ? { word: word.word, meaning: word.meaning, example: word.example, example_ja: word.example_ja, score_band: word.score_band } : emptyForm(newBand));
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
    const saved = `「${added.word}」を${bandName(added.score_band)}に登録しました。続けて登録できます。`;
    setFormSaved(saved);
    announce(saved);
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

  // ---- 描画 ----
  type Banner = { message: string; action: string; onAction: () => void };
  const banners: Banner[] = [];
  if (progressError) banners.push({ message: progressError, action: copy.common.retry, onAction: retry });
  if (notice) banners.push({ message: notice, action: copy.common.close, onAction: dismissNotice });
  if (customError && !hideCustomError)
    banners.push({ message: customError, action: copy.common.close, onAction: () => setHideCustomError(true) });

  let body: React.ReactNode;
  if (!progressReady || !customReady) {
    body = (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text maxFontSizeMultiplier={fontScale.text} style={[type.callout, { color: c.muted }]}>
          {progressError ? copy.common.reloading : copy.common.loading}
        </Text>
        {banners.length > 0 && (
          <Text maxFontSizeMultiplier={fontScale.text} onPress={banners[0].onAction} style={[type.button, { color: c.accent, marginTop: 16 }]}>
            {banners[0].action}
          </Text>
        )}
      </View>
    );
  } else if (screen === "study" && session && current && studyRef.current) {
    const w = current;
    const stat = progress.stats?.[w.No];
    const badges = [
      isWeak(progress, w.No) && copy.study.weakBadge,
      masteredSet.has(w.No) && copy.study.dueBadge(daysSinceSeen(stat) ?? 0),
      isCustomWord(w) && copy.study.customBadge,
    ].filter((b): b is string => typeof b === "string");
    body = (
      <StudyScreen
        theme={theme}
        reduceMotion={reduceMotion}
        word={w}
        index={session.index}
        total={session.ids.length}
        revealed={revealed}
        reverse={session.reverse}
        badges={badges}
        showHints={settings.hintsSeen < HINT_SESSIONS}
        autoSpeak={settings.autoSpeak}
        undo={undo ? { message: undo.message, onUndo: undoMark } : null}
        onToggleAutoSpeak={toggleAutoSpeak}
        onTap={studyTap}
        onMark={markCard}
        onSpeak={speak}
        onBack={back}
      />
    );
  } else if (screen === "studyResult" && lastResult) {
    const isToday = lastResult.mode === "today";
    const notYetIds = lastResult.ids.filter((id) => progress.notYet.includes(id));
    const tomorrow = isToday && target ? todayPlan(words, progress, target, DAILY_GOAL, Date.now() + DAY) : null;
    const more = plan ? plan.words.length : 0;
    body = (
      <StudyResultScreen
        theme={theme}
        isToday={isToday}
        tally={lastResult.tally}
        doneToday={doneToday}
        goal={goalToday}
        reached={reached}
        encouragement={copy.result.encouragements[(finishCount.current - 1 + copy.result.encouragements.length) % copy.result.encouragements.length]}
        tomorrow={tomorrow ? copy.result.tomorrow(tomorrow.review, tomorrow.fresh) : null}
        primary={
          isToday
            ? reached || !more
              ? { label: copy.result.done, onPress: () => go("home") }
              : { label: copy.home.continueToday(doneToday, goalToday), onPress: startToday }
            : {
                label: origin(lastResult.mode, lastResult.band) === "home" ? copy.result.done : copy.result.backToMenu,
                onPress: () => go(origin(lastResult.mode, lastResult.band)),
              }
        }
        retryNotYet={notYetIds.length > 0 ? { label: copy.result.retryNotYet(notYetIds.length), onPress: retryNotYet } : null}
        tertiary={
          isToday
            ? reached && more
              ? { label: copy.result.more(more), onPress: startToday }
              : !reached && more
                ? { label: copy.result.done, onPress: () => go("home") }
                : null
            : null
        }
        onBack={back}
      />
    );
  } else if (screen === "quiz" && question) {
    body = (
      <QuizScreen
        theme={theme}
        question={question}
        index={qIndex}
        total={questions.length}
        correct={correct}
        selected={selected}
        autoSpeak={settings.autoSpeak}
        onToggleAutoSpeak={toggleAutoSpeak}
        onAnswer={answer}
        onNext={nextQuestion}
        onSpeak={speak}
        onBack={back}
      />
    );
  } else if (screen === "quizResult") {
    body = (
      <QuizResultScreen
        theme={theme}
        correct={correct}
        total={questions.length}
        wrong={wrong}
        onRetry={startQuiz}
        onMenu={() => go("level")}
        onSpeak={speak}
        onBack={back}
      />
    );
  } else if (screen === "listen" && listen) {
    body = (
      <ListenScreen
        theme={theme}
        word={listen.queue[listen.index] ?? null}
        index={listen.index}
        total={listen.queue.length}
        paused={listen.paused}
        finished={listen.finished}
        onPauseToggle={listenPause}
        onSkip={listenSkip}
        onMarkNotYet={listenNotYet}
        onStop={stopListen}
        onRestart={() => startListen(listen.queue, listen.from)}
      />
    );
  } else if (screen === "level") {
    const isMine = band === MY_BAND;
    const inBand = words.filter((w) => w.score_band === band);
    body = (
      <LevelScreen
        theme={theme}
        band={band}
        total={inBand.length}
        mastered={masteredByBand.get(band) ?? 0}
        weak={weakByBand.get(band) ?? 0}
        due={inBand.filter((w) => hasRecord(w) && isDue(progress, w.No)).length}
        reverse={settings.reverse}
        onToggleReverse={(reverse) => updateSettings({ reverse })}
        onStart={startLevel}
        onQuiz={startQuiz}
        onListen={() => startListen(listenQueueFor(inBand.filter(hasRecord), inBand), "level")}
        registered={isMine ? customWords : customWords.filter((w) => w.score_band === band)}
        onAddWord={() => openWordForm(undefined, band)}
        onEditWord={(w) => openWordForm(w)}
        canAdd={customReady}
        onBack={back}
      />
    );
  } else if (screen === "settings") {
    body = (
      <SettingsScreen
        theme={theme}
        target={target}
        onChooseTarget={(score) => {
          updateSettings({ target: score });
          // 目標が変われば、その日の目標語数も組み直す
          if (score !== target) setGoalToday(null);
        }}
        autoSpeak={settings.autoSpeak}
        onAutoSpeak={(on) => {
          updateSettings({ autoSpeak: on });
          if (!on) stopSpeech();
        }}
        reverse={settings.reverse}
        onReverse={(on) => updateSettings({ reverse: on })}
        version={VERSION}
        stats={{ mastered: masteredTotal, retained: retainedCount(progress), weak: weakAcross, all: words.length }}
        onPlus={PREMIUM_ENABLED ? () => go("plus") : undefined}
        onBack={back}
      />
    );
  } else if (screen === "plus") {
    // 課金の仕組みを入れるまで、商品は空（この画面はフラグが有効なときしか開けない）
    body = <PlusScreen theme={theme} products={[]} onPurchase={() => {}} onRestore={() => {}} onBack={back} />;
  } else if (screen === "wordForm") {
    body = (
      <WordFormScreen
        theme={theme}
        form={form}
        onChange={(patch) => {
          setForm((f) => ({ ...f, ...patch }));
          setFormError("");
          setFormSaved("");
        }}
        editing={editingId !== null}
        duplicate={duplicate}
        error={formError}
        saved={formSaved}
        storeError={customError}
        confirmDelete={confirmDelete}
        canSave={customReady}
        onSave={saveWordForm}
        onDelete={deleteWordForm}
        onBack={back}
      />
    );
  } else {
    // ホーム（学習の途中なら「続きから」を最優先）
    let primary: { label: string; onPress: () => void; disabled?: boolean } | null = null;
    let secondary: { label: string; onPress: () => void } | null = null;
    let note = "";
    const sessionLeft = session && sessionStore.ready ? session.ids.length - session.index : 0;
    if (session && sessionLeft > 0) {
      const where = session.mode === "today" || session.band === ACROSS ? "" : bandName(session.band);
      primary = { label: copy.home.resume(session.index, session.ids.length, where), onPress: resume };
      if (reached) note = copy.home.reachedBody;
    } else if (!plan || plan.words.length === 0) {
      if (reached) {
        note = copy.home.reachedBody;
      } else {
        primary = { label: copy.home.noWords, onPress: () => {}, disabled: true };
        note = copy.home.noWordsBody;
      }
    } else if (reached) {
      note = copy.home.reachedBody;
      secondary = { label: copy.home.more(plan.words.length), onPress: startToday };
    } else if (catchUp && plan.review > 0) {
      note = copy.home.catchUpBody;
      primary = { label: copy.home.catchUp(plan.words.length), onPress: startToday };
    } else if (doneToday > 0) {
      primary = { label: copy.home.continueToday(doneToday, goalToday), onPress: startToday };
    } else {
      primary = { label: copy.home.start(plan.words.length), onPress: startToday };
    }
    body = (
      <HomeScreen
        theme={theme}
        target={target}
        onChooseTarget={(score) => {
          updateSettings({ target: score });
          // 目標が変われば、その日の目標語数も組み直す
          if (score !== target) setGoalToday(null);
        }}
        doneToday={doneToday}
        goal={goalToday}
        planLine={plan && plan.words.length > 0 ? copy.home.plan(plan.weak, plan.review, plan.fresh) : ""}
        primary={primary}
        secondary={secondary}
        note={note}
        reached={reached}
        weekDots={lastSevenDays(days.log)}
        weakAcross={weakAcross}
        onWeakOnly={startWeakAcross}
        listenCount={Math.min(LISTEN_SIZE, listenPool.length)}
        onListen={() => startListen(listenQueueFor(listenPool, listenPool), "home")}
        levels={BANDS.map((b) => ({ band: b, total: totalByBand.get(b) ?? 0, mastered: masteredByBand.get(b) ?? 0, weak: weakByBand.get(b) ?? 0 }))}
        onLevel={(b) => {
          setBand(b);
          go("level");
        }}
        myWords={{ total: totalByBand.get(MY_BAND) ?? 0, mastered: masteredByBand.get(MY_BAND) ?? 0 }}
        totals={{ mastered: masteredTotal, all: words.length }}
        onSettings={() => go("settings")}
        banners={banners}
      />
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? "light" : "dark"} />
      {body}
    </SafeAreaView>
  );
}
