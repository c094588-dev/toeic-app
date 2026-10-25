import React from "react";
import { StyleSheet, View } from "react-native";
import type { StudyMode, Word } from "../learning";
import { MY_BAND } from "../customWords";
import { space, type Theme } from "../theme";
import { Button, Card, Chip, Row, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { copy } from "../copy";

const bandName = (b: number) => (b === MY_BAND ? copy.home.myWords : `${b}点レベル`);

export type LevelProps = {
  theme: Theme;
  band: number;
  total: number;
  mastered: number;
  weak: number;
  due: number;
  reverse: boolean;
  onToggleReverse: (reverse: boolean) => void;
  onStart: (mode: StudyMode) => void;
  onQuiz: () => void;
  onListen: () => void;
  registered: Word[];
  onAddWord: () => void;
  onEditWord: (word: Word) => void;
  canAdd: boolean;
  onBack: () => void;
};

/** レベル（または マイ単語帳）のメニュー */
export function LevelScreen(p: LevelProps) {
  const { theme, band, total, mastered, weak } = p;
  const { c } = theme;
  const isMine = band === MY_BAND;
  const summary =
    total === 0
      ? "まだ単語がありません。覚えたい単語を登録しましょう。"
      : [`${total}語のうち ${mastered}語を習得`, weak > 0 && `苦手 ${weak}語`, p.due > 0 && `復習 ${p.due}語`]
          .filter(Boolean)
          .join("・");
  return (
    <Frame theme={theme} title={bandName(band)} onBack={p.onBack}>
      <Txt theme={theme} kind="callout" color={c.muted}>
        {summary}
      </Txt>
      {total > 0 && (
        <>
          <Card theme={theme}>
            <Txt theme={theme} kind="heading" accessibilityRole="header">
              {copy.menu.learn}
            </Txt>
            <View style={styles.segment}>
              {([false, true] as const).map((rev, i) => (
                <Chip
                  key={String(rev)}
                  label={copy.menu.direction[i]}
                  selected={p.reverse === rev}
                  onPress={() => p.onToggleReverse(rev)}
                  theme={theme}
                  accessibilityLabel={rev ? "日本語から英単語を答える" : "英単語から日本語を答える"}
                />
              ))}
            </View>
            {total - mastered > 0 ? (
              <Button theme={theme} label={copy.menu.unmastered(total - mastered)} onPress={() => p.onStart("unmastered")} />
            ) : (
              <Txt theme={theme} kind="callout" color={c.accent}>
                {copy.menu.allDone}
              </Txt>
            )}
            {weak > 0 && <Button theme={theme} kind="secondary" label={copy.menu.weak(weak)} onPress={() => p.onStart("weak")} />}
            <Button theme={theme} kind={total - mastered > 0 ? "tertiary" : "secondary"} label={copy.menu.all(total)} onPress={() => p.onStart("all")} />
          </Card>
          <Card theme={theme}>
            <Txt theme={theme} kind="heading" accessibilityRole="header">
              {copy.menu.check}
            </Txt>
            <Txt theme={theme} kind="callout" color={c.muted}>
              苦手な単語と復習の時期が来た単語を優先して出します。間違えた単語は「まだ」に戻ります。
            </Txt>
            <Button theme={theme} kind="secondary" label={copy.quiz.start(Math.min(10, total))} onPress={p.onQuiz} />
            <Button theme={theme} kind="tertiary" label={copy.menu.listen(Math.min(20, total))} onPress={p.onListen} />
          </Card>
        </>
      )}
      <Card theme={theme} style={{ gap: space.sm }}>
        <Txt theme={theme} kind="heading" accessibilityRole="header">
          {isMine ? "登録した単語" : "このレベルに登録した単語"}
        </Txt>
        {p.registered.length === 0 && (
          <Txt theme={theme} kind="callout" color={c.muted}>
            {isMine ? "英単語と意味を入れるだけで登録できます。" : "このレベルに、自分で単語を足せます。"}
          </Txt>
        )}
        {p.registered.length > 0 && (
          <View>
            {p.registered.map((w, i) => (
              <Row
                key={w.No}
                theme={theme}
                title={w.word}
                detail={w.meaning}
                right={isMine && w.score_band !== MY_BAND ? `${w.score_band}点` : undefined}
                onPress={() => p.onEditWord(w)}
                accessibilityLabel={`${w.word}、${w.meaning}。編集する`}
                first={i === 0}
              />
            ))}
          </View>
        )}
        <Button theme={theme} kind={total === 0 ? "primary" : "tertiary"} label="単語を登録する" onPress={p.onAddWord} disabled={!p.canAdd} />
      </Card>
    </Frame>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", gap: space.sm },
});
