import React from "react";
import { Linking, StyleSheet, Switch, View } from "react-native";
import { BANDS } from "../learning";
import { space, type Theme } from "../theme";
import { Card, Chip, Row, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { copy } from "../copy";

export const PRIVACY_URL = "https://toeic-app.trainer-jonny.workers.dev/privacy.html";
export const SUPPORT_URL = "https://toeic-app.trainer-jonny.workers.dev/support.html";

export type SettingsProps = {
  theme: Theme;
  target: number | null;
  onChooseTarget: (score: number) => void;
  autoSpeak: boolean;
  onAutoSpeak: (on: boolean) => void;
  reverse: boolean;
  onReverse: (on: boolean) => void;
  version: string;
  stats: { mastered: number; retained: number; weak: number; all: number };
  /** 有料プランの案内（課金を始めるまでは渡さない＝行を出さない） */
  onPlus?: () => void;
  onBack: () => void;
};

export function SettingsScreen(p: SettingsProps) {
  const { theme } = p;
  const { c } = theme;
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <Frame theme={theme} title={copy.settings.title} onBack={p.onBack}>
      <Card theme={theme}>
        <Txt theme={theme} kind="heading" accessibilityRole="header">
          {copy.settings.target}
        </Txt>
        <Txt theme={theme} kind="callout" color={c.muted}>
          目標までのレベルから、今日の学習を組みます。
        </Txt>
        <View style={styles.chips}>
          {BANDS.map((score) => (
            <Chip
              key={score}
              label={String(score)}
              selected={p.target === score}
              onPress={() => p.onChooseTarget(score)}
              theme={theme}
              accessibilityLabel={`目標スコア ${score}点`}
            />
          ))}
        </View>
      </Card>
      <Card theme={theme} style={{ gap: space.sm }}>
        <View style={styles.switchRow}>
          <Txt theme={theme} kind="body" style={{ flex: 1 }}>
            {copy.settings.autoSpeak}
          </Txt>
          <Switch
            value={p.autoSpeak}
            onValueChange={p.onAutoSpeak}
            accessibilityLabel={copy.settings.autoSpeak}
            trackColor={{ true: c.accent, false: c.track }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={[styles.switchRow, { borderTopWidth: 1, borderTopColor: c.line }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt theme={theme} kind="body">
              {copy.settings.reverse}
            </Txt>
            <Txt theme={theme} kind="caption" color={c.muted}>
              日本語の意味を見て英単語を思い出します
            </Txt>
          </View>
          <Switch
            value={p.reverse}
            onValueChange={p.onReverse}
            accessibilityLabel={copy.settings.reverse}
            trackColor={{ true: c.accent, false: c.track }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>
      <Card theme={theme} style={{ gap: space.sm }}>
        <Txt theme={theme} kind="heading" accessibilityRole="header">
          学習の記録
        </Txt>
        <Txt theme={theme} kind="callout" color={c.muted}>
          {`覚えた ${p.stats.mastered}語（うち定着 ${p.stats.retained}語）・苦手 ${p.stats.weak}語・全 ${p.stats.all}語`}
        </Txt>
        <Txt theme={theme} kind="caption" color={c.muted}>
          {copy.settings.local}
        </Txt>
      </Card>
      <Card theme={theme} style={{ paddingVertical: space.xs, gap: 0 }}>
        {p.onPlus && <Row theme={theme} title="英単語ノート プラス" detail="準備中" onPress={p.onPlus} first />}
        <Row theme={theme} title={copy.settings.privacy} onPress={() => open(PRIVACY_URL)} first={!p.onPlus} />
        <Row theme={theme} title={copy.settings.support} onPress={() => open(SUPPORT_URL)} />
      </Card>
      <View style={{ gap: space.xs }}>
        <Txt theme={theme} kind="caption" color={c.muted}>
          {copy.settings.version(p.version)}
        </Txt>
        <Txt theme={theme} kind="caption" color={c.muted}>
          {copy.settings.trademark}
        </Txt>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
});
