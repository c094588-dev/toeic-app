import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import data from "../words.json";
import { makeQuiz, studyWords, type Word, type Question } from "./src/learning";
import { useProgress } from "./src/useProgress";
const words: Word[] = data;
const validIds = new Set(words.map((w) => w.No));
const bands = [500, 600, 700, 800, 900];
const labels = [
  "基礎を、確かな力に。",
  "仕事の英語に、一歩先へ。",
  "表現の幅を、もっと広く。",
  "難しい文も、読み解く力へ。",
  "高得点へ、最後のひと押し。",
];
type Screen = "home" | "mode" | "study" | "studyResult" | "quiz" | "result";
export default function App() {
  return (
    <SafeAreaProvider>
      <LearningApp />
    </SafeAreaProvider>
  );
}
function LearningApp() {
  const dark = useColorScheme() === "dark";
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const c = dark
    ? {
        bg: "#181C19",
        card: "#222824",
        ink: "#F1F1E7",
        muted: "#ADB6AC",
        line: "#3C443B",
        accent: "#D5ED89",
        soft: "#303D26",
        panel: "#D5ED89",
        panelInk: "#25301D",
      }
    : {
        bg: "#F4F3EB",
        card: "#FDFDF8",
        ink: "#242D27",
        muted: "#667164",
        line: "#DADDD1",
        accent: "#405D36",
        soft: "#E8EDD9",
        panel: "#27372D",
        panelInk: "#F1F3E7",
      };
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);
  const { progress, ready, error, notice, dismissNotice, record, retry } =
    useProgress(validIds);
  const masteredByBand = useMemo(() => {
    const masteredSet = new Set(progress.mastered);
    const counts = new Map<number, number>();
    for (const w of words)
      if (masteredSet.has(w.No))
        counts.set(w.score_band, (counts.get(w.score_band) ?? 0) + 1);
    return counts;
  }, [progress.mastered]);
  const [screen, setScreen] = useState<Screen>("home");
  const [band, setBand] = useState(500);
  const [queue, setQueue] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reverseCards, setReverseCards] = useState(false);
  const revealHint = reverseCards ? "タップして英単語を表示" : "タップして意味を表示";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<Word[]>([]);
  const [onlyUnmastered, setOnlyUnmastered] = useState(true);
  const answerLock = useRef(false);
  const fade = useRef(new Animated.Value(1)).current;
  const revealFade = useRef(new Animated.Value(0)).current;
  const scroll = useRef<ScrollView>(null);
  const word = queue[index];
  const question = questions[index];
  const total = words.filter((w) => w.score_band === band).length;
  const mastered = masteredByBand.get(band) ?? 0;
  const title = screen === "home" ? "単語ノート" : `TOEIC ${band}`;
  function go(next: Screen) {
    void Speech.stop();
    setScreen(next);
  }
  function back() {
    go(screen === "mode" ? "home" : "mode");
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
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: reduceMotion ? 0 : 260,
      useNativeDriver: true,
    }).start();
  }, [screen, index, reduceMotion]);
  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );
  useEffect(() => {
    revealFade.setValue(revealed ? 0 : 1);
    if (revealed)
      Animated.timing(revealFade, {
        toValue: 1,
        duration: reduceMotion ? 0 : 220,
        useNativeDriver: true,
      }).start();
  }, [revealed, reduceMotion]);
  function speak(text: string) {
    void Speech.stop();
    Speech.speak(text, { language: "en-US", rate: 0.88, onError: () => {} });
  }
  function startStudy(unmastered: boolean) {
    setOnlyUnmastered(unmastered);
    setQueue(studyWords(words, band, progress, unmastered));
    setIndex(0);
    setRevealed(false);
    answerLock.current = false;
    go("study");
  }
  function startQuiz() {
    setQuestions(makeQuiz(words, band, progress));
    setIndex(0);
    setSelected(null);
    setCorrect(0);
    setWrong([]);
    answerLock.current = false;
    go("quiz");
  }
  function advanceCard(markAs?: boolean) {
    if (!word || answerLock.current) return;
    answerLock.current = true;
    if (markAs !== undefined) record(word.No, markAs);
    void Haptics.selectionAsync().catch(() => {});
    void Speech.stop();
    setRevealed(false);
    if (index + 1 >= queue.length) go("studyResult");
    else setIndex(index + 1);
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
    else setIndex(index + 1);
  }
  const text = (value: string, size = 16, color = c.ink) => (
    <Text style={{ color, fontSize: size, lineHeight: size * 1.55 }}>
      {value}
    </Text>
  );
  function eyebrow(value: string, color = c.muted) {
    return <Text style={[s.eyebrow, { color }]}>{value}</Text>;
  }
  function arrow(color = c.ink, diagonal = false) {
    return (
      <Text accessible={false} style={{ color, fontSize: 23, lineHeight: 28 }}>
        {diagonal ? "↗" : "→"}
      </Text>
    );
  }
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
            backgroundColor: secondary ? c.soft : c.ink,
            opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        <Text style={[s.buttonText, { color: secondary ? c.ink : c.bg }]}>
          {label}
        </Text>
        {arrow(secondary ? c.ink : c.bg)}
      </Pressable>
    );
  }
  function meter(
    value: number,
    max: number,
    inverse = false,
    fillColor?: string,
  ) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max, now: value }}
        style={[s.track, { backgroundColor: inverse ? "#596750" : c.line }]}
      >
        <View
          style={{
            width: `${max ? Math.min(100, (value / max) * 100) : 0}%`,
            height: 3,
            backgroundColor: fillColor ?? (inverse ? "#D5ED89" : c.accent),
            borderRadius: 3,
          }}
        />
      </View>
    );
  }
  function heading(kicker: string, main: string, subtitle: string) {
    return (
      <View style={s.heading}>
        {eyebrow(kicker, c.accent)}
        <Text accessibilityRole="header" style={[s.hero, { color: c.ink }]}>
          {main}
        </Text>
        {text(subtitle, 14, c.muted)}
      </View>
    );
  }
  function audioButton(value: string, label: string) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="英語で読み上げます"
        onPress={() => speak(value)}
        style={({ pressed }) => [
          s.audio,
          { backgroundColor: c.soft, opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ width: 24, height: 24 }}
        >
          <View
            style={{
              position: "absolute",
              left: 2,
              top: 9,
              width: 5,
              height: 6,
              borderRadius: 1,
              backgroundColor: c.accent,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 5,
              top: 5,
              width: 0,
              height: 0,
              borderTopWidth: 7,
              borderBottomWidth: 7,
              borderRightWidth: 8,
              borderTopColor: "transparent",
              borderBottomColor: "transparent",
              borderRightColor: c.accent,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 13,
              top: 7,
              width: 5,
              height: 10,
              borderRightWidth: 1.5,
              borderColor: c.accent,
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 14,
              top: 3,
              width: 8,
              height: 18,
              borderRightWidth: 1.5,
              borderColor: c.accent,
              borderTopRightRadius: 12,
              borderBottomRightRadius: 12,
            }}
          />
        </View>
      </Pressable>
    );
  }
  function wordCard(w: Word, showMeaning: boolean) {
    const studying = screen === "study";
    const wordSize = Math.min(
      54,
      Math.max(22, (Math.min(width, 640) - 154) / (w.word.length * 0.48)),
    );
    const reverse = studying && reverseCards;
    const tapHint = showMeaning ? "タップして次へ" : revealHint;
    function tappable(content: React.ReactNode) {
      return studying ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint={tapHint}
          onPress={() => (showMeaning ? advanceCard() : setRevealed(true))}
          style={s.tappable}
        >
          {content}
        </Pressable>
      ) : (
        <View style={s.tappable}>{content}</View>
      );
    }
    return (
      <View
        style={[s.wordCard, { backgroundColor: c.card, borderColor: c.line }]}
      >
        <View style={s.row}>
          {eyebrow(`WORD ${String(w.No).padStart(4, "0")}`)}
          {studying ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="覚えたとして保存して次へ"
              onPress={() => advanceCard(true)}
              style={({ pressed }) => [
                s.mastery,
                { backgroundColor: c.soft, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              {text("覚えた", 13, c.accent)}
              {text("✓", 15, c.accent)}
            </Pressable>
          ) : (
            eyebrow(`${w.score_band} LEVEL`, c.accent)
          )}
        </View>
        <View style={[s.wordRow, { paddingVertical: studying ? 40 : 20 }]}>
          {tappable(
            <Text
              selectable={!studying}
              style={[
                s.word,
                {
                  color: c.ink,
                  fontSize: reverse ? 28 : wordSize,
                  lineHeight: reverse ? 42 : wordSize * 1.25,
                  ...(reverse ? { fontFamily: undefined, letterSpacing: 0 } : {}),
                },
              ]}
            >
              {reverse ? w.meaning : w.word}
            </Text>,
          )}
          {!reverse && audioButton(w.word, `${w.word}の発音を聞く`)}
        </View>
        {showMeaning && (
          <Animated.View
            style={[
              s.meaning,
              { borderTopColor: c.line, opacity: studying ? revealFade : 1 },
            ]}
          >
            {reverse ? (
              <View style={s.wordRow}>
                {tappable(
                  <Text style={[s.word, { color: c.ink, fontSize: wordSize, lineHeight: wordSize * 1.25 }]}>
                    {w.word}
                  </Text>,
                )}
                {audioButton(w.word, `${w.word}の発音を聞く`)}
              </View>
            ) : (
              tappable(
                <Text style={[s.meaningText, { color: c.ink }]}>
                  {w.meaning}
                </Text>,
              )
            )}
            <View style={{ gap: 8, marginTop: 12 }}>
              {eyebrow("IN CONTEXT", c.accent)}
              <View style={s.wordRow}>
                {tappable(
                  <Text style={[s.example, { color: c.ink }]}>
                    {w.example}
                  </Text>,
                )}
                {audioButton(w.example, "英語の例文を聞く")}
              </View>
              {tappable(text(w.example_ja, 14, c.muted))}
            </View>
          </Animated.View>
        )}
        {studying && !showMeaning && (
          <Pressable
            accessible={false}
            onPress={() => setRevealed(true)}
            style={{ height: 40 }}
          />
        )}
      </View>
    );
  }
  function completion(
    mark: string,
    kicker: string,
    main: string,
    subtitle: string,
  ) {
    return (
      <View
        style={{
          alignItems: "center",
          paddingTop: 24,
          paddingBottom: 16,
          gap: 26,
        }}
      >
        <View
          style={[
            s.completionSeal,
            { backgroundColor: c.soft, borderColor: c.line },
          ]}
        >
          <Text accessible={false} style={[s.sealText, { color: c.accent }]}>
            {mark}
          </Text>
        </View>
        <View style={{ alignItems: "center", gap: 14 }}>
          {eyebrow(kicker, c.accent)}
          <Text
            accessibilityRole="header"
            style={[s.hero, { color: c.ink, textAlign: "center" }]}
          >
            {main}
          </Text>
          <Text
            style={{
              color: c.muted,
              fontSize: 14,
              lineHeight: 23,
              textAlign: "center",
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    );
  }
  const studying = screen === "study" && !!word;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
        <View style={[s.header, { maxWidth: screen === "home" ? 1040 : 640 }]}>
          {screen === "home" ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
            >
              <View
                accessible={false}
                style={[s.brandMark, { backgroundColor: c.ink }]}
              >
                <View
                  style={{
                    width: 3,
                    height: 15,
                    backgroundColor: c.bg,
                    transform: [{ rotate: "-18deg" }],
                  }}
                />
                <View
                  style={{
                    width: 3,
                    height: 15,
                    backgroundColor: "#D5ED89",
                    transform: [{ rotate: "18deg" }],
                  }}
                />
              </View>
              <Text style={[s.brand, { color: c.ink }]}>
                wordnote<Text style={{ color: c.accent }}>.</Text>
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="前の画面に戻る"
              onPress={back}
              style={s.back}
            >
              {text("←", 22)}
              {text("戻る", 13, c.muted)}
            </Pressable>
          )}
          {eyebrow(
            screen === "home"
              ? width < 360
                ? "TOEIC / 1,500"
                : "TOEIC / 1,500 WORDS"
              : title.toUpperCase(),
          )}
        </View>
      </View>
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          { maxWidth: screen === "home" ? 1040 : 640 },
          studying && { flexGrow: 1, paddingBottom: 0 },
        ]}
      >
        {!!notice && (
          <View style={[s.notice, { backgroundColor: c.soft }]}>
            {text(notice, 14)}
            {button("閉じる", dismissNotice, true)}
          </View>
        )}
        {!!error && (
          <View style={[s.notice, { backgroundColor: c.soft }]}>
            {text(error, 14)}
            {button("再試行", retry, true)}
          </View>
        )}
        {!ready ? (
          heading(
            "GETTING READY",
            "学習の準備をしています",
            "まもなく、今日の一歩を。",
          )
        ) : (
          <Animated.View
            style={{
              opacity: fade,
              gap: 20,
              flexGrow: studying ? 1 : 0,
              transform: [
                {
                  translateY: reduceMotion
                    ? 0
                    : fade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                },
              ],
            }}
          >
            {screen === "home" && (
              <>
                <View
                  style={[
                    s.summary,
                    {
                      backgroundColor: c.panel,
                      padding: wide ? 24 : 20,
                      gap: wide ? 18 : 12,
                    },
                  ]}
                >
                  <View style={[s.row, { alignItems: "flex-start" }]}>
                    <View style={{ gap: 8 }}>
                      {eyebrow("YOUR COLLECTION", c.panelInk)}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "baseline",
                          gap: 10,
                        }}
                      >
                        <Text style={[s.stat, { color: c.panelInk }]}>
                          {progress.mastered.length.toLocaleString()}
                        </Text>
                        <Text
                          style={{
                            color: c.panelInk,
                            opacity: 0.7,
                            fontSize: 13,
                          }}
                        >
                          {" "}
                          / 1,500 語
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        s.progressBadge,
                        { borderColor: dark ? "#889B56" : "#64745C" },
                      ]}
                    >
                      <Text
                        style={{
                          color: c.panelInk,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        {Math.round(progress.mastered.length / 15)}%
                      </Text>
                    </View>
                  </View>
                  {meter(
                    progress.mastered.length,
                    1500,
                    !dark,
                    dark ? c.panelInk : undefined,
                  )}
                  {text("覚えた言葉が、あなたの力になる。", 12, c.panelInk)}
                </View>
                <View style={[s.sectionHeader, { marginTop: 12 }]}>
                  <Text
                    style={{ color: c.ink, fontSize: 20, fontWeight: "600" }}
                  >
                    目標から、はじめる。
                  </Text>
                  {eyebrow("01 — 05")}
                </View>
                <View style={{ borderTopWidth: 1, borderColor: c.line }}>
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
                        style={({
                          pressed,
                          hovered,
                        }: {
                          pressed: boolean;
                          hovered?: boolean;
                        }) => [
                          s.level,
                          {
                            borderBottomColor: c.line,
                            backgroundColor:
                              pressed || hovered ? c.soft : "transparent",
                          },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: wide ? 24 : 14,
                          }}
                        >
                          {eyebrow(`0${i + 1}`)}
                          <Text style={[s.levelNumber, { color: c.ink }]}>
                            {b}
                          </Text>
                          <View style={{ flex: 1, gap: 5 }}>
                            {text(labels[i], 13)}
                            {text(`${m} / ${n} 語を習得`, 11, c.muted)}
                          </View>
                          <View style={[s.levelArrow, { borderColor: c.line }]}>
                            {arrow(c.accent, true)}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[s.row, { paddingTop: 12, flexWrap: "wrap" }]}>
                  {eyebrow("SMALL STEPS. REAL PROGRESS.")}
                  {text("進捗はこの端末に保存されます。", 11, c.muted)}
                </View>
              </>
            )}
            {screen === "mode" && (
              <>
                <View style={[s.heading, { gap: 16 }]}>
                  {eyebrow("YOUR NEXT CHAPTER", c.accent)}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: 14,
                    }}
                  >
                    <Text
                      style={[
                        s.scoreTitle,
                        { color: c.ink, fontSize: width < 360 ? 76 : 92 },
                      ]}
                    >
                      {band}
                    </Text>
                    {text("点への、一歩。", width < 360 ? 16 : 20)}
                  </View>
                  {text(labels[bands.indexOf(band)], 14, c.muted)}
                  {meter(mastered, total)}
                  {text(
                    `${total}語のうち、${mastered}語を習得済み`,
                    12,
                    c.muted,
                  )}
                </View>
                <View
                  style={[
                    s.modeCard,
                    { backgroundColor: c.card, borderColor: c.line },
                  ]}
                >
                  <View style={s.row}>
                    {eyebrow("01 / FLASHCARDS", c.accent)}
                    <Text
                      accessible={false}
                      style={[s.modeGlyph, { color: c.accent }]}
                    >
                      Aa
                    </Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    <Text
                      accessibilityRole="header"
                      style={[s.modeTitle, { color: c.ink }]}
                    >
                      言葉に、出会う。
                    </Text>
                    {text(
                      reverseCards ? "意味から英単語を思い出して、タップで答え合わせ。" : "単語をめくって、意味と例文を自分のものに。",
                      13,
                      c.muted,
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {([false, true] as const).map((reverse) => (
                      <Pressable
                        key={String(reverse)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: reverseCards === reverse }}
                        onPress={() => setReverseCards(reverse)}
                        style={({ pressed }) => ({
                          flex: 1, alignItems: "center", justifyContent: "center",
                          minHeight: 48, padding: 10, borderRadius: 12, borderWidth: 1,
                          borderColor: reverseCards === reverse ? c.accent : c.line,
                          backgroundColor: reverseCards === reverse ? c.soft : c.card,
                          opacity: pressed ? 0.65 : 1,
                        })}
                      >
                        {text(reverse ? "日本語 → 英単語" : "英単語 → 日本語", 13, reverseCards === reverse ? c.accent : c.muted)}
                      </Pressable>
                    ))}
                  </View>
                  {button("未習得の単語を学ぶ", () => startStudy(true))}
                  {button("全ての単語を復習", () => startStudy(false), true)}
                </View>
                <View
                  style={[
                    s.modeCard,
                    { backgroundColor: c.soft, borderColor: c.line },
                  ]}
                >
                  <View style={s.row}>
                    {eyebrow("02 / QUICK QUIZ", c.accent)}
                    <Text
                      accessible={false}
                      style={[s.modeGlyph, { color: c.accent }]}
                    >
                      ?
                    </Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    <Text
                      accessibilityRole="header"
                      style={[s.modeTitle, { color: c.ink }]}
                    >
                      記憶を、確かめる。
                    </Text>
                    {text(
                      "4択・10問。未習得の単語を優先して出題。",
                      13,
                      c.muted,
                    )}
                  </View>
                  {button("クイズを始める", startQuiz)}
                  {text("間違えた単語は、未習得に戻ります。", 11, c.muted)}
                </View>
              </>
            )}
            {screen === "study" &&
              (word ? (
                <>
                  <View style={s.sectionHeader}>
                    {eyebrow(reverseCards ? "JA → EN / FLASHCARDS" : "EN → JA / FLASHCARDS", c.accent)}
                    <Text style={{ color: c.muted, fontSize: 13 }}>
                      <Text style={{ color: c.ink, fontWeight: "600" }}>
                        {String(index + 1).padStart(2, "0")}
                      </Text>{" "}
                      / {queue.length}
                    </Text>
                  </View>
                  {meter(index, queue.length)}
                  {wordCard(word, revealed)}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      revealed ? "タップして次へ" : revealHint
                    }
                    onPress={() =>
                      revealed ? advanceCard() : setRevealed(true)
                    }
                    style={s.studyTapArea}
                  >
                    <View style={[s.tapHint, { borderColor: c.line }]}>
                      <View
                        accessible={false}
                        style={[s.dot, { backgroundColor: c.accent }]}
                      />
                      {text(
                        revealed ? "タップして次へ" : revealHint,
                        12,
                        c.muted,
                      )}
                      {arrow(c.accent)}
                    </View>
                  </Pressable>
                </>
              ) : (
                <>
                  {completion(
                    "✓",
                    "ALL CLEAR",
                    "このレベルは習得済み！",
                    "全ての単語で、おさらいしてみましょう。",
                  )}
                  {button("全ての単語を復習する", () => startStudy(false))}
                </>
              ))}
            {screen === "studyResult" && (
              <>
                {completion(
                  "✓",
                  "CHAPTER COMPLETE",
                  "ひと区切り、完了。",
                  `${queue.length}語を確認しました。\n少しずつ、確かな力に。`,
                )}
                {button("もう一度学習する", () => startStudy(onlyUnmastered))}
                {button("レベルのメニューに戻る", () => go("mode"), true)}
              </>
            )}
            {screen === "quiz" &&
              (question ? (
                <>
                  <View style={s.sectionHeader}>
                    {eyebrow(
                      `QUICK QUIZ / ${String(index + 1).padStart(2, "0")}`,
                      c.accent,
                    )}
                    {text(`正解 ${correct} / ${questions.length}`, 12, c.muted)}
                  </View>
                  {meter(index, questions.length)}
                  {wordCard(question.word, selected !== null)}
                  <View style={{ gap: 10 }}>
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
                          style={({ pressed }) => [
                            s.choice,
                            {
                              backgroundColor: isCorrect
                                ? c.soft
                                : pressed
                                  ? c.soft
                                  : c.card,
                              borderColor: isWrong
                                ? "#B66B54"
                                : isCorrect
                                  ? c.accent
                                  : c.line,
                            },
                          ]}
                        >
                          <View
                            style={[
                              s.choiceLetter,
                              {
                                backgroundColor: isCorrect ? c.accent : c.soft,
                              },
                            ]}
                          >
                            {text(
                              isCorrect
                                ? "✓"
                                : isWrong
                                  ? "×"
                                  : String.fromCharCode(65 + i),
                              13,
                              isCorrect ? c.bg : c.accent,
                            )}
                          </View>
                          <Text
                            style={{
                              color: isWrong
                                ? dark
                                  ? "#FFC0A9"
                                  : "#97472F"
                                : c.ink,
                              fontSize: 16,
                              lineHeight: 24,
                              flex: 1,
                            }}
                          >
                            {choice}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {selected !== null &&
                    text(
                      selected === question.correctIndex
                        ? "正解です！"
                        : "未習得に戻しました。あとで復習しましょう。",
                      14,
                      c.accent,
                    )}
                </>
              ) : (
                <>
                  {text("出題できる単語がありません。")}
                  {button("戻る", () => go("mode"))}
                </>
              ))}
            {screen === "result" && (
              <>
                {completion(
                  correct === questions.length ? "✦" : "✓",
                  "QUIZ COMPLETE",
                  `${correct} / ${questions.length}`,
                  correct === questions.length
                    ? "全問正解！その調子です。"
                    : "思い出すたび、記憶は少しずつ強くなる。",
                )}
                {wrong.length > 0 && (
                  <>
                    <View style={s.sectionHeader}>
                      <Text
                        style={{
                          color: c.ink,
                          fontSize: 19,
                          fontWeight: "600",
                        }}
                      >
                        もう一度、出会う言葉。
                      </Text>
                      {eyebrow(`${wrong.length} WORDS`)}
                    </View>
                    {wrong.map((w) => (
                      <View
                        key={w.No}
                        style={[
                          s.review,
                          { borderColor: c.line, backgroundColor: c.card },
                        ]}
                      >
                        <View style={s.row}>
                          <Text style={[s.reviewWord, { color: c.ink }]}>
                            {w.word}
                          </Text>
                          {audioButton(w.word, `${w.word}の発音を聞く`)}
                        </View>
                        {text(w.meaning, 14, c.muted)}
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
      {screen === "quiz" && selected !== null && (
        <View
          style={[
            s.quizFooter,
            { borderTopColor: c.line, backgroundColor: c.bg },
          ]}
        >
          {button(
            index + 1 === questions.length ? "結果を見る" : "次の問題",
            nextQuestion,
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia, 'Times New Roman', serif",
});
const s = StyleSheet.create({
  header: {
    minHeight: 72,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brand: {
    fontFamily: serif,
    fontSize: 27,
    letterSpacing: -1.2,
    fontWeight: "600",
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    minHeight: 44,
    minWidth: 80,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  content: {
    width: "100%",
    alignSelf: "center",
    padding: 24,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1.4,
    fontWeight: "600",
  },
  heading: { gap: 12, paddingTop: 22, paddingBottom: 12 },
  hero: {
    fontSize: 30,
    lineHeight: 42,
    fontWeight: "600",
    letterSpacing: -0.8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summary: { borderRadius: 20, padding: 24, gap: 18 },
  stat: {
    fontFamily: serif,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -1.8,
  },
  progressBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  track: { height: 3, borderRadius: 3, overflow: "hidden" },
  level: { borderBottomWidth: 1, paddingVertical: 23, paddingHorizontal: 2 },
  levelNumber: {
    fontFamily: serif,
    fontSize: 37,
    lineHeight: 44,
    letterSpacing: -1.4,
  },
  levelArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreTitle: {
    fontFamily: serif,
    fontSize: 92,
    lineHeight: 100,
    letterSpacing: -5,
  },
  modeCard: { borderWidth: 1, borderRadius: 22, padding: 24, gap: 20 },
  modeGlyph: { fontFamily: serif, fontSize: 34, fontStyle: "italic" },
  modeTitle: {
    fontSize: 25,
    lineHeight: 35,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  button: {
    minHeight: 56,
    borderRadius: 28,
    paddingVertical: 15,
    paddingHorizontal: 21,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  wordCard: { borderWidth: 1, borderRadius: 24, padding: 24 },
  mastery: {
    minHeight: 44,
    paddingHorizontal: 15,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
  },
  wordRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  tappable: { flexGrow: 1, flexShrink: 1, paddingVertical: 6 },
  word: { fontFamily: serif, letterSpacing: -1.5, lineHeight: 64 },
  audio: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  meaning: { borderTopWidth: 1, paddingTop: 22, gap: 8 },
  meaningText: { fontSize: 22, fontWeight: "600", lineHeight: 34 },
  example: { fontFamily: serif, fontSize: 20, lineHeight: 30 },
  studyTapArea: {
    flexGrow: 1,
    minHeight: 116,
    marginTop: -20,
    marginHorizontal: -24,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  tapHint: {
    borderTopWidth: 1,
    width: "100%",
    maxWidth: 280,
    paddingTop: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quizFooter: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
  },
  choice: {
    minHeight: 66,
    borderRadius: 17,
    padding: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  choiceLetter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  completionSeal: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sealText: { fontFamily: serif, fontSize: 48 },
  review: { borderWidth: 1, borderRadius: 18, padding: 20, gap: 8 },
  reviewWord: { fontFamily: serif, fontSize: 26, flex: 1 },
  notice: { borderRadius: 16, padding: 18, gap: 12, marginBottom: 16 },
});
