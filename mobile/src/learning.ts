export type Word = {
  No: number;
  word: string;
  meaning: string;
  example: string;
  example_ja: string;
  score_band: number;
  importance: string;
};
export type Progress = { mastered: number[]; notYet: number[] };
export type Question = { word: Word; choices: string[]; correctIndex: number };
export const emptyProgress = (): Progress => ({ mastered: [], notYet: [] });
export function parseProgress(
  raw: string | null,
  validIds: Set<number>,
): Progress {
  if (!raw) return emptyProgress();
  const data = JSON.parse(raw);
  if (
    data?.version !== 1 ||
    !Array.isArray(data.mastered) ||
    !Array.isArray(data.notYet)
  )
    throw new Error("Invalid progress");
  const mastered = [
    ...new Set<number>(
      data.mastered.filter(
        (id: unknown) => typeof id === "number" && validIds.has(id),
      ),
    ),
  ];
  const masteredSet = new Set(mastered);
  const notYet = [
    ...new Set<number>(
      data.notYet.filter(
        (id: unknown) =>
          typeof id === "number" && validIds.has(id) && !masteredSet.has(id),
      ),
    ),
  ];
  return { mastered, notYet };
}
/** 保存データを読み込む。壊れていれば空の進捗で始め、元データを退避できるよう corrupt で知らせる */
export function restoreProgress(
  raw: string | null,
  validIds: Set<number>,
): { progress: Progress; corrupt: boolean } {
  try {
    return { progress: parseProgress(raw, validIds), corrupt: false };
  } catch {
    return { progress: emptyProgress(), corrupt: true };
  }
}
export function mark(
  progress: Progress,
  id: number,
  mastered: boolean,
): Progress {
  return {
    mastered: [
      ...progress.mastered.filter((n) => n !== id),
      ...(mastered ? [id] : []),
    ],
    notYet: [
      ...progress.notYet.filter((n) => n !== id),
      ...(!mastered ? [id] : []),
    ],
  };
}
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function studyWords(
  words: Word[],
  band: number,
  progress: Progress,
  onlyUnmastered: boolean,
): Word[] {
  const mastered = new Set(progress.mastered);
  return shuffle(
    words.filter(
      (w) =>
        w.score_band === band && (!onlyUnmastered || !mastered.has(w.No)),
    ),
  );
}
export function makeQuiz(
  words: Word[],
  band: number,
  progress: Progress,
  count = 10,
): Question[] {
  const pool = words.filter((w) => w.score_band === band);
  const mastered = new Set(progress.mastered);
  const targets = shuffle(
    [
      ...shuffle(pool.filter((w) => !mastered.has(w.No))),
      ...shuffle(pool.filter((w) => mastered.has(w.No))),
    ].slice(0, count),
  );
  return targets.flatMap((word) => {
    const wrong = shuffle([
      ...new Set(
        pool.filter((w) => w.meaning !== word.meaning).map((w) => w.meaning),
      ),
    ]).slice(0, 3);
    if (wrong.length < 3) return [];
    const choices = shuffle([...wrong, word.meaning]);
    return [{ word, choices, correctIndex: choices.indexOf(word.meaning) }];
  });
}
