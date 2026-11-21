# ちょうじゅ / Choju — Bark wallet for iOS

[Second](https://second.tech) の **Bark SDK**（Ark プロトコル）を使った自己管理型ビットコインウォレットです。
見た目は 学習アプリらしい、やわらかくカラフルで いつも ゆっくり動いているデザイン。Ark の ことばごとに 色を 決めてあり（**オレンジ＝あなたの sats / VTXO、むらさき＝Ark サーバーとラウンド、ティール＝ビットコインのチェーン、きいろ＝ライトニング、ピンク＝期限まぢか・エラー**）、ホームでも **Ark の しくみを見せるアニメーション** でも 同じ色で 出てきます。ボタンは 押すと 沈み、タブや ステップは 共通の スプリング（`Motion`）で なめらかに 動きます。端末のライト / ダークモードに合わせて色が変わり、「視差効果を減らす」を オンにすると 動きは 止まります。

- **ホーム**：波が ゆれる 残高カード、おくる / もらう、**Ark のようす**（VTXO を 1 つずつ コインで表示：大きさは金額、まわりのリングは期限までの残り / 次のラウンドまで なめらかに 満ちていくリング / 新しいブロックが 弾んで入ってくる チェーン）、さいきんの取引
- **すいそう**：VTXO を 1 ぴきずつ魚で表示。おくると魚が泳ぎ去り、おつりや受け取りは新しい魚として入ってくる。期限が近いと「!」が出て水がにごり、Refresh（みずかえ）で新しい魚に。ブロックの時計、魚ごとのカルテ（期限・てわたし回数・ひとりで出るときの大きさ）
- **きろく**：取引履歴と詳細。詳細には、その取引が Ark の中でどう動いたかの図
- **しくみ**：ボード / Ark で送る / ラウンド / 期限と Refresh / ライトニング / オンチェーンへ / ひとりで脱出 を、サーバー・人・ブロックの図でループ再生（字幕つき、タップで一時停止、字幕タップでその場面へ。視差効果を減らす設定ではコマ送り）。ことば図鑑（たとえ / ほんとう）、接続中サーバーの実際のきまり、クイズ
- **おくる**：Ark アドレス / ライトニング（invoice・offer・アドレス・LNURL）/ `bitcoin:` URI / オンチェーンアドレス。QR 読み取り・貼り付け、手数料の見積もり、長押しで送金。送る前と送っている間、その支払いが通る道を図で表示
- **もらう**：Ark アドレス、ライトニングの請求書（QR）。届くと金額と「とどいた しくみ」の図
- **せってい**：単位・音・振動、本番（MAINNET）⇄ テスト用（SIGNET）、シード表示（Face ID）、Ark サーバー情報、おさいふの削除
- シードは iPhone のキーチェーン（この端末のみ）に保存

**MAINNET**（`ark.second.tech`、本物のビットコイン）で起動します。最初は少額で試してください。
テスト用の **SIGNET** には せってい から切り替えられます（テストコインは https://signet.2nd.dev/ ）。

## 構成

| 場所 | 中身 |
|---|---|
| `project.yml` | XcodeGen のプロジェクト定義（`xcodegen generate` で `SatsOS.xcodeproj` を作る） |
| `SatsOS/Wallet/` | Bark SDK まわり（`WalletStore`：起動・同期・送金・受取・通知、キーチェーン、ネットワーク設定） |
| `SatsOS/Design/` | 色・文字・スプリング（`Style.swift`）、部品（`Components.swift`）、動き（`Motion.swift`）、Ark の図とアニメーション（`ArkScenes.swift`）、すいそう（`FishTank.swift`）、効果音 |
| `SatsOS/Screens/` | 起動 / はじめて / ホーム / すいそう / きろく / しくみ / おくる / もらう / せってい / QR スキャナ |
| `.github/workflows/ios-build.yml` | push のたびにシミュレータ向けにビルド（コンパイル確認） |
| `.github/workflows/testflight.yml` | main への push か手動実行で TestFlight にアップロード |
| `scripts/testflight.sh` | アーカイブ → 署名 → アップロード |
| `scripts/asc.py` | App Store Connect API（Bundle ID 登録、Team ID 取得、内部テスターに自分を追加） |
| `tools/characters/render.mjs` | アプリアイコンを 書き出す道具（以前のデザインの キャラクター画像も 作れますが、アプリには もう 入れていません）。うさぎ・かえる・なかま（さる・きつね・ねこ・しか・きじ）を筆の線（`brush.mjs`：入り・抜き・太さの揺らぎ）で描き、紙・薄墨・墨・オレンジのレイヤーとアプリアイコンを書き出す（`NODE_PATH=$(npm root -g) node tools/characters/render.mjs`、`--preview 出力.png` で一覧）。`extract.py` は原画スキャンから切り抜く場合の道具 |

Bark SDK: `https://gitlab.com/ark-bitcoin/bark-ffi-bindings.git` を `0.28.0+bark-0.9.0` に固定しています。

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
   [App Store Connect → アプリ](https://appstoreconnect.apple.com/apps) の **＋ → 新規 App** で、iOS・名前（例 `ちょうじゅ`）・日本語・バンドル ID `com.itokichi0000.satsos`・SKU（例 `satsos`）を入れて作成
3. もう一度 **Run workflow**。20 分ほどで緑になり、あなたが内部テスターに自動で追加されます
4. iPhone に **TestFlight** アプリを入れ、同じ Apple ID でサインイン → ちょうじゅ を **インストール**

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
- デザイン：色・部品・アニメーションは すべて SwiftUI で 自作（外部の UI ライブラリや 画像は 使っていません）
- アプリアイコン（とリポジトリに残している以前のキャラクター）：鳥獣人物戯画（高山寺蔵、パブリックドメイン）をもとに描き起こした絵
