import React from "react";
import { View } from "react-native";
import { space, type Theme } from "../theme";
import { Button, Card, Meter, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { copy } from "../copy";

export type StudyResultProps = {
  theme: Theme;
  isToday: boolean;
  tally: { learned: number; notYet: number; skipped: number };
  doneToday: number;
  goal: number;
  reached: boolean;
  /** 連番で変える励ましの一言 */
  encouragement: string;
  tomorrow: string | null;
  primary: { label: string; onPress: () => void };
  retryNotYet: { label: string; onPress: () => void } | null;
  tertiary: { label: string; onPress: () => void } | null;
  onBack: () => void;
};

/** 学習の区切り。数字は 覚えた／まだ／判定なし の3つまで */
export function StudyResultScreen(p: StudyResultProps) {
  const { theme } = p;
  const { c } = theme;
  return (
    <Frame theme={theme} title={p.isToday ? copy.home.todayTitle : "学習の結果"} onBack={p.onBack}>
      <View style={{ gap: space.sm, paddingTop: space.md }}>
        <Txt theme={theme} kind="callout" color={c.accent} style={{ fontWeight: "600" }}>
          {p.isToday && p.reached ? copy.result.kicker : copy.result.kickerPartial}
        </Txt>
        <Txt theme={theme} kind="title" accessibilityRole="header">
          {copy.result.summary(p.tally.learned, p.tally.notYet, p.tally.skipped)}
        </Txt>
        <Txt theme={theme} kind="callout" color={c.muted}>
          {p.encouragement}
        </Txt>
      </View>
      {p.isToday && (
        <Card theme={theme}>
          <Txt theme={theme} kind="body" style={{ fontWeight: "600" }}>
            {copy.result.todayCount(Math.min(p.doneToday, p.goal), p.goal)}
          </Txt>
          <Meter value={Math.min(p.doneToday, p.goal)} max={p.goal} theme={theme} height={6} />
          {!!p.tomorrow && (
            <Txt theme={theme} kind="callout" color={c.muted}>
              {p.tomorrow}
            </Txt>
          )}
        </Card>
      )}
      <View style={{ gap: space.sm }}>
        <Button theme={theme} label={p.primary.label} onPress={p.primary.onPress} />
        {p.retryNotYet && <Button theme={theme} kind="secondary" label={p.retryNotYet.label} onPress={p.retryNotYet.onPress} />}
        {p.tertiary && <Button theme={theme} kind="tertiary" label={p.tertiary.label} onPress={p.tertiary.onPress} />}
      </View>
    </Frame>
  );
}
