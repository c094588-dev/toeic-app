/**
 * 有料プラン（将来）の土台。いまは課金を始めないので、フラグは false のまま。
 *
 * 方針:
 * - 既存の機能（1,500語、今日の学習、クイズ、マイ単語帳、耳だけ復習）は無料のまま。
 * - 有料にするのは、あとから足す「払い続ける理由のある価値」だけ（docs/MONETIZATION_PLAN.md）。
 * - 課金の仕組み（RevenueCat か StoreKit 2）を入れるときは、この層の中だけを差し替える。
 */
export const PREMIUM_ENABLED = false;

/** 有料で提供する候補の機能。いまはどれも無料で、ここに並べるだけ */
export type PremiumFeature = "wordPacks" | "backup" | "insights";

export type Entitlement = {
  premium: boolean;
  /** none: 未購入 / store: ストアで購入 / dev: 開発中の確認用 */
  source: "none" | "store" | "dev";
  /** 有料プランが使える状態か（課金の仕組みが入り、フラグが有効のとき） */
  available: boolean;
};
export const noEntitlement = (): Entitlement => ({ premium: false, source: "none", available: false });

/** この機能を使えるか。課金が始まるまでは、全部使える */
export function canUse(feature: PremiumFeature, entitlement: Entitlement): boolean {
  if (!PREMIUM_ENABLED) return true;
  void feature;
  return entitlement.premium;
}
