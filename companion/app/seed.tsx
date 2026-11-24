import { userAction } from "@/components/companionEvents";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";
import { TermHelp } from "@/components/TermHelp";
import { Button, Notice, P, Screen } from "@/components/ui";
import { adapter, wallet } from "@/container";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { theme } from "@/theme";

type State = { kind: "locked" } | { kind: "asking" } | { kind: "shown"; words: string[] } | { kind: "error"; message: string };

/**
 * Saved seed display. The words come only from `wallet.revealSeed`, which authenticates on
 * every call, so opening this route directly shows nothing. They live in this component's
 * state and are dropped when the screen loses focus or the app leaves the foreground.
 */
export default function SeedScene() {
  const t = useT();
  usePreventScreenCapture();
  const { width, fontScale } = useWindowDimensions();
  const columns = fontScale > 1.5 ? 1 : fontScale > 1.15 || width < 380 ? 2 : 3;
  const focused = useRef(false);
  const request = useRef(0);
  const update = useSettings((s) => s.update);
  const showing = useRef(false);
  const [state, setState] = useState<State>({ kind: "locked" });

  useEffect(() => {
    const shown = state.kind === "shown";
    if (shown !== showing.current) userAction(shown ? "seed-shown" : "seed-hidden");
    showing.current = shown;
  }, [state.kind]);
  useEffect(() => () => { if (showing.current) userAction("seed-hidden"); }, []);

  const hide = useCallback(() => setState((s) => (s.kind === "shown" ? { kind: "locked" } : s)), []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; request.current += 1; setState({ kind: "locked" }); };
  }, []));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") { request.current += 1; setState({ kind: "locked" }); }
      else if (next !== "active") hide();
    });
    return () => sub.remove();
  }, [hide]);

  const reveal = async () => {
    const id = ++request.current;
    setState({ kind: "asking" });
    try {
      userAction("auth-asked");
      const result = await wallet.revealSeed(t("seed.authPrompt"));
      if (!focused.current || id !== request.current) return;
      if (AppState.currentState !== "active") { setState({ kind: "locked" }); return; }
      if (result.ok) setState({ kind: "shown", words: result.words });
      else if (result.reason === "cancelled") setState({ kind: "locked" });
      else setState({ kind: "error", message: t(result.reason === "not-enrolled" ? "seed.noLock" : result.reason === "missing" ? "seed.missing" : "seed.authFailed") });
    } catch {
      // Do not surface storage exceptions: the reveal path handles secret material.
      if (focused.current && id === request.current) setState({ kind: "error", message: t("seed.authFailed") });
    }
  };

  return (
    <Screen scene="seed" title={t("seed.title")}>
      <Notice tone="danger">{t("seed.warning")}</Notice>
      {state.kind === "error" ? <Notice tone="warning">{state.message}</Notice> : null}
      {state.kind === "shown" ? (
        <>
          <View style={styles.words}>
            {state.words.map((w, i) => (
              <View key={`${i}-${w}`} style={[styles.word, { width: columns === 1 ? "100%" : columns === 2 ? "48%" : "31%" }]}>
                <Text style={styles.index}>{i + 1}</Text>
                <Text style={styles.text}>{w}</Text>
              </View>
            ))}
          </View>
          <P muted>{t("seed.noScreenshot")}</P>
          <Button
            label={t("onb.wroteDown")}
            onPress={() => {
              setState({ kind: "locked" });
              update({ seedBackupConfirmed: true });
              if (router.canGoBack()) router.back();
              else router.replace("/settings");
            }}
          />
        </>
      ) : (
        <><P muted>{t(adapter.isMock ? "seed.mockUnavailable" : "seed.beforeReveal")}</P><Button disabled={adapter.isMock} label={t("settings.showSeed")} busy={state.kind === "asking"} onPress={() => void reveal()} /></>
      )}
      <TermHelp term="seed" />
      <TermHelp term="backup" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  words: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: { width: "31%", flexDirection: "row", gap: 6, alignItems: "center", borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.sm, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: theme.colors.backgroundRaised },
  index: { color: theme.colors.textMuted, fontSize: 11, width: 16, textAlign: "right" },
  text: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
});
