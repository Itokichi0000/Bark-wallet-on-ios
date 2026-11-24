import { useLocalSearchParams } from "expo-router";
import { userAction } from "@/components/companionEvents";
import { usePullRefresh } from "@/components/usePullRefresh";
import { SyncStatus } from "@/components/SyncStatus";
import { BitcoinIcon, type BitcoinIconName } from "@/components/BitcoinIcon";
import { TermHelp } from "@/components/TermHelp";
import { Disclosure } from "@/components/Disclosure";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { H, Notice, P, Panel, Row, Screen } from "@/components/ui";
import { avatar } from "@/container";
import type { MovementStatus, WalletMovement } from "@/domain/wallet";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { chunkAddress, formatAmount, formatTime, shorten } from "@/utils/format";

const STATUS_ICON: Record<MovementStatus, BitcoinIconName> = { succeeded: "check", pending: "clock", failed: "cross", unknown: "question-circle" };
const STATUS_COLOR: Record<MovementStatus, string> = {
  succeeded: theme.colors.success, pending: theme.colors.warning, failed: theme.colors.danger, unknown: theme.colors.warning,
};

function Card({ m, open, onPress }: { m: WalletMovement; open: boolean; onPress(): void }) {
  const t = useT();
  const { unit, language } = useSettings();
  const sign = m.direction === "incoming" ? "+" : m.direction === "outgoing" ? "−" : "";
  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.cardTop}>
        <BitcoinIcon name={m.direction === "incoming" ? "receive" : m.direction === "outgoing" ? "send" : "refresh"} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t(`archive.direction.${m.direction}`)} · {t(`method.${m.method}`)}</Text>
          <Text style={styles.cardMeta}>{formatTime(m.createdAt, language)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.amount}>{sign}{formatAmount(m.amountSats, unit)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><BitcoinIcon name={STATUS_ICON[m.status]} size={18} color={STATUS_COLOR[m.status]} /><Text style={[styles.cardMeta, { color: STATUS_COLOR[m.status] }]}>{t(`archive.status.${m.status}`)}</Text></View>
        </View>
      </Pressable>
      {m.status === "pending" || m.status === "unknown" ? <Notice tone="warning">{t("archive.detail.notFinal")}</Notice> : null}
      {open ? (
        <View style={styles.detail}>
          <Row label={t("archive.detail.status")} value={t(`archive.status.${m.status}`)} />
          <Row label={t("review.method")} value={t(`method.${m.method}`)} />
          <Row label={t("send.amount")} value={formatAmount(m.amountSats, unit)} />
          <Row label={t("review.fee")} value={formatAmount(m.feeSats, unit)} />
          <Row label={t("archive.detail.created")} value={formatTime(m.createdAt, language)} />
          {m.counterparty ? <Row label={t("archive.detail.address")} value={m.method === "lightning" ? shorten(m.counterparty, 12, 8) : chunkAddress(m.counterparty)} mono /> : null}
          {m.completedAt ? <Row label={t("archive.detail.completed")} value={formatTime(m.completedAt, language)} /> : null}
          <Disclosure title={t("archive.detail.technical")}>
            <Row label={t("archive.detail.rawStatus")} value={m.rawStatus} />
            <Row label={t("archive.detail.kind")} value={m.kind} />
            <Row label={t("archive.detail.id")} value={m.id} />
          </Disclosure>
        </View>
      ) : null}
    </View>
  );
}

/** S05 Archive: the wallet's own record of movements, with each one's actual state. */
export default function ArchiveScene() {
  const t = useT();
  const refresh = usePullRefresh();
  const { completeQuest } = useSettings();
  const { movements, balance, lastSyncError, lifecycle } = useWalletStore();
  const { movement } = useLocalSearchParams<{ movement?: string }>();
  const [open, setOpen] = useState<string>(movement ?? "");

  useEffect(() => {
    completeQuest("q6");
    return () => avatar.cancel();
  }, [completeQuest]);

  return (
    <Screen scene="archive" title={t("menu.archive")} subtitle="ARCHIVE" onRefresh={refresh.onRefresh} refreshing={refresh.refreshing}>
      <SyncStatus />
      <H>{t("archive.records", { n: movements.length })}</H>
      {movements.length === 0 ? <Panel><P muted>{t(lastSyncError !== undefined || lifecycle === "degraded" ? "list.unavailable" : !balance?.lastSyncedAt ? "archive.loading" : "archive.empty")}</P></Panel> : null}
      {movements.map((m) => (
        <Card key={m.id} m={m} open={open === m.id} onPress={() => { if (open !== m.id) userAction("movement-opened"); setOpen(open === m.id ? "" : m.id); }} />
      ))}
      <TermHelp term="payment" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.md, backgroundColor: theme.colors.panel, padding: 12, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, flexWrap: "wrap" },
  dir: { color: theme.colors.primary, fontSize: 20, width: 24, textAlign: "center" },
  cardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  cardMeta: { color: theme.colors.textMuted, fontSize: 12 },
  amount: { color: theme.colors.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  detail: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outline, paddingTop: 8 },
});
