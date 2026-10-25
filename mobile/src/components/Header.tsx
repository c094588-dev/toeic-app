import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontScale, space, TAP, type, type Theme } from "../theme";
import { IconButton, type IconName } from "./Icon";
import { copy } from "../copy";

/**
 * 画面の上部。iOS 標準に合わせて高さ 44、タイトルは中央。
 * 左は戻る（ホームでは何もなし）、右は画面ごとの1操作（設定、自動発音の切替など）
 */
export function Header({
  title,
  theme,
  onBack,
  right,
}: {
  title: string;
  theme: Theme;
  onBack?: () => void;
  right?: { icon: IconName; label: string; hint?: string; onPress: () => void };
}) {
  const { c } = theme;
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack && <IconButton name="chevron-back" label={copy.common.back} onPress={onBack} theme={theme} />}
      </View>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        maxFontSizeMultiplier={fontScale.button}
        style={[styles.title, { color: c.ink }]}
      >
        {title}
      </Text>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        {right && (
          <IconButton name={right.icon} label={right.label} hint={right.hint} onPress={right.onPress} theme={theme} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: TAP + space.xs,
    paddingHorizontal: space.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  side: { width: 56, justifyContent: "center" },
  title: { ...type.button, flex: 1, textAlign: "center", fontWeight: "700" },
});
