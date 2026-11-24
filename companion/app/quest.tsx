import { userAction } from "@/components/companionEvents";
import { BitcoinIcon, type BitcoinIconName } from "@/components/BitcoinIcon";
import { Disclosure } from "@/components/Disclosure";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, H, P, Panel, Screen } from "@/components/ui";
import { QUEST_IDS, type QuestId } from "@/game/quests";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { theme } from "@/theme";

const GO: Partial<Record<QuestId, "/home" | "/receive" | "/send" | "/assets">> = { q1: "/home", q2: "/receive", q3: "/receive", q4: "/send", q6: "/assets" };
const ICON: Record<QuestId, BitcoinIconName> = { q1: "star", q2: "scan", q3: "receive", q4: "send", q5: "shield", q6: "transactions" };

export default function QuestScene() {
  const t = useT();
  const { questsDone, completeQuest } = useSettings();
  const [expanded, setExpanded] = useState<QuestId>();
  const done = QUEST_IDS.filter((q) => questsDone[q]).length;
  return (
    <Screen scene="quest" title={t("quest.title")}>
      <P muted>{t("quest.intro")}</P>
      <Button label={t("story.guideEntry")} icon="star" kind="secondary" onPress={() => router.push("/story")} />
      <H>{t("quest.progress", { done, total: QUEST_IDS.length })}</H>
      <Panel style={{ gap: 0, paddingVertical: 0 }}>
        {QUEST_IDS.map((q, index) => {
          const complete = !!questsDone[q];
          const go = GO[q];
          const open = expanded === q;
          return (
            <View key={q} style={index > 0 && styles.divider}>
              <View style={styles.row}>
                <Pressable onPress={() => { if (!open) userAction("details-opened"); setExpanded(open ? undefined : q); }} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${t(`quest.${q}.title`)}. ${t(complete ? "quest.done" : "quest.todo")}`} style={({ pressed }) => [styles.task, { opacity: pressed ? 0.65 : 1 }]}>
                  <BitcoinIcon name={ICON[q]} size={22} />
                  <Text style={styles.title}>{t(`quest.${q}.title`)}</Text>
                  {complete ? <BitcoinIcon name="check" size={20} color={theme.colors.primary} /> : null}
                </Pressable>
                {!complete ? <Pressable onPress={() => go ? router.push(go) : setExpanded(open ? undefined : q)} accessibilityRole="button" accessibilityLabel={`${t(`quest.${q}.title`)}: ${t("quest.go")}`} style={styles.link}><Text style={styles.linkText}>{t("quest.go")}</Text></Pressable> : null}
              </View>
              {open ? <View style={styles.details}>
                <P muted>{t(`quest.${q}.body`)}</P>
                {q === "q5" ? <>
                  <P>{t("backup.explain1")}</P><P>{t("backup.explain2")}</P><P>{t("backup.explain3")}</P>
                  {!complete ? <Button label={t("quest.q5.understood")} onPress={() => completeQuest("q5")} /> : null}
                </> : null}
              </View> : null}
            </View>
          );
        })}
      </Panel>
      <Disclosure title={t("common.details")}><P muted>{t("quest.rewardNote")}</P></Disclosure>
    </Screen>
  );
}
const styles = StyleSheet.create({
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outline },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  task: { flex: 1, minHeight: 60, flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 10 },
  title: { color: theme.colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600", flex: 1 },
  link: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  linkText: { color: theme.colors.primary, fontSize: 12, fontWeight: "600" },
  details: { gap: 12, paddingBottom: 16 },
});
