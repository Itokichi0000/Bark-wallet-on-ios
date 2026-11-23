import { useEffect, useState } from "react";
import { Linking, Platform, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Button, H, Notice, P, Panel, Screen } from "@/components/ui";
import { avatar, bus, wallet } from "@/container";
import { errorMessage } from "@/domain/errors";
import { useT } from "@/i18n";
import { SIGNET } from "@/infrastructure/bark/barkConfig";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { chunkAddress, formatAmount } from "@/utils/format";

/** S04 Receive: an Ark address on Signet, as QR and as text. Nothing is called "received" until the wallet reports it. */
export default function ReceiveScene() {
  const t = useT();
  const { width } = useWindowDimensions();
  const unit = useSettings((s) => s.unit);
  const syncing = useWalletStore((s) => s.syncing);
  const movements = useWalletStore((s) => s.movements);
  const [address, setAddress] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [receivedId, setReceivedId] = useState<string>();

  useEffect(() => {
    let alive = true;
    wallet.newArkAddress().then(
      (a) => {
        if (!alive) return;
        setAddress(a);
        bus.emit({ type: "RECEIVE_SHOWN", id: bus.nextId("recv-shown") });
      },
      (e) => alive && setError(errorMessage(e)),
    );
    const off = bus.on((e) => {
      if (e.type === "PAYMENT_RECEIVED") setReceivedId(e.movementId);
    });
    return () => {
      alive = false;
      off();
      avatar.cancel();
    };
  }, []);

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const received = receivedId ? movements.find((m) => m.id === receivedId) : undefined;
  const qrSize = Math.min(width - 96, 280);

  return (
    <Screen title={t("menu.receive")} subtitle="RECEIVE">
      <Notice tone="warning">{t("receive.networkNote")}</Notice>
      {received ? (
        <Panel tone="success">
          <H>{t("receive.got.title")}</H>
          <P>{t("receive.got.body", { amount: formatAmount(received.amountSats, unit) })}</P>
        </Panel>
      ) : null}
      {error ? <Notice tone="danger">{t("receive.addressFailed", { detail: error })}</Notice> : null}
      <Panel style={{ alignItems: "center" }}>
        <H>{t("receive.method")}</H>
        {address ? (
          <View style={styles.qr} accessible accessibilityLabel={t("receive.qrLabel")}>
            <QRCode value={address} size={qrSize} backgroundColor="#FFFFFF" color="#000000" quietZone={12} ecl="M" />
          </View>
        ) : (
          <View style={[styles.qr, { width: qrSize + 24, height: qrSize + 24, justifyContent: "center" }]}>
            <Text style={{ color: "#333", textAlign: "center" }}>{error ? "—" : t("receive.loading")}</Text>
          </View>
        )}
        {address ? <Text selectable style={styles.address}>{chunkAddress(address)}</Text> : null}
      </Panel>
      <Button label={copied ? t("receive.copied") : t("receive.copy")} onPress={() => void copy()} disabled={!address} />
      <Button label={t("receive.share")} kind="secondary" onPress={() => address && void Share.share({ message: address })} disabled={!address} />
      <Panel>
        <P>{syncing ? t("receive.waitingSyncing") : t("receive.waiting")}</P>
        <Button label={t("home.syncNow")} kind="secondary" busy={syncing} onPress={() => void wallet.refresh()} />
        <P muted>{t("receive.feeNote")}</P>
      </Panel>
      <Panel>
        <H>{t("receive.faucet.title")}</H>
        <P muted>{t("receive.faucet.body")}</P>
        <Button label={t("receive.faucet.open")} kind="secondary" onPress={() => void Linking.openURL(SIGNET.faucetUrl)} />
      </Panel>
      <P muted>{t("receive.notYet")}</P>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qr: { backgroundColor: "#FFFFFF", padding: 0, borderRadius: 12, overflow: "hidden", alignItems: "center" },
  address: { color: theme.colors.text, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 13, lineHeight: 20, textAlign: "center" },
});
