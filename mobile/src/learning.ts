export type Word = {
  No: number;
  word: string;
  meaning: string;
  example: string;
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
  const notYet = [
    ...new Set<number>(
      data.notYet.filter(
        (id: unknown) =>
          typeof id === "number" && validIds.has(id) && !mastered.includes(id),
      ),
    ),
  ];
  return { mastered, notYet };
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
  return shuffle(
    words.filter(
      (w) =>
        w.score_band === band &&
        (!onlyUnmastered || !progress.mastered.includes(w.No)),
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
  const targets = shuffle(
    [
      ...shuffle(pool.filter((w) => !progress.mastered.includes(w.No))),
      ...shuffle(pool.filter((w) => progress.mastered.includes(w.No))),
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
