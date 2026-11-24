import { useReduceMotion } from "@/game/useAvatarCue";
import { useEffect } from "react";
import { AppState } from "react-native";
import * as Haptics from "expo-haptics";
import { Stack, router } from "expo-router";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { autoSync, avatar, bootApp, bus, wallet } from "@/container";
import { questForEvent } from "@/game/quests";
import { translate } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";

export default function RootLayout() {
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    void bootApp().then((route) => (route ? router.replace(route as "/home") : undefined));

    const offQuests = bus.on((e) => {
      const quest = questForEvent(e);
      if (!quest || useSettings.getState().questsDone[quest]) return;
      useSettings.getState().completeQuest(quest);
    });

    // Speech and haptics follow the avatar's cues. Lines come from the fixed
    // catalogue; the seed is never a cue, so it can never be spoken.
    const offAvatar = avatar.subscribe((cue) => {
      const s = useSettings.getState();
      if (s.hapticsEnabled && cue.action === "celebrate") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      void Speech.stop();
      if (!cue.lineKey) return;
      if (s.speechEnabled && !(s.balanceHidden && cue.lineKey === "voice.balance")) {
        Speech.speak(translate(s.language, cue.lineKey, cue.lineParams), { language: s.language === "ja" ? "ja-JP" : "en-US", rate: 1.0 });
      }
    });

    const sub = AppState.addEventListener("change", (state) => {
      const lifecycle = useWalletStore.getState().lifecycle;
      if (state === "active" && (lifecycle === "ready" || lifecycle === "degraded")) {
        // Coming back: re-sync and resolve anything a kill or a suspend left open. Read-only for funds.
        void wallet.reconcileAll().then((ops) => (ops.length === 0 ? wallet.refresh() : undefined));
      }
      if (state === "active") autoSync.start();
      else autoSync.stop();
      if (state !== "active") void Speech.stop();
    });
    return () => {
      offQuests();
      offAvatar();
      sub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: reduceMotion ? "fade" : "default" }}>
          <Stack.Screen name="home" options={{ animation: "fade" }} />
          <Stack.Screen name="receive" options={{ animation: "fade" }} />
          <Stack.Screen name="send" options={{ animation: "fade" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
