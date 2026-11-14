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
| `scripts/asc.py` | App Store Connect API（Bundle ID 登録、Team ID 取得、内部テスターに自分を追加） |
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

自分だけで使うなら TestFlight の **内部テスト** です（Apple の審査なし）。
Bundle ID の登録、Team ID、テストグループ作成と自分の追加はワークフローが自動でやります。
あなたがやるのは次の 3 つだけ。前提: 有料の Apple Developer Program に加入済み。

### 1. API キーを作る（App Store Connect）

[ユーザとアクセス → 統合 → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api) → **チームキー** の **＋**。
名前は何でも、アクセスは **Admin**。作ったら次の 3 つを控えます。

- `AuthKey_XXXXXXXXXX.p8` をダウンロード（1 回しかできません）
- その行の **キー ID**
- 表の上の **Issuer ID**

### 2. GitHub に 3 つ貼る

このリポジトリの **Settings → Secrets and variables → Actions → New repository secret** を 3 回。

| Name | 値 |
|---|---|
| `ASC_KEY_ID` | キー ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_PRIVATE_KEY` | `.p8` をテキストエディタで開いて中身を全部（`-----BEGIN PRIVATE KEY-----` から `-----END PRIVATE KEY-----` まで） |

### 3. 実行 → 言われたらアプリを作る → もう一度実行

1. **Actions → TestFlight → Run workflow**
2. 1 回目は 1〜2 分で止まり、画面に「あと 1 ステップ」が出ます（Bundle ID は登録済み）。
   [App Store Connect → アプリ](https://appstoreconnect.apple.com/apps) の **＋ → 新規 App** で、iOS・名前（例 `Sats-OS Wallet`）・日本語・バンドル ID `com.itokichi0000.satsos`・SKU（例 `satsos`）を入れて作成
3. もう一度 **Run workflow**。20 分ほどで緑になり、あなたが内部テスターに自動で追加されます
4. iPhone に **TestFlight** アプリを入れ、同じ Apple ID でサインイン → Sats-OS を **インストール**

以後は `main` に push するたびに新しいビルドが自動で届きます。
ビルド番号は実行時刻（`yymmddHHMM`）、バージョンは `project.yml` の `MARKETING_VERSION`。
`ITSAppUsesNonExemptEncryption = NO` を入れてあるので輸出コンプライアンスの質問は出ません。
Bundle ID を変える場合は **Variables** に `BUNDLE_ID` を追加します。

### うまくいかないとき

| 症状 | 対処 |
|---|---|
| 「あと 1 ステップ」で止まる | App Store Connect にアプリがまだない。手順 3 の 2 を実行 |
| `No profiles for 'com.itokichi0000.satsos' were found` | App Store Connect のアプリのバンドル ID が違う |
| `Team ID が分かりませんでした` | Secrets に `APPLE_TEAM_ID`（[Membership details](https://developer.apple.com/account) の 10 文字）を追加 |
| `Cloud signing permission error` / `No signing certificate "iOS Distribution"` | API キーのアクセスを **Admin** にする |
| `The provided entity includes an attribute with a value that has already been used` | ビルド番号の重複。もう一度実行すれば新しい番号になります |
| `Missing secrets` の警告で何もしない | 手順 2 の Secrets が足りない |

ログは各実行の **Artifacts → testflight-logs** に残ります。

## クレジット

- [Bark SDK](https://gitlab.com/ark-bitcoin/bark-ffi-bindings)（MIT）— Second
- フォント：[Jacquard 12](https://fonts.google.com/specimen/Jacquard+12)・[DotGothic16](https://fonts.google.com/specimen/DotGothic16)・[Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans)（SIL Open Font License 1.1、`licenses/`）
- bitty：Zappy Bitty / 個人サイトと同じ絵
