import { userAction } from "@/components/companionEvents";
import { Companion } from "@/components/Companion";
import { authorize as authenticateUser } from "@/container";
import { TermHelp } from "@/components/TermHelp";
import { Disclosure } from "@/components/Disclosure";
import { IS_MAINNET } from "@/config/network";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";
import { Button, H, Notice, P, Panel, Screen, NET_LONG_KEY } from "@/components/ui";
import { generateMnemonic, wallet } from "@/container";
import { errorMessage } from "@/domain/errors";
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
  usePreventScreenCapture();
  const settings = useSettings();
  const [step, setStep] = useState<Step>("intro");
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Held only for the length of this flow, in a ref so it never lands in a persisted store or devtools.
  const mnemonic = useRef<string>("");
  const [words, setWords] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<number, string>>({});

  const showing = useRef(false);
  useEffect(() => {
    const shown = step === "words" || step === "quiz";
    if (shown !== showing.current) userAction(shown ? "seed-shown" : "seed-hidden");
    showing.current = shown;
  }, [step]);
  useEffect(() => () => { if (showing.current) userAction("seed-hidden"); }, []);

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

  const startCreate = async () => {
    if (authBusy) return;
    setError(undefined);
    setAuthBusy(true);
    try {
      userAction("auth-asked");
      const auth = await authenticateUser(t("seed.authPrompt"));
      if (!auth.ok) {
        if (auth.reason !== "cancelled") setError(t(auth.reason === "not-enrolled" ? "seed.noLock" : "seed.authFailed"));
        return;
      }
      mnemonic.current = generateMnemonic();
      setWords(mnemonic.current.split(" "));
      setPicked({});
      setStep("words");
    } catch {
      setError(t("seed.authFailed"));
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && (step === "words" || step === "quiz" || step === "backup")) {
        mnemonic.current = "";
        setWords([]);
        setPicked({});
        setStep("choose");
      }
    });
    return () => sub.remove();
  }, [step]);

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
    <Screen scene="onboarding" companion={step !== "intro"} title={t(step === "words" || step === "quiz" ? "seed.title" : "onb.title")} subtitle="ONBOARDING" hideBack={step === "intro" || step === "creating" || authBusy} onBack={step === "intro" || step === "creating" ? () => undefined : back}>
      {!IS_MAINNET ? <Notice tone="warning">{t(NET_LONG_KEY)}</Notice> : null}
      {IS_MAINNET ? <Notice tone="danger">{t("settings.mainnetWarning")}</Notice> : null}

      {step !== "intro" ? <P muted>{t("onb.progress", { step: ({ choose: 1, words: 2, quiz: 3, backup: 4, creating: 4 } as const)[step], total: 4 })}</P> : null}
      {step === "intro" && (
        <>
          <Companion scene="onboarding" large />
          <Text style={styles.welcome} accessibilityRole="header">{t("onb.welcome")}</Text>
          <P>{t("onb.intro1")}</P>
          <P muted>{t("onb.intro2")}</P>
          <Button label={t("onb.start")} icon="caret-right" onPress={() => setStep("choose")} />
          <Disclosure title={t("common.details")}><TermHelp term="network" /><TermHelp term="ark" /></Disclosure>
        </>
      )}

      {step === "choose" && (
        <>
          <H>{t("onb.choose")}</H>
          <TermHelp term="seed" />
          <Button label={t("onb.create")} icon="wallet" onPress={() => void startCreate()} busy={authBusy} />
          {error ? <Notice tone="danger">{error}</Notice> : null}
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
                      <Text style={[styles.optionText, on && { color: theme.colors.background }]}>{o}</Text>
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
          <P>{t("backup.summary")}</P>
          <Notice tone="warning">{t("backup.explain2")}</Notice>
          <TermHelp term="backup" />
          <Disclosure title={t("common.details")}><P>{t("backup.explain1")}</P><P muted>{t("backup.explain3")}</P></Disclosure>
          {error ? <Notice tone="danger">{t("onb.createFailed", { detail: error })}</Notice> : null}
          <Button label={t("onb.createNow")} onPress={() => void create()} busy={step === "creating"} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", backgroundColor: theme.colors.backgroundRaised, borderRadius: 28, padding: 12, borderWidth: 1, borderColor: theme.colors.outline },
  welcome: { color: theme.colors.text, fontSize: 26, lineHeight: 36, fontWeight: "700" },
  words: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: { width: "31%", flexDirection: "row", gap: 6, alignItems: "center", borderWidth: 1, borderColor: theme.colors.outline, borderRadius: theme.radius.sm, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: theme.colors.backgroundRaised },
  wordIndex: { color: theme.colors.textMuted, fontSize: 11, width: 16, textAlign: "right" },
  wordText: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderColor: theme.colors.controlBorder, borderRadius: theme.radius.pill, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: "center" },
  optionOn: { backgroundColor: theme.colors.primaryStrong, borderColor: theme.colors.primaryStrong },
  optionText: { color: theme.colors.text, fontSize: 15 },
});
