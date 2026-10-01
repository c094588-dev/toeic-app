import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyProgress, mark, restoreProgress, type Progress } from "./learning";
const KEY = "toeic.progress.v1";
// 読み込めなかった保存データの退避先（上書きで失わないように残す）
const BACKUP_KEY = "toeic.progress.v1.corrupt";
export function useProgress(validIds: Set<number>) {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const current = useRef(progress);
  const writes = useRef(Promise.resolve());
  async function load() {
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
  }
  useEffect(() => {
    void load();
  }, []);
  function save(value: Progress) {
    writes.current = writes.current.then(async () => {
      try {
        await AsyncStorage.setItem(
          KEY,
          JSON.stringify({ version: 1, ...value }),
        );
        setError("");
      } catch {
        setError(
          "進捗を保存できませんでした。アプリを閉じる前に再試行してください。",
        );
      }
    });
  }
  function record(id: number, mastered: boolean) {
    if (!ready) return;
    const next = mark(current.current, id, mastered);
    current.current = next;
    setProgress(next);
    save(next);
  }
  return {
    progress,
    ready,
    error,
    notice,
    dismissNotice: () => setNotice(""),
    record,
    retry: () => (ready ? save(current.current) : void load()),
  };
}
