import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useT } from "@/i18n";
import { conversation } from "@/container";
import { theme } from "@/theme";
import { Button, P } from "./ui";

// Serialize close/reopen and permission retries: a late resume cannot reclaim the rear camera.
let cameraHandoff: Promise<void> = Promise.resolve();
function handoff(suspended: boolean) {
  cameraHandoff = cameraHandoff.catch(() => undefined).then(() => conversation.setCameraSuspended(suspended));
  return cameraHandoff;
}

/** Mount the rear camera only after the front gesture camera has stopped. */
export function QrScanner({ visible, onScanned }: { visible: boolean; onScanned(data: string): void }) {
  const t = useT();
  const [permission, request] = useCameraPermissions();
  const done = useRef(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setCameraReady(false);
    setCameraError(false);
    void handoff(true).then(() => { if (alive) setCameraReady(true); }).catch(() => { if (alive) setCameraError(true); });
    return () => {
      alive = false;
      // React has removed the rear CameraView before passive cleanup resumes the front camera.
      void handoff(false).catch(() => { /* The service exposes its native availability state. */ });
    };
  }, [visible, attempt]);
  useEffect(() => { done.current = false; }, [visible]);
  if (!visible) return null;
  return <View style={styles.board}>
    {!cameraReady && !cameraError ? <ActivityIndicator color={theme.colors.primary} accessibilityLabel={t("stage.scanLabel")} /> : permission?.granted && !cameraError ? <CameraView
      style={StyleSheet.absoluteFill}
      accessible accessibilityLabel={t("stage.scanLabel")}
      facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      onMountError={() => setCameraError(true)}
      onBarcodeScanned={({ data }) => {
        if (done.current) return;
        done.current = true;
        onScanned(data);
      }}
    /> : <ScrollView contentContainerStyle={styles.permission}>
      <P style={styles.permissionText}>{t(cameraError ? "stage.cameraFailed" : "scan.permission")}</P>
      {cameraError ? <Button compact label={t("common.retry")} onPress={() => setAttempt((n) => n + 1)} /> : permission?.canAskAgain !== false ? <Button compact label={t("scan.allow")} onPress={() => { void request().catch(() => setCameraError(true)); }} /> : <P muted style={styles.permissionText}>{t("scan.denied")}</P>}
    </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({
  board: { width: "100%", height: "100%", backgroundColor: theme.colors.background },
  permissionText: { fontSize: 12, lineHeight: 16 },
  permission: { flexGrow: 1, padding: 8, justifyContent: "center", gap: 8 },
});
