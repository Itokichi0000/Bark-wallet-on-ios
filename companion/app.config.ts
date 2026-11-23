import type { ExpoConfig } from "expo/config";

// Signet-only build. There is deliberately no mainnet switch in this app:
// see docs/SECURITY_MODEL.md. A mainnet build would need a different bundle
// id and data directory, after the review gates in the design document.
const config: ExpoConfig = {
  name: "Bark Companion (Signet)",
  slug: "bark-companion-wallet",
  version: "0.1.0",
  scheme: "barkcompanion",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  backgroundColor: "#0D0918",
  icon: "./assets/icon.png",
  ios: {
    buildNumber: process.env.BUILD_NUMBER ?? "1",
    bundleIdentifier: "com.itokichi0000.barkcompanion.signet",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription:
        "送金先のQRコードを読み取るためにカメラを使います / Camera is used to scan payment QR codes.",
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
    "expo-router",
    "@secondts/bark-react-native",
    "expo-secure-store",
    "expo-localization",
    "expo-sharing",
    "expo-status-bar",
    ["expo-splash-screen", { backgroundColor: "#0D0918" }],
    ["expo-camera", { cameraPermission: "送金先のQRコードを読み取るためにカメラを使います。" }],
    ["expo-local-authentication", { faceIDPermission: "送金の確定とシードフレーズの表示の前に本人確認をします。" }],
  ],
  experiments: { typedRoutes: false },
};

export default config;
