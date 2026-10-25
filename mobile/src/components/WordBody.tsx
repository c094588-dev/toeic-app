import React from "react";
import { View } from "react-native";
import type { Word } from "../learning";
import { space, type Theme } from "../theme";
import { Txt } from "../ui";
import { IconButton } from "./Icon";

/** 答えの面: 意味、例文（読み上げボタン付き）、例文の訳 */
export function WordBody({
  word,
  theme,
  onSpeak,
  showMeaning = true,
  compact = false,
}: {
  word: Word;
  theme: Theme;
  onSpeak: (text: string) => void;
  showMeaning?: boolean;
  compact?: boolean;
}) {
  const { c } = theme;
  return (
    <View style={{ gap: compact ? space.sm : space.md }}>
      {showMeaning && (
        <Txt theme={theme} kind="heading" accessibilityRole="header">
          {word.meaning}
        </Txt>
      )}
      {!!word.example && (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
          <View style={{ flex: 1, gap: space.xs }}>
            <Txt theme={theme} kind="body">
              {word.example}
            </Txt>
            {!!word.example_ja && (
              <Txt theme={theme} kind="callout" color={c.muted}>
                {word.example_ja}
              </Txt>
            )}
          </View>
          <IconButton
            name="volume-high-outline"
            label="英語の例文を聞く"
            onPress={() => onSpeak(word.example)}
            theme={theme}
            tone="soft"
          />
        </View>
      )}
    </View>
  );
}
