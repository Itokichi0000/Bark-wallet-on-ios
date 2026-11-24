import { userAction } from "@/components/companionEvents";
import { TermHelp } from "@/components/TermHelp";
import { Disclosure } from "@/components/Disclosure";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { SyncStatus } from "@/components/SyncStatus";
import { BitcoinIcon } from "@/components/BitcoinIcon";
import { Linking, Platform, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Button, H, Notice, P, Panel, Screen } from "@/components/ui";
import { autoSync, avatar, bus, wallet } from "@/container";
import { errorMessage } from "@/domain/errors";
import { useT } from "@/i18n";
import { NET } from "@/config/network";

const faucetUrl = NET.faucetUrl;
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { chunkAddress, formatAmount } from "@/utils/format";

/** S04 Receive: an Ark address on Signet, as QR and as text. Nothing is called "received" until the wallet reports it. */
export default function ReceiveScene() {
  const t = useT();
  const { width, height } = useWindowDimensions();
  const unit = useSettings((s) => s.unit);
  const completeQuest = useSettings((s) => s.completeQuest);
  const syncing = useWalletStore((s) => s.syncing);
  const offline = useWalletStore((s) => s.lastSyncError !== undefined || s.lifecycle === "degraded");
  const [attempt, setAttempt] = useState(0);
  const movements = useWalletStore((s) => s.movements);
  const [address, setAddress] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [receivedId, setReceivedId] = useState<string>();

  useFocusEffect(useCallback(() => {
    const off = bus.on((e) => {
      if (e.type === "PAYMENT_RECEIVED") setReceivedId(e.movementId);
    });
    const release = autoSync.watch();
    return () => { release(); off(); };
  }, []));

  useEffect(() => {
    let alive = true;
    setError(undefined);
    wallet.newArkAddress().then(
      (a) => {
        if (!alive) return;
        setAddress(a);
        // The address is ready: retain learning progress without a second greeting.
        completeQuest("q2");
      },
      (e) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
      avatar.cancel();
    };
  }, [attempt, completeQuest]);

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    userAction("address-copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const received = receivedId ? movements.find((m) => m.id === receivedId) : undefined;
  const qrSize = Math.max(120, Math.min(width - 144, height < 720 ? 152 : 210));

  return (
    <Screen scene="receive" title={t("menu.receive")} subtitle="RECEIVE">
      <Notice tone={NET.network === "mainnet" ? "danger" : "warning"}>{t("receive.networkNote")}</Notice>
      {error ? <Notice tone="danger">{t("receive.addressFailed", { detail: error })}</Notice> : null}
      {error ? <Button label={t("common.retry")} kind="secondary" onPress={() => setAttempt((n) => n + 1)} /> : null}
      <Panel style={{ alignItems: "center", padding: 12, gap: 10 }}>
        {address ? (
          <View style={styles.qr} accessible accessibilityLabel={t("receive.qrLabel")}>
            <QRCode value={address} size={qrSize} backgroundColor="#FFFFFF" color="#000000" quietZone={12} ecl="M" />
          </View>
        ) : (
          <View style={[styles.qr, { width: qrSize + 24, height: qrSize + 24, justifyContent: "center" }]}>
            <Text style={{ color: "#333", textAlign: "center" }}>{error ? "—" : t("receive.loading")}</Text>
          </View>
        )}
        {address ? <View style={styles.live} accessibilityLiveRegion="polite">
          <BitcoinIcon name={received?.status === "succeeded" ? "check" : offline ? "alert" : "clock"} size={20} color={received?.status === "succeeded" ? theme.colors.success : offline ? theme.colors.warning : theme.colors.primary} />
          <Text style={styles.liveText}>{received?.status === "succeeded"
            ? t("receive.got.body", { amount: formatAmount(received.amountSats, unit) })
            : t(offline ? "receive.waitingOffline" : syncing ? "receive.waitingSyncing" : "receive.waiting")}</Text>
        </View> : null}
        {address ? <Text selectable style={styles.address}>{chunkAddress(address)}</Text> : null}
        <View style={{ alignSelf: "stretch" }}><Button label={copied ? t("receive.copied") : t("receive.copy")} icon="copy" onPress={() => void copy()} disabled={!address} /></View>
      </Panel>
      <Button label={t("receive.share")} icon="share" kind="secondary" onPress={() => { if (address) void Share.share({ message: address }).then((result) => { if (result.action === Share.sharedAction) userAction("address-shared"); }); }} disabled={!address} />
      <SyncStatus />
      <Disclosure title={t("common.details")}>
      <TermHelp term="ark" /><TermHelp term="fee" />
      <P muted>{t("receive.feeNote")}</P>
      {faucetUrl ? (
        <Panel>
          <H>{t("receive.faucet.title")}</H>
          <P muted>{t("receive.faucet.body")}</P>
          <Button label={t("receive.faucet.open")} kind="secondary" onPress={() => void Linking.openURL(faucetUrl)} />
        </Panel>
      ) : null}
      <P muted>{t("receive.notYet")}</P>
      </Disclosure>
    </Screen>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: "row", gap: 8, alignItems: "center", alignSelf: "stretch", minHeight: 28 },
  liveText: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  qr: { backgroundColor: "#FFFFFF", padding: 0, borderRadius: 12, overflow: "hidden", alignItems: "center" },
  address: { color: theme.colors.text, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 12, lineHeight: 17, textAlign: "center" },
});
