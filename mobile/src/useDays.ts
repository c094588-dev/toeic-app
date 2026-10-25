import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { bumpDay, dayKey, parseDailyGoal, parseDayLog, type DailyGoal, type DayLog } from "./days";
const KEY = "toeic.days.v1";
const GOAL_KEY = "toeic.goal.v1";
/** 日ごとの学習語数と、その日の目標語数を端末に持つ（この7日の点、しばらくぶりの判定、目標の固定に使う） */
export function useDays() {
  const [log, setLog] = useState<DayLog>({});
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [ready, setReady] = useState(false);
  const current = useRef(log);
  const loaded = useRef(false);
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(GOAL_KEY)])
      .then(([raw, rawGoal]) => {
        // 読み込み前に学習した分があれば、読み込んだものに足す
        const stored = parseDayLog(raw);
        const today = dayKey();
        const pending = current.current[today] ?? 0;
        current.current = pending ? { ...stored, [today]: (stored[today] ?? 0) + pending } : stored;
        setLog(current.current);
        const g = parseDailyGoal(rawGoal);
        if (g !== null) setGoal({ day: today, goal: g });
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);
  const write = useCallback((next: DayLog) => {
    current.current = next;
    setLog(next);
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  /** その日に初めて今日の学習を組んだときに呼ぶ。null で取り消す（目標スコアを変えたとき） */
  const setGoalToday = useCallback((n: number | null) => {
    if (n === null) {
      setGoal(null);
      AsyncStorage.removeItem(GOAL_KEY).catch(() => {});
      return;
    }
    const next = { day: dayKey(), goal: n };
    setGoal(next);
    AsyncStorage.setItem(GOAL_KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  /** 1語判定したら呼ぶ */
  const bump = useCallback(() => write(bumpDay(current.current)), [write]);
  /** 判定を取り消したら呼ぶ */
  const unbump = useCallback(() => {
    const key = dayKey();
    const n = (current.current[key] ?? 0) - 1;
    const next = { ...current.current };
    if (n > 0) next[key] = n;
    else delete next[key];
    write(next);
  }, [write]);
  const today = dayKey();
  return {
    log,
    ready,
    /** 今日の目標語数（まだ決めていなければ null） */
    goalToday: goal && goal.day === today ? goal.goal : null,
    setGoalToday,
    bump,
    unbump,
  };
}
