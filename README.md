# Sats-OS — Bark wallet for iOS

架空のレトロOS「Sats-OS」（[個人サイト](https://website-matt-8eed.vercel.app) と同じ世界観）で動く、
[Second](https://second.tech) の **Bark SDK**（Ark プロトコル）を使った自己管理型ビットコインウォレットです。

- 起動画面 `[ OK ] ark.drv ..... online` → タップでデスクトップ
- デスクトップ：₿ パーティクル、bitty くん（タップでしゃべる）、残高ウィンドウ `wallet.dat`
- `send.exe`：Ark アドレス / Lightning invoice・offer / Lightning アドレス / LNURL / `bitcoin:` URI / on-chain アドレスに送金（QR 読み取り・貼り付け、手数料見積もり、RPG 風の確認ダイアログ）
- `recv.exe`：Ark アドレス、Lightning invoice（ドット絵の QR、支払われると自動で「Received!」）
- `history.log`：取引履歴（ターミナル風ログ、詳細表示）
- `system.cfg`：テーマ 6 種（Genesis / Cold Storage / Lightning / Mempool / Paper Wallet / Fiat）、走査線・8bit 効果音・振動、SIGNET ⇄ MAINNET、シード表示（Face ID）、Ark サーバー情報、ウォレット削除
- シードは iPhone のキーチェーン（この端末のみ）に保存

| 起動 | デスクトップ | 受け取り | 設定 |
|---|---|---|---|
| ![boot](docs/screenshots/02-boot.png) | ![desktop](docs/screenshots/03-desktop.png) | ![receive](docs/screenshots/04-receive.png) | ![system](docs/screenshots/07-system.png) |

（CI の iPhone シミュレータで signet に接続して撮影したもの。push のたびに Actions の **screenshots** アーティファクトに最新版が残ります）

最初は **SIGNET**（テスト用）で起動します。テストコインは https://signet.2nd.dev/ でもらえます。
MAINNET（`ark.second.tech`）は system.cfg から切り替えられます（本物のビットコインです）。

## 構成

| 場所 | 中身 |
|---|---|
| `project.yml` | XcodeGen のプロジェクト定義（`xcodegen generate` で `SatsOS.xcodeproj` を作る） |
| `SatsOS/Wallet/` | Bark SDK まわり（`WalletStore`：起動・同期・送金・受取・通知、キーチェーン、ネットワーク設定） |
| `SatsOS/Design/` | テーマ・フォント・ドット絵の部品・₿ パーティクル・bitty・効果音 |
| `SatsOS/Screens/` | 起動 / セットアップ / デスクトップ / 送金 / 受取 / 履歴 / 設定 / QR スキャナ |
| `.github/workflows/ios-build.yml` | push のたびにシミュレータ向けにビルド（コンパイル確認） |
| `.github/workflows/testflight.yml` | main への push か手動実行で TestFlight にアップロード |
| `scripts/testflight.sh` | アーカイブ → 署名 → アップロード |
| `tools/make_app_icon.py` | bitty からアプリアイコンを作るスクリプト |

Bark SDK: `https://gitlab.com/ark-bitcoin/bark-ffi-bindings.git` を `0.27.0+bark-0.8.1` に固定しています。

## 手元の Mac で動かす

```bash
brew install xcodegen
```

```bash
xcodegen generate
```

```bash
open SatsOS.xcodeproj
```

Xcode 26 以上で、ターゲット SatsOS の Signing & Capabilities で自分の Team を選んで ⌘R。

## TestFlight に上げる（Mac なしで GitHub Actions から）

最初に 1 回だけ、以下を準備します。

### 1. App Store Connect でアプリを作る

1. [App Store Connect](https://appstoreconnect.apple.com) → **ビジネス** で未同意の契約があれば同意
2. [Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list) で App ID を登録  
   Bundle ID：`com.itokichi0000.satsos`（別の ID にしたい場合は下の `BUNDLE_ID` 変数で指定）
3. App Store Connect → **アプリ** → **＋ 新規 App**：プラットフォーム iOS、名前（例 `Sats-OS Wallet`）、上の Bundle ID、SKU は任意（例 `satsos`）
4. 作ったアプリの **TestFlight** → **内部テスト** にグループを作り、自分を追加（「自動配信」をオンにすると新しいビルドが自動で届きます）

### 2. API キーを作る

1. App Store Connect → **ユーザとアクセス** → **統合** → **App Store Connect API** → **チームキー** の **＋**
2. 名前は `GitHub TestFlight` など、アクセスは **Admin**（クラウド署名で配布用証明書を作るのに必要）
3. `AuthKey_XXXXXXXXXX.p8` をダウンロード（1 回しかダウンロードできません）
4. **Key ID** と、表の上にある **Issuer ID** を控える
5. [Membership details](https://developer.apple.com/account) で **Team ID**（10 文字）を控える

### 3. GitHub に Secrets を登録

このリポジトリの **Settings → Secrets and variables → Actions → New repository secret**：

| Name | 値 |
|---|---|
| `ASC_KEY_ID` | Key ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_PRIVATE_KEY` | `.p8` ファイルの中身をまるごと（`-----BEGIN PRIVATE KEY-----` から `-----END PRIVATE KEY-----` まで） |
| `APPLE_TEAM_ID` | Team ID |

Bundle ID を変える場合だけ、**Variables** タブに `BUNDLE_ID` を追加します。

### 4. アップロード

- **Actions → TestFlight → Run workflow** で手動実行、または `main` に push（マージ）すると自動で走ります
- 成功すると数分〜15 分ほどで App Store Connect の処理が終わり、iPhone の TestFlight アプリに届きます
- ビルド番号は実行時刻（`yymmddHHMM`）なので毎回自動で増えます。バージョンは `project.yml` の `MARKETING_VERSION`

`Info.plist` に `ITSAppUsesNonExemptEncryption = NO` を入れてあるので、輸出コンプライアンスの質問は出ません。

### うまくいかないとき

| 症状 | 対処 |
|---|---|
| `No profiles for 'com.itokichi0000.satsos' were found` | App ID の登録漏れか、App Store Connect にアプリがない。手順 1 を確認 |
| `Cloud signing permission error` / `No signing certificate "iOS Distribution"` | API キーのアクセスを **Admin** にする |
| `The provided entity includes an attribute with a value that has already been used` | ビルド番号の重複。もう一度実行すれば新しい番号になります |
| `Missing secrets` の警告で何もしない | 手順 3 の Secrets が足りない |

ログは各実行の **Artifacts → testflight-logs** に残ります。

## クレジット

- [Bark SDK](https://gitlab.com/ark-bitcoin/bark-ffi-bindings)（MIT）— Second
- フォント：[Jacquard 12](https://fonts.google.com/specimen/Jacquard+12)・[DotGothic16](https://fonts.google.com/specimen/DotGothic16)・[Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans)（SIL Open Font License 1.1、`licenses/`）
- bitty：Zappy Bitty / 個人サイトと同じ絵
