# Ark School Wallet

使いながら、Arkの仕組みが見えるBitcoinウォレット — **Signet専用の教育用Webウォレット**。
Second の公式 **Bark Web SDK（`@secondts/bark` 0.28.0）** で本物のSignetウォレットを動かし、VTXO・期限・Refresh・Exitを画面で学べます。

> 独立した教育プロジェクトです。Second公式製品ではありません。Signet（テスト用、価値なし）専用で、Mainnetへの切替はありません。

## 使い方

```bash
npm install
```

```bash
npm run dev
```

http://localhost:5173 を開く（WASMとWeb Locksのため、HTTPSかlocalhostが必要）。

| 入口 | できること |
|---|---|
| **デモを試す** | 鍵・ネットワークなし。受取 → VTXO → 送金 → 差分 → Refresh/Exit教材までを体験 |
| **Signetウォレットを作る** | 本物のBark SDKウォレット。復元フレーズ表示 → 3語の確認 → このブラウザ用パスフレーズで暗号化保存 |
| **復元フレーズから復元** | サーバーのメールボックスから残高を再構築（履歴・進行中Exitは戻りません） |

テストsatsは https://signet.2nd.dev/ （GitHubログインが必要）で、Receive画面のArkアドレスに送ってもらいます。

## 画面

- **Wallet**：残高（使用可能・更新が必要・保留中・合計・オンチェーンを分けて表示）、受取（QR）、送金（Arkアドレスのみ、確認ダイアログ）、履歴
- **X-Ray**：Coins（VTXOカード：ID・金額・種類・状態・満了ブロック高・残りブロック・exit depth・出典）、Life（履歴の消費/生成）、Structure（実データのexit depth＋概念図）、Safety（期限・要対応・バックアップ状況）。送金前後のスナップショット差分
- **VTXO詳細**：Identity / Lifetime / How it exits / Explain。緊急Exit費用の見積もり、未承認のexitトランザクションの列挙、Refresh費用の見積もり（どれも読み取りのみ）
- **Lab**：6つのレッスン（UTXOとVTXO、3つの送金方法、ラウンド、Refreshと期限、Offboard vs 緊急Exit、バックアップ）。すべてローカルのシミュレーション
- **Learn**：用語辞典（30秒で理解 / 技術的に詳しく / 原典リンク）
- **設定**：ネットワーク情報（Signet固定）、サーバー情報、バックアップの説明、復元フレーズの表示、SDK対応状況、診断ログ（伏せ字済み）、ウォレット削除

日本語が基本、ヘッダーで英語に切り替え。スマホ（360px）とPC、ライト/ダークに対応。

## 確認できたこと（2026-11-21）

| 項目 | 結果 |
|---|---|
| `npm run typecheck` / `lint` / `test` / `build` | ✅ すべて成功（Vitest 65件） |
| Playwright E2E（デモ・Lab・言語・360px、本番ビルド＋CSP） | ✅ 10件成功 |
| **本物のSignetウォレット**（`LIVE_SIGNET=1`、headless Chromium → `ark.signet.2nd.dev`） | ✅ UIから作成 → `tark1p…` アドレス表示 → 同期・残高0・VTXO一覧・チェーン高・サーバー情報（network=Signet）→ 再読み込み → 誤パスフレーズを拒否 → 正しいパスフレーズで再オープン。コンソールに復元フレーズが出ないことも確認 |
| Mainnetのアドレスへの送金 | ✅ 拒否（`validateArkoorAddress` = false、SDKも `different network` で拒否） |
| Mainnet設定でのビルド | ✅ 失敗する（`VITE_BARK_NETWORK=bitcoin`、`ark.second.tech`） |

## 未検証・未対応

- **実際の受取・送金・送金前後の差分（LIVE）は未検証**。faucetにGitHubログインが必要なため、こちらでは資金を用意できませんでした。コードはSDKの型どおりに実装し、モックSDKでテストしています
- **Refreshの実行**：SDKに `refreshVtxos` はありますが、Signetで検証できていないので無効（費用見積もりだけ可能）
- **SecondのSignetサーバーのVTXO寿命は144ブロック（約1日）**。このアプリはBarkのデーモンを止めて自動Refreshしないため、受け取ったVTXOは約1日で「更新が必要」になりArk送金に使えなくなります（画面にも表示）
- **緊急Exit・Offboardの実行**：MVPの範囲外（説明と読み取りのみ）
- **ウォレットDBの継続バックアップ**：Web SDKに整合的なエクスポートAPIがないため未対応
- Lightning・オンチェーン送金、BIP-321 URI

詳しくは [`docs/SDK_CAPABILITIES.md`](docs/SDK_CAPABILITIES.md)・[`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md)・[`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)。

## バックアップについて（重要）

- **復元フレーズ（12語）だけでは完全なバックアップになりません。** 残高の復元はArkサーバーの協力に依存し、取引履歴と進行中のExitの状態は戻りません
- ウォレットのデータはこのブラウザのIndexedDBにあり、サイトデータの消去や容量不足で消えることがあります
- 復元フレーズは、このブラウザ用のパスフレーズでAES-GCM暗号化して保存します（localStorageには保存しません）。ページを開いている間のXSSや悪意ある拡張機能からは守れません

## Signetへの接続

接続先は `.env.example` のとおり（Second公式の [Connection details](https://second.tech/docs/connection-details)）。

```bash
cp .env.example .env
```

`VITE_BARK_NETWORK` は `signet` 以外を受け付けず、Mainnetのホストを指定するとビルドが止まります。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（`dist/`、CSPのmetaタグ付き） |
| `npm run typecheck` / `npm run lint` | 型・lint |
| `npm run test` | Vitest（ユニット＋結合。SDKはモック） |
| `npm run test:e2e` | Playwright（デモ。本番ビルドに対して実行） |
| `LIVE_SIGNET=1 npm run test:e2e -- --project=desktop signet` | 本物のSignetサーバーでウォレット作成〜再オープン（送金はしません） |

## 公開するとき

`dist/` をHTTPSの静的ホスティングへ。ホスト側で次のHTTPヘッダーも付けてください（`frame-ancestors` はmetaタグでは効きません）。

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://ark.signet.2nd.dev https://esplora.signet.2nd.dev; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

## 構成

```text
src/
  lib/bark/       config（Signet固定）, client（WASM読み込み）, adapter（SDK → WalletPort）, normalize, capabilities
  lib/wallet/     types（WalletPort）, sats, expiry（期限・リスク）, snapshots（差分）, reconcile（送金の一回性・結果不明の管理）
  lib/demo/       fixtures, DemoWallet（ネットワークなし）
  lib/education/  lessons（純粋関数）, glossary
  lib/security/   vault（暗号化保存）, redact, log, environment
  pages/ components/ i18n/ state/
docs/             SPEC（元の設計書）, SDK_CAPABILITIES, SECURITY_REVIEW, TEST_PLAN
tests/            unit, integration, e2e
```

元の設計資料（`CLAUDE.md`・`START_HERE.md`・`PROMPT_FOR_CLAUDE.md`・`docs/SPEC.md`）もこのフォルダにあります。

## クレジット

- [Bark](https://gitlab.com/ark-bitcoin/bark) / [`@secondts/bark`](https://www.npmjs.com/package/@secondts/bark)（MIT）— Second
- 用語・教材の内容は [Second のドキュメント](https://second.tech/docs) にもとづきます
