# アバター / アニメーション素材の仕様

現在は `SpriteAvatarRenderer`（SVG の全身プレースホルダー）です。本番素材は次のインターフェースを満たす
レンダラーを追加し、差し替えます。ウォレット側のコードは変更不要です。

```ts
interface AvatarRendererProps { cue: AvatarCue; height: number; reduceMotion: boolean }
// 縦横比 AVATAR_ASPECT = 200 / 440
```

## キューの語彙（`src/domain/avatar.ts`）

- emotion: neutral / happy / curious / focused / concerned / surprised / sleepy
- action: idle / blink / wave / point-left / point-right / receive / inspect / prepare-send / sending / celebrate / warn / listen / rest
- 優先度: safety > paymentResult > mistake > sendInput > voice > menu > idle

## 必要な素材（M2 以降）

| 素材 | 内容 |
|---|---|
| 立ち絵 | 全身、透過、縦長。表情 7 種 |
| ループ | idle（呼吸）、sending（処理中）、listen |
| ワンショット | wave, point-left/right, receive, inspect, prepare-send, celebrate, warn |
| 小物 | 送金時の端末、受取時の QR パネル、警告アイコン |

## 規則

- `celebrate` は PAYMENT_SUCCEEDED / PAYMENT_RECEIVED からしか出ません。素材側で勝手に再生しないこと。
- `reduceMotion` が true のときは静止画＋表情差分のみ。
- 状態は色だけで伝えない（文字のセリフ・ラベルを併用）。
- 権利が確認できた素材だけを入れる。既存作品のキャラクターに似せない。
