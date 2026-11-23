# ADR-0002: DB バックアップは「デーモン停止 → ファイルコピー → 封緘」で行う

- 状態: 採用（実機検証待ち）
- 背景: bark-react-native 0.28.0 にスナップショット / エクスポート API がない。Second は状態変化ごとのバックアップを推奨。
- 決定: `WalletAdapter.quiesce` で `stopDaemonWait` → `readDatadirInfo().dbFile` をコピー → `runDaemon`。
  journal / WAL が残っていれば中止。XChaCha20-Poly1305 + シード由来鍵（HKDF）で封緘。
- 検討した代替: (a) 動作中の DB をそのままコピー → 不整合の恐れ。(b) シードのみに頼る → 履歴と一部資金を失い得る。
  (c) SDK の対応を待つ → バックアップなしの期間ができる。
- 結果: 状態変化のたびにデーモンが短時間止まる。SDK が公式 API を出したら置き換える。
  整合性は実機での復元試験で確認するまで保証しない。
