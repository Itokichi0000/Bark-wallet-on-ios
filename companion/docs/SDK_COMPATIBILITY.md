# SDK 互換性

| 項目 | 値 |
|---|---|
| パッケージ | `@secondts/bark-react-native` **0.28.0**（bark 0.9.0） |
| Expo SDK / React Native / React | 58 / 0.88.1 / 19.3 （New Architecture, Hermes） |
| ネットワーク | Signet のみ |
| Ark サーバー | `https://ark.signet.2nd.dev` |
| Esplora | `https://esplora.signet.2nd.dev` |
| faucet | `https://signet.2nd.dev/` |

`BARK_SDK_VERSION` 定数とインストール済みパッケージの版が一致することを単体テストで検査しています。
SDK を上げるときは、下の表の API をインストール済みの `.d.ts` で再確認してからにしてください。

## 使用している API（すべてインストール済み d.ts で存在を確認。実機での挙動は未確認）

| 用途 | API |
|---|---|
| 作成 / オープン | `Config.create`, `WalletOpenArgs.create`, `Wallet.open`, `walletExists`, `readDatadirInfo` |
| シード | `generateMnemonic`, `validateMnemonic` |
| 同期 / 残高 | `wallet.sync`, `wallet.balanceSummary` |
| 受取 | `wallet.newAddress` |
| 宛先検証 | `wallet.parsePaymentRequest`, `wallet.validateArkoorAddress` |
| 見積もり / 送金 | `wallet.estimateArkoorPaymentFee`, `wallet.sendArkoorPayment` |
| 履歴 / VTXO | `wallet.history`, `wallet.vtxos`, `wallet.getVtxosToRefresh`, `getNextRequiredRefreshBlockheight`, `getFirstExpiringVtxoBlockheight` |
| 通知 | `WalletNotifications.subscribe`（MovementCreated / MovementUpdated） |
| デーモン | `wallet.runDaemon`, `wallet.stopDaemonWait` |

## 対応状況

| 機能 | 状態 |
|---|---|
| Ark アドレスでの受取 | implemented / untested |
| Ark（arkoor）送金 | implemented / untested |
| Lightning 送金・受取 | 無効（SDK に API はあるが未検証のため UI から到達不可） |
| オンチェーン送金・Offboard・Exit・手動 Refresh | 無効（説明のみ） |
| DB スナップショット API | **SDK に存在しない** → 停止＋ファイルコピーで代替（ADR-0002） |

## 推測で呼んでいる API

ありません。存在が d.ts で確認できなかったものは実装していません。
