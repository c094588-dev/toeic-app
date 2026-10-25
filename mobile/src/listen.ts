import type { Word } from "./learning";

/** 読み上げの1区切り */
export type Utterance = { text: string; lang: "en-US" | "ja-JP"; rate: number; pauseAfter: number };

/**
 * 耳だけ復習で1語につき読み上げる順番。
 * 英単語 →（思い出す間）→ 日本語の意味 → 英語の例文 → 次の単語へ。
 * 間を置くのは、答えを聞く前に自分で思い出す（想起）ため。
 */
export function listenScript(w: Word, options: { recallPause?: number } = {}): Utterance[] {
  const recallPause = options.recallPause ?? 1800;
  const script: Utterance[] = [
    { text: w.word, lang: "en-US", rate: 0.85, pauseAfter: recallPause },
    { text: w.meaning, lang: "ja-JP", rate: 1.0, pauseAfter: 500 },
  ];
  if (w.example) script.push({ text: w.example, lang: "en-US", rate: 0.9, pauseAfter: 900 });
  return script;
}

export type Speaker = (u: Utterance) => Promise<void>;
export type Sleeper = (ms: number) => Promise<void>;

/**
 * 単語の列を順に読み上げる。`control.stopped()` が true になったら途中でやめる。
 * `onWord` は各単語の読み上げを始める前に呼ぶ（画面の表示を合わせるため）。
 * 戻り値は読み終えた語数。
 */
export async function runListen(
  queue: Word[],
  speak: Speaker,
  sleep: Sleeper,
  control: { stopped: () => boolean; waitWhilePaused: () => Promise<void> },
  onWord: (index: number) => void,
  startAt = 0,
): Promise<number> {
  let done = startAt;
  for (let i = startAt; i < queue.length; i++) {
    if (control.stopped()) break;
    await control.waitWhilePaused();
    if (control.stopped()) break;
    onWord(i);
    for (const u of listenScript(queue[i])) {
      if (control.stopped()) return done;
      await control.waitWhilePaused();
      if (control.stopped()) return done;
      await speak(u);
      if (control.stopped()) return done;
      await sleep(u.pauseAfter);
    }
    done = i + 1;
  }
  return done;
}
