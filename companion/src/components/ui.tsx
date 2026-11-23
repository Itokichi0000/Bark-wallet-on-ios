import type { ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { container } from "@/components/containerHooks";
import { useT } from "@/i18n";
import { theme } from "@/theme";

const c = theme.colors;

export function Screen({ title, subtitle, children, scroll = true, onBack, footer }: {
  title: string; subtitle?: string; children: ReactNode; scroll?: boolean; onBack?: () => void; footer?: ReactNode;
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
        <Pressable onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/home")))} accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹ {t("common.back")}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <NetworkTag />
      </View>
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** Always visible: which network this is, and whether the numbers are a mock. */
export function NetworkTag() {
  const t = useT();
  return (
    <View style={styles.netTag} accessible accessibilityLabel={t("net.signetLong")}>
      <Text style={styles.netTagText}>SIGNET</Text>
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

export function Button({ label, onPress, kind = "primary", disabled, busy, accessibilityHint }: {
  label: string; onPress(): void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean; busy?: boolean; accessibilityHint?: string;
}) {
  const off = disabled || busy;
  const bg = off ? c.disabled : kind === "primary" ? c.primaryStrong : kind === "danger" ? c.danger : "transparent";
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: kind === "secondary" ? c.outline : bg, opacity: pressed ? 0.8 : 1 }]}
    >
      {busy ? <ActivityIndicator color={c.text} /> : <Text style={[styles.buttonText, kind === "danger" && { color: c.background }]}>{label}</Text>}
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
  const glyph = tone === "warning" ? "▲" : tone === "danger" ? "✕" : tone === "success" ? "✓" : "ℹ";
  return (
    <View style={[styles.notice, { borderColor: color }]} accessibilityRole={tone === "danger" || tone === "warning" ? "alert" : undefined}>
      <Text style={[styles.noticeGlyph, { color }]}>{glyph}</Text>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  back: { paddingVertical: 6, paddingRight: 4 },
  backText: { color: c.primary, fontSize: 16 },
  title: { color: c.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: c.textMuted, fontSize: 11, letterSpacing: 2 },
  body: { padding: 16, gap: 14 },
  footer: { padding: 16, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.outline },
  netTag: { borderWidth: 1, borderColor: c.warning, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  netTagText: { color: c.warning, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  mock: { backgroundColor: c.warning, paddingVertical: 4, paddingHorizontal: 12 },
  mockText: { color: c.background, fontSize: 12, fontWeight: "700", textAlign: "center" },
  panel: { backgroundColor: c.panel, borderWidth: 1, borderRadius: theme.radius.md, padding: 14, gap: 8 },
  button: { minHeight: 50, borderRadius: theme.radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  buttonText: { color: c.text, fontSize: 16, fontWeight: "700" },
  row: { gap: 2 },
  rowLabel: { color: c.textMuted, fontSize: 12 },
  rowValue: { color: c.text, fontSize: 15, fontVariant: ["tabular-nums"] },
  mono: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 13, lineHeight: 20 },
  p: { color: c.text, fontSize: 15, lineHeight: 22 },
  h: { color: c.primary, fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  notice: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: theme.radius.sm, padding: 12, backgroundColor: c.backgroundRaised },
  noticeGlyph: { fontSize: 15, fontWeight: "700" },
  noticeText: { color: c.text, fontSize: 14, lineHeight: 20, flex: 1 },
});
