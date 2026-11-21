# Ark School Wallet — Claude Code開始ガイド

## 配置

ZIPを展開して、次のように配置してください。

```text
ark-school-wallet/
  CLAUDE.md
  START_HERE.md
  docs/
    SPEC.md
  PROMPT_FOR_CLAUDE.md
```

## Claude Codeでの実行

1. このディレクトリをターミナルで開く。
2. `claude` でClaude Codeを起動する。
3. `PROMPT_FOR_CLAUDE.md`をClaude Codeへ貼り付けるか、ファイルを読むように指示する。
4. Claudeが最初に作成する`docs/SDK_CAPABILITIES.md`を確認する。
5. Demo Lab → Signet Wallet → VTXO X-Ray の順に実装とテストを進める。

## 必ず動かしてほしい体験

- デモなら**本物の鍵を持たず**にVTXOの仕組みを学べる。
- Signet walletを生成し、Arkアドレスでテストsatsを受け取れる。
- Signet Ark送金を行って、実際の残高変化を確認できる。
- Web SDKが提供するVTXO情報を正しく表示する。取得不可の値を実測として出さない。
- シードフレーズとDBのバックアップについて安全に説明できる。

## 技術的な前提

- `.env.example`を作り、Signet用ASP/chain source URLはSecond公式資料から設定する。
- SDKがサポートしないAPIは無理に実装せず、理由を画面に明記する。
- 開発環境はlocalhost、公開はHTTPSで動かす。
- Mainnetで本物のお金を扱う用途ではない。
