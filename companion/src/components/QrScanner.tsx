import { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { Button, P } from "./ui";

export function QrScanner({ visible, onClose, onScanned }: { visible: boolean; onClose(): void; onScanned(data: string): void }) {
  const t = useT();
  const [permission, request] = useCameraPermissions();
  const [done, setDone] = useState(false);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setDone(false)}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{t("scan.title")}</Text>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={done ? undefined : ({ data }) => {
              setDone(true);
              onScanned(data);
            }}
          />
        ) : (
          <View style={styles.camera}>
            <P>{t("scan.permission")}</P>
            {permission?.canAskAgain !== false ? <Button label={t("scan.allow")} onPress={() => void request()} /> : <P muted>{t("scan.denied")}</P>}
          </View>
        )}
        <P muted>{t("scan.hint")}</P>
        <Button label={t("common.close")} kind="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.background, padding: 20, paddingTop: 64, gap: 16 },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: "700" },
  camera: { flex: 1, borderRadius: theme.radius.md, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.outline, justifyContent: "center", padding: 16, gap: 12 },
});
