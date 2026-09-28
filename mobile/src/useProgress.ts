import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyProgress, mark, parseProgress, type Progress } from "./learning";
const KEY = "toeic.progress.v1";
export function useProgress(validIds: Set<number>) {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(progress);
  const writes = useRef(Promise.resolve());
  async function load() {
    setError("");
    try {
      const loaded = parseProgress(await AsyncStorage.getItem(KEY), validIds);
      current.current = loaded;
      setProgress(loaded);
      setReady(true);
    } catch {
      setError("進捗を読み込めませんでした。再読み込みをお試しください。");
    }
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
    record,
    retry: () => (ready ? save(current.current) : void load()),
  };
}
