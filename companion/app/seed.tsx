import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";
import { Button, Notice, P, Screen } from "@/components/ui";
import { useT } from "@/i18n";
import { SecureSeedRepository } from "@/infrastructure/secure/SecureSeedRepository";
import { useSettings } from "@/state/settingsStore";
import { theme } from "@/theme";

/** Reached only from Settings after device authentication. The words live in this component's state and nowhere else. */
export default function SeedScene() {
  const t = useT();
  usePreventScreenCapture();
  const update = useSettings((s) => s.update);
  const [words, setWords] = useState<string[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    void SecureSeedRepository.read().then((m) => {
      if (!alive) return;
      if (m) setWords(m.split(" "));
      else setMissing(true);
    });
    return () => {
      alive = false;
      setWords([]);
    };
  }, []);

  return (
    <Screen title={t("seed.title")} subtitle="SEED">
      <Notice tone="danger">{t("seed.warning")}</Notice>
      {missing ? <Notice tone="danger">{t("seed.missing")}</Notice> : null}
      <View style={styles.words}>
        {words.map((w, i) => (
          <View key={`${i}-${w}`} style={styles.word}>
            <Text style={styles.index}>{i + 1}</Text>
            <Text style={styles.text}>{w}</Text>
          </View>
        ))}
      </View>
      <P muted>{t("seed.noScreenshot")}</P>
      <P muted>{t("backup.explain1")}</P>
      <Button
        label={t("onb.wroteDown")}
        disabled={words.length === 0}
        onPress={() => {
          update({ seedBackupConfirmed: true });
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  words: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: { width: "31%", flexDirection: "row", gap: 6, alignItems: "center", borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.sm, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: theme.colors.backgroundRaised },
  index: { color: theme.colors.textMuted, fontSize: 11, width: 16, textAlign: "right" },
  text: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
});
