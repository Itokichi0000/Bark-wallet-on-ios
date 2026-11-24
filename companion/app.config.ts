import type { ExpoConfig } from "expo/config";

// Ships in the existing Sats-OS TestFlight slot (same bundle ID), replacing the
// SwiftUI app, at the owner's request. Signet is the default network; Mainnet
// is a deliberate switch in Settings with its own seed and data directory
// (docs/ADR/0003-network-switch-and-replacing-sats-os.md).
const config: ExpoConfig = {
  name: "Bark Companion",
  slug: "bark-companion-wallet",
  version: "2.0.0",
  scheme: "barkcompanion",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  backgroundColor: "#0D0918",
  icon: "./assets/icon.png",
  ios: {
    buildNumber: process.env.BUILD_NUMBER ?? "1",
    bundleIdentifier: "com.itokichi0000.satsos",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription:
        "送金先のQRコードの読み取りと、オンにしたときの手のジェスチャーの認識にカメラを使います。映像は端末の外に出ません / Camera is used to scan payment QR codes and, if you turn it on, to recognise hand gestures on the device.",
      NSMicrophoneUsageDescription:
        "オンにしたとき、ノアに声で話しかけるためにマイクを使います。音声は端末の中で文字にします / The microphone lets you talk to Noa if you turn it on. Speech is recognised on the device.",
      NSSpeechRecognitionUsageDescription:
        "話しかけた言葉を端末の中で文字にして、ノアが答えるために使います / Your words are recognised on the device so Noa can answer.",
      NSFaceIDUsageDescription:
        "送金の確定とシードフレーズの表示の前に本人確認をします / Face ID confirms payments and seed reveal.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.itokichi0000.barkcompanion.signet",
    permissions: ["android.permission.CAMERA"],
  },
  plugins: [
    "./plugins/withAdoptLegacyScene",
    "expo-router",
    "@secondts/bark-react-native",
    "expo-secure-store",
    "expo-localization",
    "expo-sharing",
    "expo-status-bar",
    ["expo-splash-screen", { backgroundColor: "#0D0918" }],
    ["expo-camera", { cameraPermission: "送金先のQRコードの読み取りと、オンにしたときの手のジェスチャーの認識にカメラを使います。映像は端末の外に出ません。" }],
    "expo-speech-recognition",
    ["expo-local-authentication", { faceIDPermission: "送金の確定とシードフレーズの表示の前に本人確認をします。" }],
  ],
  experiments: { typedRoutes: false },
};

export default config;
