import { usePreventScreenCapture } from "expo-screen-capture";
import { TermHelp } from "@/components/TermHelp";
import { useCallback, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect } from "expo-router";
import { Button, H, Notice, P, Panel, Row, Screen, NET_LONG_KEY } from "@/components/ui";
import { adapter, isValidMnemonic, normalizeMnemonic, wallet, restoreBackup } from "@/container";
import { errorMessage } from "@/domain/errors";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { theme } from "@/theme";

type Mode = "choose" | "backup" | "seed-only";

/** S09 Recovery: restore from an encrypted database backup plus the seed, or from the seed alone with its limits spelled out. */
export default function RecoveryScene() {
  const t = useT();
  usePreventScreenCapture();
  const update = useSettings((s) => s.update);
  const [mode, setMode] = useState<Mode>("choose");
  const [phrase, setPhrase] = useState("");
  const [file, setFile] = useState<{ uri: string; name: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useFocusEffect(useCallback(() => () => setPhrase(""), []));

  const valid = isValidMnemonic(phrase);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset) setFile({ uri: asset.uri, name: asset.name });
  };

  const finish = () => {
    setPhrase("");
    update({ introSeen: true, seedBackupConfirmed: true });
    router.replace("/home");
  };

  const restoreFromBackup = async () => {
    if (!file || !valid) return;
    setBusy(true);
    setError(undefined);
    try {
      const mnemonic = normalizeMnemonic(phrase);
      const result = await restoreBackup(file.uri, mnemonic);
      if (!result.ok) {
        setError(t(`recovery.error.${result.reason}`));
        return;
      }
      await wallet.openRestored(mnemonic);
      finish();
    } catch (e) {
      setError(t("recovery.error.io") + " " + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const restoreFromSeed = async () => {
    if (!valid) return;
    setBusy(true);
    setError(undefined);
    try {
      // Creating a wallet for an existing seed makes the SDK run its seed recovery against the Ark server.
      await wallet.create(normalizeMnemonic(phrase));
      finish();
    } catch (e) {
      setError(t("recovery.error.seedOnly", { detail: errorMessage(e) }));
    } finally {
      setBusy(false);
    }
  };

  const phraseInput = (
    <Panel>
      <H>{t("recovery.phrase")}</H>
      <TermHelp term="seed" />
      <TextInput
        value={phrase}
        onChangeText={setPhrase}
        placeholder={t("recovery.phrasePlaceholder")}
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        secureTextEntry
        textContentType="none"
        style={styles.input}
        accessibilityLabel={t("recovery.phrase")}
      />
      {phrase.trim() !== "" && !valid ? <Notice tone="warning">{t("recovery.phraseInvalid")}</Notice> : null}
      <P muted>{t("recovery.phraseNote")}</P>
    </Panel>
  );

  return (
    <Screen scene="recovery" title={t("recovery.title")} subtitle="RECOVERY" onBack={mode === "choose" ? undefined : () => setMode("choose")}>
      <Notice tone="warning">{t(NET_LONG_KEY)}</Notice>
      {adapter.isMock ? <Notice tone="info">{t("backup.mock")}</Notice> : null}

      {mode === "choose" && (
        <>
          <Panel>
            <H>{t("recovery.withBackup.title")}</H>
            <P>{t("recovery.withBackup.body")}</P>
            <Button label={t("recovery.withBackup.go")} onPress={() => setMode("backup")} disabled={adapter.isMock} />
          </Panel>
          <Panel tone="warning">
            <H>{t("recovery.seedOnly.title")}</H>
            <P>{t("recovery.seedOnly.body")}</P>
            <P muted>{t("recovery.seedOnly.limits")}</P>
            <Button label={t("recovery.seedOnly.go")} kind="secondary" disabled={adapter.isMock} onPress={() => setMode("seed-only")} />
          </Panel>
          <TermHelp term="backup" />
          <P muted>{t("recovery.noOverwrite")}</P>
        </>
      )}

      {mode === "backup" && (
        <>
          {phraseInput}
          <Panel>
            <H>{t("recovery.file")}</H>
            {file ? <Row label={t("recovery.fileChosen")} value={file.name} /> : <P muted>{t("recovery.fileNone")}</P>}
            <Button label={t("recovery.pick")} kind="secondary" onPress={() => void pick()} />
          </Panel>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button label={t("recovery.withBackup.run")} onPress={() => void restoreFromBackup()} busy={busy} disabled={!valid || !file} />
        </>
      )}

      {mode === "seed-only" && (
        <>
          <Notice tone="warning">{t("recovery.seedOnly.limits")}</Notice>
          {phraseInput}
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button label={t("recovery.seedOnly.run")} onPress={() => void restoreFromSeed()} busy={busy} disabled={!valid} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: theme.colors.controlBorder, borderRadius: theme.radius.sm, color: theme.colors.text, fontSize: 16, lineHeight: 24, padding: 12, minHeight: 96, textAlignVertical: "top" },
});
