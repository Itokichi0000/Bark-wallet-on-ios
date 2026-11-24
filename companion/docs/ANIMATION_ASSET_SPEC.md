# アバター / アニメーション素材の仕様

現在は `IllustratedAvatarRenderer`（画像生成で作った立ち絵と表情差分）です。別の素材に替えるときは、
次のインターフェースを満たすレンダラーを追加して差し替えます。ウォレット側のコードは変更不要です。

```ts
interface AvatarRendererProps { cue: AvatarCue; height: number; reduceMotion: boolean }
// 縦横比 AVATAR_ASPECT = 752 / 1344
```

## いま入っている素材（`assets/avatar/`）

| ファイル | 使われる場面 |
|---|---|
| neutral / happy / curious / focused / concerned / surprised / sleepy | 表情（同じ立ちポーズ） |
| wave | あいさつ（起動時・タップ時） |
| celebrate | 送金成功・受取の確認後だけ |

- 2026-11-24 に画像生成（GPT Image 2.6）で作成。オリジナルのキャラクターで、既存作品のキャラクターを指定・参照していない。
  `neutral` を基準画像にして、他の 8 枚はそれを参照して生成した。
- すべて 752×1344 px・透過 PNG・足の位置が同じ。切り替えは 160ms のクロスフェード。
- 指さし・受け取り・点検などのポーズ絵はまだなく、表情だけで表している。まばたきや口パクもない。
- `SpriteAvatarRenderer`（SVG）は予備として残してある。

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

## Motion clips (added 2026-11-24)

`assets/avatar/motion/*.webp` — transparent animated WebP, 480x858, 76 frames at 15 fps (about 3 MB each).

| Clip | Loop | Played for |
| --- | --- | --- |
| `idle` | forever | neutral / happy idle: breathing, blinking |
| `wave` | once | greeting |
| `celebrate` | once | a confirmed success only |
| `focus` | once | listening, inspecting, preparing or sending |
| `worry` | once | warnings, concerned |
| `guide` | once | pointing, speaking, receive |

How they were made: the neutral still (GPT Image) was placed on a flat green background and animated
image-to-video with Kling 4.0 (start frame = end frame, so each clip returns to the standing pose);
the green was keyed out with ffmpeg (`chromakey`, then green clamped to `max(r, b)` so the cyan trim
survives) and the frames packed with `img2webp`. The cue-to-clip table is `src/game/avatarMotion.ts`
(tested); `AnimatedAvatarRenderer.tsx` plays them with `expo-image`. Reduce Motion shows the stills only.

### Per-action clips (added 2026-11-24, second batch)

Ten more one-shot clips made the same way (Kling 4.0, same start/end frame, same keying script):
`catch` (confirmed incoming payment only), `send` (payment submitted: a gesture, not a result), `think`,
`nod`, `pointdown`, `hush` (seed, hidden balance, device auth), `yawn`, `startle` (tapped), `talk`
(story, explanations), `search` (history, coins, scanning). Sixteen clips in total; only `idle` and the
clip being played may be mounted at once.
