import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Button, ModeBanner, Notice, P, NET_LONG_KEY } from "@/components/ui";
import { wallet } from "@/container";
import { useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";

/** S00 Boot: checks what exists, then routes. It never creates a wallet or sends anything. */
export default function BootScene() {
  const t = useT();
  const lifecycle = useWalletStore((s) => s.lifecycle);
  const fatal = useWalletStore((s) => s.fatalError);
  const reduceMotion = useReduceMotion();
  const spin = useSharedValue(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!reduceMotion) spin.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [reduceMotion, spin]);

  useEffect(() => {
    if (lifecycle === "not-created") router.replace("/onboarding");
    else if (lifecycle === "ready" || lifecycle === "degraded") router.replace("/home");
  }, [lifecycle]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  if (lifecycle === "error") {
    const known = fatal === "orphan-database" || fatal === "seed-without-database";
    return (
      <View style={styles.wrap}>
        <ModeBanner />
        <Text style={styles.brand}>BARK//COMPANION</Text>
        <Notice tone="danger">{known ? t(`boot.error.${fatal}`) : t("boot.error.generic", { detail: fatal ?? "" })}</Notice>
        <P muted>{t("boot.error.noAutoCreate")}</P>
        <Button label={t("common.retry")} onPress={() => void wallet.boot()} />
        {fatal === "seed-without-database" ? <Button label={t("boot.toRecovery")} kind="secondary" onPress={() => router.push("/recovery")} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ModeBanner />
      <Animated.View style={[styles.ring, ring]} />
      <Text style={styles.brand}>BARK//COMPANION</Text>
      <Text style={styles.status} accessibilityLiveRegion="polite">{t(`boot.${lifecycle}`)}</Text>
      <Text style={styles.net}>{t(NET_LONG_KEY)}</Text>
      {slow ? <P muted style={{ textAlign: "center" }}>{t("boot.slow")}</P> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 28, gap: 18 },
  ring: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: theme.colors.primary, borderTopColor: "transparent", borderLeftColor: theme.colors.outline },
  brand: { color: theme.colors.text, fontSize: 20, letterSpacing: 4, fontWeight: "700" },
  status: { color: theme.colors.textMuted, fontSize: 14 },
  net: { color: theme.colors.warning, fontSize: 12, textAlign: "center" },
});
