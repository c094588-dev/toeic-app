import { useColorScheme, type TextStyle } from "react-native";

/**
 * デザイントークン。画面ごとに値を直書きせず、ここから使う。
 * - 間隔は 4pt 刻み（space）。画面の横の余白は 16〜20、カードの中は 16、セクション間は 24
 * - 文字は用途別のスケール（type）。9種類だけ
 * - 角丸は4種類。影は使わない（面の明るさの差で分ける）
 * - 色は意味ごとの名前（Colors）。ライト／ダークで値だけ変える
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 12, md: 14, lg: 20, pill: 999 } as const;
/** 文字の大きさ。lineHeight は読みやすさのため 1.2〜1.5 倍 */
export const type = {
  /** 学習画面の英単語 */
  display: { fontSize: 48, lineHeight: 56, fontWeight: "700" as const, letterSpacing: -0.5 },
  /** クイズの単語、日→英の日本語 */
  display2: { fontSize: 34, lineHeight: 42, fontWeight: "700" as const, letterSpacing: -0.3 },
  /** 画面の見出し */
  title: { fontSize: 28, lineHeight: 36, fontWeight: "700" as const, letterSpacing: -0.4 },
  /** カードの見出し、答えの意味 */
  heading: { fontSize: 22, lineHeight: 30, fontWeight: "600" as const },
  /** 大きな数字（進捗） */
  numeral: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const, fontVariant: ["tabular-nums"] as NonNullable<TextStyle["fontVariant"]> },
  /** 本文（例文、説明） */
  body: { fontSize: 17, lineHeight: 26, fontWeight: "400" as const },
  /** ボタン */
  button: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  /** 補足（例文の訳、副文） */
  callout: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  /** ラベル・バッジ・注記 */
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
} as const;
/** 文字サイズの拡大（Dynamic Type）に付き合う上限。大きな単語や数字は画面からはみ出さない範囲で */
export const fontScale = { text: 1.6, button: 1.3, display: 1.2 } as const;
/** 指で押す部品の最小の大きさ（Apple の推奨 44pt） */
export const TAP = 44;

export type Colors = {
  /** 画面の背景 */
  bg: string;
  /** カード・行の面 */
  card: string;
  /** 本文 */
  ink: string;
  /** 補足の文字（15pt 以上で使う） */
  muted: string;
  /** 区切り線（ライトではカードの枠に使わない） */
  line: string;
  /** チップ・入力欄の枠（3:1 を確保） */
  border: string;
  /** 進捗バーの空の部分 */
  track: string;
  /** 主操作・進捗の塗り・選択 */
  accent: string;
  /** accent の上の文字 */
  onAccent: string;
  /** 控えめなボタン・選択中の背景 */
  soft: string;
  /** 「まだ」・誤答 */
  wrong: string;
  wrongBorder: string;
};
export const light: Colors = {
  bg: "#EEF1EC",
  card: "#FFFFFF",
  ink: "#172F36",
  muted: "#55696D",
  line: "#E0E7E4",
  border: "#7C8C87",
  track: "#CAD5D0",
  accent: "#176F66",
  onAccent: "#FFFFFF",
  soft: "#E7F2EE",
  wrong: "#9A4329",
  wrongBorder: "#A9502F",
};
export const dark: Colors = {
  bg: "#111B22",
  card: "#1C2932",
  ink: "#F2F6F5",
  muted: "#A8BABD",
  line: "#2A3A42",
  border: "#667C83",
  track: "#3E5158",
  accent: "#80DACC",
  onAccent: "#102A28",
  soft: "#243E3F",
  wrong: "#FFA487",
  wrongBorder: "#E0876B",
};
export type Theme = { c: Colors; dark: boolean };
export function useTheme(): Theme {
  const isDark = useColorScheme() === "dark";
  return { c: isDark ? dark : light, dark: isDark };
}
