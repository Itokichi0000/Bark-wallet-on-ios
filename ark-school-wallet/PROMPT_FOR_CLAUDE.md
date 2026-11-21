# Claude Codeに渡す最初の指示

`CLAUDE.md`と`docs/SPEC.md`を**最初から最後まで**読んでください。

あなたは「Ark School Wallet」という教育用Webウォレットの実装担当です。目的は、Secondの公式**Bark Web SDK（`@secondts/bark`）**を使い、**ArkのVTXOの内部状態や期限、Refresh、Exitの考え方を、実際のウォレット操作と連動して分かりやすく表示すること**です。

以下の順に、計画だけで終わらず、現在のディレクトリに実際のコードを書いて進めてください。

1. まずSecond公式ドキュメント、現行SDKパッケージ、インストールされた型定義を検証。ブラウザSDKにある機能・ない機能を`docs/SDK_CAPABILITIES.md`にまとめてください。BarkdのREST APIと混同せず、曖昧なメソッドをでっち上げないでください。
2. `docs/SECURITY_REVIEW.md`を作り、ブラウザ保存、秘密鍵、Signet固定、送金の二重実行防止、バックアップ、緊急Exitを安全に扱うための制約を整理してください。
3. React + Vite + TypeScript + Tailwindで画面を作成。Wallet、X-Ray、Lab、Learnの4つの導線を実装。スマホとPC両対応、日本語が基本で英語切替。
4. DemoWalletとローカルfixtureで、VTXO一覧、期限カウント、状態変化、送金前後のグラフ、Refreshと緊急Exitの学習教材を完成させてください。教材はすべて`DEMO / 概念図`と常時表示。実データに見せかけない。
5. Bark SDKの本物のSignet walletを接続し、SDKが提供する範囲でウォレット作成・復元・残高・同期・Ark受取QR・Ark送金・履歴・VTXO表示を実装してください。対応不能な機能は`unsupported`として正直にUIへ表示。
6. 本物の送金前後でスナップショットを取得し、実際のVTXOと残高の変化を説明するX-Ray画面を作成してください。実際のVTXOのexit chainを取得できないなら、概念図として区別。
7. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`を実行・修正し、最後にREADMEに実際に確認できた機能、未検証部分、Signetの接続方法、バックアップに関する重要な注意を書いてください。

**必須のプロダクト体験：**
ウォレットを開く → テストsatsを受け取る → VTXOが見える → 少額送金する → VTXOの変化を見て理解する → Refresh・Exitを教材で学ぶ。

**必須の安全ルール：**
- Signet専用。Mainnetへの切替は実装しない。
- ウォレット秘密鍵・mnemonic・DBをサーバー送信しない。
- ブラウザIndexedDBの消去リスクや、Seedだけでは完全復元できない問題を隠さない。
- 送金処理結果が不明なとき自動再送しない。
- 緊急ExitはMVPでは説明/シミュレーションだけとする。
- エラーやSDK制約を隠して「完成した」と報告しない。

最終的には、動作可能なコード一式と実行手順、テスト結果、SDK対応状況の報告を残してください。
