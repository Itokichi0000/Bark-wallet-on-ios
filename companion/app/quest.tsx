import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, H, P, Panel, Screen } from "@/components/ui";
import { QUEST_IDS, type QuestId } from "@/game/quests";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { theme } from "@/theme";

const GO: Partial<Record<QuestId, "/receive" | "/send" | "/archive" | "/assets">> = { q2: "/receive", q3: "/receive", q4: "/send", q6: "/assets" };

/** S08 Quests: a learning checklist. Completion never depends on amounts or on how often money moved. */
export default function QuestScene() {
  const t = useT();
  const { questsDone, completeQuest } = useSettings();
  const [reading, setReading] = useState(false);
  const done = QUEST_IDS.filter((q) => questsDone[q]).length;

  return (
    <Screen title={t("quest.title")} subtitle="QUEST">
      <P>{t("quest.intro")}</P>
      <H>{t("quest.progress", { done, total: QUEST_IDS.length })}</H>
      {QUEST_IDS.map((q) => {
        const complete = !!questsDone[q];
        const go = GO[q];
        return (
          <Panel key={q} tone={complete ? "success" : undefined}>
            <View style={styles.head}>
              <Text style={[styles.mark, { color: complete ? theme.colors.success : theme.colors.textMuted }]}>{complete ? "✓" : "○"}</Text>
              <Text style={styles.title}>{t(`quest.${q}.title`)}</Text>
            </View>
            <P muted>{t(`quest.${q}.body`)}</P>
            <Text style={styles.state}>{complete ? t("quest.done") : t("quest.todo")}</Text>
            {!complete && go ? <Button label={t("quest.go")} kind="secondary" onPress={() => router.push(go)} /> : null}
            {q === "q5" ? (
              <>
                <Button label={reading ? t("common.close") : t("quest.q5.read")} kind="secondary" onPress={() => setReading((r) => !r)} />
                {reading ? (
                  <>
                    <P>{t("backup.explain1")}</P>
                    <P>{t("backup.explain2")}</P>
                    <P>{t("backup.explain3")}</P>
                    {!complete ? <Button label={t("quest.q5.understood")} onPress={() => completeQuest("q5")} /> : null}
                  </>
                ) : null}
              </>
            ) : null}
          </Panel>
        );
      })}
      <P muted>{t("quest.rewardNote")}</P>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: 10, alignItems: "center" },
  mark: { fontSize: 18, fontWeight: "700", width: 20 },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  state: { color: theme.colors.textMuted, fontSize: 12 },
});
