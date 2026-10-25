import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Question, Word } from "../learning";
import { fontScale, radius, space, type, type Theme } from "../theme";
import { Button, Card, Meter, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { IconButton } from "../components/Icon";
import { WordBody } from "../components/WordBody";
import { copy } from "../copy";

export type QuizProps = {
  theme: Theme;
  question: Question;
  index: number;
  total: number;
  correct: number;
  selected: number | null;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  onAnswer: (choice: number) => void;
  onNext: () => void;
  onSpeak: (text: string) => void;
  onBack: () => void;
};

export function QuizScreen(p: QuizProps) {
  const { theme, question, selected } = p;
  const { c } = theme;
  const answered = selected !== null;
  const isRight = answered && selected === question.correctIndex;
  return (
    <Frame
      theme={theme}
      title={`${p.index + 1} / ${p.total}`}
      onBack={p.onBack}
      right={{
        icon: p.autoSpeak ? "volume-high-outline" : "volume-mute-outline",
        label: p.autoSpeak ? "自動発音をオフにする" : "自動発音をオンにする",
        onPress: p.onToggleAutoSpeak,
      }}
      footer={
        answered ? (
          <>
            <Txt theme={theme} kind="body" color={isRight ? c.accent : c.wrong} style={{ textAlign: "center", fontWeight: "600" }}>
              {isRight ? `✓ ${copy.quiz.correct}` : `× ${copy.quiz.wrong}`}
            </Txt>
            <Button theme={theme} label={copy.quiz.next} onPress={p.onNext} />
          </>
        ) : undefined
      }
    >
      <Meter value={p.index} max={p.total} theme={theme} height={4} />
      <Txt theme={theme} kind="caption" color={c.muted}>
        {`${copy.quiz.title}　${copy.quiz.correct} ${p.correct}`}
      </Txt>
      {/* 答えたあとは画面のどこをタップしても次へ（disabled にすると中の選択肢まで無効と読まれるので、onPress の有無で切り替える） */}
      <Pressable accessible={false} onPress={answered ? p.onNext : undefined} style={{ gap: space.lg }}>
        <View style={styles.wordRow}>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            maxFontSizeMultiplier={fontScale.display}
            style={[type.display2, { color: c.ink, flex: 1 }]}
          >
            {question.word.word}
          </Text>
          <IconButton
            name="volume-high-outline"
            label={`${question.word.word}の発音を聞く`}
            onPress={() => p.onSpeak(question.word.word)}
            theme={theme}
            tone="soft"
          />
        </View>
        <View style={{ gap: space.sm }}>
          {question.choices.map((choice, i) => {
            const isCorrect = answered && i === question.correctIndex;
            const isWrong = selected === i && !isCorrect;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityState={{ disabled: answered }}
                disabled={answered}
                onPress={() => p.onAnswer(i)}
                style={({ pressed }) => [
                  styles.choice,
                  {
                    backgroundColor: isCorrect ? c.soft : c.card,
                    borderColor: isWrong ? c.wrongBorder : isCorrect ? c.accent : c.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text maxFontSizeMultiplier={fontScale.button} style={[type.button, styles.letter, { color: isWrong ? c.wrong : isCorrect ? c.accent : c.muted }]}>
                  {isCorrect ? "✓" : isWrong ? "×" : String.fromCharCode(65 + i)}
                </Text>
                <Text maxFontSizeMultiplier={fontScale.text} style={[type.body, { color: isWrong ? c.wrong : c.ink, flex: 1 }]}>
                  {choice}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {answered && (
          <Card theme={theme}>
            <WordBody word={question.word} theme={theme} onSpeak={p.onSpeak} showMeaning={false} compact />
          </Card>
        )}
      </Pressable>
    </Frame>
  );
}

export type QuizResultProps = {
  theme: Theme;
  correct: number;
  total: number;
  wrong: Word[];
  onRetry: () => void;
  onMenu: () => void;
  onSpeak: (text: string) => void;
  onBack: () => void;
};

export function QuizResultScreen(p: QuizResultProps) {
  const { theme } = p;
  const { c } = theme;
  return (
    <Frame theme={theme} title={copy.quiz.result} onBack={p.onBack}>
      <View style={{ gap: space.sm, paddingTop: space.md }}>
        <Txt theme={theme} kind="title" accessibilityRole="header">
          {`${p.correct} / ${p.total}`}
        </Txt>
        <Txt theme={theme} kind="callout" color={c.muted}>
          {p.correct === p.total ? copy.quiz.perfect : copy.quiz.some}
        </Txt>
      </View>
      {p.wrong.length > 0 && (
        <Card theme={theme} style={{ paddingVertical: space.xs, gap: 0 }}>
          <Txt theme={theme} kind="caption" color={c.muted} style={{ paddingVertical: space.sm }}>
            {copy.quiz.wrongWords(p.wrong.length)}
          </Txt>
          {p.wrong.map((w) => (
            <View key={w.No} style={[styles.wrongRow, { borderTopColor: c.line }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt theme={theme} kind="body" style={{ fontWeight: "600" }}>
                  {w.word}
                </Txt>
                <Txt theme={theme} kind="callout" color={c.muted}>
                  {w.meaning}
                </Txt>
              </View>
              <IconButton name="volume-high-outline" label={`${w.word}の発音を聞く`} onPress={() => p.onSpeak(w.word)} theme={theme} />
            </View>
          ))}
        </Card>
      )}
      <View style={{ gap: space.sm }}>
        <Button theme={theme} label={copy.quiz.again(p.total)} onPress={p.onRetry} />
        <Button theme={theme} kind="tertiary" label={copy.result.backToMenu} onPress={p.onMenu} />
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  wordRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingTop: space.sm },
  choice: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  letter: { width: 28 },
  wrongRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderTopWidth: 1 },
});
