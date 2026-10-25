/**
 * App Store のレビュー依頼を出すタイミング。
 * iOS は1年に3回までしか表示しないので、よいタイミング（目標達成の直後）に絞って頼む。
 */
export type ReviewState = { goals: number; asked: number[] };
export const emptyReviewState = (): ReviewState => ({ goals: 0, asked: [] });
const DAY = 24 * 60 * 60 * 1000;
/** 何回目の目標達成で初めて頼むか */
export const ASK_AFTER_GOALS = 3;
/** 一度頼んだら、次に頼むまで空ける日数 */
export const ASK_INTERVAL_DAYS = 120;
export const MAX_ASKS_PER_YEAR = 3;

export function parseReviewState(raw: string | null): ReviewState {
  if (!raw) return emptyReviewState();
  try {
    const data = JSON.parse(raw);
    const goals = Number.isInteger(data?.goals) && data.goals >= 0 ? data.goals : 0;
    const asked = Array.isArray(data?.asked)
      ? data.asked.filter((t: unknown) => typeof t === "number" && Number.isFinite(t))
      : [];
    return { goals, asked };
  } catch {
    return emptyReviewState();
  }
}

/** 今日の目標を達成したときに呼ぶ。依頼を出すべきなら ask: true */
export function onGoalReached(state: ReviewState, now = Date.now()): { state: ReviewState; ask: boolean } {
  const next = { ...state, goals: state.goals + 1 };
  const recent = next.asked.filter((t) => now - t < 365 * DAY);
  const last = Math.max(0, ...recent);
  const ask =
    next.goals >= ASK_AFTER_GOALS &&
    recent.length < MAX_ASKS_PER_YEAR &&
    (last === 0 || now - last >= ASK_INTERVAL_DAYS * DAY);
  return { state: ask ? { ...next, asked: [...recent, now] } : next, ask };
}
