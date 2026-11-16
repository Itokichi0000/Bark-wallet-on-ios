# ちょうじゅ / Choju — Bark wallet for iOS

鳥獣戯画のうさぎとかえると暮らす、[Second](https://second.tech) の **Bark SDK**（Ark プロトコル）を使った自己管理型ビットコインウォレットです。
白と黒の墨の世界に、ビットコインのオレンジを少しだけ。端末のライト / ダークモードに合わせて色が変わります。

- **いえ**：うさぎの部屋（タップでしゃべる・跳ねる）、残高、おくる / もらう、さいきんの取引
- **おくる**：Ark アドレス / ライトニング（invoice・offer・アドレス・LNURL）/ `bitcoin:` URI / オンチェーンアドレス。QR 読み取り・貼り付け、手数料の見積もり、長押しで送金。かえるが手紙を届けます
- **もらう**：Ark アドレス、ライトニングの請求書（QR）。着金するとうさぎが跳ねて「もらった！」
- **きろく**：取引履歴（すべて / もらった / おくった）と詳細
- **なかま**：これまでの最高残高がのびると、なかまの動物があそびに来て、いえの部屋に住みつく（1,000 sats でさる → 1万できつね → 5万でねこ → 10万でしか → 50万できじ）。使っても帰らない。仲間はそれぞれ勝手に動き（さるはそわそわ、きつねは跳びかかり、ねこはのびと昼寝、しかは丘を歩いて草を食み、きじはついばむ。うさぎは散歩したり、おじぎ・のび・お月見・立ったままうとうとしたりしてつぶやく。かえるも「けろ」と鳴いたり、虫に飛びついたり、ぴょこぴょこ跳ねたりする）、タップすると得意の動き、着金するとみんなで跳ねる
- **せってい**：単位・音・振動、本番（MAINNET）⇄ テスト用（SIGNET）、シード表示（Face ID）、Ark サーバー情報、おさいふの削除
- シードは iPhone のキーチェーン（この端末のみ）に保存

**MAINNET**（`ark.second.tech`、本物のビットコイン）で起動します。最初は少額で試してください。
テスト用の **SIGNET** には せってい から切り替えられます（テストコインは https://signet.2nd.dev/ ）。

## 構成

| 場所 | 中身 |
|---|---|
| `project.yml` | XcodeGen のプロジェクト定義（`xcodegen generate` で `SatsOS.xcodeproj` を作る） |
| `SatsOS/Wallet/` | Bark SDK まわり（`WalletStore`：起動・同期・送金・受取・通知、キーチェーン、ネットワーク設定） |
| `SatsOS/Design/` | 色・フォント・部品・キャラクター（うさぎ・かえる・なかま）の表示と動き・効果音 |
| `SatsOS/Screens/` | 起動 / はじめて / いえ / おくる / もらう / きろく / なかま / せってい / QR スキャナ |
| `.github/workflows/ios-build.yml` | push のたびにシミュレータ向けにビルド（コンパイル確認） |
| `.github/workflows/testflight.yml` | main への push か手動実行で TestFlight にアップロード |
| `scripts/testflight.sh` | アーカイブ → 署名 → アップロード |
| `scripts/asc.py` | App Store Connect API（Bundle ID 登録、Team ID 取得、内部テスターに自分を追加） |
| `tools/characters/render.mjs` | うさぎ・かえる・なかま（さる・きつね・ねこ・しか・きじ）を筆の線（`brush.mjs`：入り・抜き・太さの揺らぎ）で描き、紙・薄墨・墨・オレンジのレイヤーとアプリアイコンを書き出す（`NODE_PATH=$(npm root -g) node tools/characters/render.mjs`、`--preview 出力.png` で一覧）。`extract.py` は原画スキャンから切り抜く場合の道具 |

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
- フォント：[Klee One](https://fonts.google.com/specimen/Klee+One)（SIL Open Font License 1.1、`licenses/`）
- うさぎ・かえる・なかま：鳥獣人物戯画（高山寺蔵、パブリックドメイン）をもとに描き起こした絵
