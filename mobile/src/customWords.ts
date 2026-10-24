import type { Word } from "./learning";

/** マイ単語帳のレベル番号（500〜900 のレベルより前に並ぶよう 0 にする） */
export const MY_BAND = 0;
/** 自分で登録した単語の番号はここから振る（収録単語の番号と重ならないように） */
export const CUSTOM_ID_BASE = 1_000_000;
/** 入力できる最大の長さ */
export const LIMITS = { word: 60, meaning: 100, example: 300, example_ja: 300 };

export type CustomWordInput = {
  word: string;
  meaning: string;
  example: string;
  example_ja: string;
  score_band: number;
};
export type CustomWordStore = { words: Word[]; nextId: number };

export const isCustomId = (id: number) => id >= CUSTOM_ID_BASE;
export const isCustomWord = (w: Word) => isCustomId(w.No);
export const emptyCustomWords = (): CustomWordStore => ({ words: [], nextId: CUSTOM_ID_BASE + 1 });

const validBand = (band: unknown, bands: readonly number[]) =>
  typeof band === "number" && (band === MY_BAND || bands.includes(band));

/** 前後の空白を取り、続く空白や改行を1つの空白にする */
function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/** 入力に問題があれば、その説明を返す（問題がなければ null） */
export function validateCustomWord(input: CustomWordInput, bands: readonly number[]): string | null {
  if (!clean(input.word)) return "英単語を入力してください。";
  if (!clean(input.meaning)) return "意味を入力してください。";
  if (clean(input.word).length > LIMITS.word) return `英単語は${LIMITS.word}文字以内で入力してください。`;
  if (clean(input.meaning).length > LIMITS.meaning) return `意味は${LIMITS.meaning}文字以内で入力してください。`;
  if (clean(input.example).length > LIMITS.example) return `例文は${LIMITS.example}文字以内で入力してください。`;
  if (clean(input.example_ja).length > LIMITS.example_ja)
    return `例文の訳は${LIMITS.example_ja}文字以内で入力してください。`;
  if (!validBand(input.score_band, bands)) return "登録先を選んでください。";
  return null;
}

/** 入力から単語を作る */
export function makeCustomWord(input: CustomWordInput, id: number): Word {
  return {
    No: id,
    word: clean(input.word),
    meaning: clean(input.meaning),
    example: clean(input.example),
    example_ja: clean(input.example_ja),
    score_band: input.score_band,
    importance: "自分で登録",
  };
}

/** 同じ英単語（大文字・小文字は区別しない）がすでにあれば返す。編集中の単語自身は除く */
export function findDuplicate(words: Word[], word: string, exceptId?: number): Word | undefined {
  const key = clean(word).toLowerCase();
  if (!key) return undefined;
  return words.find((w) => w.No !== exceptId && w.word.toLowerCase() === key);
}

/** 保存データを読み込む。形のおかしい単語は捨てる */
export function parseCustomWords(raw: string | null, bands: readonly number[]): CustomWordStore {
  if (!raw) return emptyCustomWords();
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.words)) throw new Error("Invalid custom words");
  const seen = new Set<number>();
  const words: Word[] = [];
  for (const item of data.words) {
    if (
      !item ||
      typeof item.No !== "number" ||
      !isCustomId(item.No) ||
      seen.has(item.No) ||
      typeof item.word !== "string" ||
      typeof item.meaning !== "string" ||
      !validBand(item.score_band, bands)
    )
      continue;
    seen.add(item.No);
    words.push(
      makeCustomWord(
        {
          word: item.word,
          meaning: item.meaning,
          example: typeof item.example === "string" ? item.example : "",
          example_ja: typeof item.example_ja === "string" ? item.example_ja : "",
          score_band: item.score_band,
        },
        item.No,
      ),
    );
  }
  const maxId = Math.max(CUSTOM_ID_BASE, ...words.map((w) => w.No));
  const nextId = Number.isInteger(data.nextId) && data.nextId > maxId ? data.nextId : maxId + 1;
  return { words: words.filter((w) => w.word && w.meaning), nextId };
}

export function serializeCustomWords(store: CustomWordStore): string {
  return JSON.stringify({ version: 1, ...store });
}
