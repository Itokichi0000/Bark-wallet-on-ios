import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, H, Notice, P, Panel, Row, Screen } from "@/components/ui";
import { backup, wallet } from "@/container";
import type { PendingOperation } from "@/domain/payment";
import { useT } from "@/i18n";
import { BARK_SDK_VERSION, SIGNET } from "@/infrastructure/bark/barkConfig";
import { authenticateUser } from "@/infrastructure/secure/SecureSeedRepository";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { formatTime } from "@/utils/format";

function Toggle({ label, note, value, onChange }: { label: string; note?: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {note ? <Text style={styles.toggleNote}>{note}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: theme.colors.primaryStrong, false: theme.colors.disabled }} />
    </View>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange(v: T): void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((o) => (
          <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="radio" accessibilityState={{ selected: value === o.id }} style={[styles.choice, value === o.id && styles.choiceOn]}>
            <Text style={styles.choiceText}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** S07 Settings. */
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

  const revealSeed = async () => {
    setAuthError(undefined);
    const auth = await authenticateUser(t("seed.authPrompt"));
    if (auth.ok) router.push("/seed");
    else if (auth.reason === "not-enrolled") setAuthError(t("seed.noLock"));
    else if (auth.reason === "failed") setAuthError(t("seed.authFailed"));
  };

  const backupNow = async () => {
    setBusy("backup");
    await backup.backupNow();
    setBusy(null);
  };
  const exportBackup = async () => {
    setBusy("export");
    await backup.exportLatest().catch(() => false);
    setBusy(null);
  };

  const backupTone = b.status === "failed" ? "danger" : b.status === "current" && b.exportedGeneration >= b.generation ? "success" : "warning";

  return (
    <Screen title={t("settings.title")} subtitle="SETTINGS">
      <Panel>
        <H>{t("settings.network")}</H>
        <Row label={t("review.network")} value={t("net.signetLong")} valueStyle={{ color: theme.colors.warning }} />
        <P muted>{t("settings.networkNote")}</P>
      </Panel>

      <Panel>
        <H>{t("settings.security")}</H>
        <Button label={t("settings.showSeed")} kind="secondary" onPress={() => void revealSeed()} disabled={info?.isMock} />
        {authError ? <Notice tone="warning">{authError}</Notice> : null}
        {!s.seedBackupConfirmed && !info?.isMock ? <Notice tone="warning">{t("status.seedNotConfirmed")}</Notice> : null}
      </Panel>

      <Panel tone={b.status === "failed" ? "danger" : undefined}>
        <H>{t("settings.backup")}</H>
        {b.status === "unsupported" ? (
          <P muted>{t("backup.mock")}</P>
        ) : (
          <>
            <Notice tone={backupTone}>{t(`backup.status.${b.status}`)}</Notice>
            <Row label={t("backup.generation")} value={String(b.generation)} />
            <Row label={t("backup.lastSuccess")} value={b.lastSuccessAt ? formatTime(b.lastSuccessAt, s.language) : t("assets.none")} />
            <Row label={t("backup.exported")} value={b.generation === 0 ? t("assets.none") : b.exportedGeneration >= b.generation ? t("backup.exportedYes") : t("backup.exportedNo")} />
            {b.lastError ? <P muted>{b.lastError}</P> : null}
            <Button label={t("backup.now")} kind="secondary" busy={busy === "backup"} onPress={() => void backupNow()} />
            <Button label={t("backup.export")} busy={busy === "export"} disabled={b.generation === 0} onPress={() => void exportBackup()} />
            <P muted>{t("backup.explain2")}</P>
            <P muted>{t("backup.restoreUntested")}</P>
          </>
        )}
        <Button label={t("quest.q5.read")} kind="secondary" onPress={() => router.push("/quest")} />
      </Panel>

      <Panel>
        <H>{t("settings.experience")}</H>
        <Choice label={t("settings.language")} value={s.language} options={[{ id: "ja", label: "日本語" }, { id: "en", label: "English" }]} onChange={(language) => s.update({ language })} />
        <Choice label={t("settings.unit")} value={s.unit} options={[{ id: "sats", label: "sats" }, { id: "btc", label: "BTC" }]} onChange={(unit) => s.update({ unit })} />
        <Toggle label={t("settings.hideBalance")} value={s.balanceHidden} onChange={(balanceHidden) => s.update({ balanceHidden })} />
        <Toggle label={t("settings.speech")} note={t("settings.speechNote")} value={s.speechEnabled} onChange={(speechEnabled) => s.update({ speechEnabled })} />
        <Toggle label={t("settings.haptics")} value={s.hapticsEnabled} onChange={(hapticsEnabled) => s.update({ hapticsEnabled })} />
        <Toggle label={t("settings.avatarMotion")} value={s.avatarMotion} onChange={(avatarMotion) => s.update({ avatarMotion })} />
        <Toggle label={t("settings.reduceMotion")} note={t("settings.reduceMotionNote")} value={s.forceReduceMotion} onChange={(forceReduceMotion) => s.update({ forceReduceMotion })} />
        <P muted>{t("settings.voiceNote")}</P>
      </Panel>

      <Panel>
        <H>{t("settings.details")}</H>
        <Row label={t("settings.mode")} value={info?.isMock ? "MOCK" : "Bark SDK"} />
        <Row label="Bark SDK" value={`@secondts/bark-react-native ${BARK_SDK_VERSION}`} />
        <Row label={t("settings.server")} value={info?.serverAddress ?? SIGNET.serverAddress} mono />
        <Row label="Esplora" value={SIGNET.esploraAddress} mono />
        <Row label={t("settings.fingerprint")} value={info?.fingerprint ?? "—"} mono />
        <Row label={t("settings.openOps")} value={String(open.length)} />
        {lastSyncError ? <Row label={t("settings.lastSyncError")} value={lastSyncError} /> : null}
        <P muted>{t("settings.logNote")}</P>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  toggleLabel: { color: theme.colors.text, fontSize: 15 },
  toggleNote: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  choice: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.pill, paddingHorizontal: 16, minHeight: 44, justifyContent: "center" },
  choiceOn: { backgroundColor: theme.colors.primaryStrong, borderColor: theme.colors.primaryStrong },
  choiceText: { color: theme.colors.text, fontSize: 15 },
});
