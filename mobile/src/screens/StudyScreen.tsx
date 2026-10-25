import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { Word } from "../learning";
import { clozeExample } from "../cloze";
import { fontScale, radius, space, type, type Theme } from "../theme";
import { Badge, Button, Meter, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { IconButton } from "../components/Icon";
import { WordBody } from "../components/WordBody";
import { copy } from "../copy";

/** 学習カードをこの距離（px）以上、左右に動かしたら「まだ」「覚えた」を記録する */
export const SWIPE_DISTANCE = 90;

export type StudyProps = {
  theme: Theme;
  reduceMotion: boolean;
  word: Word;
  index: number;
  total: number;
  revealed: boolean;
  reverse: boolean;
  badges: string[];
  /** 操作のヒントを見せるか（慣れたら消す） */
  showHints: boolean;
  autoSpeak: boolean;
  undo: { message: string; onUndo: () => void } | null;
  onToggleAutoSpeak: () => void;
  onTap: () => void;
  onMark: (mastered: boolean) => void;
  onSpeak: (text: string) => void;
  onBack: () => void;
};

export function StudyScreen(p: StudyProps) {
  const { theme, word, revealed, reverse } = p;
  const { c } = theme;
  const { width, height } = useWindowDimensions();
  // 単語を画面の上から約 28% の位置に固定する（答え前も後も動かさない）
  const spacer = Math.max(24, Math.round(height * 0.28) - 112);
  const swipeX = useRef(new Animated.Value(0)).current;
  const actions = useRef({ tap: p.onTap, mark: p.onMark, reduceMotion: p.reduceMotion });
  actions.current = { tap: p.onTap, mark: p.onMark, reduceMotion: p.reduceMotion };
  const moved = useRef(false);
  const crossed = useRef(false);
  const pan = useMemo(
    () =>
      PanResponder.create({
        // 画面のどこから触っても受け取る（中のボタンは、ボタンの方が優先される）
        onStartShouldSetPanResponder: () => true,
        // ボタンの上から始めても、横に動かしたらスワイプとして受け取る
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) >= 10 && Math.abs(g.dx) > Math.abs(g.dy),
        // 横に動かし始めたら、縦のスクロールに取られないようにする
        onPanResponderTerminationRequest: (_, g) => Math.abs(g.dx) < 10,
        onPanResponderGrant: () => {
          moved.current = false;
          crossed.current = false;
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) >= 10 || Math.abs(g.dy) >= 10) moved.current = true;
          if (!actions.current.reduceMotion) swipeX.setValue(g.dx);
          const over = Math.abs(g.dx) >= SWIPE_DISTANCE;
          if (over !== crossed.current) {
            crossed.current = over;
            if (over) void Haptics.selectionAsync().catch(() => {});
          }
        },
        onPanResponderRelease: (_, g) => {
          const horizontal = Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
          const flicked = Math.abs(g.vx) > 0.6 && Math.abs(g.dx) > 40;
          if (horizontal && (Math.abs(g.dx) >= SWIPE_DISTANCE || flicked)) {
            swipeX.setValue(0);
            actions.current.mark(g.dx > 0);
          } else if (!moved.current) {
            swipeX.setValue(0);
            actions.current.tap();
          } else {
            Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [swipeX],
  );
  useEffect(() => {
    swipeX.setValue(0);
  }, [word.No, swipeX]);

  // 英単語は1行に収まる大きさにする（Web は adjustsFontSizeToFit が効かないので幅から計算する）
  const longest = Math.max(...word.word.split(/\s+/).map((t) => t.length), 1);
  const available = Math.min(width, 600) - space.lg * 2;
  const webSize = Math.max(24, Math.min(type.display.fontSize, Math.floor(available / (longest * 0.6))));
  const wordSize = Platform.OS === "web" ? webSize : type.display.fontSize;
  const english = (
    <Text
      accessibilityRole="header"
      numberOfLines={word.word.includes(" ") ? 2 : 1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      maxFontSizeMultiplier={fontScale.display}
      style={[type.display, { color: c.ink, fontSize: wordSize, lineHeight: Math.round(wordSize * 1.2), textAlign: "center" }]}
    >
      {word.word}
    </Text>
  );
  const stamp = (label: string, color: string, side: object, inputRange: number[], outputRange: number[]) => (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stamp,
        side,
        { borderColor: color, backgroundColor: c.card, opacity: swipeX.interpolate({ inputRange, outputRange, extrapolate: "clamp" }) },
      ]}
    >
      <Text maxFontSizeMultiplier={fontScale.button} style={[type.button, { color }]}>
        {label}
      </Text>
    </Animated.View>
  );
  const hint = !revealed
    ? reverse
      ? copy.study.tapToRevealReverse
      : copy.study.tapToReveal
    : copy.study.afterReveal;
  return (
    <Frame
      theme={theme}
      title={`${p.index + 1} / ${p.total}`}
      onBack={p.onBack}
      scroll={false}
      right={{
        icon: p.autoSpeak ? "volume-high-outline" : "volume-mute-outline",
        label: p.autoSpeak ? "自動発音をオフにする" : "自動発音をオンにする",
        onPress: p.onToggleAutoSpeak,
      }}
      footer={
        <>
          {p.undo && (
            <View style={[styles.toast, { backgroundColor: c.soft }]}>
              <Txt theme={theme} kind="callout" style={{ flex: 1 }}>
                {p.undo.message}
              </Txt>
              <Button theme={theme} kind="tertiary" size="md" label={copy.study.undo} onPress={p.undo.onUndo} />
            </View>
          )}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <IconButton
              name="volume-high-outline"
              label={`${word.word}の発音を聞く`}
              onPress={() => p.onSpeak(word.word)}
              theme={theme}
              size={56}
              tone="soft"
              // 逆向きカードでは、答えを出す前に発音すると答えが分かってしまうので押せなくする
              disabled={reverse && !revealed}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="まだとして保存して次へ"
              onPress={() => p.onMark(false)}
              style={({ pressed }) => [styles.mark, { borderColor: c.wrongBorder, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text maxFontSizeMultiplier={fontScale.button} style={[type.button, { color: c.wrong }]}>
                {copy.study.notYet}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="覚えたとして保存して次へ"
              onPress={() => p.onMark(true)}
              style={({ pressed }) => [styles.mark, { borderColor: c.accent, backgroundColor: c.accent, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text maxFontSizeMultiplier={fontScale.button} style={[type.button, { color: c.onAccent }]}>
                {copy.study.learned}
              </Text>
            </Pressable>
          </View>
        </>
      }
    >
      <Meter value={p.index} max={p.total} theme={theme} height={4} />
      <View {...pan.panHandlers} style={styles.area} accessible={false}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: swipeX },
                { rotate: swipeX.interpolate({ inputRange: [-300, 0, 300], outputRange: ["-4deg", "0deg", "4deg"] }) },
              ],
            },
          ]}
        >
          <View style={{ height: spacer }} />
          {p.badges.length > 0 && (
            <View style={styles.badges}>
              {p.badges.map((b) => (
                <Badge key={b} label={b} color={b === copy.study.weakBadge ? c.wrong : c.muted} theme={theme} />
              ))}
            </View>
          )}
          {reverse ? (
            <Txt theme={theme} kind="display2" display style={{ textAlign: "center" }} accessibilityRole="header">
              {word.meaning}
            </Txt>
          ) : (
            english
          )}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.answer} scrollEnabled={revealed}>
            {reverse && !revealed && !!word.example && (
              <View style={{ gap: space.xs }}>
                <Txt theme={theme} kind="caption" color={c.accent}>
                  {copy.study.clozePrompt}
                </Txt>
                <Txt theme={theme} kind="body">
                  {clozeExample(word.word, word.example)}
                </Txt>
              </View>
            )}
            {revealed && (
              <View style={{ gap: space.lg }}>
                {reverse && <View style={{ alignItems: "center" }}>{english}</View>}
                <WordBody word={word} theme={theme} onSpeak={p.onSpeak} showMeaning={!reverse} />
              </View>
            )}
          </ScrollView>
          {/* VoiceOver 用の「意味を見る／次へ」。見た目はヒントの行だけ（慣れたら文字は消えるが、ボタンは残る） */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "次のカードへ" : reverse ? "英単語を見る" : "意味を見る"}
            onPress={p.onTap}
            style={styles.hintRow}
          >
            {p.showHints && (
              <Txt theme={theme} kind="caption" color={c.muted} style={styles.hint}>
                {hint}
              </Txt>
            )}
          </Pressable>
        </Animated.View>
        {stamp(copy.study.learned, c.accent, { left: space.lg }, [0, SWIPE_DISTANCE], [0, 1])}
        {stamp(copy.study.notYet, c.wrong, { right: space.lg }, [-SWIPE_DISTANCE, 0], [1, 0])}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, width: "100%", maxWidth: 600, alignSelf: "center" },
  card: { flex: 1, paddingHorizontal: space.lg, gap: space.lg },
  badges: { flexDirection: "row", gap: space.sm, justifyContent: "center", flexWrap: "wrap" },
  answer: { paddingBottom: space.lg },
  hintRow: { minHeight: 44, justifyContent: "center" },
  hint: { textAlign: "center", paddingBottom: space.sm },
  mark: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  stamp: {
    position: "absolute",
    top: space.lg,
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.xs,
  },
});
