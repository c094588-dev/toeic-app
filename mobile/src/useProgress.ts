import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  emptyProgress,
  mark,
  markQuizCorrect,
  forgetWord,
  restoreProgress,
  touch,
  type IdCheck,
  type MarkOptions,
  type Progress,
} from "./learning";
const KEY = "toeic.progress.v1";
// 読み込めなかった保存データの退避先（上書きで失わないように残す）
const BACKUP_KEY = "toeic.progress.v1.corrupt";
export function useProgress(validIds: IdCheck) {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const current = useRef(progress);
  const writes = useRef(Promise.resolve());
  const load = useCallback(async () => {
    setError("");
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(KEY);
    } catch {
      // 端末の読み込みエラーは一時的な可能性があるので再試行できるようにする
      setError("進捗を読み込めませんでした。再読み込みをお試しください。");
      return;
    }
    const { progress: loaded, corrupt } = restoreProgress(raw, validIds);
    if (corrupt && raw !== null) {
      // 同じ壊れたデータで止まり続けないよう、退避してから空の進捗で始める
      await AsyncStorage.setItem(BACKUP_KEY, raw).catch(() => {});
      setNotice(
        "保存されていた進捗が壊れていたため、最初から始めます。",
      );
    }
    current.current = loaded;
    setProgress(loaded);
    setReady(true);
  }, [validIds]);
  useEffect(() => {
    void load();
  }, [load]);
  function save(value: Progress) {
    writes.current = writes.current.then(async () => {
      try {
        // step/due を足しても形は version 2 のまま（古いアプリでも読めるよう、番号は上げない）
        await AsyncStorage.setItem(
          KEY,
          JSON.stringify({ version: 2, ...value }),
        );
        setError("");
      } catch {
        setError(
          "進捗を保存できませんでした。アプリを閉じる前に再試行してください。",
        );
      }
    });
  }
  function update(next: Progress) {
    current.current = next;
    setProgress(next);
    save(next);
  }
  function record(id: number, mastered: boolean, options: MarkOptions = {}) {
    if (!ready) return;
    update(mark(current.current, id, mastered, Date.now(), options));
  }
  /** 答えを見ただけで判定せずに次へ進んだとき（今日の学習数に数える） */
  function touchWord(id: number) {
    if (!ready) return;
    update(touch(current.current, id));
  }
  /** 直前の判定を取り消すときに、判定前の進捗へ戻す */
  function restore(value: Progress) {
    if (!ready) return;
    update(value);
  }
  /** 単語の記録を消す（自分で登録した単語を削除したとき） */
  function forget(id: number) {
    if (!ready) return;
    update(forgetWord(current.current, id));
  }
  /** クイズで正解したとき（苦手度を下げる） */
  function recordQuizCorrect(id: number) {
    if (!ready) return;
    update(markQuizCorrect(current.current, id));
  }
  return {
    progress,
    ready,
    error,
    notice,
    dismissNotice: () => setNotice(""),
    record,
    touchWord,
    restore,
    recordQuizCorrect,
    forget,
    retry: () => (ready ? save(current.current) : void load()),
  };
}
