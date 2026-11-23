import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, H, P, Panel, Row, Screen } from "@/components/ui";
import { avatar, wallet } from "@/container";
import type { MovementStatus, WalletMovement } from "@/domain/wallet";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { chunkAddress, formatAmount, formatTime } from "@/utils/format";

const STATUS_GLYPH: Record<MovementStatus, string> = { succeeded: "✓", pending: "…", failed: "✕", unknown: "?" };
const STATUS_COLOR: Record<MovementStatus, string> = {
  succeeded: theme.colors.success, pending: theme.colors.warning, failed: theme.colors.danger, unknown: theme.colors.warning,
};

function Card({ m, open, onPress }: { m: WalletMovement; open: boolean; onPress(): void }) {
  const t = useT();
  const { unit, language } = useSettings();
  const sign = m.direction === "incoming" ? "+" : m.direction === "outgoing" ? "−" : "";
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.dir}>{m.direction === "incoming" ? "↙" : m.direction === "outgoing" ? "↗" : "⟳"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t(`archive.direction.${m.direction}`)} · {t(`method.${m.method}`)}</Text>
          <Text style={styles.cardMeta}>{formatTime(m.createdAt, language)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.amount}>{sign}{formatAmount(m.amountSats, unit)}</Text>
          <Text style={[styles.cardMeta, { color: STATUS_COLOR[m.status] }]}>{STATUS_GLYPH[m.status]} {t(`archive.status.${m.status}`)}</Text>
        </View>
      </View>
      {open ? (
        <View style={styles.detail}>
          <Row label={t("archive.detail.status")} value={`${t(`archive.status.${m.status}`)} (${m.rawStatus})`} />
          <Row label={t("archive.detail.kind")} value={m.kind} />
          <Row label={t("review.fee")} value={formatAmount(m.feeSats, unit)} />
          {m.counterparty ? <Row label={t("archive.detail.address")} value={chunkAddress(m.counterparty)} mono /> : null}
          {m.completedAt ? <Row label={t("archive.detail.completed")} value={formatTime(m.completedAt, language)} /> : null}
          <Row label="ID" value={m.id} />
          {m.status === "pending" || m.status === "unknown" ? <P muted>{t("archive.detail.notFinal")}</P> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** S05 Archive: the wallet's own record of movements, with each one's actual state. */
export default function ArchiveScene() {
  const t = useT();
  const { language, completeQuest } = useSettings();
  const { movements, balance, syncing } = useWalletStore();
  const [open, setOpen] = useState<string>();

  useEffect(() => {
    completeQuest("q6");
    return () => avatar.cancel();
  }, [completeQuest]);

  return (
    <Screen title={t("menu.archive")} subtitle="ARCHIVE">
      <Panel>
        <Row label={t("archive.updated")} value={balance?.lastSyncedAt ? formatTime(balance.lastSyncedAt, language) : t("status.neverSynced")} />
        <Button label={t("home.syncNow")} kind="secondary" busy={syncing} onPress={() => void wallet.refresh()} />
      </Panel>
      <H>{t("archive.records", { n: movements.length })}</H>
      {movements.length === 0 ? <P muted>{t("archive.empty")}</P> : null}
      {movements.map((m) => (
        <Card key={m.id} m={m} open={open === m.id} onPress={() => setOpen(open === m.id ? undefined : m.id)} />
      ))}
      <P muted>{t("archive.note")}</P>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.md, backgroundColor: theme.colors.panel, padding: 12, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  dir: { color: theme.colors.primary, fontSize: 20, width: 24, textAlign: "center" },
  cardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  cardMeta: { color: theme.colors.textMuted, fontSize: 12 },
  amount: { color: theme.colors.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  detail: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outline, paddingTop: 8 },
});
