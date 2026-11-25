import { useEffect, useRef, type ComponentRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { PlayerBubble } from "./conversation";
import { ListeningFeedback } from "./talk-controls";

/** This space belongs to the figure region even when there is no player turn. */
export function stageEchoLayout(width: number, height: number, board: boolean) {
  const beside = !board && height < 160;
  const slotHeight = Math.min(72, Math.max(0, height));
  return {
    figureWidth: beside ? width * 0.4 : width,
    figureHeight: beside ? height : Math.max(0, height - slotHeight),
    left: beside ? width * 0.4 + 8 : 16,
    right: 16,
    bottom: 0,
    height: slotHeight,
  };
}

/** All echo sources share one bounded overlay, outside the measured reply tree. */
export function StageEcho({ slot, turn, listening, gesture }: {
  slot: ReturnType<typeof stageEchoLayout>;
  turn?: { id: number; text: string; listening: boolean };
  listening: boolean;
  gesture?: string;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [turn?.id]);
  return <View pointerEvents="box-none" style={[styles.slot, { left: slot.left, right: slot.right, bottom: slot.bottom, height: slot.height }]}>
    <ScrollView ref={scroll} pointerEvents={turn || listening || gesture ? "auto" : "none"} style={styles.scroll} contentContainerStyle={styles.content}
      nestedScrollEnabled automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled">
      {turn ? <PlayerBubble turn={turn} /> : null}
      <ListeningFeedback listening={listening} gesture={gesture} />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  slot: { position: "absolute", zIndex: 4, justifyContent: "flex-end", paddingVertical: 4 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { flexGrow: 1, justifyContent: "flex-end" },
});
