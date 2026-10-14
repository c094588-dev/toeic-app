export type Word = {
  No: number;
  word: string;
  meaning: string;
  example: string;
  example_ja: string;
  score_band: number;
  importance: string;
};
/** 単語ごとの記録。miss は苦手度（まちがえると+1、クイズ正解で-1、「覚えた」で0）、seen は最後に記録した時刻(ms) */
export type WordStat = { miss: number; seen: number };
export type Progress = {
  mastered: number[];
  notYet: number[];
  stats?: Record<number, WordStat>;
};
export type Question = { word: Word; choices: string[]; correctIndex: number };
/** weak: 苦手な単語だけ / unmastered: 覚えていない単語（苦手を優先）/ all: 全ての単語 */
export type StudyMode = "weak" | "unmastered" | "all";
export const emptyProgress = (): Progress => ({ mastered: [], notYet: [], stats: {} });
const DAY = 24 * 60 * 60 * 1000;
export function parseProgress(
  raw: string | null,
  validIds: Set<number>,
): Progress {
  if (!raw) return emptyProgress();
  const data = JSON.parse(raw);
  if (
    (data?.version !== 1 && data?.version !== 2) ||
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
  // version 1 の保存データには stats がないので空で始める
  const stats: Record<number, WordStat> = {};
  if (data.stats && typeof data.stats === "object") {
    for (const [key, value] of Object.entries(data.stats as Record<string, unknown>)) {
      const id = Number(key);
      const stat = value as Partial<WordStat> | null;
      if (
        validIds.has(id) &&
        Number.isFinite(stat?.miss) &&
        Number.isFinite(stat?.seen) &&
        (stat!.miss as number) >= 0 &&
        (stat!.seen as number) >= 0
      )
        stats[id] = { miss: Math.floor(stat!.miss as number), seen: stat!.seen as number };
    }
  }
  return { mastered, notYet, stats };
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
/** 苦手度。記録がない「まだ」の単語（以前の保存形式から移行したもの）は 1 とみなす */
export function missCount(progress: Progress, id: number): number {
  return progress.stats?.[id]?.miss ?? (progress.notYet.includes(id) ? 1 : 0);
}
/** 苦手な単語 = 覚えていない単語のうち、苦手度が1以上のもの */
export function isWeak(progress: Progress, id: number): boolean {
  return progress.notYet.includes(id) && missCount(progress, id) > 0;
}
/** 「覚えた」(true) /「まだ」(false) を記録する。「まだ」は苦手度+1、「覚えた」は苦手度を0に戻す */
export function mark(
  progress: Progress,
  id: number,
  mastered: boolean,
  now = Date.now(),
): Progress {
  const miss = mastered ? 0 : missCount(progress, id) + 1;
  return {
    mastered: [
      ...progress.mastered.filter((n) => n !== id),
      ...(mastered ? [id] : []),
    ],
    notYet: [
      ...progress.notYet.filter((n) => n !== id),
      ...(!mastered ? [id] : []),
    ],
    stats: { ...progress.stats, [id]: { miss, seen: now } },
  };
}
/** クイズで正解したとき。覚えた／まだ は変えず、苦手度を1下げる */
export function markQuizCorrect(
  progress: Progress,
  id: number,
  now = Date.now(),
): Progress {
  const miss = Math.max(0, missCount(progress, id) - 1);
  return { ...progress, stats: { ...progress.stats, [id]: { miss, seen: now } } };
}
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
/**
 * 出題の優先度（大きいほど先に出す）。
 * 苦手な単語 > 新しい単語 > 覚えた単語 の順。同じ種類の中では、苦手度が高いほど・最後に見てから日が経つほど先に出す。
 * 毎回まったく同じ順にならないよう、少しだけ乱数を混ぜる。
 */
export function priority(
  word: Word,
  progress: Progress,
  mastered: Set<number>,
  now = Date.now(),
  random = Math.random,
): number {
  const stat = progress.stats?.[word.No];
  // 最後に見てからの日数（記録がなければ30日前とみなす）。忘れかけた単語ほど先に出す
  const days = stat ? Math.max(0, (now - stat.seen) / DAY) : 30;
  const forgetting = Math.min(days * 3, 45);
  let base: number;
  if (mastered.has(word.No)) base = forgetting;
  else if (isWeak(progress, word.No))
    base = 200 + 30 * Math.min(missCount(progress, word.No), 5) + forgetting;
  else base = 100;
  return base + random() * 15;
}
/** 優先度の高い順に並べる */
export function orderByPriority(
  words: Word[],
  progress: Progress,
  now = Date.now(),
  random = Math.random,
): Word[] {
  const mastered = new Set(progress.mastered);
  return words
    .map((word) => ({ word, score: priority(word, progress, mastered, now, random) }))
    .sort((a, b) => b.score - a.score)
    .map(({ word }) => word);
}
export function weakWords(words: Word[], band: number, progress: Progress): Word[] {
  return words.filter((w) => w.score_band === band && isWeak(progress, w.No));
}
export function studyWords(
  words: Word[],
  band: number,
  progress: Progress,
  mode: StudyMode,
  now = Date.now(),
  random = Math.random,
): Word[] {
  const mastered = new Set(progress.mastered);
  const pool = words.filter(
    (w) =>
      w.score_band === band &&
      (mode === "all" ||
        (mode === "unmastered" && !mastered.has(w.No)) ||
        (mode === "weak" && isWeak(progress, w.No))),
  );
  return orderByPriority(pool, progress, now, random);
}
export function makeQuiz(
  words: Word[],
  band: number,
  progress: Progress,
  count = 10,
  now = Date.now(),
): Question[] {
  const pool = words.filter((w) => w.score_band === band);
  // 苦手な単語を優先して選び、出題順はばらばらにする
  const targets = shuffle(orderByPriority(pool, progress, now).slice(0, count));
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
