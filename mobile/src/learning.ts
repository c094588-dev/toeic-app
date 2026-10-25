export type Word = {
  No: number;
  word: string;
  meaning: string;
  example: string;
  example_ja: string;
  score_band: number;
  importance: string;
};
/**
 * 単語ごとの記録。
 * - miss: 苦手度（まちがえると+1、クイズ正解で-1、「覚えた」で0）
 * - seen: 最後に答えた時刻(ms)
 * - step: 間隔反復の段階（0=学習中。覚えたを重ねるほど上がり、次の復習までの間隔が延びる）
 * - due: 次に出す時刻(ms)。この時刻を過ぎると「復習」として今日の学習に入る
 * step/due は version 3 から。古い記録には無いので、読み込み時に補う（記録は1語も消さない）
 */
export type WordStat = {
  miss: number;
  seen: number;
  step?: number;
  due?: number;
  /** 初めて記録が付いた時刻(ms)。今日の新しい単語の数に使う。古い記録には無い */
  first?: number;
};
export type Progress = {
  /** 最後の判定が「覚えた」の単語 */
  mastered: number[];
  /** 最後の判定が「まだ」の単語 */
  notYet: number[];
  stats?: Record<number, WordStat>;
};
export type Question = { word: Word; choices: string[]; correctIndex: number };
/** weak: 苦手な単語だけ / unmastered: 覚えていない単語（苦手を優先）/ all: 全ての単語 */
export type StudyMode = "weak" | "unmastered" | "all";
export const emptyProgress = (): Progress => ({ mastered: [], notYet: [], stats: {} });
const DAY = 24 * 60 * 60 * 1000;
export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---- 間隔反復（SRS）----
/**
 * 段階ごとの、次の復習までの日数（Leitner 式のはしご）。「覚えた」を重ねるたびに1段階上がる。
 * 間隔が延びるほど1語あたりの復習回数が減り、忘れかけたころにもう一度出る
 */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60, 120, 240] as const;
export const MAX_STEP = INTERVAL_DAYS.length - 1;
/** 「定着」とみなす段階（1日・3日・7日・14日の復習を通り、次は30日後） */
export const RETAINED_STEP = 5;
/** 答えを見ずに「覚えた」とした初見の単語は、すでに知っている語として7日後の段から始める */
export const CONFIDENT_STEP = 3;
/** 古い記録（due なし）の覚えた単語は、最後に見てから何日で復習に出していたか */
export const REVIEW_AFTER_DAYS = 7;
export const intervalFor = (step: number) => INTERVAL_DAYS[Math.max(0, Math.min(MAX_STEP, step))] * DAY;
/** その日の 0 時にそろえた次の復習時刻（「1日後」は翌日のいつ開いても出る） */
export function nextDue(step: number, now: number): number {
  return step <= 0 ? now : startOfDay(now) + intervalFor(step);
}
/** 経過した日数に見合う段階（60日放って思い出せたなら、60日の段とみなす） */
function stepForElapsed(elapsedMs: number): number {
  let k = 0;
  for (let i = 0; i <= MAX_STEP; i++) if (elapsedMs >= INTERVAL_DAYS[i] * DAY) k = i;
  return k;
}
/**
 * 古い記録（step なし）に段階を補う。
 * - 覚えた単語: 段階 3（従来の「7日後に復習」と同じ）。最後に見てから7日たっていれば、すぐ復習に出る
 * - まだの単語・クイズだけの単語: 段階 1。翌日から出る
 */
export function migrateStat(stat: WordStat, mastered: boolean): WordStat {
  if (Number.isInteger(stat.step) && Number.isFinite(stat.due)) return stat;
  const step = mastered ? CONFIDENT_STEP : 1;
  return { ...stat, step, due: nextDue(step, stat.seen) };
}
/** 更新で一度に復習の時期が来た「覚えた」単語を、何日に分けて出すか */
export const MIGRATION_SPREAD_DAYS = 14;
/** 残してよい単語の番号（番号の集合、または番号を調べる関数） */
export type IdCheck = Set<number> | ((id: number) => boolean);
export function parseProgress(
  raw: string | null,
  validIds: IdCheck,
  now = Date.now(),
): Progress {
  if (!raw) return emptyProgress();
  const valid = typeof validIds === "function" ? validIds : (id: number) => validIds.has(id);
  const data = JSON.parse(raw);
  if (
    (data?.version !== 1 && data?.version !== 2 && data?.version !== 3) ||
    !Array.isArray(data.mastered) ||
    !Array.isArray(data.notYet)
  )
    throw new Error("Invalid progress");
  const mastered = [
    ...new Set<number>(
      data.mastered.filter(
        (id: unknown) => typeof id === "number" && valid(id),
      ),
    ),
  ];
  const masteredSet = new Set(mastered);
  const notYet = [
    ...new Set<number>(
      data.notYet.filter(
        (id: unknown) =>
          typeof id === "number" && valid(id) && !masteredSet.has(id),
      ),
    ),
  ];
  // version 1 の保存データには stats がない
  const stats: Record<number, WordStat> = {};
  // 段階（step/due）が記録にあった単語。無かった単語は移行で補う
  const explicit = new Set<number>();
  if (data.stats && typeof data.stats === "object") {
    for (const [key, value] of Object.entries(data.stats as Record<string, unknown>)) {
      const id = Number(key);
      const stat = value as Partial<WordStat> | null;
      if (
        valid(id) &&
        Number.isFinite(stat?.miss) &&
        Number.isFinite(stat?.seen) &&
        (stat!.miss as number) >= 0 &&
        (stat!.seen as number) >= 0
      ) {
        // 端末の時計が未来にずれていた記録は「いま」に丸める（「今日学習済み」が何日も残らないように）
        const base: WordStat = { miss: Math.floor(stat!.miss as number), seen: Math.min(stat!.seen as number, now) };
        if (Number.isFinite(stat!.first)) base.first = Math.min(stat!.first as number, now);
        if (Number.isInteger(stat!.step) && (stat!.step as number) >= 0 && Number.isFinite(stat!.due)) {
          Object.assign(base, { step: Math.min(MAX_STEP, stat!.step as number), due: stat!.due as number });
          explicit.add(id);
        }
        stats[id] = migrateStat(base, masteredSet.has(id));
      }
    }
  }
  // 記録のない「覚えた」単語（version 1）は、7日前に覚えたものとして、いま復習に出す
  for (const id of mastered)
    if (!stats[id]) stats[id] = { miss: 0, seen: now - REVIEW_AFTER_DAYS * DAY, step: CONFIDENT_STEP, due: now };
  // 記録のない「まだ」の単語（version 1）は、苦手度 1 で、すぐ出す
  for (const id of notYet)
    if (!stats[id]) stats[id] = { miss: 1, seen: now - DAY, step: 1, due: now };
  // 段階の記録がなく、更新で一度に時期が来た「覚えた」単語は 14 日に分けて出す
  //（更新直後に復習だけの日が何日も続かないように。段階の記録がある単語には触れない）
  const today = startOfDay(now);
  for (const id of mastered) {
    const s = stats[id];
    if (!explicit.has(id) && s.due !== undefined && s.due <= now) s.due = today + (id % MIGRATION_SPREAD_DAYS) * DAY;
  }
  return { mastered, notYet, stats };
}
/** 保存データを読み込む。壊れていれば空の進捗で始め、元データを退避できるよう corrupt で知らせる */
export function restoreProgress(
  raw: string | null,
  validIds: IdCheck,
  now = Date.now(),
): { progress: Progress; corrupt: boolean } {
  try {
    return { progress: parseProgress(raw, validIds, now), corrupt: false };
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
/**
 * 次の復習の時刻。記録がなければ「いますぐ」。
 * due のない古い記録は、覚えた単語なら最後に見てから7日後、まだの単語ならいますぐ
 */
export function dueTime(stat: WordStat | undefined, mastered = true): number {
  if (!stat) return 0;
  return stat.due ?? (mastered ? stat.seen + REVIEW_AFTER_DAYS * DAY : stat.seen);
}
/** 復習の時期が来ているか（一度は答えたことのある単語で、次の復習の時刻を過ぎている） */
export function isDue(progress: Progress, id: number, now = Date.now()): boolean {
  const stat = progress.stats?.[id];
  if (!stat) return progress.mastered.includes(id) || progress.notYet.includes(id);
  return dueTime(stat, progress.mastered.includes(id)) <= now;
}
/** 「定着」した単語か（覚えたあと、何度かの復習を通った） */
export function isRetained(progress: Progress, id: number): boolean {
  return progress.mastered.includes(id) && (progress.stats?.[id]?.step ?? 0) >= RETAINED_STEP;
}
/** 次の復習まで何日か（「次は3日後」の表示用） */
export function daysUntilDue(stat: WordStat | undefined, now = Date.now()): number {
  return Math.max(0, Math.round((dueTime(stat) - startOfDay(now)) / DAY));
}
/** 最後に見てから何日か（カードの「3日ぶり」の表示用。記録がなければ null） */
export function daysSinceSeen(stat: WordStat | undefined, now = Date.now()): number | null {
  return stat ? Math.max(0, Math.floor((startOfDay(now) - startOfDay(stat.seen)) / DAY)) : null;
}
/** 初めて記録が付いた時刻を残す。古い記録（first なし）を更新するときは付けない（新しい単語に数えないため） */
function withFirst(stat: WordStat, prev: WordStat | undefined, now: number): WordStat {
  const first = prev ? prev.first : now;
  return first === undefined ? stat : { ...stat, first };
}
export type MarkOptions = {
  /** 答えを見ずに「覚えた」とした（すでに知っている語） */
  confident?: boolean;
};
/**
 * 「覚えた」(true) /「まだ」(false) を記録する。
 * 覚えた:
 *   - 復習の時期が来ていた、または初めて答えた → 段階を1つ上げる。長く放っても思い出せた語は、経過した日数に見合う段まで一気に上げる
 *   - 時期の前に見ただけ（レベル別の復習など） → 段階は据え置き（同じ日に何度見ても間隔が延びすぎないように）
 *   - 初見で答えを見ずに覚えた → 段階 3（7日後）から。知っている語に毎日つき合わされないため
 * まだ:
 *   - 苦手度 +1。段階は2つ下げる（全部は戻さない。一度覚えた語の記憶は残っている）。すぐ出す
 */
export function mark(
  progress: Progress,
  id: number,
  mastered: boolean,
  now = Date.now(),
  options: MarkOptions = {},
): Progress {
  const prev = progress.stats?.[id];
  const wasMastered = progress.mastered.includes(id);
  const prevStep = prev?.step ?? (wasMastered ? CONFIDENT_STEP : 0);
  let step: number;
  let due: number;
  let miss: number;
  if (mastered) {
    miss = 0;
    if (wasMastered && dueTime(prev, true) > now) {
      step = prevStep;
      due = dueTime(prev, true);
    } else if (!prev && options.confident) {
      step = CONFIDENT_STEP;
      due = nextDue(step, now);
    } else {
      const elapsed = prev ? Math.max(0, now - prev.seen) : 0;
      step = Math.min(MAX_STEP, Math.max(prevStep, stepForElapsed(elapsed)) + 1);
      due = nextDue(step, now);
    }
  } else {
    miss = missCount(progress, id) + 1;
    step = Math.max(0, prevStep - 2);
    due = now;
  }
  return {
    mastered: [
      ...progress.mastered.filter((n) => n !== id),
      ...(mastered ? [id] : []),
    ],
    notYet: [
      ...progress.notYet.filter((n) => n !== id),
      ...(!mastered ? [id] : []),
    ],
    stats: { ...progress.stats, [id]: withFirst({ miss, seen: now, step, due }, prev, now) },
  };
}
/**
 * 「見た」だけを記録する（答えを見たあと、判定せずに次へ進んだとき）。
 * 今日の学習数に数え、同じ日にもう一度出ないようにする。覚えた／まだと苦手度、復習の時期は変えない。
 * 覚えた単語（復習として出た語）は記録しない：判定なしで次の復習を先送りしないため
 */
export function touch(progress: Progress, id: number, now = Date.now()): Progress {
  if (progress.mastered.includes(id)) return progress;
  const prev = progress.stats?.[id];
  return {
    ...progress,
    stats: {
      ...progress.stats,
      [id]: withFirst({ miss: prev?.miss ?? 0, step: prev?.step ?? 0, due: prev ? dueTime(prev, false) : now, seen: now }, prev, now),
    },
  };
}
/** 最後に学習した時刻（記録がなければ null） */
export function lastStudiedAt(progress: Progress): number | null {
  const times = Object.values(progress.stats ?? {}).map((s) => s.seen);
  return times.length ? Math.max(...times) : null;
}
/** 単語の記録を消す（自分で登録した単語を削除したとき） */
export function forgetWord(progress: Progress, id: number): Progress {
  const stats = { ...progress.stats };
  delete stats[id];
  return {
    mastered: progress.mastered.filter((n) => n !== id),
    notYet: progress.notYet.filter((n) => n !== id),
    stats,
  };
}
/**
 * クイズで正解したとき。覚えた／まだ は変えず、苦手度を1下げる。
 * 復習の時期が来ていた単語は段階を1つ上げる（4択は思い出すより易しいので、経過日数のボーナスは付けない）
 */
export function markQuizCorrect(
  progress: Progress,
  id: number,
  now = Date.now(),
): Progress {
  const prev = progress.stats?.[id];
  const miss = Math.max(0, missCount(progress, id) - 1);
  let step = prev?.step ?? 0;
  let due = prev ? dueTime(prev, progress.mastered.includes(id)) : now;
  if (!prev) {
    step = 1;
    due = nextDue(step, now);
  } else if (due <= now) {
    step = Math.min(MAX_STEP, step + 1);
    due = nextDue(step, now);
  }
  return { ...progress, stats: { ...progress.stats, [id]: withFirst({ miss, seen: now, step, due }, prev, now) } };
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
 * 苦手な単語 > 復習の時期が来た覚えた単語（段階が低い・遅れているほど先）> 新しい単語 > まだ時期でない覚えた単語 の順。
 * 同じ種類の中では、苦手度が高いほど・最後に見てから日が経つほど先に出す。
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
  if (mastered.has(word.No)) {
    const due = dueTime(stat, true);
    // 時期が来た復習は新しい単語より先。段階が低い（記憶が不安定な）ものと遅れたものを先に（最大 +60）
    if (due <= now)
      base = 120 + Math.min(((now - due) / DAY) * 4, 40) + Math.max(0, 20 - 4 * (stat?.step ?? 0));
    else base = forgetting;
  } else if (isWeak(progress, word.No))
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
/** 目標スコア以下の全レベル（マイ単語帳を含む）から、苦手な単語を優先度順に */
export function weakWordsAcross(
  words: Word[],
  progress: Progress,
  target: number,
  now = Date.now(),
  random = Math.random,
): Word[] {
  return orderByPriority(
    words.filter((w) => w.score_band <= target && isWeak(progress, w.No)),
    progress,
    now,
    random,
  );
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
/** 訳を語義ごとに分ける（「顧客、取引先」→ ["顧客", "取引先"]） */
export function meaningParts(meaning: string): string[] {
  return meaning
    .split(/[、,，／/・;；]/)
    .map((s) => s.replace(/（.*?）|\(.*?\)/g, "").trim())
    .filter(Boolean);
}
/** 語義が1つでも重なるか（customer「顧客」と client「顧客、取引先」など。4択で正解が2つに見えるのを防ぐ） */
export function meaningsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = meaningParts(a);
  const pb = new Set(meaningParts(b));
  return pa.some((p) => pb.has(p));
}
export function makeQuiz(
  words: Word[],
  band: number,
  progress: Progress,
  count = 10,
  now = Date.now(),
): Question[] {
  const pool = words.filter((w) => w.score_band === band);
  return quizFrom(shuffle(orderByPriority(pool, progress, now).slice(0, count)), pool, words);
}
/**
 * 与えた単語で4択を作る。選択肢は同じレベルから。単語が少ない（マイ単語帳など）ときは全ての単語から選ぶ。
 * 語義の重なる単語は選択肢にしない
 */
export function quizFrom(targets: Word[], pool: Word[], allWords: Word[]): Question[] {
  const choicePool = new Set(pool.map((w) => w.meaning)).size >= 8 ? pool : allWords;
  return targets.flatMap((word) => {
    const wrong = shuffle([
      ...new Set(
        choicePool.filter((w) => !meaningsOverlap(w.meaning, word.meaning)).map((w) => w.meaning),
      ),
    ]).slice(0, 3);
    if (wrong.length < 3) return [];
    const choices = shuffle([...wrong, word.meaning]);
    return [{ word, choices, correctIndex: choices.indexOf(word.meaning) }];
  });
}

// ---- 今日の学習 ----
export const BANDS = [500, 600, 700, 800, 900];
/** 1日の目標語数 */
export const DAILY_GOAL = 20;
/** 1日に出す新しい単語の下限と上限。多すぎると数日後の復習があふれる */
export const NEW_WORDS_MIN = 4;
export const NEW_WORDS_MAX = 10;
/** 復習がこれより溜まっていたら、新しい単語を止めて復習に専念する（しばらくぶりの復帰） */
export const CATCH_UP_DUE = 60;
/** これ以上あいだが空いたら、「おさらい」から始める */
export const CATCH_UP_AFTER_DAYS = 7;
/** 今日学習した単語の数（今日「まだ」「覚えた」を記録した単語、今日クイズに答えた単語、答えを見た単語） */
/** 答えを見ただけで、一度も判定していない語（今日の学習数・新しい単語の数には入れない） */
function viewedOnly(progress: Progress, id: number, s: WordStat): boolean {
  return !progress.mastered.includes(id) && !progress.notYet.includes(id) && s.miss === 0 && (s.step ?? 0) === 0;
}
/** 今日判定した語の数（覚えた・まだ・クイズ。見ただけの語は数えない） */
export function studiedToday(progress: Progress, now = Date.now()): number {
  const start = startOfDay(now);
  return Object.entries(progress.stats ?? {}).filter(([id, s]) => s.seen >= start && !viewedOnly(progress, Number(id), s)).length;
}
/** 今日初めて記録が付いた新しい単語の数（復習に失敗した語や、見ただけの語は数えない） */
export function newWordsToday(progress: Progress, now = Date.now()): number {
  const start = startOfDay(now);
  return Object.entries(progress.stats ?? {}).filter(
    ([id, s]) => s.first !== undefined && s.first >= start && !viewedOnly(progress, Number(id), s),
  ).length;
}
/** 復習の時期が来ている単語の数（目標スコア以下のレベル） */
export function dueCount(words: Word[], progress: Progress, target: number, now = Date.now()): number {
  return words.filter((w) => w.score_band <= target && isDue(progress, w.No, now)).length;
}
/** 定着した単語の数（覚えて、何度かの復習を通った） */
export function retainedCount(progress: Progress): number {
  return progress.mastered.filter((id) => isRetained(progress, id)).length;
}
export type TodayPlan = {
  words: Word[];
  /** 復習のうち「まだ」だった単語 */
  weak: number;
  /** 復習（時期が来た単語）の数 */
  review: number;
  /** 新しい単語の数 */
  fresh: number;
  /** 時期が来ている復習のうち、今日の分に入りきらなかった数 */
  dueLeft: number;
};
export type PlanOptions = {
  /** しばらくぶりの「おさらい」: 新しい単語は出さず、復習だけにする */
  catchUp?: boolean;
  /** 目標達成後の「さらに10語」: 1日の新しい単語の上限を超えて出してよい */
  more?: boolean;
};
/**
 * 今日の学習で出す単語を選ぶ。目標スコア以下のレベル（マイ単語帳を含む）から、
 * 1. 復習の時期が来た単語（段階が低い＝記憶が不安定なものから。最大 size − 新しい単語の下限）
 * 2. 新しい単語（マイ単語帳 → 低いレベルの順。1日 NEW_WORDS_MAX 語まで。復習が溜まりすぎているときは出さない）
 * 3. 足りなければ、2日以内に時期が来る単語を前倒し
 * 今日すでに答えた単語は出さない。
 */
export function todayPlan(
  words: Word[],
  progress: Progress,
  target: number,
  size = DAILY_GOAL,
  now = Date.now(),
  random = Math.random,
  options: PlanOptions = {},
): TodayPlan {
  const today = startOfDay(now);
  const stats = progress.stats ?? {};
  const mastered = new Set(progress.mastered);
  const notYet = new Set(progress.notYet);
  const seenToday = (w: Word) => (stats[w.No]?.seen ?? -1) >= today;
  const eligible = words.filter((w) => w.score_band <= target);
  const fresh = eligible.filter((w) => !seenToday(w));
  const hasRecord = (w: Word) => mastered.has(w.No) || notYet.has(w.No) || !!stats[w.No];
  const stepOf = (w: Word) => stats[w.No]?.step ?? (mastered.has(w.No) ? CONFIDENT_STEP : 0);
  const dueOf = (w: Word) => dueTime(stats[w.No], mastered.has(w.No));
  // 1. 復習: 段階が低い順 → 時期が早い順（同じなら少し乱数）
  const dueAll = fresh
    .filter((w) => hasRecord(w) && dueOf(w) <= now)
    .map((w) => ({ w, key: [stepOf(w), dueOf(w), random()] as const }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2])
    .map(({ w }) => w);
  const catchUp = options.catchUp || dueAll.length > CATCH_UP_DUE;
  const newCap = catchUp ? 0 : options.more ? size : Math.max(0, NEW_WORDS_MAX - newWordsToday(progress, now));
  const reviewCap = Math.max(0, size - Math.min(NEW_WORDS_MIN, newCap));
  const review = dueAll.slice(0, reviewCap);
  const chosen = new Set(review.map((w) => w.No));
  // 2. 新しい単語は低いレベルから（同じレベルの中はばらばら）。マイ単語帳（0）は最初
  const bandsInPlan = [...new Set(eligible.map((w) => w.score_band))].sort((a, b) => a - b);
  const newWords = bandsInPlan
    .flatMap((b) => shuffle(fresh.filter((w) => w.score_band === b && !hasRecord(w)), random))
    .slice(0, Math.min(newCap, Math.max(0, size - chosen.size)));
  newWords.forEach((w) => chosen.add(w.No));
  // 3. 足りなければ、2日以内に時期が来る単語を前倒し（新しい単語の上限は守る）
  const soon =
    chosen.size < size
      ? fresh
          .filter((w) => hasRecord(w) && !chosen.has(w.No) && dueOf(w) <= now + 2 * DAY)
          .sort((a, b) => dueOf(a) - dueOf(b))
          .slice(0, size - chosen.size)
      : [];
  return {
    // 復習（まだ → 覚えた の順になる）→ 新しい単語 → 前倒し
    words: [...review, ...newWords, ...soon],
    weak: review.filter((w) => notYet.has(w.No)).length,
    review: review.length,
    fresh: newWords.length,
    dueLeft: dueAll.length - review.length,
  };
}
