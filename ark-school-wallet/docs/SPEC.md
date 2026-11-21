# Ark School Wallet — プロダクト・技術設計書

> Version 1.0 / 2026-11-21 / Claude Code 向け実装仕様  
> 開発名: **Ark School Wallet**（仮称）  
> プロダクトの一言: **使いながら、Arkの仕組みが見えるBitcoinウォレット。**  
> 公式のBark Walletとは別の独立した教育プロジェクト。Second Labsの公式製品と誤認させない。

---

## 0. エグゼクティブサマリー

### 何を作るか

Bark SDKを用いて、**実際にSignet上のArk送受金を行える学習用Webウォレット**を制作する。一般的なウォレットの操作（作成、復元、残高、受取、送金、履歴）に加えて、Ark特有の仮想的なコインである**VTXO（Virtual UTXO）**を、理解しやすいグラフィック・説明文・インタラクティブな教材として表示する。

ユーザーは「1000 satsを受け取る → VTXOが増える → 送金する → 消費されたVTXOとお釣りを確認 → Refreshを学ぶ → 協調的なオンチェーン引き出しと緊急Exitを比較する」という一連の体験からArkを理解する。

### 価値

- 初心者：見慣れたウォレットを操作するだけでArkの基本が理解できる。
- 中級者：VTXOの数・種類・有効期限・状態・コストを詳しく観察できる。
- 開発者：Bark SDKの操作と実際のウォレットデータの変化を把握できる。
- 教育者：TBBのワークショップなどで、デモ教材として投影・使用できる。

### 絶対条件

1. MVPは**Signet限定**。Mainnetへの切替UIやフラグは設けない。
2. **Bark公式Web SDK** `@secondts/bark` を使う。Arkade SDKなど別実装へ無断で置換しない。
3. **ウォレットとして本当に動く部分**と**説明用シミュレーション**を明確に分離する。
4. 残高・期限・VTXO状態・費用を推測で「実測値」として表示しない。
5. ユーザーの秘密鍵・mnemonic・ウォレットデータをアプリのバックエンドへ送信しない。
6. **seed phraseだけではフルバックアップにならない**。状態・履歴・進行中Exitの復元にはDBの継続的バックアップが重要。
7. アプリがVTXOを自動更新する・強制Exitが確実に成功するなどの保証をしない。
8. SDKにない操作は架空のメソッドを作らず、実装可否を調査して機能フラグで管理する。

---

## 1. 成功条件・評価指標

### MVPのユーザーストーリー

**S1 — 初心者：** Signetウォレットを生成し、復元フレーズを記録して、無料のSignet satsを受け取る。残高とVTXOがつながっていることを理解する。

**S2 — 初心者：** Arkアドレスへ少額送金し、「どのVTXOが使われたか」「どのVTXOが生まれたか」を差分画面で確認する。

**S3 — 中級者：** VTXO詳細で、金額・識別子・種別・状態・満了ブロック高・現在チェーン高・残りブロック数・推定日数を確認する（SDKから得られるフィールドに限る）。

**S4 — 中級者：** Refreshの意味・ラウンド・新しい期限・概算費用を学び、サポートされるなら手動でSignetのRefreshを試す。

**S5 — 上級者：** 協調的なOffboardと一方的なEmergency Exitの違いを学び、Exitに必要なトランザクションの構造を概念図で理解する。実行機能はMVPの必須要件ではない。

**S6 — 教育者：** ウォレット未作成でも「Demo Lab」で教材用の例を動かし、実操作との差を明確に説明できる。

### 完成基準

- 1ブラウザでSignetウォレットを作成・開き直せる。
- Signetで受取アドレスを発行し、実際の受取を同期して確認できる。
- SignetのArk送金を実行し、結果を履歴に表示できる。
- 少なくとも2件以上の異なるVTXO状態をUIで表示できる（実データを優先、デモのみでも状態差分教材は動く）。
- 送金前後を保存したスナップショットから差分が確認できる。
- 期限をブロック数で表示し、時間換算は**参考値**であると明記する。
- 全画面で「Signet」と「DEMOまたはLIVE」が見える。
- 設計上危険なバックアップ欠落を隠さず、UIからバックアップ手順を読める。
- npm scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`（導入に応じて）を用意する。

---

## 2. ユーザー体験の中心概念

### 2.1 3つのモード

| モード | 目的 | 内容 |
|---|---|---|
| **Wallet** | 普通に使う | 残高、受取、送金、履歴、同期、接続状態 |
| **X-Ray** | 内部を理解する | VTXO一覧、状態、期限、変更差分、資金の流れ |
| **Lab** | 失敗を恐れず学ぶ | ステップ式教材、架空の例、期限・Exitシミュレーター |

**重要:** 3モードは同じ本物のBarkウォレットを参照できるが、**Labのシミュレーション操作は実ウォレットに一切影響しない**。Labで使う架空データはデモと常時表示。

### 2.2 説明の二段階表示

各機能に「やさしい説明」と「技術的な説明」を用意する。

例：

- やさしい：「VTXOはArkの中で持っているBitcoinのかたまり。残高は、こうしたかたまりの合計などから計算される」
- 技術：「VTXOはArkのオフチェーン所有権を表す構造。取引の履歴や支出可能状態、Bitcoinのブロック高に基づく期限、Exitの取引経路が関係する」

説明は正確さのため、以下を強調：

- VTXOはオンチェーンUTXOそのものではない。
- Arkでの送金はすべて即座にBitcoinのベースチェーンへ書き込まれるわけではない。
- `spendable`・`pending`・`needs refresh`・`exited`などの違いは重要。
- 期限、Exit可能性、費用、ラウンドの待ち時間は状況次第。
- 「秘密鍵を持っている＝いつでも必ず無費用でExitできる」ではない。

### 2.3 ゲーミフィケーションは理解補助だけ

「ウォレットを作った」「アドレスを見た」「VTXOの詳細を開いた」「Refreshの説明を読んだ」などのチェック項目を置く。ただし資金が減る行為や危険な操作を誘導する報酬設計にしない。

---

## 3. 画面仕様

### 共通ヘッダー

- 製品名 / 「Independent educational demo」表記
- `SIGNET`固定バッジ（赤ではなく視認性のある中立的強調）
- `LIVE` / `DEMO`（ラベルは常に明確）
- Ark server接続状態・最終同期時刻
- 日本語 / English 切替
- `?` ガイド / バックアップへの導線

### 3.1 `/` — ダッシュボード（Wallet）

```text
┌─────────────────────────────────────────────────────────────┐
│ Ark School              [SIGNET] [LIVE]   JP / EN  Settings │
├─────────────────────────────────────────────────────────────┤
│ 学びながら使えるArkウォレット                               │
│                                                             │
│                使用可能  12,400 sats                        │
│    [受け取る] [送る] [同期]                                  │
│                                                             │
│ [VTXO 3個] [更新が必要 1個] [保留中 200 sats]                  │
│                                                             │
│ 🟠 あなたのBitcoinは複数のVTXOで管理されています。          │
│ [中身を見る →]                                              │
│                                                             │
│ 最近の取引  ...                                              │
└─────────────────────────────────────────────────────────────┘
```

**要件:**

- 残高の内訳はSDKの現行`balance()`のフィールドを検証したうえで正確にマッピング。
- 利用不可・保留中・Refreshが必要な金額を無条件で「今送れる残高」に合算しない。
- 自動同期に依存する場合は明示し、手動同期ボタンも設ける。
- UIのsatsは整数、JSの浮動小数点で資金を計算しない。SDK型に応じ`bigint`等を安全に使用。

### 3.2 `/wallet/create` / `/wallet/restore`

- 初回起動時「デモを試す」「Signetウォレットを作る」を選択。
- 生成前にブラウザ保存・バックアップの注意を短く表示。
- 本物のウォレットを作る場合は復元フレーズを**本人の画面にのみ**表示し、確認ステップを通す。
- ページ初期ロードやログにフレーズを表示しない。
- 復元時は入力がクライアント内で完結。すでにあるDBと競合する場合は上書き前に明示確認。
- **seed phrase alone ≠ fully independent restore** の注意とDBバックアップの説明を必ず表示。
- セキュアストレージ方針は実装前に調査・記録（通常のWebローカル保存に対するリスク、XSS、ブラウザのデータ消去）。安全に解決できない場合はSignet限定の実験扱いを維持。

### 3.3 `/wallet/receive`

- SDKによるArk受取アドレス発行、コピー、QR表示。
- `tark`などのアドレス表記やNetwork validationはSDKに確認し、独自に決めつけない。
- 任意の金額入力、相手に表示する補足（アプリ独自UI）。
- 受取待機、同期、受取済の状態を明確に分ける。
- BIP-321統合URI、Lightning invoice、オンチェーン受取はPhase 2以降でサポート可能性を確認。
- Signet faucetへのリンクは公式エンドポイントの現行状態を確認して表示。

### 3.4 `/wallet/send`

- P0は**Arkアドレスへの送金だけ**。Lightning / OnchainはP1。
- 受取アドレス、金額、見積可能なら手数料の情報、確認画面を用意。
- 結果が不明なまま失敗した場合、**自動で再送しない**。同期/履歴で送金状態を照合する。
- 確認画面にネットワーク、送金先短縮形・全表示切替、金額を出す。
- 送金実行前のVTXO snapshotと完了後のsnapshotを比較し、学習パネルへつなげる。

### 3.5 `/xray` — VTXO研究室

もっとも重要な差別化画面。

**タブ:**

1. **Coins**：すべてのVTXO（現存・過去。SDKにあれば）
2. **Life**：VTXOの生成・支出・Refresh・Exit状態を時系列で表示
3. **Structure**：概念的なツリー、または真のトランザクションデータによるグラフ
4. **Safety**：期限、Exit可能性、バックアップ状況、要対応項目

**VTXOカードに表示するフィールド:**

- ID（省略表示＋コピー）
- sats
- type/kind（SDKに取得できる場合）
- state（Spendable / Locked / Spent / Exitedなど。実際のSDK値を正規化）
- expiry block height
- chain tip height
- blocks remaining（`expiryHeight - tipHeight`。負数含める）
- remaining estimate（平均10分/ブロック等の参考値。厳密な残時間ではない）
- exit depth / exit transaction weight（SDKが公開する場合のみ）
- origin anchor / transaction ID（SDKが公開する場合のみ）
- raw / detailの出典と最終同期時刻

**状態の表現:**

- `spendable`：現時点の条件に基づき使用可能とSDKが判断
- `locked`：別操作の進行などで一時的に使用不可
- `spent`：別のVTXOや送金に消費された
- `exited`：オンチェーンへのExit処理へ移った状態。最終請求・着金の完了とは別
- `needs-refresh`：SDKが更新を必要とするとみなす残高・VTXO（最新版の実フィールドに準拠）
- `pending`：ラウンド、board、送受信、exitなど処理進行中（根拠のある細分類を優先）
- `unknown`：SDKが情報を返さない、または未対応。推測して決めつけない

**表示方針:** 実データが取れない箇所は `SDKから取得不可` と表示し、別の場所に**概念図**を置く。概念図には必ず「説明用・実ウォレットの取引構造ではありません」と明記。

### 3.6 `/xray/vtxo/[id]` — 個別VTXO詳細

カードの拡張として、以下の4セクションを表示。

1. **Identity**: ID / 金額 / 種別 / 状態
2. **Lifetime**: 誕生、満了ブロック高、経過、タイムライン
3. **How it exits**: 概念的なExit経路と必要ステップ。実経路は本物の構成をSDKが提供する場合だけ。
4. **Explain**: 「なぜ期限が必要なの？」「なぜサーバーがいてもself-custodyなの？」「VTXOとUTXOは何が違う？」

### 3.7 `/lab` — 操作できる学習教材

実資金を使わない、**完全ローカルのシミュレーター**。起動時に`DEMO DATA — NO REAL PAYMENT`と表示。

**Lesson 1: UTXOとVTXO**

10000 satsのVTXOを持つ例。1000 satsを送ると、概念的に入力が消費され新しいVTXOへ変化する様子をアニメーション表示。金額の配分は教育用簡略モデルと明示し、実手数料等を固定値として主張しない。

**Lesson 2: On-chain / Ark / Lightning**

同じ1000 satsを3つの方法で送る場合の概念比較。確定方法・サーバー要件・手数料・処理速度を、測定値ではなく一般的な特徴として示す。

**Lesson 3: Ark Round**

ラウンドの待機、入力VTXO、新規VTXO、確認の時間軸を可視化。ラウンドが常に即時に終わるとは表示しない。

**Lesson 4: Refreshと期限**

VTXOの満了ブロックをスライダーで動かし、更新した場合と放置した場合を比較。満了後の回復可能性は実装・サーバー状況に依存するため「期限を過ぎたら必ず即消失」と単純化しない。

**Lesson 5: Cooperative Offboard vs Emergency Exit**

Arkサーバーと協力する場合、できない場合の2ルートを表示。一方的Exitは複数のオンチェーン取引・待ち時間・手数料・必要資金が発生する可能性を説明。

**Lesson 6: バックアップと復元**

Seedのみと、継続的な暗号化DBバックアップの違いを再現。サーバーの協力が得られない状況、履歴・進行中Exitに関する復元範囲を比較。

### 3.8 `/learn` — 参考資料・用語辞典

- Arkの概要
- ASP / Ark server
- VTXO、UTXO、Round、Boarding、Offboarding、Refresh、Arkoor、Emergency Exit
- Lightningとの関係
- Trust assumptions：in-roundとout-of-round、サーバー協調の有無
- 用語カードは「30秒で理解」「技術的に詳しく」「原典リンク」の3段階
- 説明内容はSecond公式資料と更新履歴を根拠に見直す

### 3.9 `/settings` — ネットワーク・保存・バックアップ

- 設定：Signet、選択中のASP、chain source、同期状態（変更可能にする場合は宛先を厳密に検証）
- バックアップガイドと状態確認
- データエクスポートの有無（API実現可能性に基づく）
- Demo Lab初期化
- ウォレット削除（誤操作防止の二段階確認）
- 診断ログをエクスポートするときは秘密データを完全に削除

---

## 4. デザインシステム

### トーン

- 「技術解説書を読む」ではなく「透明なウォレットを触る」感覚。
- 高密度な開発者画面を避け、通常の支払い機能はシンプルに。
- 図解は必要なときに徐々に深掘りできる Progressive Disclosure。
- 技術を知らなくても分かる日本語、英語表示にも対応。

### 画面構成

- Desktop：左サイドバー + Wallet中央 + 右側学習パネル
- Mobile：下部タブ（Wallet / X-Ray / Lab / Learn）
- 色：ホワイト/チャコールをベース、Arkのオレンジをポイントカラー。ダークモード対応。
- 警告は色だけに依存せず、明確なテキスト・アイコンで表示。
- モーションは送金やRefreshによる**データの変化**を示すために限定する。`prefers-reduced-motion`対応。
- 重要アクションは全てキーボード操作・スクリーンリーダーで実行できる。

### グラフ原則

- **実データグラフ**：SDKの事実に由来するノードだけ（根拠表示あり）。
- **概念図**：スクリプトやExit chainの説明に用いるイラスト。`Conceptual model`ラベルを表示。
- **差分ビュー**：操作前後のスナップショット比較。生成/消費/状態変更の確度を示す。
- 実在しない出力・トランザクション・署名を勝手に描かない。

---

## 5. 技術スタック

| 層 | 推奨 | 理由 |
|---|---|---|
| UI | React + TypeScript + Vite | ブラウザWASMとの相性、SPAで教育体験に集中 |
| SDK | `@secondts/bark`（公式） | BarkのWebAssembly SDK |
| Styling | Tailwind CSS + shadcn/ui | 学習コンポーネントの再利用 |
| State | Zustand + TanStack Query（必要な範囲） | Walletセッション状態・同期キャッシュ |
| Graph | `@xyflow/react` または軽量SVG | VTXO・Exitの説明図 |
| Motion | CSS / Framer Motion（必要時） | VTXO変化の視覚化 |
| QR | 信頼できる小型QRライブラリ | Signetアドレス表示 |
| Validation | Zod | SDKの外側に出るデータを検証 |
| Tests | Vitest + Testing Library + Playwright | 教材・WalletAdapter・UIの検証 |
| Persistence | Bark SDKのIndexedDB + 別途検討したバックアップ | 鍵をサーバーに送らない |
| Deployment | HTTPSで配信可能な静的ホスティング | 暗号APIとWASMが使えるセキュアコンテキスト |

**注意:** Webアプリ内のウォレットは、ブラウザ拡張・XSS・サイト改ざんの影響を受けやすい。MVPはSignetに固定し、後にMainnetを考える場合は別のセキュリティレビューと本番運用設計が必要。

### SDK実装時の調査ゲート（必須）

- `@secondts/bark`の実際にインストールしたバージョンと型定義を確認。
- `Wallet.create/open`、`Config`、`balance`、アドレス生成、送金、同期、`vtxos`、`refresh`、履歴、オフボード、Exitのシグネチャを**現行型定義から特定**。
- Web SDKで提供されていないデータは、SDKが対応するまで`unavailable`として扱う。
- **Barkd REST APIとブラウザWASM SDKを混同しない**。BarkdのAPIに存在するからWeb SDKにも同名メソッドがある、とはみなさない。
- `second.tech`のホームページ例とSDKの型定義に差がある場合は**インストールしたバージョンの型定義を優先**し、ドキュメントの差異を記録。
- 開発最初に`docs/SDK_CAPABILITIES.md`を生成して調査結果を表にする。

---

## 6. アーキテクチャ

```text
┌────────────────────────────────────────────────────────────┐
│ React Application                                          │
│ Dashboard | Receive | Send | X-Ray | Lab | Learn | Settings │
└──────────────────────────────┬─────────────────────────────┘
                               │ view models
                    ┌──────────▼─────────┐
                    │ App Controllers    │
                    │ Wallet / Education │
                    └────┬──────────┬────┘
                         │          │
               ┌─────────▼──┐ ┌────▼───────────┐
               │ WalletPort │ │ Lesson Engine  │
               │ interface  │ │ demo data only │
               └─────┬──────┘ └────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐       ┌────────▼────────┐
│ BarkWebAdapter │       │ DemoWallet      │
│ WASM+IndexedDB │       │ NO real keys/tx │
└───────┬────────┘       └─────────────────┘
        │
  ┌─────▼─────────────┐       ┌──────────────────┐
  │ Signet Ark server │       │ Signet chain API │
  │ configured SDK    │       │ configured SDK   │
  └───────────────────┘       └──────────────────┘
```

### 6.1 `WalletPort` — SDKからUIを切り離す

**下記はアプリ内部の独自interface**。Bark SDKの実際のメソッドではない。

```ts
type Mode = 'demo' | 'signet';
type Capability =
  | 'receiveArk' | 'sendArk' | 'sync' | 'listVtxos'
  | 'history' | 'refresh' | 'offboard' | 'exitStatus'
  | 'exitEstimate' | 'exportWalletBackup';

type CapabilityStatus = 'supported' | 'unsupported' | 'unknown';

type WalletSnapshot = {
  mode: Mode;
  capturedAt: string;
  chainTipHeight?: number;
  balance: {
    spendableSats?: string; // stringで整数を運び、端末でBigInt変換
    needsRefreshSats?: string;
    pendingSats?: string;
    onchainSats?: string;
    rawCategories?: Record<string, string>;
  };
  vtxos: VtxoView[];
};

type VtxoView = {
  id: string;
  amountSats?: string;
  kind?: string;
  state: 'spendable' | 'locked' | 'spent' | 'exited' |
         'needs-refresh' | 'pending' | 'unknown';
  expiryHeight?: number;
  exitDepth?: number;
  exitTxWeightWu?: number;
  source: 'sdk' | 'demo';
  evidence?: string[]; // この値がどこから来たか
};

type OperationResult = {
  status: 'succeeded' | 'pending' | 'failed' | 'unknown';
  referenceId?: string;
  message?: string;
};

interface WalletPort {
  getCapabilities(): Record<Capability, CapabilityStatus>;
  getSnapshot(): Promise<WalletSnapshot>;
  sync(): Promise<WalletSnapshot>;
  getReceiveAddress(): Promise<string>;
  sendArk(params: { address: string; amountSats: string }): Promise<OperationResult>;
  getHistory(): Promise<unknown[]>;
  refresh?(): Promise<OperationResult>;
}
```

**方針:**

- アプリ側の型はBark SDKと1対1でなくてよいが、SDKで得た事実の意味を変えてはならない。
- 非対応メソッドは`unsupported`。ボタンは非表示/無効にし、理由を説明。
- 学習用デモは`DemoWallet`に実装し、実ウォレットとDB/状態を共有しない。
- 機能の自動検出に失敗した場合、UIには`unknown`と明示する。
- SDKインスタンスとmnemonicは最小限のクライアント層でのみ扱う。

### 6.2 `VtxoView`生成と出所管理

- `src/lib/bark/normalize.ts`でSDK戻り値を正規化。
- 存在しないプロパティを`0`で埋めない。`undefined`のまま扱う。
- expiryの算出は両方のブロック高があったときのみ。
- `approxHours = blocksRemaining / 6`（平均10分/ブロックを仮定）等の時間換算は**参考表示**、市場・ネットワーク・実際のブロック生成間隔とは異なる。
- VTXO種類別・操作別の解説は`content/ark-glossary.ts`に分離し、技術監修しやすくする。
- snapshotを比較する`compareSnapshots(a,b)`は、同じモード・同じウォレットのデータのみ比較。

### 6.3 操作と差分画面

```text
[送金確認]
    │
    ├─ preSnapshot = await WalletPort.getSnapshot()
    ├─ ユーザーの明示承認
    ├─ sendArk(...)   ← 結果が不明な時は自動再送不可
    ├─ sync / operation status reconcile
    ├─ postSnapshot = await WalletPort.getSnapshot()
    └─ UI: 実際に変更されたVTXOの「生成」「消費」「状態変化」を表示
```

- ユーザー操作に対してネットワーク送金処理を1回しか開始しない。ボタン多重押下防止。
- 不明状態の時は取引履歴・サーバー照会での照合を案内し、再度の署名/送金を誘導しない。
- snapshotが取得できなければ「追跡できませんでした」と表示し、架空の差分は描かない。

---

## 7. VTXOの可視化仕様（重点）

### 7.1 リスト

- VTXO総数、使用可能/更新必要/Exit中/消費済の件数を表示（取得可能なもののみ）。
- 期限が近いVTXOがある場合は詳細へ遷移。
- `expiryHeight`とチェーン先端高がある場合：残りブロック数、期限の目安、リスク説明。
- 危険度の判定値を恣意的に定めない。サーバー情報やBarkの設定を可能な限り利用。
- **期限が長い＝必ずExitが安全**とはみなさない。Exit depthとコストも関係する。

### 7.2 期限・危険度

1. `No data` — 判定に必要なデータがない。
2. `Healthy` — SDKがspendableで、期限差に余裕がある。
3. `Review` — 期限が近い可能性がある／状態確認が必要。
4. `Action needed` — SDKが`needs_refresh`または対応状態を報告。
5. `Expired or exited` — 状況を明示し、送金できない理由を説明。

`Review`の基準は教育表示のための**ユーザー向け注意喚起**であり、確実な安全ラインとは表現しない。設定閾値はコードに説明とテストを持たせる。

### 7.3 ツリー

**概念ビュー**（必須）

```text
BitcoinのオンチェーンUTXO（共有アンカー）
                 │
          署名済みの経路
             /       \
          分岐       分岐
          /            \
      VTXO A          VTXO B
    (your coin)       (other)
```

これは概念図であり、実ウォレットの正確な署名ツリーを示すものではない。実際の共同アンカーとExitの経路はプロトコルの詳細による。

**実構造ビュー**（オプション）

- Bark SDK/ライブラリでVTXOの正規化された構造・exit chain・署名済みトランザクションを取得できる場合に実装。
- Second LabsのVTXO Inspector（ https://labs.second.tech/inspector/ ）を参考にする。
- 直接取り込めない場合は正確な構造を推測で構築しない。
- 署名・トランザクションデータを外部サイトへ無断送信しない。

### 7.4 時間軸

```text
受取 ──▶ Arkで保持 ──▶ Refresh ──▶ 新しいVTXOで保持
                           │
                           └─▶ 協調的Offboard or Emergency Exit
```

- 図解において「Refresh＝期限の数字をリセットするだけ」ではなく、ラウンドで旧VTXOが消費されて新VTXOになる趣旨を説明する。
- OffboardとEmergency Exitは別の行動として表示。
- 期限切れで必ずゼロになる等の断定はしない。

### 7.5 実例モード

- seedを含まないダミーfixtureを用意する。
- 受取前 / 受取後 / 送金後 / Refresh後 / Exit進行中のスナップショットを複数用意。
- 各fixtureに`demo: true`を含め、アプリの見える位置に`DEMO`を常時表示。

---

## 8. Bark SDK導入仕様

### 8.1 SDKリファレンス

- Second公式ホーム: https://second.tech/
- Bark SDK概要: https://second.tech/docs/bark-sdk
- Web SDK: https://second.tech/docs/bark-sdk/wasm
- Release notes: https://second.tech/docs/changelog
- SDK package: https://www.npmjs.com/package/@secondts/bark
- Backups: https://second.tech/docs/backups
- Connection details: https://second.tech/docs/connection-details
- Second Labs/VTXO Inspector: https://labs.second.tech/
- Bark source mirror: https://github.com/ark-bitcoin/bark

### 8.2 公式に確認できるWeb SDKの使用イメージ

現行Secondトップページに掲載されている**参考コードの一部**。SDKバージョンで変わる可能性があるので、実装時は型定義を最優先する。

```ts
import init, { Wallet, generateMnemonic } from '@secondts/bark/web';
await init();
// const config = ... // 公式ドキュメントの設定値と実際の型定義から構築
const mnemonic = generateMnemonic();
const wallet = await Wallet.create({
  mnemonic,
  config,
  dbName: 'ark-school-signet',
  forceRescan: false,
});
const balance = await wallet.balance();
// sendArkoorPaymentやreceiveは現在のSDK型に従って別のadapterに実装
```

- 上記は**そのまま完成コードではない**。`config`は型定義・公式Signet接続先の確認が必要。
- `Wallet.create`に関するドキュメント表記には複数形式がある。ビルドで検証してから採用する。
- 別のSDKである`@arkade-os/sdk`は使用しない。

### 8.3 `SDK_CAPABILITIES.md`に必ず記録すること

| 機能 | 探す対象 | 実装方針 |
|---|---|---|
| create/open/restore | `Wallet`クラス型定義 | P0必須 |
| balance | `wallet.balance()` | P0必須 |
| Ark address | address生成API | P0必須 |
| Ark send | `sendArkoorPayment`等 | P0必須 |
| sync | sync/maintenance相当 | P0必須 |
| VTXO list/details | API・型定義 | P0目標、不可なら明示 |
| history/movements | API・型定義 | P0目標、不可なら明示 |
| refresh | `refresh`または同等 | P1、可否確認後 |
| offboard | cooperative on-chain movement | P1、可否確認後 |
| emergency exit | state / progress / estimate | P2、**教育解説を先行** |
| wallet backups | IndexedDB/export hooks | P0設計必須、P1実装 |

### 8.4 最新仕様の注意点

- Bark 0.8.0では、SDKの高さ/差分型やウォレットの戻り値などに破壊的変更があった。
- 残高には`needs_refresh`の区分が導入されており、UIで`spendable`と混同しない。
- 0.8.1では緊急Exitトランザクションの事前署名・残りトランザクション列挙が追加されているが、**Web SDKにその機能があると即断しない**。
- エンドポイントやメソッドはBarkd RESTとWASM SDKで異なることがある。
- 実装時点で利用可能なSDKの機能を記録し、仕様に足りなければIssueとして残す。

---

## 9. ネットワーク・セキュリティ・保存

### 9.1 Signet固定

- `network = signet`をコード上で固定し、ビルド時にmainnet指定を拒否する検証を用意。
- 接続先はSecond公式のSignet Ark server / Esploraの**最新接続情報を参照**して設定。
- 送受信先が異なるネットワークのアドレスであれば拒否。
- UI上は常に「テスト用のBitcoinであり、実際の価値を持たないSignet sats」と説明。
- 誤ってMainnet walletと同じIndexedDB namespaceを使わない。

### 9.2 秘密情報の取り扱い

- mnemonicをURLクエリ、localStorage、analytics、console.log、error報告、サーバーAPIに含めない。
- クライアントだけで鍵を生成・署名する。
- 強力なCSPを構成し、第三者スクリプトを極力排除。
- Web Worker化は性能最適化として検討するが、それだけでXSSや鍵窃取を防げるわけではない。
- セキュリティ上の問題が見つかった場合は送金機能を一時的に無効化する。
- seed表示は意図的な操作でのみ、一時表示。スクリーンショット・画面共有への注意を促す。

### 9.3 バックアップとリストア

Second公式資料によると：

- seed phraseだけで残高復元可能な場合はArkサーバーの協力に依存。
- seedのみでは**取引履歴や進行中のExit状態**まで完全に復元できない。
- 独立した完全復元には、継続的なウォレットDBバックアップが重要。
- Browser IndexedDBはorigin単位で、ブラウザによる削除・消去の可能性がある。

**P0対応:** seedバックアップ警告と復元フロー、初回作成後の安全確認を実装する。ブラウザ保存が継続する保証はしない。

**P1対応:** SDKの整合性あるsnapshot/export APIを調べ、**暗号化済DBバックアップのエクスポート／インポート**を設計する。任意タイミングのIndexedDB単純dumpを「完全復元可能」と断言しない。バックアップ実行と復元テストが可能になるまで、Mainnet非対応を維持。

### 9.4 非協調Exitのリスク

- 非協調Exitは即時無料の引き出しではない。
- 複数のBitcoinトランザクション、確認待ち、CPFP等の手数料負担が必要になる場合がある。
- 機能を実装できない段階で「Exitができる」と書かない。
- 必要なオンチェーン資金・費用・期限・進捗・失敗時の処置を完全に検証できないなら、P0では読み取り/説明だけにする。
- Education UIはサーバー協調的Offboardと一方的Emergency Exitをはっきり分ける。

### 9.5 エラーハンドリング

| ケース | 表示 | 対応 |
|---|---|---|
| Signet ASPに接続できない | 「サーバー接続ができません」 | 再試行／デモへ |
| Esplora/chain sourceエラー | 「ブロック情報取得に失敗」 | 数値を古いまま断定しない |
| WASM初期化失敗 | 「ウォレットを初期化できません」 | ブラウザ・HTTPS確認 |
| IndexedDB不可 | 「保存機能が利用できません」 | 実ウォレット生成を中止 |
| VTXO一覧APIがない | 「このSDKでは詳細を取得できません」 | 概念図のみ表示 |
| 送金結果が不明 | 「確認中。再送しないでください」 | 同期・照合 |
| 操作中のリロード | 「処理が継続している可能性があります」 | 状態復元・照合 |
| backup不備 | 「ブラウザデータ消去で復元情報が失われる危険」 | 学習ガイドへ |

---

## 10. 推奨プロジェクト構造

```text
ark-school-wallet/
├── CLAUDE.md
├── docs/
│   ├── SPEC.md
│   ├── SDK_CAPABILITIES.md      # Claudeが調査して生成
│   ├── SECURITY_REVIEW.md      # Claudeが実装前に作成
│   └── TEST_PLAN.md            # Claudeがテスト計画を生成
├── public/
├── src/
│   ├── app/{App.tsx,routes.tsx}
│   ├── components/
│   │   ├── wallet/{BalanceCard,ReceivePanel,SendForm,HistoryList}.tsx
│   │   ├── xray/{VtxoCard,VtxoTimeline,VtxoGraph,SnapshotDiff}.tsx
│   │   ├── lab/{LessonRunner,ConceptGraph,ScenarioControls}.tsx
│   │   └── common/{NetworkBadge,ModeBadge,ExplainPopover}.tsx
│   ├── pages/{Dashboard,Receive,Send,XRay,VtxoDetail,Lab,Learn,Settings}.tsx
│   ├── lib/
│   │   ├── bark/{client,adapter,capabilities,normalize,config}.ts
│   │   ├── wallet/{types,snapshots,reconcile}.ts
│   │   ├── demo/{fixtures,DemoWallet,scenarios}.ts
│   │   └── education/{lessons,glossary}.ts
│   ├── content/{ja,en}/
│   ├── hooks/
│   ├── state/
│   └── styles/
├── tests/{unit,integration,e2e}/
├── .env.example
├── package.json
└── README.md
```

---

## 11. 実装フェーズ（Claude Codeのタスク）

### Phase 0 — SDK調査・安全確認（最初に必須）

- Node/npm、ビルド、WASMの適合確認。
- `npm info`で最新版確認、インストールして型定義調査。
- 第二のSDK/Arkadeと混同しないこと。
- `docs/SDK_CAPABILITIES.md`に本当に使えるメソッド・型・非対応機能を書く。
- Signet設定構築・SDK初期化だけを行う最小スパイク。
- `docs/SECURITY_REVIEW.md`にブラウザ保存・復元・送金・Exitのリスクを列挙。

**DoD:** SDKがブラウザで初期化され、Signetの情報取得に成功。使う機能の出典と型を記録。

### Phase 1 — 教育用UIとDemo Lab

- Vite + React + TypeScript + Tailwindなど。
- Dashboard, X-Ray, Lab, LearnのUI。
- DemoWalletを使ってVTXO一覧、差分、期限、概念図を表示。
- 日本語メイン + 英語切替。
- 360pxモバイルでも使える。
- Lesson 1, 3, 4, 5, 6を完成。

**DoD:** まだ本物の資金を操作せず、操作可能な学習アプリとして機能。

### Phase 2 — Signetウォレット接続

- create/open/restoreをBark SDKで実装。
- Signet walletの残高・アドレス・同期。
- 受取QRと少額の送金。
- SDKから取れる範囲でVTXOを取得。
- Signet faucet誘導、取引履歴の表示。

**DoD:** 別のSignet Bark walletとの間で少額受取・送金を確認。

### Phase 3 — X-Ray実データと学習連動

- VTXOをview modelへ正規化。
- 状態・期限・chain tip表示。
- 操作前後のスナップショット差分。
- VTXOカードから該当用語・教材への遷移。
- VTXO情報が取れないときは説明モードにフォールバックし、実データと混同しない。

**DoD:** 「送金でVTXOがどう変化したか」をユーザーが実データから理解できる。

### Phase 4 — Refresh・Offboard教育

- Web SDKで実際にサポートされるRefresh操作を調査。
- SDK対応が確認できればSignet Refreshを手動実行。
- 手数料やラウンドの状態を表示できる範囲で表示。
- 協調的Offboardは学習を先に実装し、操作は別途検証。
- Exitは**読む・理解する**が先。実行はSDK対応・手数料・フェイルセーフの検証を経るまで実装しない。

**DoD:** Refresh前後のデータを確認可能（SDK対応時）。未対応なら機能の理由付き無効化。

### Phase 5 — 品質・配布

- Playwright E2E、Vitest、アクセシビリティ、レスポンシブ。
- HTTPS環境で動作、WASMとIndexedDBの確認。
- 英訳、用語監修、実測値と概念図の区別監査。
- 公開版READMEに制限事項・バックアップリスク・公式ではない旨を記載。
- セキュリティチェックが終わるまでMainnet対応しない。

---

## 12. 受け入れテスト

| ID | 操作 | 期待する結果 |
|---|---|---|
| T01 | 未接続でアプリ起動 | デモに入れる、本物の残高は見せない |
| T02 | Signetウォレット作成 | seedをクライアントだけで生成、DBに保存、Signet表記 |
| T03 | 別ブラウザでデモ | デモデータが実ウォレットと混ざらない |
| T04 | 残高取得 | SDKのspendableを正しく表示 |
| T05 | pending / needs_refreshあり | spendable残高に無条件で足さない |
| T06 | Arkアドレスを生成 | 正しいSignetアドレス、QRコピー可能 |
| T07 | 無効なMainnet宛先 | 送信拒否 |
| T08 | 実送金 | 明示的な確認、成功時に履歴へ |
| T09 | 送金途中の通信切断 | 自動再送せず、不明状態と照合を表示 |
| T10 | VTXO詳細 | ID、金額、状態、期限など根拠ありの項目のみ表示 |
| T11 | Expiry heightのみ取得 | tipがなければ残りブロックを捏造しない |
| T12 | 差分を比較 | 取得できた実VTXOのみ差分表示 |
| T13 | SDKがVTXO一覧非対応 | 概念モードに切替、SDK制限を説明 |
| T14 | Labのスライダー操作 | 実送金やDB更新をしない |
| T15 | Exit教材 | 協調Offboardと緊急Exitの違いを明示 |
| T16 | seed-only復元の説明 | Arkサーバー依存と履歴・進行中Exitの限界を説明 |
| T17 | ブラウザ保存なし | 実ウォレット作成を安全に停止 |
| T18 | Mainnetのconfigを指定 | ビルドまたはランタイムで拒否 |
| T19 | モバイル画面 | 360px幅で操作・学習可能 |
| T20 | エラーログを保存 | seedや署名情報を含まない |
| T21 | 支払いボタン連打 | 送金リクエスト1回のみ |
| T22 | SDK更新で型が変更 | 型検査とAdapterテストで検知 |

### テストの区別

- Unit：正規化・期限計算・費用表示・差分・リスク分類・翻訳。
- Integration：SDK依存層にモックを注入。WASMは別のブラウザ環境で実測。
- E2E：Demo Labは完全自動。Signet送金は資金・接続に依存するため opt-in の環境指定付きテストとして分ける。

---

## 13. あとで追加したい機能

- **Learning Journey**：初学者向け5分コース、クイズ、達成チェック。
- **Tx Story**：1回の送金を「入力→署名→サーバー→受信→残高変化」としてアニメーション化。
- **Exit Simulator Advanced**：実際のfee rateを参考に複数のExitパスのコストと時間を試算。見積値と実行可否を混同しない。
- **Compare Wallets**：オンチェーンUTXO/Lightningチャネル/Ark VTXOを別々の概念図で比較。
- **Presenter Mode**：TBBなどのスクリーン投影向け、seed・アドレスを自動マスクする教育表示。
- **Share Snapshot**：VTXO ID・相手先・ウォレット識別情報など機密性がある要素を削除した図だけをSNS投稿用画像にする。
- **Protocol Deep Dive**：実際の署名済トランザクション・exit chainの読み取り専用解析（取得可能なら）。

---

## 14. 設計の境界・未決事項

1. **Web SDKでのVTXO一覧・Exit操作の可否:** Phase 0のインストール済SDK型定義が確定事項。BarkdのRESTにあるだけでは実装可能とみなさない。
2. **秘密情報の長期保持:** ブラウザ内Webウォレットに固有のセキュリティリスク。Signet以外は別フェーズ。
3. **DBバックアップ:** SDKが提供する整合的なexport/restoreフックを調査。安全に構築できるまで本番用途にはしない。
4. **SignetのASP・faucet接続:** 外部サービスであり可用性は保証されない。エラー時はDemoに誘導。
5. **Exitの可視化:** 概念図と実取引グラフを明確に分ける。
6. **L2の相互運用:** Barkと他のArk実装は直接互換とは限らない。受取先とサーバー条件の検証を入れる。
7. **コスト:** 手数料ゼロ、瞬時確定を保証しない。実際のSDK見積がない値は非表示。
8. **使用可否:** 教育用ソフトとして設計する。利用規約や専門のセキュリティ監査を経た本番ウォレットではない。

---

## 15. Claude Codeへ最初に求める成果物

1. `docs/SDK_CAPABILITIES.md`：実際の`@secondts/bark`バージョンとAPI/型定義の検証結果、対応状況。
2. `docs/SECURITY_REVIEW.md`：ブラウザ保存/復元・送金・バックアップ・Mainnet無効化のレビュー。
3. `src/lib/bark/adapter.ts`：UIとSDKを分離した実装。
4. 画面とDemo Lab（まずはPhase 1）、その後Signet接続（Phase 2）。
5. 結果レポート：動作したこと、未対応機能、テストの成否、既知の制約。

**完成は「画面がそれっぽく動く」ことではなく、SDKの実データに基づき、Arkの内部状態を誤解なく学べること。**

## 16. 一次資料（2026-11-21確認）

- Second: https://second.tech/
- Bark SDK: https://second.tech/docs/bark-sdk
- WebAssembly SDK: https://second.tech/docs/bark-sdk/wasm
- Official changelog: https://second.tech/docs/changelog
- Official backups: https://second.tech/docs/backups
- Connection details: https://second.tech/docs/connection-details
- Second Labs demos: https://labs.second.tech/
- Bark source: https://github.com/ark-bitcoin/bark
- npm: https://www.npmjs.com/package/@secondts/bark
- Docs index: https://second.tech/docs/llms.txt
