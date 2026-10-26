import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Word } from "../learning";
import { fontScale, space, type, type Theme } from "../theme";
import { Button, Meter, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { IconButton } from "../components/Icon";
import { copy } from "../copy";

export type ListenProps = {
  theme: Theme;
  word: Word | null;
  index: number;
  total: number;
  paused: boolean;
  finished: boolean;
  onPauseToggle: () => void;
  onSkip: () => void;
  onMarkNotYet: () => void;
  onStop: () => void;
  onRestart: () => void;
};

/** 耳だけ復習: 単語 → 意味 → 例文 を自動で読み上げる。画面は見なくてもよい */
export function ListenScreen(p: ListenProps) {
  const { theme, word } = p;
  const { c } = theme;
  return (
    <Frame
      theme={theme}
      title={copy.listen.title}
      onBack={p.onStop}
      footer={
        p.finished ? (
          <>
            <Button theme={theme} label={copy.result.again} onPress={p.onRestart} />
            <Button theme={theme} kind="tertiary" label={copy.listen.stop} onPress={p.onStop} />
          </>
        ) : (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <IconButton
              name={p.paused ? "play" : "pause"}
              label={p.paused ? copy.listen.play : copy.listen.pause}
              onPress={p.onPauseToggle}
              theme={theme}
              size={56}
              tone="soft"
            />
            <Button theme={theme} kind="secondary" label={copy.study.notYet} onPress={p.onMarkNotYet} style={{ flex: 1 }} />
            <Button theme={theme} kind="secondary" label={copy.listen.skip} onPress={p.onSkip} style={{ flex: 1 }} />
          </View>
        )
      }
    >
      <Meter value={p.index} max={p.total} theme={theme} height={4} />
      <Txt theme={theme} kind="caption" color={c.muted}>
        {p.finished ? copy.listen.done : `${Math.min(p.index + 1, p.total)} / ${p.total}　${p.paused ? copy.listen.pause : ""}`}
      </Txt>
      {word && !p.finished && (
        <View style={styles.body}>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            maxFontSizeMultiplier={fontScale.display}
            style={[type.display2, { color: c.ink, textAlign: "center" }]}
          >
            {word.word}
          </Text>
          <Txt theme={theme} kind="heading" style={{ textAlign: "center" }}>
            {word.meaning}
          </Txt>
          {!!word.example && (
            <View style={{ gap: space.xs }}>
              <Txt theme={theme} kind="body" style={{ textAlign: "center" }}>
                {word.example}
              </Txt>
              {!!word.example_ja && (
                <Txt theme={theme} kind="callout" color={c.muted} style={{ textAlign: "center" }}>
                  {word.example_ja}
                </Txt>
              )}
            </View>
          )}
        </View>
      )}
      {p.finished && (
        <Txt theme={theme} kind="callout" color={c.muted}>
          {`${p.total}語を読み上げました。「まだ」にした単語は、次の学習で先に出ます。`}
        </Txt>
      )}
      <Txt theme={theme} kind="caption" color={c.muted} style={{ textAlign: "center" }}>
        {copy.listen.body}
      </Txt>
    </Frame>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingVertical: space.xxl },
});
