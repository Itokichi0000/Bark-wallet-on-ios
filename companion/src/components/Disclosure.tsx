import { userAction } from "./companionEvents";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BitcoinIcon } from "./BitcoinIcon";
import { theme } from "@/theme";

/** Inline disclosure: stays in the scroll flow, no motion or modal focus trap. */
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => { if (!open) userAction("details-opened"); setOpen(!open); }} style={styles.trigger}>
        <Text style={styles.title}>{title}</Text>
        <BitcoinIcon name={open ? "caret-up" : "caret-down"} size={20} />
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outline },
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  title: { flex: 1, color: theme.colors.primary, fontSize: 14, fontWeight: "600" },
  content: { gap: 12, paddingBottom: 8 },
});
