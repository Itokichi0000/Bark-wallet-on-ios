# Bark Companion Wallet (Signet)

キャラクターが案内する、Bitcoin / Ark（Bark）のセルフカストディ・ウォレット。Expo + React Native + TypeScript。
設計書「Bark Companion Wallet 詳細設計書」の M0 / M1-A を対象にした実装です。

> **Signet 専用です。** 本物のビットコインは扱えません。本番用の SwiftUI アプリ（リポジトリ直下の `SatsOS/`）とは
> バンドル ID もデータ領域も別で、互いに影響しません。

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
