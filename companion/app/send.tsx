import { Reply, ReplyComposer, SpeechFact } from "@/components/conversation";
import { userAction } from "@/components/companionEvents";
import { useSendPresentation } from "@/components/SendCompanion";
import { Stage, finishStage, usePresentBoard, type StageAnswer } from "@/components/stage";
import { sendTurn, type SendChoice } from "@/game/dialogue";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect, useLocalSearchParams, usePreventRemove } from "expo-router";
import { PaymentReview } from "@/components/PaymentReview";
import { QrScanner } from "@/components/QrScanner";
import { Button, Notice, Row } from "@/components/ui";
import { avatar, bus, wallet } from "@/container";
import { CuePriority, type AvatarCue } from "@/domain/avatar";
import { WalletError, errorMessage } from "@/domain/errors";
import { btcDecimalToSats, formatBtc, parseSatsInput, toMoney } from "@/domain/money";
import { type PendingOperation, initialSendState, sendReducer } from "@/domain/payment";
import { useT } from "@/i18n";
import { authorize as authenticateUser } from "@/container";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { formatAmount, shorten } from "@/utils/format";

const QUOTE_MAX_AGE_MS = 120_000;

/** S03 Send. The reducer in domain/payment.ts decides what may happen next; this file only renders it. */
export default function SendScene() {
  const t = useT();
  const params = useLocalSearchParams<{ amount?: string; max?: string }>();
  const unit = useSettings((s) => s.unit);
  const balanceHidden = useSettings((s) => s.balanceHidden);
  const balance = useWalletStore((s) => s.balance);
  const [state, dispatch] = useReducer(sendReducer, { ...initialSendState, amountInput: params.amount ?? "" });
  const [authError, setAuthError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [typing, setTyping] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [amountUnit, setAmountUnit] = useState<"sats" | "btc">("sats");
  const [btcInput, setBtcInput] = useState<string>();
  const [openLoaded, setOpenLoaded] = useState(false);
  const [openError, setOpenError] = useState<string>();
  const validationSerial = useRef(0);
  const submitLock = useRef(false);
  const editLock = useRef(false);
  const [queuedDestination, setQueuedDestination] = useState<string>();
  const [editRevision, bumpEditRevision] = useReducer((n: number) => n + 1, 0);
  const releaseEditLock = useCallback(() => { editLock.current = false; bumpEditRevision(); }, []);
  const focused = useRef(false);
  const [busyMax, setBusyMax] = useState(false);
  const [open, setOpen] = useState<PendingOperation[]>([]);
  const [reconcileError, setReconcileError] = useState<string>();
  const [reconciling, setReconciling] = useState(false);
  const validationInput = useRef<string | undefined>(undefined);
  const amountTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTypingAt = useRef(0);
  const cancelTyping = useCallback(() => { clearTimeout(amountTimer.current); amountTimer.current = undefined; }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; validationSerial.current++; setQueuedDestination(undefined); cancelTyping(); setScanning(false); avatar.cancel(); };
  }, [cancelTyping]));
  const formError = useCallback((message: string) => {
    cancelTyping();
    avatar.cancel();
    dispatch({ type: "FORM_ERROR", message });
  }, [cancelTyping]);
  const typeAmount = (amountInput: string) => {
    dispatch({ type: "AMOUNT_CHANGED", amountInput });
    cancelTyping();
    if (amountInput) amountTimer.current = setTimeout(() => {
      lastTypingAt.current = Date.now();
      userAction("amount-typing");
    }, Math.max(450, 2000 - (Date.now() - lastTypingAt.current)));
  };
  const announceValidation = useCallback((input: string, valid: boolean) => {
    if (validationInput.current === input) return;
    validationInput.current = input;
    userAction(valid ? "destination-valid" : "destination-invalid");
  }, []);
  const wantMax = useRef(params.max === "1");

  const loadOpen = useCallback(async () => {
    try { setOpen(await wallet.unresolvedOperations()); setOpenLoaded(true); setOpenError(undefined); }
    catch (e) { setOpenLoaded(false); setOpenError(errorMessage(e)); }
  }, []);
  useEffect(() => {
    void loadOpen();
    return () => avatar.cancel();
  }, [loadOpen]);

  const blocking = open.filter((o) => o.status === "unknown" || o.status === "submitting");

  const explainCheck = (reason: string) => t(`send.invalid.${reason}`);

  const goReview = async () => {
    if (editLock.current || busyMax || !openLoaded || blocking.length > 0 || state.phase !== "editing") return;
    if (amountUnit === "btc" && btcInput && btcDecimalToSats(btcInput) === undefined) {
      formError(t(/^\d+\.\d{9,}$/.test(btcInput) ? "send.amount.fractional" : "send.amount.not-a-number"));
      return;
    }
    editLock.current = true;
    try { await prepareReview(); } finally { releaseEditLock(); }
  };
  const prepareReview = async () => {
    cancelTyping();
    Keyboard.dismiss();
    dispatch({ type: "VALIDATE_STARTED" });
    let check;
    try {
      check = await wallet.validateDestination(state.input);
    } catch (e) {
      announceValidation(state.input, false);
      dispatch({ type: "VALIDATED", check: { valid: false, reason: "unrecognised", detail: errorMessage(e) } });
      return;
    }
    announceValidation(state.input, check.valid);
    dispatch({ type: "VALIDATED", check });
    if (!check.valid) return;
    const amountText = check.fixedAmountSats ?? state.amountInput;
    const parsed = parseSatsInput(amountText);
    if (!parsed.ok) return formError(t(`send.amount.${parsed.reason}`));
    if (parsed.sats === 0n) return formError(t("send.amount.zero"));
    dispatch({ type: "QUOTE_STARTED" });
    try {
      const quote = await wallet.quoteSend({ method: check.method, destination: check.destination, amountSats: toMoney(parsed.sats) });
      dispatch({ type: "QUOTED", quote });
    } catch (e) {
      if (e instanceof WalletError && e.code === "insufficient-funds") {
        formError(t("send.insufficient", { short: formatAmount(e.message, unit) }));
      } else {
        // No quote means no review: a fee is never guessed.
        formError(t("send.quoteFailed", { detail: errorMessage(e) }));
      }
    }
  };

  const fillMax = useCallback(async () => {
    cancelTyping();
    userAction("max-selected");
    if (editLock.current) return;
    editLock.current = true;
    setBusyMax(true);
    setBtcInput(undefined);
    try {
      const max = await wallet.quoteMaxSend("ark");
      if (max.ok) dispatch({ type: "AMOUNT_CHANGED", amountInput: max.amountSats });
      else formError(t(`send.max.${max.reason}`));
    } catch (e) {
      formError(t("send.quoteFailed", { detail: errorMessage(e) }));
    } finally {
      releaseEditLock();
      setBusyMax(false);
    }
  }, [t, cancelTyping, formError, releaseEditLock]);

  useEffect(() => {
    if (wantMax.current) {
      wantMax.current = false;
      void fillMax();
    }
  }, [fillMax]);

  const submit = async () => {
    const quote = state.quote;
    if (!quote || state.phase !== "review" || submitLock.current || !openLoaded || blocking.length > 0) return;
    if (Date.now() - new Date(quote.quotedAt).getTime() > QUOTE_MAX_AGE_MS) {
      return formError(t("send.quoteExpired"));
    }
    submitLock.current = true;
    setAuthError(undefined);
    dispatch({ type: "USER_CONFIRMED" });
    userAction("auth-asked");
    const auth = await authenticateUser(t("send.authPrompt")).catch(() => ({ ok: false as const, reason: "failed" as const }));
    if (!auth.ok) {
      if (auth.reason !== "cancelled") setAuthError(t(auth.reason === "not-enrolled" ? "send.noLockBody" : "seed.authFailed"));
      submitLock.current = false;
      return dispatch({ type: "AUTH_FAILED" });
    }
    let operationId: string;
    try { operationId = wallet.newOperationId(); }
    catch (e) {
      submitLock.current = false;
      setAuthError(errorMessage(e));
      dispatch({ type: "AUTH_FAILED" });
      return;
    }
    dispatch({ type: "AUTHORIZED", operationId });
    try {
      const outcome = await wallet.confirmSend(operationId, quote);
      dispatch({ type: "OUTCOME", outcome });
    } catch {
      // A service/journal exception is not evidence of failure. Never invite a resend.
      dispatch({ type: "OUTCOME", outcome: { status: "unknown" } });
    } finally {
      submitLock.current = false;
      void loadOpen();
    }
  };

  const reconcile = async (operationId: string, own: boolean) => {
    setReconciling(true);
    setReconcileError(undefined);
    try {
      const op = await wallet.reconcileById(operationId);
      if (own && op && op.status !== "submitting") {
        dispatch({ type: "RECONCILED", outcome: { status: op.status, movementId: op.movementId } });
      }
      await loadOpen();
    } catch (e) {
      setReconcileError(errorMessage(e));
    } finally {
      setReconciling(false);
    }
  };

  const paste = async () => {
    Keyboard.dismiss();
    try {
      const text = await Clipboard.getStringAsync();
      if (!focused.current) return;
      userAction("destination-pasted");
      if (text) { setTyping(false); void checkDestination(text.trim()); }
      else setTyping(true);
    } catch (e) { if (focused.current) { setTyping(true); formError(errorMessage(e)); } }
  };

  const checkDestination = useCallback(async (input: string) => {
    if (!input.trim() || !focused.current) return;
    const serial = ++validationSerial.current;
    // Preserve the latest scan/paste while max/quote owns the edit lock.
    if (editLock.current) { setQueuedDestination(input.trim()); return; }
    setQueuedDestination(undefined);
    Keyboard.dismiss();
    dispatch({ type: "INPUT_CHANGED", input: input.trim() });
    dispatch({ type: "VALIDATE_STARTED" });
    try {
      const check = await wallet.validateDestination(input.trim());
      if (serial !== validationSerial.current) return;
      announceValidation(input.trim(), check.valid);
      dispatch({ type: "VALIDATED", check });
      if (check.valid) { setTyping(false); setBtcInput(undefined); }
    } catch (e) {
      if (serial !== validationSerial.current) return;
      announceValidation(input.trim(), false);
      dispatch({ type: "VALIDATED", check: { valid: false, reason: "unrecognised", detail: errorMessage(e) } });
    }
  }, [announceValidation]);
  useEffect(() => {
    if (queuedDestination && !editLock.current) void checkDestination(queuedDestination);
  }, [queuedDestination, editRevision, checkDestination]);

  const { phase } = state;
  const editing = phase === "editing" || phase === "validating" || phase === "quoting";
  const fixed = state.check?.valid ? state.check.fixedAmountSats : undefined;
  const inFlight = phase === "authorizing" || phase === "submitting";
  const turn = sendTurn(state);
  const phasePresentation = useSendPresentation(phase);
  const inputPresentation = useMemo<AvatarCue>(() => ({
    id: `send-turn:${turn.step}`, action: turn.action === "celebrate" || turn.action === "catch" ? "idle" : turn.action,
    emotion: turn.emotion, lineKey: turn.lineKey, priority: CuePriority.scene + 1, interruptible: true, holdMs: 0,
  }), [turn.step, turn.action, turn.emotion, turn.lineKey]);
  const presentation = phasePresentation ?? inputPresentation;
  const cancelReview = () => { cancelTyping(); avatar.cancel(); userAction("review-cancelled"); dispatch({ type: "BACK_TO_EDIT" }); };

  const boardCue = usePresentBoard(scanning, "curious", "talk.scan.show");
  usePreventRemove(inFlight);
  const changeDestination = () => { validationSerial.current++; setQueuedDestination(undefined); cancelTyping(); Keyboard.dismiss(); setTyping(false); setBtcInput(undefined); dispatch({ type: "INPUT_CHANGED", input: "" }); };
  const choose = (id: SendChoice) => {
    switch (id) {
      case "scan": Keyboard.dismiss(); cancelTyping(); setTyping(false); setScanning(true); userAction("scan-opened"); break;
      case "paste": void paste(); break;
      case "type": setTyping(true); break;
      case "clear": case "change-destination": changeDestination(); break;
      case "max": void fillMax(); break;
      case "confirm-amount": void goReview(); break;
      case "send": void submit(); break;
      case "back": cancelReview(); break;
      case "retry": setBtcInput(undefined); dispatch({ type: "BACK_TO_EDIT" }); break;
      case "activity": router.replace("/archive"); break;
      case "done": finishStage(); break;
    }
  };
  const awaitingDestination = turn.step === "destination" || turn.step === "bad-destination";
  const answers: StageAnswer[] = scanning ? [{ id: "stop", label: t("stage.stopScan"), onPress: () => setScanning(false), alwaysVisible: true }] : turn.choices.filter((id) =>
    !(turn.step === "amount" && (id === "max" || id === "confirm-amount")) &&
    // The editor is already open. Keep Scan/Paste beside it without a second
    // row of redundant entry/reset replies consuming keyboard space.
    !(typing && keyboardOpen && (id === "type" || id === "clear"))).map((id) => ({
    id, label: id === "send" ? t("send.confirm") : t(`talk.send.choice.${id}`), onPress: () => choose(id),
    hint: id === "send" ? t("send.confirmHint") : id === "max" ? t("send.maxHint") : undefined,
    busy: id === "max" && busyMax,
    disabled: busyMax || ((id === "confirm-amount" || id === "send") && (!openLoaded || blocking.length > 0)),
  }));
  const amountValue = fixed ?? state.amountInput;
  const parsedAmount = parseSatsInput(amountValue);
  const amountDisplay = amountUnit === "btc" ? (btcInput ?? (parsedAmount.ok ? formatBtc(parsedAmount.sats).replace(/,/g, "") : "")) : amountValue;
  return <Stage scene="send" line={t(scanning ? "talk.scan.show" : turn.lineKey)} choices={answers}
    boardCue={boardCue} boardImmediate
    fallbackCue={presentation} sendResult={{ phase, operationId: state.operationId }} locked={inFlight} review={phase === "review"}
    onBack={scanning ? () => setScanning(false) : phase === "review" ? cancelReview : finishStage}
    board={scanning ? <QrScanner visible onScanned={(data) => { setScanning(false); setTyping(false); void checkDestination(data.trim()); }} /> : undefined}
    speechFacts={<>
      {blocking.length > 0 && editing ? <SpeechFact tone="warning">{t("send.openOps.title")}{"\n"}{t("send.openOps.body")}</SpeechFact> : null}
      {!scanning && turn.step === "amount" && fixed !== undefined ? <SpeechFact>{t("send.amountFixed")}</SpeechFact> : null}
      {!scanning && awaitingDestination ? <SpeechFact>{t("send.methodsNote")}</SpeechFact> : null}
      {!scanning && state.check && !state.check.valid ? <SpeechFact tone="danger">{explainCheck(state.check.reason)}{state.check.detail ? `\n${state.check.detail}` : ""}</SpeechFact> : null}
      {!scanning && turn.step === "amount" && state.check?.valid ? <SpeechFact selectable>{t("send.to")}: {state.check.destination}</SpeechFact> : null}
      {state.formError && !scanning ? <SpeechFact tone="danger">{state.formError}</SpeechFact> : null}
      {reconcileError ? <SpeechFact tone="warning">{reconcileError}</SpeechFact> : null}
      {openError && editing ? <SpeechFact tone="warning">{openError}</SpeechFact> : null}
      {phase === "submitting" ? <SpeechFact>{t("send.submitting.body")}</SpeechFact> : null}
      {phase === "succeeded" && state.quote ? <SpeechFact>{t("send.succeeded.body", { amount: formatAmount(state.quote.amountSats, unit) })}</SpeechFact> : null}
      {phase === "failed" ? <SpeechFact>{t("send.failed.body")}{state.failure ? `\n${state.failure}` : ""}</SpeechFact> : null}
      {phase === "pending" || phase === "unknown" ? <SpeechFact tone="warning">{t(phase === "pending" ? "send.pending.body" : "send.unknown.body")}{phase === "unknown" ? `\n${t("send.unknown.noResend")}` : ""}</SpeechFact> : null}
    </>}>

    {blocking.length > 0 && editing ? <View style={{ gap: 10 }}>
      {blocking.map((o) => <View key={o.operationId} style={{ gap: 6 }}>
        <Row label={shorten(o.destination)} value={formatAmount(o.amountSats, unit)} />
        <Button label={t("send.reconcile")} kind="secondary" busy={reconciling} onPress={() => void reconcile(o.operationId, false)} />
      </View>)}
    </View> : null}
    {openError && editing ? <Button label={t("common.retry")} kind="secondary" onPress={() => void loadOpen()} /> : null}
    {!scanning && awaitingDestination && typing ? <ReplyComposer value={state.input} onChangeText={(input) => { validationSerial.current++; setQueuedDestination(undefined); dispatch({ type: "INPUT_CHANGED", input }); }}
      placeholder={t("send.toPlaceholder")} autoCapitalize="none" autoCorrect={false} autoFocus returnKeyType="next"
      accessibilityLabel={t("send.to")} submitLabel={t("stage.checkDestination")} disabled={busyMax || !state.input.trim()}
      replyText={state.input} onSend={() => void checkDestination(state.input)} /> : null}
    {!scanning && turn.step === "amount" && state.check?.valid ? <>
      <ReplyComposer submitLabel={t("talk.send.choice.confirm-amount")} onSend={() => void goReview()} replyText={`${amountDisplay || "0"} ${amountUnit === "btc" ? "BTC" : "sats"}`} disabled={busyMax || !openLoaded || blocking.length > 0}
        value={amountDisplay} editable={fixed === undefined && !busyMax} onChangeText={(value) => {
          if (amountUnit === "btc") {
            setBtcInput(value);
            const sats = value.length <= 32 ? btcDecimalToSats(value) : undefined;
            typeAmount(sats === undefined ? "" : toMoney(sats));
          } else typeAmount(value);
        }} onEndEditing={() => { cancelTyping(); if (state.amountInput) bus.emit({ type: "AMOUNT_ENTERED", id: bus.nextId("amount") }); }}
          placeholder="0" placeholderTextColor={theme.colors.textMuted} keyboardType={amountUnit === "btc" ? "decimal-pad" : "number-pad"} style={[styles.amount, keyboardOpen && { fontSize: 28 }]} accessibilityLabel={`${t("send.amount")} (${amountUnit === "btc" ? "BTC" : "sats"})`}>
        <View style={styles.helpers}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("home.unit")} accessibilityState={{ disabled: busyMax }} disabled={busyMax} onPress={() => {
          setBtcInput(undefined); setAmountUnit(amountUnit === "sats" ? "btc" : "sats"); userAction("unit-changed");
        }} style={styles.unitButton}><Text style={styles.unit}>{amountUnit === "btc" ? "BTC" : "sats"} ⇄</Text></Pressable>
        {fixed === undefined ? <Reply label={t("talk.send.choice.max")} hint={t("send.maxHint")} onPress={() => void fillMax()} disabled={busyMax} busy={busyMax} /> : null}
        </View>
        <Text style={styles.available}>{t("send.available", { amount: balanceHidden ? "••••••" : balance ? formatAmount(balance.spendableSats, unit) : t("home.balanceUnknown") })}</Text>
      </ReplyComposer>
      {keyboardOpen ? <Pressable accessibilityRole="button" accessibilityLabel={t("stage.dismissKeyboard")} onPress={() => { cancelTyping(); Keyboard.dismiss(); }} style={styles.keyboardDone}><Text style={styles.unit}>{t("stage.dismissKeyboard")}</Text></Pressable> : null}
    </> : null}
    {phase === "review" && state.quote ? <>
      <PaymentReview quote={state.quote} unit={unit} embedded />
      {authError ? <Notice tone="warning">{authError}</Notice> : null}
    </> : null}
    {inFlight || phase === "validating" || phase === "quoting" ? <ActivityIndicator color={theme.colors.primary} accessibilityLabel={t(turn.lineKey)} /> : null}
    {phase === "pending" || phase === "unknown" ? <>
      <Button label={t("send.reconcile")} kind="secondary" busy={reconciling} onPress={() => state.operationId && void reconcile(state.operationId, true)} />
    </> : null}
  </Stage>;
}

const styles = StyleSheet.create({
  available: { color: theme.colors.textMuted, fontSize: theme.presence.footnoteSize, lineHeight: theme.presence.footnoteLine, paddingHorizontal: theme.spacing.sm },
  helpers: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  amount: { fontSize: theme.presence.amountSize, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unitButton: { minHeight: theme.presence.touch, minWidth: theme.presence.touch, justifyContent: "center", paddingHorizontal: theme.spacing.sm },
  unit: { color: theme.colors.primary, fontSize: theme.presence.replySize },
  keyboardDone: { minHeight: theme.presence.touch, alignSelf: "flex-end", justifyContent: "center", paddingHorizontal: theme.spacing.md },
});
