import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Word } from "./learning";
import { parseSession, serializeSession, type StudySession } from "./session";
const KEY = "toeic.session.v1";
/**
 * 学習の途中位置を端末に保存し、起動時に読み戻す。
 * 保存は1カードごと。終わったら消す。
 * 読み戻しは、収録単語と登録単語の両方がそろってから（`wordsReady`）行う。
 */
export function useSession(wordsById: Map<number, Word>, wordsReady: boolean) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [ready, setReady] = useState(false);
  const writes = useRef(Promise.resolve());
  const loaded = useRef(false);
  useEffect(() => {
    if (!wordsReady || loaded.current) return;
    loaded.current = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => setSession(parseSession(raw, wordsById)))
      .catch(() => setSession(null))
      .finally(() => setReady(true));
  }, [wordsReady, wordsById]);
  function write(next: StudySession | null) {
    setSession(next);
    writes.current = writes.current.then(() =>
      (next ? AsyncStorage.setItem(KEY, serializeSession(next)) : AsyncStorage.removeItem(KEY)).catch(
        () => {},
      ),
    );
  }
  return {
    session,
    ready,
    /** 学習を始めた・1カード進んだときに呼ぶ */
    save: (next: Omit<StudySession, "updatedAt">) => write({ ...next, updatedAt: Date.now() }),
    /** 学習を終えた・やり直すときに呼ぶ */
    clear: () => write(null),
  };
}
