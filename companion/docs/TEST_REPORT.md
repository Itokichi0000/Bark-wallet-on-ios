# テスト報告

実施日: 2026-11-24 ／ 環境: macOS, Node 26.12, Xcode 27.1, pnpm 10.6

## 実行して確認したもの

| 確認 | コマンド | 結果 |
|---|---|---|
| 型検査（strict） | `pnpm typecheck` | エラー 0 |
| 単体テスト | `pnpm test` | 9 スイート / 90 件 すべて成功 |
| プロジェクト診断 | `npx expo-doctor` | 20 / 20 |
| iOS JS バンドル | `npx expo export --platform ios` | 成功（2118 モジュール） |
| iOS ネイティブのコンパイル | `expo prebuild` → `pod install` → `xcodebuild -sdk iphonesimulator`（署名なし, arm64） | BUILD SUCCEEDED |

### 単体テストの内容

- `money`: 全角数字・区切り、負数 / 小数 / 指数表記 / 上限超過の拒否、BTC 換算を浮動小数なしで
- `payment`: 確認・確定・認証を経ないと送信状態に入れない、二重タップ無視、不明 / 処理中から再送できない
- `reconcile`: タイムアウト後に実際は送れていた場合の発見、証拠なしで失敗と断定しない
- `walletService`（MOCK）: 起動時に勝手に作らない、同一 operationId で二重送金しない、同時送金 1 件のみ、
  SDK 呼び出し前の永続化、不明 → 照合、強制終了後の再起動照合、MAX と手数料
- `avatar`: 成功演出は 1 操作 1 回、成功イベント以外から celebrate に到達しない、送金中は割り込まれない
- `voice`: 送金確定の action が出ない、発話から宛先を取り込まない、秘密の要求は拒否
- `backup`: 往復、別シード拒否、改ざん・切り詰め検出、復元可否の判定
- `i18n`: ja / en のキーとプレースホルダー一致、コードが使うキーの存在
- `mapping` / 構成: SDK 状態の対応、SDK 版の一致、Mainnet 参照なし、アバター層が鍵 API を import しない、`console.*` なし

テストで見つけて直した不具合: 「送金処理中」の表示が割り込み不可だったため、送金結果（成功 / 失敗 / 不明）の
表示まで遮っていた（`AvatarOrchestrator`）。

## 確認できていないもの（untested）

開発機に iOS シミュレータのランタイムと Android SDK がなく、実機も接続されていなかったため、
**アプリを起動しての確認は一切できていません。**

- 画面の表示・レイアウト・アニメーション・VoiceOver
- 実 SDK でのウォレット作成 / オープン / 同期 / 残高
- Signet での受取・Ark 送金・手数料表示の正しさ
- 通信断での「不明」状態と照合（実 SDK）
- Keychain 保存、端末認証、スクリーンショット抑止、カメラでの QR 読み取り
- DB バックアップの取得と復元（端末上のファイル I/O）
- Android ビルド全般

コンパイルが通ることは、起動して動くことを意味しません。手順は IMPLEMENTATION_STATUS.md「次にやること」を参照。
