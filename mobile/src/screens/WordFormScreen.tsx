import React from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { BANDS, type Word } from "../learning";
import { LIMITS, MY_BAND, isCustomWord, type CustomWordInput } from "../customWords";
import { fontScale, radius, space, type, type Theme } from "../theme";
import { Button, Card, Chip, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { copy } from "../copy";

const bandName = (b: number) => (b === MY_BAND ? copy.home.myWords : `${b}点レベル`);

export type WordFormProps = {
  theme: Theme;
  form: CustomWordInput;
  onChange: (patch: Partial<CustomWordInput>) => void;
  editing: boolean;
  duplicate: Word | undefined;
  error: string;
  saved: string;
  storeError: string;
  confirmDelete: boolean;
  canSave: boolean;
  onSave: () => void;
  onDelete: () => void;
  onBack: () => void;
};

export function WordFormScreen(p: WordFormProps) {
  const { theme, form } = p;
  const { c } = theme;
  const field = (label: string, key: keyof Omit<CustomWordInput, "score_band">, props: TextInputProps) => (
    <View style={{ gap: space.xs }}>
      <Txt theme={theme} kind="callout">
        {label}
      </Txt>
      <TextInput
        value={form[key]}
        onChangeText={(value) => p.onChange({ [key]: value })}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        maxFontSizeMultiplier={fontScale.text}
        style={[styles.input, props.multiline && styles.multiline, { color: c.ink, borderColor: c.border, backgroundColor: c.bg }]}
        {...props}
      />
    </View>
  );
  return (
    <Frame theme={theme} title={p.editing ? "単語を編集" : "単語を登録"} onBack={p.onBack}>
      <Txt theme={theme} kind="callout" color={c.muted}>
        英単語と意味は必ず入れてください。例文はなくても登録できます。
      </Txt>
      {!!p.saved && (
        <Card theme={theme} tone="soft">
          <Txt theme={theme} kind="callout">
            {p.saved}
          </Txt>
        </Card>
      )}
      {!!p.storeError && (
        <Txt theme={theme} kind="callout" color={c.wrong}>
          {p.storeError}
        </Txt>
      )}
      <Card theme={theme}>
        {field("英単語", "word", { placeholder: "例：deadline", autoCapitalize: "none", autoCorrect: false, maxLength: LIMITS.word })}
        {!!p.duplicate && (
          <Txt theme={theme} kind="caption" color={c.wrong}>
            {`「${p.duplicate.word}」は${bandName(p.duplicate.score_band)}に${isCustomWord(p.duplicate) ? "登録済み" : "収録されています"}。このまま登録することもできます。`}
          </Txt>
        )}
        {field("意味", "meaning", { placeholder: "例：締め切り", maxLength: LIMITS.meaning })}
        {field("例文（なくても可）", "example", {
          placeholder: "例：The deadline is this Friday.",
          autoCapitalize: "sentences",
          multiline: true,
          maxLength: LIMITS.example,
        })}
        {field("例文の訳（なくても可）", "example_ja", {
          placeholder: "例：締め切りは今週の金曜日です。",
          multiline: true,
          maxLength: LIMITS.example_ja,
        })}
        <View style={{ gap: space.sm }}>
          <Txt theme={theme} kind="callout">
            登録先
          </Txt>
          <Chip
            label={copy.home.myWords}
            selected={form.score_band === MY_BAND}
            onPress={() => p.onChange({ score_band: MY_BAND })}
            theme={theme}
            accessibilityLabel={`登録先 ${copy.home.myWords}`}
            grow={false}
          />
          <View style={styles.chips}>
            {BANDS.map((b) => (
              <Chip
                key={b}
                label={String(b)}
                selected={form.score_band === b}
                onPress={() => p.onChange({ score_band: b })}
                theme={theme}
                accessibilityLabel={`登録先 ${b}点レベル`}
              />
            ))}
          </View>
        </View>
        {!!p.error && (
          <Txt theme={theme} kind="callout" color={c.wrong}>
            {p.error}
          </Txt>
        )}
        <Button theme={theme} label={p.editing ? "保存する" : "登録する"} onPress={p.onSave} disabled={!p.canSave} />
        {p.editing && (
          <Button theme={theme} kind="danger" label={p.confirmDelete ? "本当に削除する" : "この単語を削除する"} onPress={p.onDelete} />
        )}
        {p.confirmDelete && (
          <Txt theme={theme} kind="caption" color={c.wrong}>
            削除すると、この単語の学習記録も消えます。
          </Txt>
        )}
      </Card>
    </Frame>
  );
}

const styles = StyleSheet.create({
  input: {
    ...type.body,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 50,
  },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  chips: { flexDirection: "row", gap: space.sm },
});
