import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { NET } from "@/config/network";
import { wallet } from "@/container";
import { errorMessage } from "@/domain/errors";
import type { LightningInvoiceRequest, LightningReceiveState } from "@/domain/wallet";
import type { LightningReceiveStage } from "@/game/dialogue";

/** Screen lifecycle only. Receipt/success still belongs to PAYMENT_RECEIVED. */
export function useLightningReceive(received: boolean) {
  const [stage, setStage] = useState<LightningReceiveStage>();
  const [invoice, setInvoice] = useState<LightningInvoiceRequest>();
  const [error, setError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const request = useRef(0);
  const creating = useRef(false);
  const checking = useRef(false);
  const lastStatus = useRef<LightningReceiveState>("awaiting");
  const settled = useRef<string | undefined>(undefined);
  useEffect(() => () => { request.current++; }, []);

  const reset = (next?: "amount") => {
    request.current++;
    creating.current = false;
    setStage(next); setInvoice(undefined); setError(undefined); setUncertain(false);
    lastStatus.current = "awaiting";
  };
  const create = async (amountSats: string) => {
    if (!wallet.lightningAvailable || NET.network !== "signet" || creating.current) return;
    creating.current = true;
    const serial = ++request.current;
    setStage("preparing"); setError(undefined); setInvoice(undefined); setUncertain(false);
    lastStatus.current = "awaiting";
    try {
      const next = await wallet.newLightningInvoice(amountSats);
      if (serial !== request.current) return;
      setInvoice(next); setStage("showing");
    } catch (e) {
      if (serial === request.current) { setError(errorMessage(e)); setStage("error"); }
    } finally { if (serial === request.current) creating.current = false; }
  };

  const polling = stage === "showing" || stage === "claiming";
  useFocusEffect(useCallback(() => {
    if (!wallet.lightningAvailable || NET.network !== "signet" || !invoice || received || !polling) return;
    const serial = request.current;
    let alive = true;
    let active = AppState.currentState === "active";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = () => !!invoice.expiresAt && Date.parse(invoice.expiresAt) <= Date.now();
    const stopAtExpiry = () => {
      if (!expired()) return false;
      if (lastStatus.current === "awaiting") setStage("expired");
      // An ambiguous result must not be relabelled as expired/failed or received.
      else setUncertain(lastStatus.current !== "settled");
      return true;
    };
    const schedule = () => {
      if (!alive || !active || serial !== request.current) return;
      const remaining = invoice.expiresAt ? Date.parse(invoice.expiresAt) - Date.now() : Infinity;
      clearTimeout(timer);
      timer = setTimeout(() => void poll(), Math.min(3000, Number.isFinite(remaining) ? Math.max(1, remaining) : 3000));
    };
    const poll = async () => {
      if (!alive || !active || serial !== request.current || settled.current === invoice.paymentHash || stopAtExpiry()) return;
      if (checking.current) { schedule(); return; }
      checking.current = true;
      let status: LightningReceiveState;
      try { status = await wallet.checkLightningReceive(invoice.paymentHash); }
      catch { status = "unknown"; }
      finally { checking.current = false; }
      if (status === "settled") settled.current = invoice.paymentHash;
      if (!alive || !active || serial !== request.current) return;
      lastStatus.current = status;
      setUncertain(status === "unknown");
      if (status === "claiming" || status === "settled") setStage("claiming");
      if (status === "settled" || stopAtExpiry()) return;
      schedule();
    };
    void poll();
    const subscription = AppState.addEventListener("change", (state) => {
      active = state === "active";
      clearTimeout(timer);
      if (active) void poll();
    });
    return () => { alive = false; clearTimeout(timer); subscription.remove(); };
  }, [invoice, received, polling]));
  return { stage, invoice, error, uncertain, reset, create };
}
