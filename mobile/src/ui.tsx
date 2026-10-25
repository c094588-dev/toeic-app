import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { fontScale, radius, space, TAP, type, type Theme } from "./theme";

/** 用途別の文字。Dynamic Type の拡大には付き合うが、はみ出さない上限を付ける */
export function Txt({
  children,
  kind = "body",
  color,
  theme,
  style,
  display = false,
  numberOfLines,
  accessibilityRole,
}: {
  children: React.ReactNode;
  kind?: keyof typeof type;
  color?: string;
  theme: Theme;
  style?: StyleProp<TextStyle>;
  /** 大きな数字・単語など、拡大しすぎると崩れる文字 */
  display?: boolean;
  numberOfLines?: number;
  accessibilityRole?: "header" | "text";
}) {
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={display ? fontScale.display : fontScale.text}
      style={[type[kind], { color: color ?? theme.c.ink }, style]}
    >
      {children}
    </Text>
  );
}

type ButtonKind = "primary" | "secondary" | "tertiary" | "danger";
/** ボタン。primary は画面に1つだけ。高さは親指で押しやすい 56pt */
export function Button({
  label,
  onPress,
  theme,
  kind = "primary",
  disabled = false,
  size = "lg",
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
  kind?: ButtonKind;
  disabled?: boolean;
  size?: "lg" | "md";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = theme;
  const bg =
    kind === "primary" ? c.accent : kind === "secondary" ? c.soft : "transparent";
  const fg =
    kind === "primary" ? c.onAccent : kind === "danger" ? c.wrong : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={kind === "tertiary" ? 8 : 0}
      style={({ pressed }) => [
        ui.button,
        size === "md" && ui.buttonMd,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        kind === "danger" && { borderWidth: 1.5, borderColor: c.wrongBorder },
        style,
      ]}
    >
      <Text
        maxFontSizeMultiplier={fontScale.display}
        style={[type.button, { color: fg, textAlign: "center" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 角丸のカード。border は「押せない入れ物」、押せる物には pressable を使う */
export function Card({
  children,
  theme,
  style,
  tone = "card",
}: {
  children: React.ReactNode;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
  tone?: "card" | "soft";
}) {
  const { c } = theme;
  return (
    <View
      style={[
        ui.card,
        tone === "soft"
          ? { backgroundColor: c.soft }
          : { backgroundColor: c.card, borderColor: c.line, borderWidth: 1 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** 進み具合のバー */
export function Meter({
  value,
  max,
  theme,
  height = 6,
  color,
}: {
  value: number;
  max: number;
  theme: Theme;
  height?: number;
  color?: string;
}) {
  const { c } = theme;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={{ height, borderRadius: height, backgroundColor: c.track, overflow: "hidden" }}
    >
      <View
        style={{
          width: `${max ? Math.min(100, (value / max) * 100) : 0}%`,
          height,
          backgroundColor: color ?? c.accent,
          borderRadius: height,
        }}
      />
    </View>
  );
}

/** 選択肢の小さなボタン（目標スコアなど） */
export function Chip({
  label,
  selected,
  onPress,
  theme,
  accessibilityLabel,
  grow = true,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: Theme;
  accessibilityLabel?: string;
  grow?: boolean;
}) {
  const { c } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        ui.chip,
        grow && { flexBasis: 0, flexGrow: 1 },
        {
          borderColor: selected ? c.accent : c.border,
          backgroundColor: selected ? c.accent : c.card,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={fontScale.display}
        style={[
          type.body,
          { color: selected ? c.onAccent : c.ink, fontWeight: selected ? "700" : "500" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 行の右端に矢印が付く、押せる行（一覧の項目） */
export function Row({
  title,
  detail,
  right,
  onPress,
  theme,
  accessibilityLabel,
  first = false,
}: {
  title: string;
  detail?: string;
  right?: string;
  onPress: () => void;
  theme: Theme;
  accessibilityLabel?: string;
  first?: boolean;
}) {
  const { c } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}${detail ? `、${detail}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        ui.row,
        !first && { borderTopWidth: 1, borderTopColor: c.line },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt theme={theme} kind="body" style={{ fontWeight: "600" }}>
          {title}
        </Txt>
        {!!detail && (
          <Txt theme={theme} kind="caption" color={c.muted}>
            {detail}
          </Txt>
        )}
      </View>
      {!!right && (
        <Txt theme={theme} kind="caption" color={c.accent}>
          {right}
        </Txt>
      )}
      <Txt theme={theme} kind="body" color={c.muted} display>
        ›
      </Txt>
    </Pressable>
  );
}

/** 小さな丸いラベル（苦手・自分で登録など） */
export function Badge({ label, color, theme }: { label: string; color: string; theme: Theme }) {
  return (
    <View style={[ui.badge, { borderColor: color, backgroundColor: theme.c.card }]}>
      <Text maxFontSizeMultiplier={fontScale.display} style={[type.caption, { color }]}>
        {label}
      </Text>
    </View>
  );
}

/** お知らせ（保存エラーなど） */
export function Notice({
  message,
  action,
  onAction,
  theme,
}: {
  message: string;
  action: string;
  onAction: () => void;
  theme: Theme;
}) {
  return (
    <Card theme={theme} tone="soft" style={{ gap: space.md }}>
      <Txt theme={theme}>{message}</Txt>
      <Button theme={theme} label={action} onPress={onAction} kind="tertiary" size="md" />
    </Card>
  );
}

export const ui = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonMd: { minHeight: TAP, paddingVertical: space.sm },
  card: { borderRadius: radius.lg, padding: space.xl, gap: space.lg },
  chip: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  /** 画面間で共通の横の余白 */
  screen: { width: "100%", maxWidth: 600, alignSelf: "center", padding: space.xl, gap: space.lg },
});
