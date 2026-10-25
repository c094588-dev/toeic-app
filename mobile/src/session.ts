import type { StudyMode, Word } from "./learning";

/** 学習の途中位置。中断してもここから再開できるように端末に保存する */
export type StudySession = {
  /** "today" は今日の学習、それ以外はレベル別の各モード */
  mode: StudyMode | "today";
  /** レベル（今日の学習では使わないが、戻り先のために持つ） */
  band: number;
  /** 出題する単語の番号（順番どおり） */
  ids: number[];
  /** 次に出す位置（0 から） */
  index: number;
  reverse: boolean;
  /** このセッションでの判定の数 */
  tally: { learned: number; notYet: number; skipped: number };
  startedAt: number;
  updatedAt: number;
};
const DAY = 24 * 60 * 60 * 1000;
/** 途中位置は同じ日のうちだけ再開する（日付が変わったら、その日の苦手・復習で組み直すほうがよい） */
function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
const MODES = new Set(["today", "weak", "unmastered", "all"]);

export function serializeSession(session: StudySession): string {
  return JSON.stringify({ version: 1, ...session });
}

/**
 * 保存した途中位置を読み込む。壊れている・古い・単語が見つからない・残りがない場合は null。
 * 消えた単語（削除したマイ単語帳の単語など）は飛ばす。
 */
export function parseSession(
  raw: string | null,
  wordsById: Map<number, Word>,
  now = Date.now(),
): StudySession | null {
  if (!raw) return null;
  let data: Partial<StudySession> & { version?: number };
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !data ||
    data.version !== 1 ||
    typeof data.mode !== "string" ||
    !MODES.has(data.mode) ||
    typeof data.band !== "number" ||
    !Array.isArray(data.ids) ||
    !Number.isInteger(data.index) ||
    typeof data.updatedAt !== "number"
  )
    return null;
  if (!sameLocalDay(data.updatedAt, now) || data.updatedAt > now + DAY) return null;
  const index = data.index as number;
  const ids = (data.ids as unknown[]).filter((id): id is number => typeof id === "number");
  // 残りの単語のうち、いまも存在するものだけを使う
  const rest = ids.slice(index).filter((id) => wordsById.has(id));
  if (rest.length === 0) return null;
  const done = ids.slice(0, index);
  return {
    mode: data.mode as StudySession["mode"],
    band: data.band,
    ids: [...done, ...rest],
    index: done.length,
    reverse: data.reverse === true,
    tally: {
      learned: Number.isInteger(data.tally?.learned) ? (data.tally!.learned as number) : 0,
      notYet: Number.isInteger(data.tally?.notYet) ? (data.tally!.notYet as number) : 0,
      skipped: Number.isInteger(data.tally?.skipped) ? (data.tally!.skipped as number) : 0,
    },
    startedAt: typeof data.startedAt === "number" ? data.startedAt : data.updatedAt,
    updatedAt: data.updatedAt,
  };
}

/** 残りの語数 */
export function sessionRemaining(session: StudySession): number {
  return Math.max(0, session.ids.length - session.index);
}
