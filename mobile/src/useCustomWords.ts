import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Word } from "./learning";
import {
  emptyCustomWords,
  makeCustomWord,
  parseCustomWords,
  serializeCustomWords,
  type CustomWordInput,
  type CustomWordStore,
} from "./customWords";
const KEY = "toeic.customWords.v1";
// 読み込めなかった保存データの退避先（上書きで失わないように残す）
const BACKUP_KEY = "toeic.customWords.v1.corrupt";
/** 自分で登録した単語を、端末に保存して読み書きする */
export function useCustomWords(bands: readonly number[]) {
  const [store, setStore] = useState<CustomWordStore>(emptyCustomWords);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(store);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(async (raw) => {
        let loaded: CustomWordStore;
        try {
          loaded = parseCustomWords(raw, bands);
        } catch {
          // 壊れたデータで止まらないよう、退避してから空で始める
          if (raw !== null) await AsyncStorage.setItem(BACKUP_KEY, raw).catch(() => {});
          setError("登録した単語を読み込めませんでした。");
          loaded = emptyCustomWords();
        }
        current.current = loaded;
        setStore(loaded);
        setReady(true);
      })
      .catch(() => setError("登録した単語を読み込めませんでした。"));
  }, []);
  function update(next: CustomWordStore) {
    current.current = next;
    setStore(next);
    writes.current = writes.current.then(async () => {
      try {
        await AsyncStorage.setItem(KEY, serializeCustomWords(next));
        setError("");
      } catch {
        setError("登録した単語を保存できませんでした。もう一度お試しください。");
      }
    });
  }
  /** 単語を登録し、登録した単語を返す */
  function add(input: CustomWordInput): Word {
    const word = makeCustomWord(input, current.current.nextId);
    update({ words: [...current.current.words, word], nextId: word.No + 1 });
    return word;
  }
  function edit(id: number, input: CustomWordInput) {
    update({
      ...current.current,
      words: current.current.words.map((w) => (w.No === id ? makeCustomWord(input, id) : w)),
    });
  }
  function remove(id: number) {
    update({ ...current.current, words: current.current.words.filter((w) => w.No !== id) });
  }
  return { customWords: store.words, ready, error, add, edit, remove };
}
