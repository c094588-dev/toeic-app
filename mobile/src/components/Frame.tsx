import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { space, type Theme } from "../theme";
import { Header } from "./Header";
import type { IconName } from "./Icon";
import { Notice } from "../ui";

/**
 * 画面の枠。ヘッダー＋本文（スクロールする／しない）＋下の固定ボタン欄。
 * banners は保存エラーなどのお知らせ（本文の上に出す）
 */
export function Frame({
  theme,
  title,
  onBack,
  right,
  scroll = true,
  footer,
  banners,
  children,
  contentStyle,
  scrollRef,
}: {
  theme: Theme;
  title: string;
  onBack?: () => void;
  right?: { icon: IconName; label: string; hint?: string; onPress: () => void };
  scroll?: boolean;
  footer?: React.ReactNode;
  banners?: { message: string; action: string; onAction: () => void }[];
  children: React.ReactNode;
  contentStyle?: object;
  scrollRef?: React.Ref<ScrollView>;
}) {
  const { c } = theme;
  const bannerViews = banners?.filter((b) => b.message).map((b, i) => (
    <Notice key={i} theme={theme} message={b.message} action={b.action} onAction={b.onAction} />
  ));
  return (
    <View style={{ flex: 1 }}>
      <Header title={title} theme={theme} onBack={onBack} right={right} />
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.content, contentStyle]}
        >
          {bannerViews}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentStyle]}>
          {bannerViews && bannerViews.length > 0 && <View style={styles.content}>{bannerViews}</View>}
          {children}
        </View>
      )}
      {footer && (
        <View style={[styles.footer, { borderTopColor: c.line, backgroundColor: c.bg }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  fill: { flex: 1, width: "100%", maxWidth: 600, alignSelf: "center" },
  footer: { borderTopWidth: 1, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg },
  footerInner: { width: "100%", maxWidth: 568, alignSelf: "center", gap: space.sm },
});
