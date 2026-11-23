# 実装状況

最終更新: 2026-11-24 ／ 対象: M0 + M1-A（Signet）

凡例: **verified** = 自動テストまたは実行で確認済み ／ **implemented** = 実装済みだが実機未確認 ／
**mock** = MOCK のみ ／ **blocked** = 着手不可 ／ **untested** = 未検証

## 最重要の注意

**このアプリは、まだ一度も実機・シミュレータで起動していません。** 開発機に iOS シミュレータのランタイムと
Android SDK がなかったためです。確認できているのは「型検査」「単体テスト」「Metro による iOS バンドル生成」
「iOS ネイティブのコンパイル」までです（詳細は TEST_REPORT.md）。Signet での実際の受取・送金・バックアップ・復元は
**すべて untested** です。実機で確認するまで、動くものとして扱わないでください。

## マイルストーン

| 項目 | 状態 | 備考 |
|---|---|---|
| M0: Expo/TS strict/expo-router/Bark SDK 導入 | verified | 型検査・バンドル・expo-doctor 20/20 |
| M0: Signet 設定のみ（Mainnet なし） | verified | テストで `Network.Bitcoin` と本番エンドポイントの不在を検査 |
| M0: MockWalletAdapter / プレースホルダーアバター | verified | 単体テスト |
| M0: ウォレット作成・オープン・同期・残高（実 SDK） | **untested** | BarkWalletAdapter は実装済み、実機未確認 |
| M1-A: 起動 / オンボーディング / ホーム | implemented | 画面は未起動 |
| M1-A: 受取（Ark アドレス・QR・コピー・共有・faucet 案内） | implemented | 実 SDK 未確認 |
| M1-A: 資産（残高内訳・VTXO・保守状態） | implemented | 実 SDK 未確認 |
| M1-A: 記録（履歴・詳細） | implemented | 実 SDK 未確認 |
| M1-A: シード表示（端末認証・スクショ抑止） | implemented | 実機未確認 |
| M1-A: 暗号化 DB バックアップ（作成・世代・エクスポート） | 暗号部 verified / 端末 I/O **untested** | BACKUP_AND_RECOVERY.md |
| M1-A: バックアップからの復元 | implemented / **untested** | 「復元確認済み」と表示しない |
| M1-B: Ark 送金（確認画面・認証・二重送金防止・照合） | ロジック verified（MOCK）/ 実 SDK **untested** | 設計書の順序より先行して実装。実機検証までは M1-B 未完了扱い |
| M1-C: 文字入力による「話しかける」 | verified（パーサ・方針）| マイク入力なし |
| クエスト Q1–Q6 | implemented | 報酬（衣装等）は未実装と明記 |

## 意図的に入れていないもの

- Lightning 送受信、オンチェーン送受信、Swap（`ENABLED_SEND_METHODS = ["ark"]`。Lightning 宛先は「このビルドでは無効」と表示）
- Refresh / Offboard / Exit の手動実行（資産画面は説明パネルのみ）
- マイクによる音声入力、LLM、通知、バックグラウンド保守、クラウドへの自動バックアップ
- 3D / Live2D アバター（`AvatarRenderer` インターフェースの裏に SVG のプレースホルダー）
- 効果音（アセットがないため、設定項目も置いていない）
- Android の動作確認（コードは共通だが未ビルド）

## 既知の制約・要確認

1. **バックアップの取得方法**: SDK にスナップショット API がないため、デーモンを止めて DB ファイルをコピーしています。
   実機で「コピー中に journal/WAL が残らないこと」「復元した DB が開けること」を確認する必要があります。
2. **手数料の表示**: 合計 = 金額 + `FeeEstimate.feeSats` としています。SDK の gross/net と一致しない場合は
   確認画面に「見積もり」と出します。実額は送金後の記録で確認する前提です。
3. **シードのみの復元**: `Wallet.open(createIfNotExists)` に既存シードを渡して SDK の復元に任せています。実機未確認。
4. **アバターの名前**「ノア」は仮です。
5. `react-native-qrcode-svg` など一部ライブラリの New Architecture での挙動は実機未確認。

## 次にやること（優先順）

1. iOS シミュレータのランタイムを入れる、または実機で development build を起動する
2. MOCK モードで全画面を通す → Bark モードで作成・同期・faucet 受取
3. バックアップ → アプリ削除 → 復元 の通し確認（BACKUP_AND_RECOVERY.md の手順）
4. Signet で少額の Ark 送金、機内モードでの「不明」状態と照合の確認
