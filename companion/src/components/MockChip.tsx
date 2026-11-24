import { Pressable, StyleSheet, Text } from "react-native";
import { useT } from "@/i18n";
import { theme } from "@/theme";

/** A test tool, visually separate from Noa's conversational replies. */
export function MockChip({ label, onPress }: { label: string; onPress(): void }) {
  const t = useT();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.65 }]}>
    <Text style={styles.badge}>{t("stage.mockOnly")}</Text><Text style={styles.label}>{t("mock.short")}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: theme.colors.warning, backgroundColor: theme.colors.backgroundRaised, flexShrink: 1 },
  badge: { color: theme.colors.warning, fontSize: 10, lineHeight: 13, fontWeight: "800", letterSpacing: 1 },
  label: { color: theme.colors.warning, fontSize: 12, lineHeight: 16, fontWeight: "600" },
});
