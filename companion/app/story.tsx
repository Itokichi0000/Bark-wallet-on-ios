import { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { Path, Rect } from "react-native-svg";
import { BitcoinIcon } from "@/components/BitcoinIcon";
import { Stage } from "@/components/stage";
import { SpeechFact } from "@/components/conversation";
import { H, P, Panel, Screen } from "@/components/ui";
import { avatar, bus } from "@/container";
import { STORY_CHAPTERS, storyProgress, storyLineCue, type StoryChapter } from "@/game/story";
import { useAvatarCue } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { theme } from "@/theme";
import { formatAmount } from "@/utils/format";

const c = theme.colors;

export default function StoryScene() {
  const t = useT();
  const sent = useSettings((s) => s.storySentSats);
  const read = useSettings((s) => s.storyRead);
  const hidden = useSettings((s) => s.balanceHidden);
  const unit = useSettings((s) => s.unit);
  const markRead = useSettings((s) => s.markStoryRead);
  const [chapter, setChapter] = useState<StoryChapter>();
  const progress = storyProgress(BigInt(sent));
  const close = useCallback(() => { avatar.cancel(); setChapter(undefined); }, []);
  useFocusEffect(useCallback(() => () => avatar.cancel(), []));
  useFocusEffect(useCallback(() => {
    if (!chapter) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { close(); return true; });
    return () => sub.remove();
  }, [chapter, close]));
  if (chapter) return <StoryReader key={chapter.id} chapter={chapter} onClose={close} onFinish={() => { markRead(chapter.id); close(); }} />;
  return (
    <Screen contentKey="chapters" scene="story" title={t("story.title")} >
      <>
        <Panel>
          <Text style={styles.eyebrow}>{t("story.memories")}</Text>
          <P muted>{t("story.sentTotal")}</P>
          <Text style={styles.total}>{hidden ? "••••••" : formatAmount(sent, unit)}</Text>
          <View
            style={styles.track} accessible accessibilityRole="progressbar"
            accessibilityLabel={t("story.progress")}
            accessibilityValue={hidden ? { text: t("story.hidden") } : { min: 0, max: 100, now: Math.round((progress.next?.fraction ?? 1) * 100) }}
          >
            <View style={[styles.fill, { width: hidden ? "0%" : `${(progress.next?.fraction ?? 1) * 100}%` }]} />
          </View>
          <P>{t(progress.next ? "story.explore" : "story.allOpen")}</P>
        </Panel>
        <P muted>{t("story.honest")}</P>
        <H>{t("story.fragments")}</H>
        {STORY_CHAPTERS.map((entry, index) => {
          const unlocked = progress.unlocked.some((item) => item.id === entry.id);
          const isNew = unlocked && !read[entry.id];
          // Do not even resolve a locked chapter's title or lines.
          const title = unlocked ? t(`story.${entry.id}.title`) : t("story.lockedTitle");
          return <Pressable
            key={entry.id} disabled={!unlocked}
            accessibilityRole="button" accessibilityState={{ disabled: !unlocked }}
            accessibilityLabel={`${t("story.fragmentNumber", { n: index + 1 })}. ${title}. ${t(unlocked ? isNew ? "story.new" : "story.read" : "story.locked")}`}
            onPress={() => setChapter(entry)}
            style={({ pressed }) => [styles.fragment, !unlocked && styles.locked, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.fragmentIcon}>
              {unlocked ? <BitcoinIcon name="star" /> : <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}><Path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke={c.textMuted} strokeWidth={1.5} /><Rect x={5} y={10} width={14} height={11} rx={3} fill="none" stroke={c.textMuted} strokeWidth={1.5} /></Svg>}
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.eyebrow}>{t("story.fragmentNumber", { n: index + 1 })}</Text>
              <Text style={styles.fragmentTitle}>{title}</Text>
              <Text style={styles.meta}>{unlocked ? t(isNew ? "story.unread" : "story.read") : t("story.threshold", { amount: formatAmount(entry.unlockAtSats.toString(), unit) })}</Text>
            </View>
            {isNew ? <Text style={styles.badge}>{t("story.new")}</Text> : unlocked ? <BitcoinIcon name="caret-right" size={18} /> : null}
          </Pressable>;
        })}
      </>
    </Screen>
  );
}

function StoryReader({ chapter, onFinish, onClose }: { chapter: StoryChapter; onFinish(): void; onClose(): void }) {
  const t = useT();
  const cue = useAvatarCue();
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const lineKey = `story.${chapter.id}.${index + 1}`;
  useFocusEffect(useCallback(() => {
    setFocused(true);
    avatar.cancel();
    avatar.play(storyLineCue(chapter, index, bus.nextId("story")));
    return () => { setFocused(false); avatar.cancel(); };
  }, [chapter, index]));
  useEffect(() => {
    // A higher-priority payment/safety cue can defer narration; resume only after it ends.
    if (focused && cue.id === "idle") avatar.play(storyLineCue(chapter, index, bus.nextId("story")));
  }, [focused, cue.id, chapter, index]);
  const advance = () => index === chapter.lines.length - 1 ? onFinish() : setIndex((n) => n + 1);
  return <Stage scene="story" line={t(lineKey)} active={focused} onBack={onClose} onLinePress={advance} onStagePress={advance}
    turnKey={lineKey} pages={{ next: "next", previous: "back" }}
    speechFacts={<SpeechFact>{t(`story.${chapter.id}.title`)} · {t("story.page", { n: index + 1, total: chapter.lines.length })}</SpeechFact>}
    choices={[
      { id: "next", label: t(index === chapter.lines.length - 1 ? "story.finish" : "common.next"), onPress: advance },
      { id: "back", label: t("common.back"), onPress: () => index === 0 ? onClose() : setIndex((n) => n - 1) },
    ]} />;
}

const styles = StyleSheet.create({
  eyebrow: { color: c.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  total: { color: c.text, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  track: { height: 6, backgroundColor: c.outline, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: c.primary },
  fragment: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 94, borderWidth: 1, borderColor: c.outline, borderRadius: 20, backgroundColor: c.panel, padding: 16 },
  locked: { backgroundColor: c.backgroundRaised },
  fragmentIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: c.backgroundRaised },
  fragmentTitle: { color: c.text, fontSize: 17, fontWeight: "600" },
  badge: { color: c.background, backgroundColor: c.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, fontSize: 10, fontWeight: "700" },
  meta: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
});
