import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { BitcoinIcon } from "./BitcoinIcon";

// Only static glossary keys enter this component. Never wallet data or seed words.
export type GlossaryTerm = "sync" | "network" | "ark" | "vtxo" | "expiry" | "fee" | "seed" | "backup" | "payment";
export function TermHelp({ term }: { term: GlossaryTerm }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const title = t(`help.${term}.title`);
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel={t("help.label", { term: title })} accessibilityState={{ expanded: open }} style={styles.trigger}>
        <BitcoinIcon name="question-circle" size={22} />
        <Text style={styles.title}>{title}</Text>
        <BitcoinIcon name={open ? "caret-up" : "caret-down"} size={16} />
      </Pressable>
      {open ? <Text style={styles.body} accessibilityLiveRegion="polite">{t(`help.${term}.body`)}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  trigger: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingVertical: 8 },
  title: { color: theme.colors.primary, fontSize: 13, flexShrink: 1 },
  body: { color: theme.colors.text, backgroundColor: theme.colors.backgroundRaised, borderRadius: theme.radius.sm, padding: 14, fontSize: 14, lineHeight: 22 },
});
