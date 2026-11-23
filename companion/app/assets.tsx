import { TermHelp } from "@/components/TermHelp";
import { Disclosure } from "@/components/Disclosure";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button, H, Notice, P, Panel, Row, Screen } from "@/components/ui";
import { avatar, wallet } from "@/container";
import type { WalletVtxo } from "@/domain/wallet";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { formatAmount, formatTime, shorten } from "@/utils/format";

const HEALTH_COLOR: Record<WalletVtxo["health"], string> = {
  ok: theme.colors.primary,
  "refresh-soon": theme.colors.warning,
  "refresh-required": theme.colors.danger,
  locked: theme.colors.disabled,
};

function Crystal({ color }: { color: string }) {
  return (
    <Svg width={30} height={40} viewBox="0 0 30 40">
      <Path d="M15 1 L28 14 L15 39 L2 14 Z" fill={color} opacity={0.28} stroke={color} strokeWidth={1.4} />
      <Path d="M2 14 H28 M15 1 L10 14 L15 39 L20 14 Z" fill="none" stroke={color} strokeWidth={0.9} opacity={0.9} />
    </Svg>
  );
}

/** S06 Assets: what is owned vs. what can be spent, and the real state of each VTXO. */
export default function AssetsScene() {
  const t = useT();
  const { unit, language, completeQuest } = useSettings();
  const { balance, vtxos, maintenance, syncing } = useWalletStore();
  const [selected, setSelected] = useState<string>();
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => () => avatar.cancel(), []);
  useEffect(() => {
    if (advanced) completeQuest("q6");
  }, [advanced, completeQuest]);

  const show = (m: string | undefined) => (m === undefined ? t("home.balanceUnknown") : formatAmount(m, unit));

  return (
    <Screen title={t("menu.assets")} subtitle="ASSETS">
      <Panel>
        <Row label={t("assets.spendable")} value={show(balance?.spendableSats)} valueStyle={{ fontSize: 32, fontWeight: "700" }} />
        <Disclosure title={t("common.details")}>
        <Row label={t("assets.total")} value={show(balance?.totalSats)} />
        <P muted>{t("assets.totalNote")}</P>
        <Row label={t("assets.pending")} value={show(balance?.pendingSats)} />
        <Row label={t("assets.needsRefresh")} value={show(balance?.needsRefreshSats)} />
        <Row label={t("assets.asOf")} value={balance?.lastSyncedAt ? formatTime(balance.lastSyncedAt, language) : t("status.neverSynced")} />
        </Disclosure>
        <Button label={t("home.syncNow")} icon="refresh" busy={syncing} onPress={() => void wallet.refresh()} />
      </Panel>

      {maintenance && maintenance.severity !== "none" ? (
        <Notice tone={maintenance.severity === "urgent" ? "danger" : "warning"}>
          {t(maintenance.severity === "urgent" ? "status.maintenanceUrgent" : "status.maintenanceNotice")}
        </Notice>
      ) : null}

      <Panel>
        <H>{t("assets.maintenance.title")}</H>
        <TermHelp term="expiry" />
        <Disclosure title={t("common.details")}>
        <Row label={t("assets.maintenance.tip")} value={maintenance?.tipHeight !== undefined ? String(maintenance.tipHeight) : t("assets.unknown")} />
        <Row label={t("assets.maintenance.toRefresh")} value={maintenance ? String(maintenance.vtxosToRefresh) : t("assets.unknown")} />
        <Row label={t("assets.maintenance.nextRefresh")} value={maintenance?.nextRequiredRefreshHeight !== undefined ? String(maintenance.nextRequiredRefreshHeight) : t("assets.none")} />
        <Row label={t("assets.maintenance.firstExpiry")} value={maintenance?.firstExpiryHeight !== undefined ? String(maintenance.firstExpiryHeight) : t("assets.none")} />
        </Disclosure>
        <P muted>{t("assets.maintenance.caveat")}</P>
      </Panel>

      <TermHelp term="vtxo" />
      <Button label={advanced ? t("assets.hideVtxos") : t("assets.showVtxos", { n: vtxos.length })} kind="secondary" onPress={() => setAdvanced((a) => !a)} />
      {advanced && (
        <Panel>
          <H>VTXO</H>
          <P muted>{t("assets.vtxoExplain")}</P>
          {vtxos.length === 0 ? <P muted>{t("assets.noVtxos")}</P> : null}
          {vtxos.map((v) => {
            const on = selected === v.id;
            return (
              <Pressable key={v.id} onPress={() => setSelected(on ? undefined : v.id)} accessibilityRole="button" accessibilityState={{ expanded: on }} style={styles.vtxo}>
                <Crystal color={HEALTH_COLOR[v.health]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.vtxoAmount}>{formatAmount(v.amountSats, unit)}</Text>
                  <Text style={styles.vtxoMeta}>{t(`assets.health.${v.health}`)}</Text>
                  {on ? (
                    <View style={{ gap: 2, marginTop: 4 }}>
                      <Text style={styles.vtxoMeta}>{t("assets.vtxo.expiry", { height: v.expiryHeight })}</Text>
                      <Text style={styles.vtxoMeta}>
                        {v.blocksToExpiry !== undefined ? t("assets.vtxo.blocksLeft", { n: v.blocksToExpiry, days: Math.max(0, Math.round(v.blocksToExpiry / 144)) }) : t("assets.vtxo.blocksUnknown")}
                      </Text>
                      <Text style={styles.vtxoMeta}>{t("assets.vtxo.state", { state: v.state, kind: v.kind })}</Text>
                      <Text style={styles.vtxoMeta} selectable>{shorten(v.id, 14, 10)}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Panel>
      )}

      <Disclosure title={t("assets.ops.title")}>
        <P>{t("assets.ops.refresh")}</P>
        <P>{t("assets.ops.offboard")}</P>
        <P>{t("assets.ops.exit")}</P>
        <Notice tone="info">{t("assets.ops.notEnabled")}</Notice>
      </Disclosure>
    </Screen>
  );
}

const styles = StyleSheet.create({
  vtxo: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 8, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outline },
  vtxoAmount: { color: theme.colors.text, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  vtxoMeta: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
});
