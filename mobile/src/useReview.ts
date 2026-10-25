import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { emptyReviewState, onGoalReached, parseReviewState, type ReviewState } from "./review";
const KEY = "toeic.review.v1";
/** 今日の目標を達成したときに、よいタイミングなら App Store のレビュー依頼を出す */
export function useReview() {
  const state = useRef<ReviewState>(emptyReviewState());
  const loaded = useRef(false);
  // 読み込みが終わる前に達成したぶんは、終わってから数える（空の状態で上書きしないため）
  const pending = useRef(0);
  const apply = useCallback(() => {
      const result = onGoalReached(state.current);
      state.current = result.state;
      AsyncStorage.setItem(KEY, JSON.stringify(result.state)).catch(() => {});
      if (!result.ask || Platform.OS === "web") return;
      // 達成の表示を見てもらってから頼む
      setTimeout(() => {
        StoreReview.hasAction()
          .then((ok) => (ok ? StoreReview.requestReview() : undefined))
          .catch(() => {});
      }, 1500);
  }, []);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        state.current = parseReviewState(raw);
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        while (pending.current > 0) {
          pending.current -= 1;
          apply();
        }
      });
  }, [apply]);
  const goalReached = useCallback(() => {
    if (!loaded.current) {
      pending.current += 1;
      return;
    }
    apply();
  }, [apply]);
  return { goalReached };
}
