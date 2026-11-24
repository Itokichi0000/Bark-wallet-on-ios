import { Companion } from "./Companion";
import { useReduceMotion } from "@/game/useAvatarCue";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IS_MAINNET } from "@/config/network";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { Button, ModeBanner, NetworkTag, Notice, P } from "./ui";

/**
 * "Talk" in M1 means typing a command. There is no microphone code in this
 * build, and the sheet says so; push-to-talk speech recognition is M2.
 */
export function CommandSheet({ visible, onClose, onSubmit }: { visible: boolean; onClose(): void; onSubmit(text: string): void }) {
  const t = useT();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    onSubmit(value);
  };
  const examples = ["talk.example.balance", "talk.example.receive", "talk.example.send", "talk.example.archive"];
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("common.close")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom), maxHeight: "90%" }]} accessibilityViewIsModal>
          <ModeBanner />
          <NetworkTag />
          {IS_MAINNET ? <Notice tone="danger">{t("net.mainnetLong")}</Notice> : null}
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("talk.title")}</Text>
          <P muted>{t("talk.noMic")}</P>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder={t("talk.placeholder")}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            autoFocus
            returnKeyType="send"
            accessibilityLabel={t("talk.title")}
          />
          <View style={styles.examples}>
            {examples.map((k) => (
              <Pressable key={k} onPress={() => onSubmit(t(k))} style={styles.chip} accessibilityRole="button">
                <Text style={styles.chipText}>{t(k)}</Text>
              </Pressable>
            ))}
          </View>
          <Button label={t("talk.send")} onPress={submit} disabled={text.trim() === ""} />
          <Button label={t("common.close")} kind="secondary" onPress={onClose} />
          </ScrollView>
          {visible ? <Companion scene="home" /> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(5,3,12,0.6)" },
  sheet: { backgroundColor: theme.colors.panelSolid, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, padding: 18, gap: 12, borderWidth: 1, borderColor: theme.colors.outline },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: theme.colors.controlBorder, borderRadius: theme.radius.sm, color: theme.colors.text, fontSize: 16, padding: 12, minHeight: 48 },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: theme.colors.primary, fontSize: 13 },
});
