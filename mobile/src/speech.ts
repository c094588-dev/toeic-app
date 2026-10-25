import * as Speech from "expo-speech";
import type { Utterance } from "./listen";

/** 英語の読み上げ。前の読み上げは止める */
export function speakEnglish(texts: string[]) {
  void Speech.stop();
  for (const t of texts.filter(Boolean))
    Speech.speak(t, { language: "en-US", rate: 0.88, onError: () => {} });
}
export function stopSpeech() {
  void Speech.stop();
}
/**
 * 1つ読み終わるまで待つ読み上げ（耳だけ復習用）。
 * 止められた・失敗したときも、待ち続けないように必ず解決する
 */
export function speakAsync(u: Utterance): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    // 音声が使えない環境でも止まらないよう、長さに応じた上限を置く
    const guard = setTimeout(finish, 4000 + u.text.length * 120);
    Speech.speak(u.text, {
      language: u.lang,
      rate: u.rate,
      onDone: () => {
        clearTimeout(guard);
        finish();
      },
      onStopped: () => {
        clearTimeout(guard);
        finish();
      },
      onError: () => {
        clearTimeout(guard);
        finish();
      },
    });
  });
}
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
