import React from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { radius, TAP, type Theme } from "../theme";

export type IconName =
  | "chevron-back"
  | "chevron-forward"
  | "volume-high-outline"
  | "volume-mute-outline"
  | "settings-outline"
  | "close"
  | "checkmark"
  | "play"
  | "pause"
  | "play-skip-forward"
  | "arrow-undo-outline"
  | "add";

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** アイコンだけのボタン。44pt（ヘッダー）か 56pt（フッター） */
export function IconButton({
  name,
  label,
  hint,
  onPress,
  theme,
  size = TAP,
  tone = "plain",
  disabled = false,
  style,
}: {
  name: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  theme: Theme;
  size?: number;
  tone?: "plain" | "soft";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size < 48 ? 6 : 0}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: tone === "soft" ? radius.md : size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tone === "soft" ? c.soft : "transparent",
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} size={size >= 56 ? 26 : 24} color={c.accent} />
    </Pressable>
  );
}
