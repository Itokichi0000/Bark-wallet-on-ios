import { userAction } from "@/components/companionEvents";
import { TermHelp } from "@/components/TermHelp";
import { Disclosure } from "@/components/Disclosure";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, H, Notice, P, Panel, Row, Screen, NET_LONG_KEY } from "@/components/ui";
import { backup, wallet } from "@/container";
import type { PendingOperation } from "@/domain/payment";
import { useT } from "@/i18n";
import { ACTIVE_NETWORK, IS_MAINNET, NET, switchNetworkAndReload } from "@/config/network";
import type { NetworkName as NetworkId } from "@/domain/wallet";
import { authorize as authenticateUser } from "@/container";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { formatTime } from "@/utils/format";
import { VOICE_PREVIEW_LINE, noaVoice } from "@/voice/NoaVoice";

function Toggle({ label, note, value, onChange }: { label: string; note?: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {note ? <Text style={styles.toggleNote}>{note}</Text> : null}
      </View>
      <Switch hitSlop={{ top: 8, bottom: 8 }} value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: theme.colors.primaryStrong, false: theme.colors.disabled }} />
    </View>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange(v: T): void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="radio" accessibilityState={{ selected: value === o.id }} style={[styles.choice, value === o.id && styles.choiceOn]}>
            <Text style={[styles.choiceText, value === o.id && { color: theme.colors.background }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** S07 Settings. */
/** Lets the owner hear the voice they just picked. Plays a fixed line; silent when the switch is on silent. */
function previewVoice(voice: "off" | "a" | "b" | "c") {
  if (voice === "off") noaVoice.stop();
  else noaVoice.say(voice, VOICE_PREVIEW_LINE);
}

export default function SettingsScene() {
  const t = useT();
  const s = useSettings();
  const { info, backup: b, lastSyncError } = useWalletStore();
  const [busy, setBusy] = useState<"backup" | "export" | null>(null);
  const [authError, setAuthError] = useState<string>();
  const [open, setOpen] = useState<PendingOperation[]>([]);

  useEffect(() => {
    void wallet.unresolvedOperations().then(setOpen);
  }, []);


  const [switching, setSwitching] = useState(false);
  const doSwitch = async (target: NetworkId) => {
    setAuthError(undefined);
    userAction("auth-asked");
    const auth = await authenticateUser(t("settings.switch.authPrompt"));
    if (!auth.ok && auth.reason !== "not-enrolled") {
      if (auth.reason === "failed") setAuthError(t("seed.authFailed"));
      return;
    }
    setSwitching(true);
    try {
      // The open wallet is closed first; the app then restarts with everything built for the other network.
      userAction("setting-changed");
      await wallet.shutdown();
      await switchNetworkAndReload(target);
    } catch (e) {
      setSwitching(false);
      setAuthError(t("settings.switch.failed", { detail: e instanceof Error ? e.message : String(e) }));
    }
  };
  const askSwitch = (target: NetworkId) => {
    if (target === ACTIVE_NETWORK || switching) return;
    Alert.alert(
      t(target === "mainnet" ? "settings.switch.toMainnetTitle" : "settings.switch.toSignetTitle"),
      t(target === "mainnet" ? "settings.switch.toMainnetBody" : "settings.switch.toSignetBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("settings.switch.confirm"), style: target === "mainnet" ? "destructive" : "default", onPress: () => void doSwitch(target) },
      ],
    );
  };

  const backupNow = async () => {
    setBusy("backup");
    try { await backup.backupNow(); } finally { setBusy(null); }
  };
  const exportBackup = async () => {
    setBusy("export");
    await backup.exportLatest().then((offered) => { if (offered) userAction("backup-exported"); }).catch(() => false);
    setBusy(null);
  };

  const backupTone = b.status === "failed" ? "danger" : b.status === "current" && b.exportedGeneration >= b.generation ? "success" : "warning";

  return (
    <Screen scene="settings" title={t("settings.title")} subtitle="SETTINGS">
      <Panel tone={b.status === "failed" ? "danger" : undefined}>
        <H>{t("settings.backup")}</H>
        {b.status === "unsupported" ? (
          <P muted>{t("backup.mock")}</P>
        ) : (
          <>
            <Notice tone={backupTone}>{t(`backup.status.${b.status}`)}</Notice>
            <Row label={t("backup.exported")} value={b.generation === 0 ? t("assets.none") : b.exportedGeneration >= b.generation ? t("backup.exportedYes") : t("backup.exportedNo")} />
            {b.lastError ? <P muted>{b.lastError}</P> : null}
            <Button label={t("backup.now")} kind={b.generation === 0 ? "primary" : "secondary"} disabled={busy !== null} busy={busy === "backup"} onPress={() => void backupNow()} />
            <Button label={t("backup.export")} icon="share" kind={b.generation === 0 ? "secondary" : "primary"} busy={busy === "export"} disabled={b.generation === 0 || busy !== null} onPress={() => void exportBackup()} />
            <TermHelp term="backup" />
            <Disclosure title={t("common.details")}>
              <Row label={t("backup.generation")} value={String(b.generation)} />
              <Row label={t("backup.lastSuccess")} value={b.lastSuccessAt ? formatTime(b.lastSuccessAt, s.language) : t("assets.none")} />
              <P muted>{t("backup.explain2")}</P>
            </Disclosure>
            <P muted>{t("backup.restoreUntested")}</P>
          </>
        )}
        <Button label={t("quest.q5.read")} kind="secondary" onPress={() => router.push("/quest")} />
      </Panel>

      <Panel>
        <H>{t("settings.security")}</H>
        <Button label={t("settings.showSeed")} kind="secondary" onPress={() => router.push("/seed")} disabled={info?.isMock} />
        {info?.isMock ? <P muted>{t("seed.mockUnavailable")}</P> : null}
        <TermHelp term="seed" />
        {authError ? <Notice tone="warning">{authError}</Notice> : null}
        {!s.seedBackupConfirmed && !info?.isMock ? <Notice tone="warning">{t("status.seedNotConfirmed")}</Notice> : null}
      </Panel>

      <Panel>
        <H>{t("settings.experience")}</H>
        <Choice label={t("settings.language")} value={s.language} options={[{ id: "ja", label: "日本語" }, { id: "en", label: "English" }]} onChange={(language) => { s.update({ language }); userAction("setting-changed"); }} />
        <Choice label={t("settings.unit")} value={s.unit} options={[{ id: "sats", label: "sats" }, { id: "btc", label: "BTC" }]} onChange={(unit) => { s.update({ unit }); userAction("unit-changed"); }} />
        <Toggle label={t("settings.hideBalance")} value={s.balanceHidden} onChange={(balanceHidden) => { s.update({ balanceHidden }); userAction(balanceHidden ? "balance-hidden" : "balance-shown"); }} />
        <Choice label={t("settings.noaVoice")} value={s.noaVoice} options={[{ id: "off", label: t("settings.noaVoice.off") }, { id: "a", label: t("settings.noaVoice.a") }, { id: "b", label: t("settings.noaVoice.b") }, { id: "c", label: t("settings.noaVoice.c") }]} onChange={(noaVoice) => { s.update({ noaVoice }); previewVoice(noaVoice); }} />
        <P muted>{t("settings.noaVoiceNote")}</P>
        <Toggle label={t("settings.speech")} note={t("settings.speechNote")} value={s.speechEnabled} onChange={(speechEnabled) => { s.update({ speechEnabled }); userAction("setting-changed"); }} />
        <Toggle label={t("settings.haptics")} value={s.hapticsEnabled} onChange={(hapticsEnabled) => { s.update({ hapticsEnabled }); userAction("setting-changed"); }} />
        <Toggle label={t("settings.avatarMotion")} value={s.avatarMotion} onChange={(avatarMotion) => { s.update({ avatarMotion }); userAction("setting-changed"); }} />
        <Toggle label={t("settings.reduceMotion")} note={t("settings.reduceMotionNote")} value={s.forceReduceMotion} onChange={(forceReduceMotion) => { s.update({ forceReduceMotion }); userAction("setting-changed"); }} />
        <P muted>{t("settings.voiceNote")}</P>
      </Panel>

      <Panel>
        <H>{t("settings.network")}</H>
        <Row label={t("review.network")} value={t(NET_LONG_KEY)} valueStyle={{ color: IS_MAINNET ? theme.colors.danger : theme.colors.warning }} />
        <Choice<NetworkId>
          label={t("settings.switch.label")}
          value={ACTIVE_NETWORK}
          options={[{ id: "signet", label: "Signet" }, { id: "mainnet", label: "Mainnet" }]}
          onChange={askSwitch}
        />
        {IS_MAINNET ? <Notice tone="danger">{t("settings.mainnetWarning")}</Notice> : null}
        <P muted>{t("settings.networkNote")}</P>
        <TermHelp term="network" />
      </Panel>

      <Disclosure title={t("settings.details")}>
        <Row label={t("settings.mode")} value={info?.isMock ? "MOCK" : "Bark SDK"} />
        <Row label="Bark SDK" value={info?.sdkVersion ?? t("assets.unknown")} />
        <Row label={t("settings.server")} value={info?.serverAddress ?? NET.serverAddress} mono />
        <Row label="Esplora" value={NET.esploraAddress} mono />
        <Row label={t("settings.fingerprint")} value={info?.fingerprint ?? "—"} mono />
        <Row label={t("settings.openOps")} value={String(open.length)} />
        {lastSyncError ? <Row label={t("settings.lastSyncError")} value={lastSyncError} /> : null}
        <P muted>{t("settings.logNote")}</P>
      </Disclosure>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  toggleLabel: { color: theme.colors.text, fontSize: 15 },
  toggleNote: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  choice: { borderWidth: 1, borderColor: theme.colors.controlBorder, borderRadius: theme.radius.pill, paddingHorizontal: 16, minHeight: 44, justifyContent: "center" },
  choiceOn: { backgroundColor: theme.colors.primaryStrong, borderColor: theme.colors.primaryStrong },
  choiceText: { color: theme.colors.text, fontSize: 15 },
});
