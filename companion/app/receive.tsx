import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Keyboard, Linking, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { AmountComposer } from "@/components/amount-composer";
import { useLightningReceive } from "@/components/use-lightning-receive";
import { BoardQr } from "@/components/board-qr";
import { MockChip } from "@/components/MockChip";
import { SpeechFact } from "@/components/conversation";
import { Stage, finishStage, usePresentBoard, type StageAnswer } from "@/components/stage";
import { userAction } from "@/components/companionEvents";
import { adapter, autoSync, avatar, bus, wallet } from "@/container";
import { btcDecimalToSats, formatBtc, parseSatsInput, toMoney } from "@/domain/money";
import { errorMessage } from "@/domain/errors";
import { receiveTurn, type ReceiveChoice } from "@/game/dialogue";
import { useT } from "@/i18n";
import { NET } from "@/config/network";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { chunkAddress, formatAmount, formatTime } from "@/utils/format";

export default function ReceiveScene() {
  const t = useT();
  const unit = useSettings((s) => s.unit);
  const language = useSettings((s) => s.language);
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState<"sats" | "btc">("sats");
  const [btcInput, setBtcInput] = useState<string>();
  const [amountError, setAmountError] = useState<string>();
  const [keyboardOpen, setKeyboardOpen] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
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
  const ln = useLightningReceive(!!received);
  const lightningAvailable = wallet.lightningAvailable && NET.network === "signet";
  const lightning = lightningAvailable ? ln.stage : undefined;
  const hasFaucet = NET.network === "signet" && !!NET.faucetUrl;
  const turn = receiveTurn({ address, error: !!error || qrError, received: !!received, hasFaucet, lightningAvailable, lightning });
  const showInvoice = !!lightning && !!ln.invoice && (turn.step === "ln-showing" || turn.step === "ln-claiming");
  const boardValue = showInvoice ? ln.invoice!.invoice : turn.step === "showing" ? address : undefined;
  const shareValue = lightning ? ln.invoice?.invoice : address;
  const boardCue = usePresentBoard(!!boardValue, turn.emotion, turn.lineKey);
  const resetLightning = (next?: "amount") => {
    Keyboard.dismiss(); avatar.cancel(); clearTimeout(copyTimer.current);
    setReceivedId(undefined); setQrError(false); setActionError(undefined); setCopied(false); setAmountError(undefined);
    ln.reset(next);
  };
  const createInvoice = () => {
    if (!focused.current || !lightningAvailable) return;
    if (amountUnit === "btc" && btcInput !== undefined && (btcInput.length > 32 || btcDecimalToSats(btcInput) === undefined)) {
      setAmountError(t(/^\d+\.\d{9,}$/.test(btcInput) ? "send.amount.fractional" : "send.amount.not-a-number")); return;
    }
    const parsed = parseSatsInput(amount);
    if (!parsed.ok) { setAmountError(t(`send.amount.${parsed.reason}`)); return; }
    if (parsed.sats === 0n) { setAmountError(t("send.amount.zero")); return; }
    Keyboard.dismiss(); setAmountError(undefined); setQrError(false); setActionError(undefined); setCopied(false);
    void ln.create(toMoney(parsed.sats));
  };
  const copy = async () => {
    if (!shareValue) return;
    setActionError(undefined);
    try { await Clipboard.setStringAsync(shareValue); }
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
      case "share": setActionError(undefined); if (shareValue) void Share.share({ message: shareValue }).then((result) => { if (result.action === Share.sharedAction) userAction("address-shared"); }).catch(() => setActionError(t("receive.shareFailed"))); break;
      case "faucet": setActionError(undefined); if (hasFaucet && turn.step === "showing" && !lightning) void Linking.openURL(NET.faucetUrl!).catch(() => setActionError(t("receive.linkFailed"))); break;
      case "retry": if (lightning) createInvoice(); else { setReceivedId(undefined); setAttempt((n) => n + 1); } break;
      case "lightning": if (lightningAvailable) resetLightning("amount"); break;
      case "ark": resetLightning(); break;
      case "new-invoice": resetLightning("amount"); break;
      case "confirm-amount": createInvoice(); break;
      case "done": finishStage(); break;
    }
  };
  const qrFailed = useCallback(() => setQrError(true), []);
  const answers: StageAnswer[] = turn.choices.filter((id) => id !== "confirm-amount" && (id !== "faucet" || (turn.step === "showing" && !lightning))).map((id) => ({ id, label: id === "copy" && copied ? t("receive.copied") : t(`talk.receive.choice.${id}`), onPress: () => choose(id), hint: id === "copy" && !lightning ? address : undefined }));
  const mockChip = adapter.isMock && "simulateIncoming" in adapter && (turn.step === "showing" || turn.step === "ln-showing") ? <MockChip
    label={t(lightning ? "mock.payInvoice" : "mock.simulateIncoming")}
    onPress={() => { try { (adapter as typeof adapter & { simulateIncoming(sats: bigint): void }).simulateIncoming(10_000n); } catch (e) { setActionError(errorMessage(e)); } }} /> : undefined;
  if (turn.step === "received" && !lightning) answers.unshift({ id: "show-qr", label: t("receive.showQrAgain"), onPress: () => { setReceivedId(undefined); setActionError(undefined); } });
  const parsedAmount = parseSatsInput(amount);
  const amountDisplay = amountUnit === "btc" ? (btcInput ?? (parsedAmount.ok ? formatBtc(parsedAmount.sats).replace(/,/g, "") : "")) : amount;
  return <Stage scene="receive" receivedId={received?.id} line={t(turn.lineKey)} boardCue={boardCue}
    board={boardValue ? (size) => <View accessible accessibilityRole="image" accessibilityLabel={t(showInvoice ? "receive.ln.qrLabel" : "receive.qrLabel")} style={{ backgroundColor: "#FFFFFF" }}>
      <BoardQr value={boardValue} size={size} onError={qrFailed} />
    </View> : undefined}
    choices={answers} choiceAccessory={mockChip}
    caption={showInvoice && ln.invoice ? <View style={styles.invoiceCaption}>
      <Text style={styles.invoiceMethod}>{t("receive.ln.method")} · {formatAmount(ln.invoice.amountSats, unit)}{ln.invoice.expiresAt ? ` · ${t("receive.ln.expires", { time: formatTime(ln.invoice.expiresAt, language) })}` : ""}</Text>
      <Text style={styles.invoiceText}>{t("receive.ln.fixed", { amount: formatAmount(ln.invoice.amountSats, unit) })}</Text>
      {ln.invoice.feeSats !== undefined && BigInt(ln.invoice.feeSats) > 0n ? <Text style={styles.invoiceText}>{t("receive.ln.fee")}: {formatAmount(ln.invoice.feeSats, unit)}</Text> : null}
    </View> : turn.step === "showing" && address ? <Text selectable accessibilityLabel={`${t("send.to")}: ${address}`} style={styles.address}>{chunkAddress(address)}</Text> : undefined}
    speechFacts={<>
      <SpeechFact tone="warning">{t("receive.networkChip")}</SpeechFact>
      {showInvoice ? <SpeechFact>{t("receive.ln.keepOpen")}</SpeechFact> : null}
      {!lightning && error ? <SpeechFact tone="danger">{t("receive.addressFailed", { detail: error })}</SpeechFact> : null}
      {lightning && ln.error ? <SpeechFact tone="danger">{ln.error}</SpeechFact> : null}
      {lightning && ln.uncertain ? <SpeechFact tone="warning">{t("receive.ln.unknown")}</SpeechFact> : null}
      {amountError ? <SpeechFact tone="danger">{amountError}</SpeechFact> : null}
      {qrError ? <SpeechFact tone="danger">{t("receive.qrFailed")}</SpeechFact> : null}
      {actionError ? <SpeechFact tone="danger">{actionError}</SpeechFact> : null}
      {received ? <SpeechFact>{t("receive.got.body", { amount: formatAmount(received.amountSats, unit) })}</SpeechFact> : address && (offline || syncing) ? <SpeechFact>{t(offline ? "receive.waitingOffline" : "receive.waitingSyncing")}</SpeechFact> : null}
    </>}>
    {turn.step === "ln-amount" ? <>
      <AmountComposer amountUnit={amountUnit} keyboardOpen={keyboardOpen}
        value={amountDisplay}
        onChangeText={(value) => {
          setAmountError(undefined);
          if (amountUnit === "btc") {
            setBtcInput(value); const sats = value.length <= 32 ? btcDecimalToSats(value) : undefined;
            setAmount(sats === undefined ? "" : toMoney(sats));
          } else setAmount(value);
        }} onUnitChange={() => { setBtcInput(undefined); const parsed = parseSatsInput(amount); if (parsed.ok) setAmount(toMoney(parsed.sats)); setAmountUnit(amountUnit === "sats" ? "btc" : "sats"); userAction("unit-changed"); }}
        submitLabel={t("talk.receive.choice.confirm-amount")} onSend={createInvoice}
        replyText={`${amountDisplay || "0"} ${amountUnit === "btc" ? "BTC" : "sats"}`} />
    </> : null}
    {turn.step === "ln-preparing" ? <ActivityIndicator color={theme.colors.primary} accessibilityLabel={t(turn.lineKey)} /> : null}
  </Stage>;
}
const styles = StyleSheet.create({
  invoiceCaption: { gap: 2, padding: 4, borderRadius: theme.radius.sm, backgroundColor: theme.colors.backgroundRaised },
  invoiceMethod: { color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  invoiceText: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
  address: { color: theme.colors.text, fontSize: 11, lineHeight: 14, textAlign: "center", padding: 4, backgroundColor: theme.colors.backgroundRaised, borderRadius: theme.radius.sm },
});
