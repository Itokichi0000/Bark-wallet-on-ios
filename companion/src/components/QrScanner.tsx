import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { Button, P } from "./ui";

/** The stage mounts this only inside the held board, and only while focused. */
export function QrScanner({ visible, onScanned }: { visible: boolean; onScanned(data: string): void }) {
  const t = useT();
  const [permission, request] = useCameraPermissions();
  const done = useRef(false);
  const [cameraError, setCameraError] = useState(false);
  useEffect(() => { done.current = false; }, [visible]);
  if (!visible) return null;
  return <View style={styles.board}>
    {permission?.granted && !cameraError ? <CameraView
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
      {cameraError ? <Button compact label={t("common.retry")} onPress={() => setCameraError(false)} /> : permission?.canAskAgain !== false ? <Button compact label={t("scan.allow")} onPress={() => { void request().catch(() => setCameraError(true)); }} /> : <P muted style={styles.permissionText}>{t("scan.denied")}</P>}
    </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({
  board: { width: "100%", height: "100%", backgroundColor: theme.colors.background },
  permissionText: { fontSize: 12, lineHeight: 16 },
  permission: { flexGrow: 1, padding: 8, justifyContent: "center", gap: 8 },
});
