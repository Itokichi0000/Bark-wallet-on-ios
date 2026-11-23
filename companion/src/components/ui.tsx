import { IS_MAINNET } from "@/config/network";
import type { ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { container } from "@/components/containerHooks";
import { useT } from "@/i18n";
import { theme } from "@/theme";

import { BitcoinIcon, type BitcoinIconName } from "./BitcoinIcon";

const c = theme.colors;

export function Screen({ title, children, scroll = true, onBack, footer, hideBack = false }: {
  title: string; subtitle?: string; children: ReactNode; scroll?: boolean; onBack?: () => void; footer?: ReactNode; hideBack?: boolean;
}) {
  const t = useT();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  ) : (
    <View style={[styles.body, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ModeBanner />
      <View style={styles.header}>
        {!hideBack ? <Pressable onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/home")))} accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={12} style={styles.back}>
          <BitcoinIcon name="caret-left" />
        </Pressable> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
        </View>
        <NetworkTag />
      </View>
      {IS_MAINNET ? <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}><Notice tone="danger">{t("net.mainnetLong")}</Notice></View> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>{body}</KeyboardAvoidingView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export const NET_LONG_KEY = IS_MAINNET ? "net.mainnetLong" : "net.signetLong";

/** Always visible: which network this is, and whether the numbers are a mock. */
export function NetworkTag() {
  const t = useT();
  return (
    <View style={[styles.netTag, IS_MAINNET && { borderColor: theme.colors.danger }]} accessible accessibilityLabel={t(NET_LONG_KEY)}>
      <Text style={[styles.netTagText, IS_MAINNET && { color: theme.colors.danger }]}>{IS_MAINNET ? "MAINNET" : "SIGNET"}</Text>
    </View>
  );
}

export function ModeBanner() {
  const t = useT();
  if (!container().adapter.isMock) return null;
  return (
    <View style={styles.mock} accessibilityRole="alert">
      <Text style={styles.mockText}>{t("mock.banner")}</Text>
    </View>
  );
}

export function Panel({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "default" | "warning" | "danger" | "success" }) {
  const border = tone === "warning" ? c.warning : tone === "danger" ? c.danger : tone === "success" ? c.success : c.outline;
  return <View style={[styles.panel, { borderColor: border }, style]}>{children}</View>;
}

export function Button({ label, onPress, kind = "primary", disabled, busy, accessibilityHint, icon }: {
  label: string; onPress(): void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean; busy?: boolean; accessibilityHint?: string; icon?: BitcoinIconName;
}) {
  const off = disabled || busy;
  const bg = off ? c.disabled : kind === "primary" ? c.primaryStrong : kind === "danger" ? c.danger : "transparent";
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: kind === "secondary" ? c.controlBorder : bg, opacity: pressed ? 0.8 : 1 }]}
    >
      {icon && !busy ? <BitcoinIcon name={icon} color={kind === "primary" || kind === "danger" ? c.background : c.primary} /> : null}
      {busy ? <ActivityIndicator color={c.text} /> : <Text style={[styles.buttonText, (kind === "danger" || kind === "primary") && !off && { color: c.background }]}>{label}</Text>}
    </Pressable>
  );
}

export function Row({ label, value, mono, strong, valueStyle }: { label: string; value: string; mono?: boolean; strong?: boolean; valueStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text selectable style={[styles.rowValue, mono && styles.mono, strong && { fontWeight: "700", fontSize: 18 }, valueStyle]}>{value}</Text>
    </View>
  );
}

export function P({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.p, muted && { color: c.textMuted }, style]}>{children}</Text>;
}

export function H({ children }: { children: ReactNode }) {
  return <Text style={styles.h} accessibilityRole="header">{children}</Text>;
}

/** Icon + words, never colour alone. */
export function Notice({ tone, children }: { tone: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  const color = tone === "warning" ? c.warning : tone === "danger" ? c.danger : tone === "success" ? c.success : c.primary;
  const icon = tone === "warning" ? "alert" : tone === "danger" ? "alert" : tone === "success" ? "check" : "info-circle";
  return (
    <View style={[styles.notice, { borderColor: color }]} accessibilityRole={tone === "danger" || tone === "warning" ? "alert" : undefined}>
      <BitcoinIcon name={icon} size={20} color={color} />
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  back: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  title: { color: c.text, fontSize: 22, fontWeight: "700" },
  body: { padding: 20, paddingBottom: 32, gap: 18, width: "100%", maxWidth: 620, alignSelf: "center" },
  footer: { padding: 16, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.outline },
  netTag: { borderWidth: 1, borderColor: c.warning, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  netTagText: { color: c.warning, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  mock: { backgroundColor: c.warning, paddingVertical: 4, paddingHorizontal: 12 },
  mockText: { color: c.background, fontSize: 12, fontWeight: "700", textAlign: "center" },
  panel: { backgroundColor: c.panel, borderWidth: 1, borderRadius: theme.radius.md, padding: 18, gap: 14 },
  button: { minHeight: 54, flexDirection: "row", gap: 8, paddingVertical: 12, borderRadius: theme.radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  buttonText: { color: c.text, fontSize: 16, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  row: { gap: 5 },
  rowLabel: { color: c.textMuted, fontSize: 12 },
  rowValue: { color: c.text, fontSize: 15, fontVariant: ["tabular-nums"] },
  mono: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 13, lineHeight: 20 },
  p: { color: c.text, fontSize: 15, lineHeight: 22 },
  h: { color: c.text, fontSize: 16, fontWeight: "700" },
  notice: { flexDirection: "row", gap: 10, borderLeftWidth: 3, borderRadius: theme.radius.sm, padding: 12, backgroundColor: c.backgroundRaised },
  noticeText: { color: c.text, fontSize: 14, lineHeight: 20, flex: 1 },
});
