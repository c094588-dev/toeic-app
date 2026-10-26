import React from "react";
import { Linking, View } from "react-native";
import { space, type Theme } from "../theme";
import { Button, Card, Row, Txt } from "../ui";
import { Frame } from "../components/Frame";
import { PRIVACY_URL, SUPPORT_URL } from "./SettingsScreen";

/** ストアから取得した商品（価格の文字列はストアのローカライズ済みのものをそのまま使う） */
export type PlusProduct = {
  id: string;
  /** 例: 月額プラン */
  title: string;
  /** 例: ¥480 */
  price: string;
  /** 例: 1か月ごと / 1年ごと / 買い切り */
  period: string;
  /** 無料体験の説明（あるときだけ） */
  trial?: string;
};

export type PlusProps = {
  theme: Theme;
  products: PlusProduct[];
  onPurchase: (id: string) => void;
  onRestore: () => void;
  onBack: () => void;
};

/**
 * 有料プラン（英単語ノート プラス）の案内画面の雛形。
 * いまは課金を始めないので、この画面はフラグ（premium.ts の PREMIUM_ENABLED）が有効なときしか開けない。
 * 審査（App Review 3.1.1 / 3.1.2）で求められる表示をここにまとめておく:
 * 価格と期間、何が手に入るか、無料体験の条件、自動更新と解約の方法、購入の復元、プライバシーポリシーと利用規約。
 */
export function PlusScreen(p: PlusProps) {
  const { theme } = p;
  const { c } = theme;
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <Frame theme={theme} title="英単語ノート プラス" onBack={p.onBack}>
      <Card theme={theme}>
        <Txt theme={theme} kind="heading" accessibilityRole="header">
          無料でできることは、これからも無料のまま
        </Txt>
        <Txt theme={theme} kind="callout" color={c.muted}>
          1,500語・今日の学習・4択クイズ・マイ単語帳・耳だけ復習は、ずっと無料で使えます。プラスは、あとから足す便利な機能のためのものです。
        </Txt>
      </Card>
      <Card theme={theme} style={{ gap: space.sm }}>
        <Txt theme={theme} kind="heading" accessibilityRole="header">
          プラスでできること
        </Txt>
        {["機種変更しても学習の記録を引き継ぐ（iCloud バックアップ）", "学習の記録をくわしく見る（週ごと・レベルごとの定着）", "単語ごとのメモ（派生語・言い換え）を毎月追加"].map((t) => (
          <Txt key={t} theme={theme} kind="body">
            {`・${t}`}
          </Txt>
        ))}
      </Card>
      {p.products.length === 0 ? (
        <Txt theme={theme} kind="callout" color={c.muted}>
          プランは準備中です。
        </Txt>
      ) : (
        <Card theme={theme} style={{ paddingVertical: space.xs, gap: 0 }}>
          {p.products.map((prod, i) => (
            <Row
              key={prod.id}
              theme={theme}
              title={`${prod.title}　${prod.price}`}
              detail={[prod.period, prod.trial].filter(Boolean).join("・")}
              onPress={() => p.onPurchase(prod.id)}
              accessibilityLabel={`${prod.title}、${prod.price}、${prod.period}${prod.trial ? `、${prod.trial}` : ""}`}
              first={i === 0}
            />
          ))}
        </Card>
      )}
      <View style={{ gap: space.xs }}>
        <Txt theme={theme} kind="caption" color={c.muted}>
          サブスクリプションは、期間が終わる24時間前までに解約しない限り、同じ価格で自動的に更新されます。購入後は iPhone の「設定 › Apple アカウント › サブスクリプション」からいつでも解約できます。無料体験がある場合、体験中に解約すれば料金はかかりません。
        </Txt>
        <Txt theme={theme} kind="caption" color={c.muted}>
          買い切りは1回のお支払いで、同じ Apple アカウントの端末で使えます。
        </Txt>
      </View>
      <Button theme={theme} kind="tertiary" label="購入を復元する" onPress={p.onRestore} />
      <Card theme={theme} style={{ paddingVertical: space.xs, gap: 0 }}>
        <Row theme={theme} title="プライバシーポリシー" onPress={() => open(PRIVACY_URL)} first />
        <Row theme={theme} title="利用規約（Apple 標準）" onPress={() => open("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} />
        <Row theme={theme} title="サポート" onPress={() => open(SUPPORT_URL)} />
      </Card>
    </Frame>
  );
}
