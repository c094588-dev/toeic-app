import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BANDS } from "../learning";
import { MY_BAND } from "../customWords";
import { fontScale, radius, space, type, type Theme } from "../theme";
import { Button, Card, Chip, Meter, Row, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { Icon } from "../components/Icon";
import { copy } from "../copy";

export type HomeAction = { label: string; onPress: () => void; disabled?: boolean };
export type LevelSummary = { band: number; total: number; mastered: number; weak: number };
export type HomeProps = {
  theme: Theme;
  target: number | null;
  onChooseTarget: (score: number) => void;
  doneToday: number;
  /** 今日の目標語数（出せる単語が少ない日は 20 より小さい） */
  goal: number;
  /** 今日の内訳（苦手・復習・新しい単語） */
  planLine: string;
  /** 主ボタン（目標達成後は null） */
  primary: HomeAction | null;
  /** 控えめなボタン（さらに10語 など） */
  secondary: HomeAction | null;
  /** 主ボタンの上に添える一言（しばらくぶり・達成など） */
  note: string;
  reached: boolean;
  weekDots: boolean[];
  weakAcross: number;
  onWeakOnly: () => void;
  listenCount: number;
  onListen: () => void;
  levels: LevelSummary[];
  onLevel: (band: number) => void;
  myWords: { total: number; mastered: number };
  totals: { mastered: number; all: number };
  onSettings: () => void;
  banners: { message: string; action: string; onAction: () => void }[];
};

export function HomeScreen(p: HomeProps) {
  const { theme } = p;
  const { c } = theme;
  const weekCount = p.weekDots.filter(Boolean).length;
  return (
    <Frame
      theme={theme}
      title={copy.appName}
      banners={p.banners}
      right={{ icon: "settings-outline", label: copy.settings.title, onPress: p.onSettings }}
    >
      {p.target === null ? (
        <Card theme={theme}>
          <Txt theme={theme} kind="title" accessibilityRole="header">
            {copy.home.firstTitle}
          </Txt>
          <Txt theme={theme} kind="callout" color={c.muted}>
            {copy.home.firstBody}
          </Txt>
          <View style={styles.chips}>
            {BANDS.map((score) => (
              <Chip
                key={score}
                label={String(score)}
                selected={false}
                onPress={() => p.onChooseTarget(score)}
                theme={theme}
                accessibilityLabel={`目標スコア ${score}点`}
              />
            ))}
          </View>
        </Card>
      ) : (
        <>
          <View style={styles.titleRow}>
            <Txt theme={theme} kind="title" accessibilityRole="header">
              {copy.home.todayTitle}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`目標スコア ${p.target}点。タップして変更`}
              onPress={p.onSettings}
              hitSlop={8}
              style={({ pressed }) => [styles.goal, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Txt theme={theme} kind="callout" color={c.accent}>
                {copy.home.goal(p.target)}
              </Txt>
              <Icon name="chevron-forward" size={16} color={c.accent} />
            </Pressable>
          </View>
          <Card theme={theme}>
            <View style={styles.progressRow}>
              <Text maxFontSizeMultiplier={fontScale.display} style={[type.numeral, { color: c.accent }]}>
                {Math.min(p.doneToday, p.goal)}
                <Text style={[type.body, { color: c.muted }]}> / {p.goal}語</Text>
              </Text>
              {p.reached && (
                <Txt theme={theme} kind="callout" color={c.accent} style={{ fontWeight: "600" }}>
                  {copy.home.reached}
                </Txt>
              )}
            </View>
            <Meter value={Math.min(p.doneToday, p.goal)} max={p.goal} theme={theme} height={6} />
            {!!p.note && (
              <Txt theme={theme} kind="callout" color={c.ink}>
                {p.note}
              </Txt>
            )}
            {!!p.planLine && !p.reached && (
              <Txt theme={theme} kind="callout" color={c.muted}>
                {p.planLine}
              </Txt>
            )}
            {p.primary && (
              <Button theme={theme} label={p.primary.label} onPress={p.primary.onPress} disabled={p.primary.disabled} />
            )}
            {p.secondary && (
              <Button theme={theme} kind="secondary" label={p.secondary.label} onPress={p.secondary.onPress} disabled={p.secondary.disabled} />
            )}
            <View style={styles.weekRow} accessible accessibilityLabel={copy.home.week(weekCount)}>
              <View style={styles.dots}>
                {p.weekDots.map((on, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: on ? c.accent : "transparent", borderColor: on ? c.accent : c.border },
                      i === 6 && { borderWidth: 2, borderColor: on ? c.accent : c.border },
                    ]}
                  />
                ))}
              </View>
              <Txt theme={theme} kind="caption" color={c.muted}>
                {copy.home.week(weekCount)}
              </Txt>
            </View>
          </Card>
          {(p.weakAcross > 0 || p.listenCount > 0) && (
            <Card theme={theme} style={{ paddingVertical: space.xs, gap: 0 }}>
              {p.weakAcross > 0 && (
                <Row theme={theme} title={copy.home.weakOnly(p.weakAcross)} onPress={p.onWeakOnly} first />
              )}
              {p.listenCount > 0 && (
                <Row
                  theme={theme}
                  title={copy.home.listen}
                  detail={`${p.listenCount}語を読み上げ`}
                  onPress={p.onListen}
                  first={p.weakAcross === 0}
                />
              )}
            </Card>
          )}
          <Txt theme={theme} kind="caption" color={c.muted} style={{ marginTop: space.sm }}>
            {copy.home.levels}
          </Txt>
          <Card theme={theme} style={{ paddingVertical: space.xs, gap: 0 }}>
            {p.levels.map((l, i) => (
              <Row
                key={l.band}
                theme={theme}
                title={`${l.band}点レベル`}
                detail={l.weak > 0 ? `苦手 ${l.weak}語` : undefined}
                right={`${l.mastered} / ${l.total}`}
                onPress={() => p.onLevel(l.band)}
                accessibilityLabel={`${l.band}点レベル、${l.total}語中${l.mastered}語習得`}
                first={i === 0}
              />
            ))}
            <Row
              theme={theme}
              title={copy.home.myWords}
              detail={p.myWords.total === 0 ? copy.home.myWordsEmpty : undefined}
              right={p.myWords.total > 0 ? `${p.myWords.mastered} / ${p.myWords.total}` : undefined}
              onPress={() => p.onLevel(MY_BAND)}
              accessibilityLabel={`マイ単語帳、${p.myWords.total}語中${p.myWords.mastered}語習得`}
            />
          </Card>
          {p.totals.mastered > 0 && (
            <Txt theme={theme} kind="caption" color={c.muted} style={{ textAlign: "center" }}>
              {copy.home.total(p.totals.mastered, p.totals.all)}
            </Txt>
          )}
        </>
      )}
    </Frame>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  goal: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, paddingHorizontal: space.xs },
  progressRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  dots: { flexDirection: "row", gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: radius.pill, borderWidth: 1.5 },
});
