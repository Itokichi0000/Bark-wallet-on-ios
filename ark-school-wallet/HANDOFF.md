# HANDOFF — Ark School Wallet

最終更新: 2026-11-21 / ブランチ `claude/intelligent-maxwell-jg657l`（PR は未作成）

アップロードされた設計資料（`CLAUDE.md`・`START_HERE.md`・`PROMPT_FOR_CLAUDE.md`・`docs/SPEC.md`）をもとに、Signet 専用の教育用 Web ウォレットを作った作業の引き継ぎです。

---

## 1. ここまでの作業

### 作ったもの

`ark-school-wallet/` に React + Vite + TypeScript + Tailwind の Web アプリを作りました。Bark の公式 Web SDK `@secondts/bark` 0.28.0（Bark 0.9.0）で、本物の Signet ウォレットがブラウザ内で動きます。

| 画面 | 内容 |
|---|---|
| Wallet | 残高（使用可能 / 更新が必要 / 保留中 / 合計 / オンチェーンを分けて表示）、受け取り（QR）、Ark アドレスへの送金（確認ダイアログあり）、履歴 |
| X-Ray | Coins（VTXO カード。値ごとに出典の SDK 呼び出しを記録）、Life（履歴の消費・生成）、Structure（実データの exit depth と概念図）、Safety（期限・要対応・バックアップ状況）。送金前後のスナップショット差分 |
| VTXO 詳細 | Identity / Lifetime / How it exits / Explain。緊急 Exit 費用の見積もり、未承認の exit トランザクションの列挙、Refresh 費用の見積もり（すべて読み取りのみ） |
| Lab | 6レッスン（UTXO と VTXO、3つの送金方法、ラウンド、Refresh と期限、Offboard と緊急 Exit、バックアップ）。すべてローカルのシミュレーション |
| Learn | 用語辞典（30秒で理解 / 技術的に詳しく / Second 公式ドキュメントへのリンク） |
| 設定 | Signet 固定の接続情報、サーバー情報、バックアップの説明、復元フレーズの表示、SDK 対応状況、診断ログ（伏せ字済み）、ウォレット削除 |

- デモモード：決まった fixture で動き、ネットワークにも SDK にも触れません。`DEMO-` で始まるアドレスにしか送れません。
- 日本語が基本で、英語に切り替えられます。スマホ（360px）と PC、ライトとダークに対応しています。

### ドキュメント

| ファイル | 内容 |
|---|---|
| `README.md` | 使い方、確認できたこと、未検証の項目、バックアップの注意、公開時の HTTP ヘッダー |
| `docs/SDK_CAPABILITIES.md` | インストールした型定義と、本物の Signet サーバーへの probe で確かめた SDK の対応状況 |
| `docs/SECURITY_REVIEW.md` | Signet 固定、鍵の保管、送金、バックアップ、緊急 Exit、デモの分離 |
| `docs/TEST_PLAN.md` | 仕様の受け入れテスト T01〜T22 と、それぞれを確かめているテストの対応表 |

### リポジトリ全体の変更

- `.github/workflows/ark-school-wallet.yml` を追加しました（型チェック・lint・テスト・ビルド・E2E）。
- `.github/workflows/ios-build.yml` と `testflight.yml` の `paths-ignore` に `ark-school-wallet/**` を追加しました。Web だけの変更で macOS ビルドや TestFlight アップロードが動かないようにするためです。
- ルートの `README.md` に、このフォルダへの案内を追加しました。
- iOS アプリのコードには触れていません。

コミット: `8684aee Add Ark School Wallet, a Signet-only educational web wallet`

---

## 2. 決まったこと（と理由）

| 決定 | 理由 |
|---|---|
| iOS リポジトリ内の別フォルダ `ark-school-wallet/` に置く | 仕様が Web アプリで、iOS アプリとは技術も目的も別のため。このセッションで push できるのはこのリポジトリだけ |
| `@secondts/bark` を **0.28.0 に完全固定** | 0.9.0 の changelog に「0.8.1 以下は小さい VTXO からの送金がサーバーに拒否されうる」とある。アプリが使う API は 0.27.0 と同じ |
| **Bark のバックグラウンドデーモンを止める**（`runDaemon: false`） | 仕様の「自動 Refresh・Exit をしない」を守るため。同期は手動と、画面表示中の30秒ごとの `sync()` だけ |
| チェーン高は `OnchainWallet.tipHeight()` から取る | `Wallet` クラスにチェーン高を返すメソッドがないため。取れないときは残りブロックを「取得不可」と表示する |
| 復元フレーズはパスフレーズで暗号化して IndexedDB に保存 | SDK は開くたびに mnemonic を必要とするが、仕様で localStorage への保存は禁止。AES-GCM-256、PBKDF2-SHA256（60万回） |
| 送金の例外は「失敗」ではなく **「結果不明」** として扱う | 二重送金を防ぐため。自動で再送せず、ユーザーが同期して履歴を確認するまで送金をロックする |
| Refresh・Offboard・緊急 Exit の **実行は無効** | Refresh は Signet で試せていない。Offboard と Exit は MVP の範囲外。費用見積もりなど読み取りだけ有効 |
| 「確認推奨」の基準は `max(Bark の refresh しきい値, サーバーの VTXO 寿命の25%)` | 仕様の「判定値を恣意的に決めない」に従い、サーバーとウォレットの値から計算する。Signet なら36ブロック |
| DB の継続バックアップは **未対応** と表示 | Web SDK に整合的なエクスポート API がないため。フレーズだけでは完全に復元できないことを UI の各所で説明している |
| Signet をビルド時・コード・実行時の3段階で強制 | Mainnet の設定ではビルドが止まる。開いた後もサーバーが Signet と答えなければ中止する |

---

## 3. 確認済み / 未検証

### 確認済み

- `npm run typecheck` / `lint` / `test`（Vitest 65件）/ `build` がすべて成功
- Playwright のデモ E2E 10件が成功（PC 幅と 360px 幅、本番ビルドで CSP 有効）
- **本物の Signet サーバーでのウォレット作成〜再オープン**（`LIVE_SIGNET=1` の E2E）
- Mainnet のアドレスへの送金は拒否される（`validateArkoorAddress` が false を返し、SDK 側も "different network" で拒否）
- 二重送金防止と残高の正しさのテストは、コードをわざと壊すと失敗することも確認した

### 未検証（Signet sats が必要。faucet には GitHub ログインが要る）

- 実際の受け取りと、受け取った VTXO の表示
- 実際の `sendArkoorPayment` と送金前後の差分
- 入金済みウォレットの復元（サーバーのメールボックスからの回復）
- VTXO が期限を過ぎて「更新が必要」になる挙動

---

## 4. 次にやること

優先度の高い順です。

1. **入金して LIVE を検証する。** https://signet.2nd.dev/ で Receive 画面の Arkアドレスに送ってもらい、次を確かめる。
   - 受け取り → X-Ray での表示 → 別ウォレットへの少額送金 → 送金前後の差分
   - 結果が分からない送金の照合フロー
2. **【要判断】VTXO の寿命が短い問題への対応を決める。** Second の Signet サーバーは VTXO 寿命が **144ブロック（約1日）** で、今の設定では受け取った VTXO が約1日で「更新が必要」になる。選択肢は2つ。
   - (a) 1 で入金したウォレットで手動 Refresh（`refreshVtxos`、デーモンなしでラウンドが完了するかも含む）を検証し、確認ダイアログ付きで有効にする
   - (b) ユーザーが明示的にオンにしたときだけ、Bark の自動メンテナンス（デーモン）を有効にする
3. **iOS アプリの Bark SDK を更新する。** iOS は `0.27.0+bark-0.8.1` に固定されていて、mainnet で小さい VTXO からの送金が失敗しうる。前回のセッションで提案カードを出してある（「Upgrade iOS Bark SDK past 0.8.1」）。
4. **公開する場合は**、`dist/` を HTTPS で配信し、README にある CSP（`frame-ancestors` を含む）を HTTP ヘッダーで付ける。
5. 必要なら PR を作る（まだ作っていない）。
6. 今後の候補：`vtxoEncoded()` を使った読み取り専用の実構造ビュー、Lightning とオンチェーン送金、SDK が対応したら暗号化した DB の継続バックアップ。

---

## 5. 引き継ぎで知っておくと良いこと

- **`userAgent` は `name/version` 形式が必須。** スラッシュがないと、Signet サーバーがハンドシェイクを `invalid x-user-agent: no slash present` で拒否する（`src/lib/bark/adapter.ts`）。
- **`validateArkAddress` は形式チェックだけ。** Mainnet の `ark1…` も通る。ネットワークとサーバーの確認は `wallet.validateArkoorAddress`、ネットワーク違いの判定には `parsePaymentRequest` を使っている。
- **SDK 更新時の検知：** `WalletLike = Pick<Wallet, …>` があるので、SDK が更新されて使っているメソッドが変わると `npm run typecheck` が失敗する（T22）。
- **ツールのバージョンが新しい。** Vite 8、Vitest 5、TypeScript 6、ESLint 10、react-router 8、Tailwind 4。
- **このコンテナで E2E を動かすとき：** Chromium はプロキシ経由でつなぐ（`playwright.config.ts` が `HTTPS_PROXY` を渡す）。Playwright はプリインストール版に合わせて 1.63.0 に固定している。
- **CSP の `frame-ancestors` は meta タグでは効かない。** ホスト側の HTTP ヘッダーで付ける必要がある。
- **SDK の仕組みと UI の関係：** UI は `WalletPort`（アプリ独自の interface）だけを見ている。SDK に触るのは `src/lib/bark/adapter.ts` だけで、デモは `src/lib/demo/DemoWallet.ts` にある。

### よく使うコマンド（`ark-school-wallet/` で実行）

```bash
npm install && npm run dev
```

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

```bash
npm run test:e2e
```

```bash
LIVE_SIGNET=1 npm run test:e2e -- --project=desktop signet
```
