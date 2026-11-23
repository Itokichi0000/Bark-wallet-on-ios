import { IS_MAINNET } from "@/config/network";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";
import { Button, H, Notice, P, Panel, Screen, NET_LONG_KEY } from "@/components/ui";
import { generateMnemonic, wallet } from "@/container";
import { errorMessage } from "@/domain/errors";
import { IDLE_CUE } from "@/domain/avatar";
import { IllustratedAvatarRenderer } from "@/game/IllustratedAvatarRenderer";
import { useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { theme } from "@/theme";

type Step = "intro" | "choose" | "words" | "quiz" | "backup" | "creating";

function WordsStep({ words }: { words: string[] }) {
  usePreventScreenCapture();
  return (
    <View style={styles.words}>
      {words.map((w, i) => (
        <View key={`${i}-${w}`} style={styles.word}>
          <Text style={styles.wordIndex}>{i + 1}</Text>
          <Text style={styles.wordText}>{w}</Text>
        </View>
      ))}
    </View>
  );
}

/** S01 Onboarding. A wallet is created only by the explicit last step here. */
export default function OnboardingScene() {
  const t = useT();
  const reduceMotion = useReduceMotion();
  const settings = useSettings();
  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState<string>();
  // Held only for the length of this flow, in a ref so it never lands in a persisted store or devtools.
  const mnemonic = useRef<string>("");
  const [words, setWords] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<number, string>>({});

  const quiz = useMemo(() => {
    if (words.length === 0) return [];
    const positions = [1, 5, 10].map((p) => p % words.length);
    return positions.map((pos, qi) => {
      const answer = words[pos] ?? "";
      const decoys = words.filter((w) => w !== answer).filter((_, i) => i % 4 === qi).slice(0, 2);
      const options = [answer, ...decoys].sort();
      return { pos, answer, options };
    });
  }, [words]);
  const quizPassed = quiz.length > 0 && quiz.every((q) => picked[q.pos] === q.answer);

  const startCreate = () => {
    mnemonic.current = generateMnemonic();
    setWords(mnemonic.current.split(" "));
    setPicked({});
    setStep("words");
  };

  const create = async () => {
    setStep("creating");
    setError(undefined);
    try {
      await wallet.create(mnemonic.current);
      mnemonic.current = "";
      setWords([]);
      settings.update({ introSeen: true, seedBackupConfirmed: true });
      router.replace("/home");
    } catch (e) {
      setError(errorMessage(e));
      setStep("backup");
    }
  };

  const back = () => {
    const order: Step[] = ["intro", "choose", "words", "quiz", "backup"];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1] ?? "intro");
  };

  return (
    <Screen title={t("onb.title")} subtitle="ONBOARDING" onBack={step === "intro" || step === "creating" ? () => undefined : back}>
      <Notice tone={IS_MAINNET ? "danger" : "warning"}>{t(NET_LONG_KEY)}</Notice>
      {IS_MAINNET ? <Notice tone="danger">{t("settings.mainnetWarning")}</Notice> : null}

      {step === "intro" && (
        <>
          <View style={{ alignItems: "center" }}>
            <IllustratedAvatarRenderer cue={{ ...IDLE_CUE, id: "onb", emotion: "happy", action: "wave" }} height={260} reduceMotion={reduceMotion} />
          </View>
          <P>{t("onb.intro1")}</P>
          <P muted>{t("onb.intro2")}</P>
          <Button label={t("common.next")} onPress={() => setStep("choose")} />
        </>
      )}

      {step === "choose" && (
        <>
          <H>{t("onb.choose")}</H>
          <Button label={t("onb.create")} onPress={startCreate} />
          <Button label={t("onb.restore")} kind="secondary" onPress={() => router.push("/recovery")} />
          <P muted>{t("onb.chooseNote")}</P>
        </>
      )}

      {step === "words" && (
        <>
          <H>{t("onb.wordsTitle")}</H>
          <Notice tone="danger">{t("seed.warning")}</Notice>
          <WordsStep words={words} />
          <P muted>{t("seed.noScreenshot")}</P>
          <Button label={t("onb.wroteDown")} onPress={() => setStep("quiz")} />
        </>
      )}

      {step === "quiz" && (
        <>
          <H>{t("onb.quizTitle")}</H>
          {quiz.map((q) => (
            <Panel key={q.pos}>
              <P>{t("onb.quizAsk", { n: q.pos + 1 })}</P>
              <View style={styles.options}>
                {q.options.map((o) => {
                  const on = picked[q.pos] === o;
                  return (
                    <Pressable key={o} onPress={() => setPicked((p) => ({ ...p, [q.pos]: o }))} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.option, on && styles.optionOn]}>
                      <Text style={styles.optionText}>{o}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Panel>
          ))}
          {Object.keys(picked).length === quiz.length && !quizPassed ? <Notice tone="warning">{t("onb.quizWrong")}</Notice> : null}
          <Button label={t("common.next")} onPress={() => setStep("backup")} disabled={!quizPassed} />
        </>
      )}

      {(step === "backup" || step === "creating") && (
        <>
          <H>{t("onb.backupTitle")}</H>
          <P>{t("backup.explain1")}</P>
          <P>{t("backup.explain2")}</P>
          <P muted>{t("backup.explain3")}</P>
          {error ? <Notice tone="danger">{t("onb.createFailed", { detail: error })}</Notice> : null}
          <Button label={t("onb.createNow")} onPress={() => void create()} busy={step === "creating"} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  words: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: { width: "31%", flexDirection: "row", gap: 6, alignItems: "center", borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.sm, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: theme.colors.backgroundRaised },
  wordIndex: { color: theme.colors.textMuted, fontSize: 11, width: 16, textAlign: "right" },
  wordText: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.pill, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: "center" },
  optionOn: { backgroundColor: theme.colors.primaryStrong, borderColor: theme.colors.primaryStrong },
  optionText: { color: theme.colors.text, fontSize: 15 },
});
