import { NET_LONG_KEY } from "@/components/ui";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import type { SendQuote } from "@/domain/wallet";
import { useT } from "@/i18n";
import type { Unit } from "@/state/settingsStore";
import { theme } from "@/theme";
import { chunkAddress, formatAmount, shorten } from "@/utils/format";
import { H, Notice, Panel, Row } from "./ui";

/** Everything the owner must see before confirming: destination, network, amount, fee, total, remainder. */
export function PaymentReview({ quote, unit }: { quote: SendQuote; unit: Unit }) {
  const t = useT();
  const [full, setFull] = useState(true);
  return (
    <Panel>
      <H>{t("review.title")}</H>
      <Row label={t("review.network")} value={t(NET_LONG_KEY)} valueStyle={{ color: theme.colors.warning }} />
      <Row label={t("review.method")} value={t(`method.${quote.method}`)} />
      <Row label={t("review.destination")} value={full ? chunkAddress(quote.destination) : shorten(quote.destination)} mono />
      <Pressable onPress={() => setFull((f) => !f)} accessibilityRole="button" hitSlop={8}>
        <Text style={{ color: theme.colors.primary, fontSize: 13 }}>{full ? t("review.collapse") : t("review.expand")}</Text>
      </Pressable>
      <Row label={t("review.amount")} value={formatAmount(quote.amountSats, unit)} />
      <Row label={t("review.fee")} value={formatAmount(quote.feeSats, unit)} />
      <Row label={t("review.total")} value={formatAmount(quote.totalDebitSats, unit)} strong />
      <Row label={t("review.after")} value={formatAmount(quote.balanceAfterSats, unit)} />
      {quote.feeIsEstimate ? <Notice tone="warning">{t("review.feeEstimate")}</Notice> : null}
      <Notice tone="info">{t("review.irreversible")}</Notice>
    </Panel>
  );
}
