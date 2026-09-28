import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
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
  const c = dark
    ? {
        bg: "#111B22",
        card: "#1C2932",
        ink: "#F2F6F5",
        muted: "#A8BABD",
        line: "#34454C",
        accent: "#80DACC",
        soft: "#243E3F",
      }
    : {
        bg: "#F5F6F2",
        card: "#FFFFFF",
        ink: "#172F36",
        muted: "#62777B",
        line: "#E0E7E4",
        accent: "#176F66",
        soft: "#E7F2EE",
      };
  const { progress, ready, error, record, retry } = useProgress(validIds);
  const [screen, setScreen] = useState<Screen>("home");
  const [band, setBand] = useState(500);
  const [queue, setQueue] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<Word[]>([]);
  const [onlyUnmastered, setOnlyUnmastered] = useState(true);
  const answerLock = useRef(false);
  const fade = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  const word = queue[index];
  const question = questions[index];
  const total = words.filter((w) => w.score_band === band).length;
  const mastered = words.filter(
    (w) => w.score_band === band && progress.mastered.includes(w.No),
  ).length;
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
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [screen, index]);
  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );
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
  function advanceCard(mastered = false) {
    if (!word || answerLock.current) return;
    answerLock.current = true;
    if (mastered) record(word.No, true);
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
        style={[s.track, { backgroundColor: c.line }]}
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
  function heading(kicker: string, main: string, subtitle: string) {
    return (
      <View style={s.heading}>
        {text(kicker, 12, c.accent)}
        <Text style={[s.hero, { color: c.ink }]}>{main}</Text>
        {text(subtitle, 14, c.muted)}
      </View>
    );
  }
  function wordCard(w: Word, showMeaning: boolean) {
    const studying = screen === "study";
    const cardContent = (
      <>
        <Text selectable={!studying} style={[s.word, { color: c.ink }]}>
          {w.word}
        </Text>
        {showMeaning && (
          <View style={[s.meaning, { borderTopColor: c.line }]}>
            <Text style={[s.meaningText, { color: c.ink }]}>{w.meaning}</Text>
            <View style={{ gap: 6 }}>
              {text(w.example, 16, c.muted)}
              {text(w.example_ja, 14, c.muted)}
            </View>
          </View>
        )}
        {studying && (
          <View style={{ paddingTop: 24, alignItems: "center" }}>
            {text(showMeaning ? "タップして次へ" : "タップして意味を表示", 13, c.muted)}
          </View>
        )}
      </>
    );
    return (
      <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>
        <View style={s.row}>
          {text(`${w.score_band} LEVEL`, 12, c.accent)}
          {studying && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="覚えたとして保存して次へ"
              onPress={() => advanceCard(true)}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: 16,
                justifyContent: "center",
                borderRadius: 22,
                backgroundColor: c.soft,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              {text("覚えた ✓", 14, c.accent)}
            </Pressable>
          )}
        </View>
        {button("発音を聞く", () => speak(w.word), true)}
        {studying ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${w.word}。${showMeaning ? `${w.meaning}。${w.example}。${w.example_ja}。タップして次へ` : "タップして意味を表示"}`}
            onPress={() => showMeaning ? advanceCard() : setRevealed(true)}
            style={{ paddingVertical: 12, gap: 16 }}
          >
            {cardContent}
          </Pressable>
        ) : (
          cardContent
        )}
      </View>
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
          text("WORD / NOTE", 12, c.accent)
        )}
        <Text style={[s.brand, { color: c.ink }]}>{title}</Text>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={s.content}>
        {!!error && (
          <View style={[s.notice, { backgroundColor: c.soft }]}>
            {text(error, 14)}
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
          <Animated.View style={{ opacity: fade, gap: 18 }}>
            {screen === "home" && (
              <>
                {heading(
                  "小さな積み重ね、大きな一歩。",
                  "今日のひとことが、\n明日の自信に。",
                  "1,500語から、あなたの目標に合うレベルを。",
                )}
                <View style={[s.summary, { backgroundColor: c.soft }]}>
                  <View style={s.row}>
                    {text("覚えた単語", 14, c.muted)}
                    <Text style={[s.stat, { color: c.accent }]}>
                      {progress.mastered.length}
                      <Text style={{ fontSize: 14 }}> / 1,500</Text>
                    </Text>
                  </View>
                  {meter(progress.mastered.length, 1500)}
                </View>
                {bands.map((b, i) => {
                  const n = words.filter((w) => w.score_band === b).length;
                  const m = words.filter(
                    (w) =>
                      w.score_band === b && progress.mastered.includes(w.No),
                  ).length;
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
                          borderColor: c.line,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <View style={s.row}>
                        <Text style={[s.levelNumber, { color: c.ink }]}>
                          {b}
                          <Text style={{ fontSize: 14 }}> 点レベル</Text>
                        </Text>
                        {text("→", 24, c.accent)}
                      </View>
                      {text(labels[i], 14, c.muted)}
                      {meter(m, n)}
                      {text(`${m} / ${n} 語を習得`, 12, c.muted)}
                    </Pressable>
                  );
                })}
                {text("進捗はこの端末に保存されます。", 12, c.muted)}
              </>
            )}
            {screen === "mode" && (
              <>
                {heading(
                  "YOUR NEXT STEP",
                  `${band}点への、一歩。`,
                  `${total}語のうち、${mastered}語を習得済み。`,
                )}
                <View
                  style={[
                    s.card,
                    { backgroundColor: c.card, borderColor: c.line },
                  ]}
                >
                  {text("覚える", 24)}
                  {text("意味を思い出してから、答え合わせ。", 14, c.muted)}
                  {button(`覚えていない単語（${total - mastered}語）`, () =>
                    startStudy(true),
                  )}
                  {button(
                    `全ての単語（${total}語）`,
                    () => startStudy(false),
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
                    "4択・10問。未習得の単語を優先して出題します。",
                    14,
                    c.muted,
                  )}
                  {button("4択クイズを始める →", startQuiz)}
                  {text("間違えた単語は「まだ」に戻ります。", 12, c.muted)}
                </View>
              </>
            )}
            {screen === "study" &&
              (word ? (
                <>
                  <View style={s.row}>
                    {text("FLASHCARDS", 12, c.accent)}
                    {text(`${index + 1} / ${queue.length}`, 14, c.muted)}
                  </View>
                  {meter(index, queue.length)}
                  {wordCard(word, revealed)}

                </>
              ) : (
                <>
                  {heading(
                    "ALL CLEAR",
                    "このレベルは習得済み！",
                    "全ての単語でおさらいすることもできます。",
                  )}
                  {button("全ての単語を復習する", () => startStudy(false))}
                </>
              ))}
            {screen === "studyResult" && (
              <>
                {heading(
                  "NICE WORK",
                  "ひと区切り、完了。",
                  `${queue.length}語を確認しました。少しずつ、確かな力に。`,
                )}
                {button("もう一度学習する", () => startStudy(onlyUnmastered))}
                {button("レベルのメニューに戻る", () => go("mode"), true)}
              </>
            )}
            {screen === "quiz" &&
              (question ? (
                <>
                  <View style={s.row}>
                    {text(
                      `QUIZ ${index + 1} / ${questions.length}`,
                      12,
                      c.accent,
                    )}
                    {text(`正解 ${correct}`, 14, c.muted)}
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
                              ? "#BA5E42"
                              : isCorrect
                                ? c.accent
                                : c.line,
                          },
                        ]}
                      >
                        {text(
                          `${isCorrect ? "✓" : isWrong ? "×" : String.fromCharCode(65 + i)}   ${choice}`,
                          17,
                          isWrong ? (dark ? "#FFA487" : "#9A4329") : c.ink,
                        )}
                      </Pressable>
                    );
                  })}
                  {selected !== null && (
                    <>
                      {text(
                        selected === question.correctIndex
                          ? "正解です！"
                          : "「まだ」に追加しました。あとで復習しましょう。",
                        14,
                        c.accent,
                      )}
                      {button(
                        index + 1 === questions.length
                          ? "結果を見る"
                          : "次の問題 →",
                        nextQuestion,
                      )}
                    </>
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
                {heading(
                  "QUIZ COMPLETE",
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
                            {text("発音", 14, c.accent)}
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
    fontSize: 34,
    lineHeight: 46,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
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
    fontSize: 40,
    lineHeight: 52,
    fontWeight: "700",
    textAlign: "center",
    marginVertical: 28,
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
  buttonText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  choice: {
    minHeight: 60,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  notice: { borderRadius: 16, padding: 18, gap: 12, marginBottom: 16 },
});
