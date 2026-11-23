import { View } from "react-native";
import { TermHelp } from "./TermHelp";
import type { SendQuote } from "@/domain/wallet";
import { useT } from "@/i18n";
import type { Unit } from "@/state/settingsStore";
import { theme } from "@/theme";
import { chunkAddress, formatAmount } from "@/utils/format";
import { H, Notice, Panel, Row } from "./ui";

/** Everything the owner must see before confirming: destination, network, amount, fee, total, remainder. */
export function PaymentReview({ quote, unit }: { quote: SendQuote; unit: Unit }) {
  const t = useT();
  return (
    <Panel>
      <H>{t("review.title")}</H>
      <Row label={t("review.network")} value={t(quote.network === "mainnet" ? "net.mainnetLong" : "net.signetLong")} valueStyle={{ color: quote.network === "mainnet" ? theme.colors.danger : theme.colors.warning }} />
      <Row label={t("review.method")} value={t(`method.${quote.method}`)} />
      <Row label={t("review.destination")} value={chunkAddress(quote.destination)} mono />
      <Row label={t("review.amount")} value={formatAmount(quote.amountSats, unit)} />
      <Row label={t("review.fee")} value={formatAmount(quote.feeSats, unit)} />
      <View style={{ padding: 16, borderRadius: 12, backgroundColor: theme.colors.backgroundRaised }}><Row label={t("review.total")} value={formatAmount(quote.totalDebitSats, unit)} strong /></View>
      <Row label={t("review.after")} value={formatAmount(quote.balanceAfterSats, unit)} />
      <TermHelp term="fee" />
      {quote.feeIsEstimate ? <Notice tone="warning">{t("review.feeEstimate")}</Notice> : null}
      <Notice tone="info">{t("review.irreversible")}</Notice>
    </Panel>
  );
}
