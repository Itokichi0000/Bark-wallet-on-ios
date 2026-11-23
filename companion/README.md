# Bark Companion Wallet

キャラクターが案内する、Bitcoin / Ark（Bark）のセルフカストディ・ウォレット。Expo + React Native + TypeScript。
設計書「Bark Companion Wallet 詳細設計書」の M0 / M1-A を対象にした実装です。

> **既定は Signet（テスト）です。** 設定画面で Mainnet に切り替えられますが、実機での検証はまだです。
> 本番では少額に限ってください。ウォレットとシードはネットワークごとに別です。
> TestFlight では既存の Sats-OS の枠（`com.itokichi0000.satsos`）に配信されます。

## 動かし方

```sh
cd companion
pnpm install
pnpm typecheck        # tsc --noEmit
pnpm test             # Jest（単体テスト）
pnpm ios              # 実機 / シミュレータ（Expo Go では動きません。development build が必要）
```

`EXPO_PUBLIC_WALLET_MODE=mock pnpm ios` で、SDK を使わない MOCK モードになります（画面に常時 MOCK バナーを表示）。

## 構成

```
app/                 画面（expo-router）。usecase を呼ぶだけ
src/domain/          型・金額・送金状態機械・イベント（SDK にも RN にも依存しない）
src/usecases/        WalletService（起動 / 同期 / 送金 / 照合）
src/infrastructure/  bark/（SDK に触る唯一の場所）, mock/, secure/, backup/, storage/
src/game/            アバター・ホログラムメニュー・クエスト（鍵や送金 API を import しない）
src/voice/           意図パーサと方針エンジン（送金を実行する action が型として存在しない）
src/i18n/            ja / en
docs/                実装状況・SDK 互換性・セキュリティ・バックアップ・テスト報告
```

現状と未検証項目は必ず [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) を見てください。

## Reviewing every screen without tapping

A mock build with demo data opens straight onto any screen, which is how the screens are reviewed in the simulator:

```sh
EXPO_PUBLIC_WALLET_MODE=mock EXPO_PUBLIC_MOCK_DEMO=1 xcodebuild ... build   # Release, simulator
xcrun simctl launch <udid> com.itokichi0000.satsos -reviewRoute send        # home, receive, send, assets, archive, settings, quest, seed, recovery
```

Demo mode exists only in mock builds: it keeps a pretend seed in memory, never touches the Keychain or the SDK, and every screen carries the MOCK banner.
