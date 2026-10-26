/**
 * 日ごとの学習語数（直近60日）。
 * 単語の記録（seen）は上書きされて過去の日が消えるので、「この7日で何日学習したか」を出すために別に持つ。
 * 連続日数（ストリーク）は採らない：切れた日の罪悪感で離脱しやすいため、7日の点で「責めずに」見せる。
 */
export type DayLog = Record<string, number>;
export const KEEP_DAYS = 60;
const DAY = 24 * 60 * 60 * 1000;

/** 端末のローカル日付で "YYYY-MM-DD" */
export function dayKey(now = Date.now()): string {
  const d = new Date(now);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parseDayLog(raw: string | null): DayLog {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return {};
    const log: DayLog = {};
    for (const [k, v] of Object.entries(data))
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isInteger(v) && (v as number) > 0) log[k] = v as number;
    return log;
  } catch {
    return {};
  }
}

/** 1語学習したら呼ぶ。古い日は捨てる */
export function bumpDay(log: DayLog, now = Date.now()): DayLog {
  const key = dayKey(now);
  const next: DayLog = { [key]: (log[key] ?? 0) + 1 };
  for (const [k, v] of Object.entries(log)) if (k !== key && now - new Date(`${k}T00:00:00`).getTime() < KEEP_DAYS * DAY) next[k] = v;
  return next;
}

/** 今日を右端にした直近7日。学習した日は true */
export function lastSevenDays(log: DayLog, now = Date.now()): boolean[] {
  return Array.from({ length: 7 }, (_, i) => (log[dayKey(now - (6 - i) * DAY)] ?? 0) > 0);
}

/** 最後に学習した日から何日たったか（記録がなければ null） */
export function daysSinceLastStudy(log: DayLog, now = Date.now()): number | null {
  const keys = Object.keys(log).sort();
  if (keys.length === 0) return null;
  const last = new Date(`${keys[keys.length - 1]}T00:00:00`).getTime();
  return Math.max(0, Math.floor((new Date(`${dayKey(now)}T00:00:00`).getTime() - last) / DAY));
}

/**
 * その日の目標語数。その日に初めて「今日の学習」を組んだときの語数（20語まで）を、その日のあいだ固定する。
 * 答えを見ずに「覚えた」にした語は新しい単語の枠を使わないので、固定しないと目標が途中で増えて見える。
 */
export type DailyGoal = { day: string; goal: number };
export function parseDailyGoal(raw: string | null, now = Date.now()): number | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.day !== dayKey(now)) return null;
    return Number.isInteger(data.goal) && data.goal >= 1 && data.goal <= 200 ? data.goal : null;
  } catch {
    return null;
  }
}

/** 決めてある目標語数のうち、その日のものだけを返す（日付が違えば、まだ決めていない＝ null） */
export function goalFor(goal: DailyGoal | null, day: string): number | null {
  return goal && goal.day === day ? goal.goal : null;
}
