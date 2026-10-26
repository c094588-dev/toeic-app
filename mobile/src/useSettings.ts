import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BANDS } from "./learning";
const KEY = "toeic.settings.v1";
export type Settings = {
  /** 単語が表示されたら自動で発音する（イヤホン利用を想定して既定はオン） */
  autoSpeak: boolean;
  /** 目標スコア（500〜900）。未設定なら null */
  target: number | null;
  /** 日本語の意味から英単語を思い出す（逆向きカード） */
  reverse: boolean;
  /** 学習画面の操作のヒントを見せた回数（慣れたら消す） */
  hintsSeen: number;
};
export const defaultSettings = (): Settings => ({ autoSpeak: true, target: null, reverse: false, hintsSeen: 0 });
/** 保存した設定を読む。知らない値や壊れた値は既定に戻す */
export function parseSettings(raw: string | null): Settings {
  const s = defaultSettings();
  if (!raw) return s;
  try {
    const data = JSON.parse(raw);
    if (typeof data?.autoSpeak === "boolean") s.autoSpeak = data.autoSpeak;
    if (BANDS.includes(data?.target)) s.target = data.target;
    if (typeof data?.reverse === "boolean") s.reverse = data.reverse;
    if (Number.isInteger(data?.hintsSeen) && data.hintsSeen >= 0) s.hintsSeen = data.hintsSeen;
  } catch {
    // 壊れていれば既定のまま
  }
  return s;
}
/** 設定を端末に保存して読み書きする。保存の失敗は黙って無視する（設定は毎回選び直せる） */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        current.current = parseSettings(raw);
        setSettings(current.current);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  function update(patch: Partial<Settings>) {
    current.current = { ...current.current, ...patch };
    setSettings(current.current);
    AsyncStorage.setItem(KEY, JSON.stringify(current.current)).catch(() => {});
  }
  return { settings, ready, update };
}
