# SDK 互換性

| 項目 | 値 |
|---|---|
| パッケージ | `@secondts/bark-react-native` **0.28.0**（bark 0.9.0） |
| Expo SDK / React Native / React | 58 / 0.88.1 / 19.3 （New Architecture, Hermes） |
| ネットワーク | Signet（既定）/ Mainnet |
| Ark サーバー | `https://ark.signet.2nd.dev` / `https://ark.second.tech` |
| Esplora | `https://esplora.signet.2nd.dev` / `https://mempool.second.tech/api` |
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
| Lightning 送金（BOLT11 請求書） | Signet で有効。`payLightningInvoice(wait=false)` で1回だけ開始し、`checkLightningPayment` で観測のみ。Paid 以外は pending/unknown として履歴照合へ。**実支払いは未検証**。Mainnet は `LIGHTNING_ENABLED` で無効 |
| Lightning 受取（BOLT11 請求書） | Signet で有効。`bolt11Invoice` で金額固定の請求書を作成、`tryClaimLightningReceive` + `lightningReceiveState` で状態確認。「受け取った」は settled と履歴の記録のみで判断。**実受取は未検証**。Mainnet は無効 |
| BOLT12 offer / Lightning Address / LNURL | 無効（SDK に API はあるが未実装） |
| オンチェーン送金・Offboard・Exit・手動 Refresh | 無効（説明のみ） |
| DB スナップショット API | **SDK に存在しない** → 停止＋ファイルコピーで代替（ADR-0002） |

## 推測で呼んでいる API

ありません。存在が d.ts で確認できなかったものは実装していません。
