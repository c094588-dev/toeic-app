import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { dayKey } from "./days";

/** 開いている間に日付が変わっていないか確かめる間隔 */
const CHECK_MS = 60_000;

/**
 * 今日の日付（"YYYY-MM-DD"）。アプリを開いたまま日付が変わったときにも新しい日付になる。
 * 今日の学習語数・今日の予定・今日の目標はこの日付ごとに組み直す。
 * そうしないと、夜のあいだ裏に残っていたアプリを朝に開いたとき、前の日の値が新しい日の目標として保存されてしまう。
 * 確かめるきっかけ: アプリが前面に戻ったとき（夜のあいだ裏に残っていた場合）と、開いている間は1分ごと（0時をまたいだ場合）。
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    // 同じ日なら前の値を返し、描き直さない
    const check = () => setToday((prev) => {
      const now = dayKey();
      return now === prev ? prev : now;
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    const timer = setInterval(check, CHECK_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return today;
}
