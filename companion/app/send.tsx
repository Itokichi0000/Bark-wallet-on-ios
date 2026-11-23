import { TermHelp } from "@/components/TermHelp";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { PaymentReview } from "@/components/PaymentReview";
import { QrScanner } from "@/components/QrScanner";
import { Button, H, Notice, P, Panel, Row, Screen } from "@/components/ui";
import { avatar, bus, wallet } from "@/container";
import { WalletError, errorMessage } from "@/domain/errors";
import { parseSatsInput, toMoney } from "@/domain/money";
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
  const balance = useWalletStore((s) => s.balance);
  const [state, dispatch] = useReducer(sendReducer, { ...initialSendState, amountInput: params.amount ?? "" });
  const [authError, setAuthError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [busyMax, setBusyMax] = useState(false);
  const [open, setOpen] = useState<PendingOperation[]>([]);
  const [reconciling, setReconciling] = useState(false);
  const wantMax = useRef(params.max === "1");

  const loadOpen = useCallback(async () => setOpen(await wallet.unresolvedOperations()), []);
  useEffect(() => {
    void loadOpen();
    return () => avatar.cancel();
  }, [loadOpen]);

  const blocking = open.filter((o) => o.status === "unknown" || o.status === "submitting");

  const explainCheck = (reason: string) => t(`send.invalid.${reason}`);

  const goReview = async () => {
    dispatch({ type: "VALIDATE_STARTED" });
    let check;
    try {
      check = await wallet.validateDestination(state.input);
    } catch (e) {
      dispatch({ type: "VALIDATED", check: { valid: false, reason: "unrecognised", detail: errorMessage(e) } });
      return;
    }
    dispatch({ type: "VALIDATED", check });
    if (!check.valid) return;
    const amountText = check.fixedAmountSats ?? state.amountInput;
    const parsed = parseSatsInput(amountText);
    if (!parsed.ok) return dispatch({ type: "FORM_ERROR", message: t(`send.amount.${parsed.reason}`) });
    if (parsed.sats === 0n) return dispatch({ type: "FORM_ERROR", message: t("send.amount.zero") });
    dispatch({ type: "QUOTE_STARTED" });
    try {
      const quote = await wallet.quoteSend({ method: check.method, destination: check.destination, amountSats: toMoney(parsed.sats) });
      dispatch({ type: "QUOTED", quote });
      bus.emit({ type: "PAYMENT_REVIEW_READY", id: bus.nextId("review") });
    } catch (e) {
      if (e instanceof WalletError && e.code === "insufficient-funds") {
        dispatch({ type: "FORM_ERROR", message: t("send.insufficient", { short: formatAmount(e.message, unit) }) });
      } else {
        // No quote means no review: a fee is never guessed.
        dispatch({ type: "FORM_ERROR", message: t("send.quoteFailed", { detail: errorMessage(e) }) });
      }
    }
  };

  const fillMax = useCallback(async () => {
    setBusyMax(true);
    try {
      const max = await wallet.quoteMaxSend("ark");
      if (max.ok) dispatch({ type: "AMOUNT_CHANGED", amountInput: max.amountSats });
      else dispatch({ type: "FORM_ERROR", message: t(`send.max.${max.reason}`) });
    } catch (e) {
      dispatch({ type: "FORM_ERROR", message: t("send.quoteFailed", { detail: errorMessage(e) }) });
    } finally {
      setBusyMax(false);
    }
  }, [t]);

  useEffect(() => {
    if (wantMax.current) {
      wantMax.current = false;
      void fillMax();
    }
  }, [fillMax]);

  const submit = async () => {
    const quote = state.quote;
    if (!quote || state.phase !== "review") return;
    if (Date.now() - new Date(quote.quotedAt).getTime() > QUOTE_MAX_AGE_MS) {
      return dispatch({ type: "FORM_ERROR", message: t("send.quoteExpired") });
    }
    setAuthError(undefined);
    dispatch({ type: "USER_CONFIRMED" });
    const auth = await authenticateUser(t("send.authPrompt"));
    if (!auth.ok) {
      if (auth.reason !== "cancelled") setAuthError(t(auth.reason === "not-enrolled" ? "send.noLockBody" : "seed.authFailed"));
      return dispatch({ type: "AUTH_FAILED" });
    }
    const operationId = wallet.newOperationId();
    dispatch({ type: "AUTHORIZED", operationId });
    const outcome = await wallet.confirmSend(operationId, quote);
    dispatch({ type: "OUTCOME", outcome });
    void loadOpen();
  };

  const reconcile = async (operationId: string, own: boolean) => {
    setReconciling(true);
    try {
      const op = await wallet.reconcileById(operationId);
      if (own && op && op.status !== "submitting") {
        dispatch({ type: "RECONCILED", outcome: { status: op.status, movementId: op.movementId } });
      }
      await loadOpen();
    } finally {
      setReconciling(false);
    }
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) dispatch({ type: "INPUT_CHANGED", input: text.trim() });
  };

  const { phase } = state;
  const editing = phase === "editing" || phase === "validating" || phase === "quoting";
  const fixed = state.check?.valid ? state.check.fixedAmountSats : undefined;
  const inFlight = phase === "authorizing" || phase === "submitting";

  return (
    <Screen title={t("menu.send")} subtitle="SEND" hideBack={inFlight} onBack={inFlight ? () => undefined : undefined}>
      {editing ? <P muted>{t("send.step.edit")}</P> : null}
      {blocking.length > 0 && editing ? (
        <Panel tone="warning">
          <H>{t("send.openOps.title")}</H>
          <P>{t("send.openOps.body")}</P>
          {blocking.map((o) => (
            <View key={o.operationId} style={{ gap: 6 }}>
              <Row label={shorten(o.destination)} value={formatAmount(o.amountSats, unit)} />
              <Button label={t("send.reconcile")} kind="secondary" busy={reconciling} onPress={() => void reconcile(o.operationId, false)} />
            </View>
          ))}
        </Panel>
      ) : null}

      {editing && (
        <>
          <Panel>
            <H>{t("send.to")}</H>
            <TextInput
              value={state.input}
              onChangeText={(input) => dispatch({ type: "INPUT_CHANGED", input })}
              placeholder={t("send.toPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              style={[styles.input, styles.mono]}
              accessibilityLabel={t("send.to")}
            />
            <View style={styles.rowButtons}>
              <View style={{ flex: 1 }}><Button label={t("send.paste")} icon="copy" kind="secondary" onPress={() => void paste()} /></View>
              <View style={{ flex: 1 }}><Button label={t("send.scan")} icon="scan" kind="secondary" onPress={() => setScanning(true)} /></View>
            </View>
            <P muted>{t("send.methodsNote")}</P>
            <TermHelp term="ark" />
            {state.check && !state.check.valid ? <Notice tone="danger">{explainCheck(state.check.reason)}</Notice> : null}
            {state.check?.valid ? <Notice tone="info">{t("send.validFor", { method: t(`method.${state.check.method}`) })}</Notice> : null}
          </Panel>

          <Panel>
            <View style={styles.amountHeading}>
              <H>{t("send.amount")}</H>
              <Text style={styles.available}>{t("send.available", { amount: balance ? formatAmount(balance.spendableSats, unit) : t("home.balanceUnknown") })}</Text>
            </View>
            <View style={styles.amountRow}>
              <TextInput
                value={fixed ?? state.amountInput}
                editable={fixed === undefined}
                onChangeText={(amountInput) => dispatch({ type: "AMOUNT_CHANGED", amountInput })}
                onEndEditing={() => state.amountInput && bus.emit({ type: "AMOUNT_ENTERED", id: bus.nextId("amount") })}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                style={[styles.input, styles.amount]}
                accessibilityLabel={t("send.amount")}
              />
              <Text style={styles.unit}>sats</Text>
              {fixed === undefined ? <Pressable onPress={() => void fillMax()} disabled={busyMax} accessibilityRole="button" accessibilityLabel={t("send.max")} accessibilityHint={t("send.maxHint")} accessibilityState={{ disabled: busyMax, busy: busyMax }} style={({ pressed }) => [styles.max, { opacity: pressed || busyMax ? 0.6 : 1 }]}>
                {busyMax ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.maxText}>{t("send.max")}</Text>}
              </Pressable> : null}
            </View>
            {fixed !== undefined ? <P muted>{t("send.amountFixed")}</P> : null}
          </Panel>

          {state.formError ? <Notice tone="danger">{state.formError}</Notice> : null}
          <Button
            label={t("send.toReview")}
            onPress={() => void goReview()}
            busy={phase !== "editing"}
            disabled={state.input.trim() === "" || blocking.length > 0}
          />
        </>
      )}

      {(phase === "review" || phase === "authorizing") && state.quote && (
        <>
          <P muted>{t("send.step.review")}</P>
          <PaymentReview quote={state.quote} unit={unit} />
          {authError ? <Notice tone="warning">{authError}</Notice> : null}
          <Button label={t("send.confirm")} icon="shield" onPress={() => void submit()} busy={phase === "authorizing"} accessibilityHint={t("send.confirmHint")} />
          <Button label={t("send.edit")} kind="secondary" onPress={() => dispatch({ type: "BACK_TO_EDIT" })} disabled={phase === "authorizing"} />
        </>
      )}

      {phase === "submitting" && (
        <Panel>
          <H>{t("send.submitting.title")}</H>
          <P>{t("send.submitting.body")}</P>
          <Button label={t("send.submitting.title")} onPress={() => undefined} busy />
        </Panel>
      )}

      {phase === "succeeded" && state.quote && (
        <Panel tone="success">
          <H>{t("send.succeeded.title")}</H>
          <P>{t("send.succeeded.body", { amount: formatAmount(state.quote.amountSats, unit) })}</P>
          <Button label={t("send.seeArchive")} onPress={() => router.replace("/archive")} />
          <Button label={t("common.done")} kind="secondary" onPress={() => router.back()} />
        </Panel>
      )}

      {phase === "pending" && (
        <Panel tone="warning">
          <H>{t("send.pending.title")}</H>
          <P>{t("send.pending.body")}</P>
          <TermHelp term="payment" />
          <Button label={t("send.reconcile")} busy={reconciling} onPress={() => state.operationId && void reconcile(state.operationId, true)} />
          <Button label={t("common.done")} kind="secondary" onPress={() => router.back()} />
        </Panel>
      )}

      {phase === "unknown" && (
        <Panel tone="warning">
          <H>{t("send.unknown.title")}</H>
          <P>{t("send.unknown.body")}</P>
          <Notice tone="warning">{t("send.unknown.noResend")}</Notice>
          <TermHelp term="payment" />
          <Button label={t("send.reconcile")} busy={reconciling} onPress={() => state.operationId && void reconcile(state.operationId, true)} />
          <Button label={t("send.seeArchive")} kind="secondary" onPress={() => router.replace("/archive")} />
        </Panel>
      )}

      {phase === "failed" && (
        <Panel tone="danger">
          <H>{t("send.failed.title")}</H>
          <P>{t("send.failed.body")}</P>
          {state.failure ? <P muted>{state.failure}</P> : null}
          <Button label={t("send.tryAgain")} onPress={() => dispatch({ type: "BACK_TO_EDIT" })} />
          <Button label={t("common.done")} kind="secondary" onPress={() => router.back()} />
        </Panel>
      )}

      <QrScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={(data) => {
          setScanning(false);
          dispatch({ type: "INPUT_CHANGED", input: data.trim() });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: theme.colors.controlBorder, borderRadius: theme.radius.sm, color: theme.colors.text, fontSize: 16, padding: 12, minHeight: 48 },
  mono: { fontSize: 14, lineHeight: 20, minHeight: 84, textAlignVertical: "top" },
  amountHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  available: { color: theme.colors.textMuted, fontSize: 12, flexShrink: 1 },
  max: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.controlBorder, alignItems: "center", justifyContent: "center" },
  maxText: { color: theme.colors.primary, fontSize: 13, fontWeight: "600" },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  amount: { flex: 1, fontSize: 36, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { color: theme.colors.textMuted, fontSize: 16 },
  rowButtons: { flexDirection: "row", gap: 10 },
});
