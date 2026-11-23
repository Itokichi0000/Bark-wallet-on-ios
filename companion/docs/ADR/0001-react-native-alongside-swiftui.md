# ADR-0001: React Native 版を既存 SwiftUI アプリと並置する

- 状態: バンドル ID と Signet 専用の部分は ADR-0003 で置き換え（2026-11-24）
- 背景: 設計書は Expo + React Native を指定。リポジトリには Mainnet 既定で TestFlight 配布中の SwiftUI アプリがある。
- 決定: `companion/` に新規の Expo アプリを作る。既存アプリは変更しない。バンドル ID は
  `com.itokichi0000.barkcompanion.signet` で別、データ領域も別。新アプリは Signet 専用。
- 結果: 本番の資金とデータに触れずに開発できる。二つのコードベースを当面維持する必要がある。
  Mainnet 対応は別ビルド・別審査とし、このアプリにネットワーク切替は置かない。
