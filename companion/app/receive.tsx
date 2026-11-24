import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Linking, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { BoardQr } from "@/components/board-qr";
import { SpeechFact } from "@/components/conversation";
import { Stage, finishStage, usePresentBoard, type StageAnswer } from "@/components/stage";
import { userAction } from "@/components/companionEvents";
import { autoSync, avatar, bus, wallet } from "@/container";
import { errorMessage } from "@/domain/errors";
import { receiveTurn, type ReceiveChoice } from "@/game/dialogue";
import { useT } from "@/i18n";
import { NET } from "@/config/network";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { chunkAddress, formatAmount } from "@/utils/format";

export default function ReceiveScene() {
  const t = useT();
  const unit = useSettings((s) => s.unit);
  const completeQuest = useSettings((s) => s.completeQuest);
  const syncing = useWalletStore((s) => s.syncing);
  const offline = useWalletStore((s) => s.lastSyncError !== undefined || s.lifecycle === "degraded");
  const movements = useWalletStore((s) => s.movements);
  const [attempt, setAttempt] = useState(0);
  const [address, setAddress] = useState<string>();
  const [error, setError] = useState<string>();
  const [qrError, setQrError] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [receivedId, setReceivedId] = useState<string>();
  const focused = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setCopied(false);
    const off = bus.on((e) => { if (e.type === "PAYMENT_RECEIVED") setReceivedId(e.movementId); });
    const release = autoSync.watch();
    return () => { focused.current = false; release(); off(); avatar.cancel(); clearTimeout(copyTimer.current); };
  }, []));
  useEffect(() => {
    let alive = true;
    setError(undefined);
    setQrError(false);
    setActionError(undefined);
    setCopied(false);
    setAddress(undefined);
    wallet.newArkAddress().then((a) => {
      if (!alive) return;
      setAddress(a);
      completeQuest("q2");
    }, (e) => { if (alive) setError(errorMessage(e)); });
    return () => { alive = false; };
  }, [attempt, completeQuest]);
  const received = receivedId ? movements.find((m) => m.id === receivedId && m.status === "succeeded") : undefined;
  const hasFaucet = NET.network === "signet" && !!NET.faucetUrl;
  const turn = receiveTurn({ address, error: !!error || qrError, received: !!received, hasFaucet });
  const boardCue = usePresentBoard(turn.step === "showing", turn.emotion, turn.lineKey);
  const copy = async () => {
    if (!address) return;
    setActionError(undefined);
    try { await Clipboard.setStringAsync(address); }
    catch { if (focused.current) setActionError(t("receive.copyFailed")); return; }
    if (!focused.current) return;
    userAction("address-copied");
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };
  const choose = (id: ReceiveChoice) => {
    switch (id) {
      case "copy": void copy(); break;
      case "share": setActionError(undefined); if (address) void Share.share({ message: address }).then((result) => { if (result.action === Share.sharedAction) userAction("address-shared"); }).catch(() => setActionError(t("receive.shareFailed"))); break;
      case "faucet": setActionError(undefined); if (hasFaucet) void Linking.openURL(NET.faucetUrl!).catch(() => setActionError(t("receive.linkFailed"))); break;
      case "retry": setReceivedId(undefined); setAttempt((n) => n + 1); break;
      case "done": finishStage(); break;
    }
  };
  const qrFailed = useCallback(() => setQrError(true), []);
  const answers: StageAnswer[] = turn.choices.map((id) => ({ id, label: id === "copy" && copied ? t("receive.copied") : t(`talk.receive.choice.${id}`), onPress: () => choose(id), hint: id === "copy" ? address : undefined }));
  if (turn.step === "received") answers.unshift({ id: "show-qr", label: t("receive.showQrAgain"), onPress: () => { setReceivedId(undefined); setActionError(undefined); } });
  return <Stage scene="receive" receivedId={receivedId} line={t(turn.lineKey)} boardCue={boardCue}
    board={turn.step === "showing" && address ? (size) => <View accessible accessibilityRole="image" accessibilityLabel={t("receive.qrLabel")} style={{ backgroundColor: "#FFFFFF" }}>
      <BoardQr value={address} size={size} onError={qrFailed} />
    </View> : undefined}
    choices={answers}
    caption={turn.step === "showing" && address ? <Text selectable accessibilityLabel={`${t("send.to")}: ${address}`} style={styles.address}>{chunkAddress(address)}</Text> : undefined}
    speechFacts={<>
      <SpeechFact tone="warning">{t("receive.networkChip")}</SpeechFact>
      {error ? <SpeechFact tone="danger">{t("receive.addressFailed", { detail: error })}</SpeechFact> : null}
      {qrError ? <SpeechFact tone="danger">{t("receive.qrFailed")}</SpeechFact> : null}
      {actionError ? <SpeechFact tone="danger">{actionError}</SpeechFact> : null}
      {received ? <SpeechFact>{t("receive.got.body", { amount: formatAmount(received.amountSats, unit) })}</SpeechFact> : address && (offline || syncing) ? <SpeechFact>{t(offline ? "receive.waitingOffline" : "receive.waitingSyncing")}</SpeechFact> : null}
    </>} />;
}
const styles = StyleSheet.create({
  address: { color: theme.colors.text, fontSize: 11, lineHeight: 14, textAlign: "center", padding: 4, backgroundColor: theme.colors.backgroundRaised, borderRadius: theme.radius.sm },
});
