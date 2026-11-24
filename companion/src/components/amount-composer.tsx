import type { ReactNode } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View, type TextInputProps } from "react-native";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { ReplyComposer } from "./conversation";

/** Shared player reply for send amounts and fixed Lightning receive requests. */
export function AmountComposer({ amountUnit, keyboardOpen, onUnitChange, helper, children, ...props }: TextInputProps & {
  amountUnit: "sats" | "btc"; keyboardOpen: boolean; onUnitChange(): void;
  onSend(): void; submitLabel: string; disabled?: boolean; replyText: string;
  helper?: ReactNode; children?: ReactNode;
}) {
  const t = useT();
  // Group the literal decimal string without Number conversion (or loss of sats precision).
  const grouped = (props.value || "0").replace(/^(\d+)(.*)$/, (_, integer: string, fraction: string) => `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction}`);
  const unitButton = <Pressable accessibilityRole="button" accessibilityLabel={t("home.unit")} accessibilityState={{ disabled: !!props.disabled }} disabled={props.disabled} onPress={onUnitChange} style={styles.unitButton}>
    <Text style={styles.unit}>{amountUnit === "btc" ? "BTC" : "sats"} ⇄</Text>
  </Pressable>;
  return <ReplyComposer {...props} autoFocus={props.autoFocus ?? props.editable !== false} returnKeyType="done" placeholder="0" keyboardType={amountUnit === "btc" ? "decimal-pad" : "number-pad"}
    inputAccessoryViewButtonLabel={t("stage.dismissKeyboard")} onSubmitEditing={Keyboard.dismiss}
    inputAccessory={unitButton}
    style={[styles.amount, keyboardOpen && { fontSize: 28 }]} accessibilityLabel={`${t("send.amount")} (${amountUnit === "btc" ? "BTC" : "sats"})`}>
    {/* While typing, the input/unit already show the value and the HUD shows
        spendable balance. Give that duplicate summary space back to the face. */}
    {!keyboardOpen ? <View style={styles.helpers}>
      <View style={styles.summary}><Text style={styles.preview}>{grouped} {amountUnit === "btc" ? "BTC" : "sats"}</Text>{children}</View>
      {helper}
    </View> : null}
  </ReplyComposer>;
}
const styles = StyleSheet.create({
  helpers: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  amount: { fontSize: theme.presence.amountSize, fontWeight: "700", fontVariant: ["tabular-nums"] },
  summary: { flex: 1, minWidth: 0 },
  preview: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, paddingHorizontal: theme.spacing.sm },
  unitButton: { minHeight: theme.presence.touch, minWidth: theme.presence.touch, justifyContent: "center", paddingHorizontal: theme.spacing.sm },
  unit: { color: theme.colors.primary, fontSize: theme.presence.replySize },
});
