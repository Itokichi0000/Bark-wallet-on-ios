import SwiftUI

// しくみ: how Ark moves bitcoin, as small looping diagrams.
//
// Every scene uses the same stage: the Ark server at the top, people in the
// middle (the Ark layer, off-chain), and a row of bitcoin blocks at the
// bottom (on-chain). A VTXO is an orange coin; the ring around it is how
// much of its lifetime is left. Captions step along with the animation.

// MARK: - Timing

enum Tween {
    static func clamp(_ x: Double) -> Double { min(max(x, 0), 1) }

    /// Smoothstep.
    static func ease(_ x: Double) -> Double {
        let c = clamp(x)
        return c * c * (3 - 2 * c)
    }

    /// Eases past 1 and settles back: a little overshoot for things that land.
    static func back(_ x: Double) -> Double {
        let c = clamp(x) - 1
        let k = 1.9
        return 1 + (k + 1) * c * c * c + k * c * c
    }

    /// 0 → 1 → 0 hump across 0...1.
    static func hump(_ x: Double) -> Double {
        sin(clamp(x) * .pi)
    }

    /// 0 before `a`, 1 after `b`, eased in between.
    static func seg(_ p: Double, _ a: Double, _ b: Double) -> Double {
        ease((p - a) / (b - a))
    }

    static func mix(_ a: CGPoint, _ b: CGPoint, _ t: Double) -> CGPoint {
        let ax = Double(a.x), ay = Double(a.y), bx = Double(b.x), by = Double(b.y)
        return CGPoint(x: ax + (bx - ax) * t, y: ay + (by - ay) * t)
    }

    /// Along a curve that bows upward by `lift` points.
    static func arc(_ a: CGPoint, _ b: CGPoint, _ t: Double, lift: Double) -> CGPoint {
        let ax = Double(a.x), ay = Double(a.y), bx = Double(b.x), by = Double(b.y)
        let cx = (ax + bx) / 2, cy = (ay + by) / 2 - lift
        let u = 1 - t
        let x = u * u * ax + 2 * u * t * cx + t * t * bx
        let y = u * u * ay + 2 * u * t * cy + t * t * by
        return CGPoint(x: x, y: y)
    }

    /// Along a polyline, 0...1 over its whole length.
    static func along(_ points: [CGPoint], _ t: Double) -> CGPoint {
        guard points.count > 1 else { return points.first ?? .zero }
        var lengths: [Double] = []
        for i in 1..<points.count {
            lengths.append(Double(hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)))
        }
        let total = max(lengths.reduce(0, +), 0.001)
        var remaining = clamp(t) * total
        for i in 0..<lengths.count {
            if remaining <= lengths[i] || i == lengths.count - 1 {
                return mix(points[i], points[i + 1], lengths[i] > 0 ? min(remaining / lengths[i], 1) : 1)
            }
            remaining -= lengths[i]
        }
        return points[points.count - 1]
    }
}

private func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: y) }

// MARK: - Stage

/// Where things sit in a scene canvas.
struct ArkStage {
    let w: Double
    let h: Double

    init(_ size: CGSize) {
        w = Double(size.width)
        h = Double(size.height)
    }

    var server: CGPoint { pt(w / 2, 26) }
    /// Just under the server box, where coins meet it.
    var serverDock: CGPoint { pt(w / 2, 56) }
    var rowY: Double { (h - 48) * 0.62 }
    var you: CGPoint { pt(30, rowY) }
    var peer: CGPoint { pt(w - 30, rowY) }
    /// Your coin, beside you.
    var yourCoin: CGPoint { pt(you.x + 58, rowY) }
    var peerCoin: CGPoint { pt(peer.x - 58, rowY) }
    var lineY: Double { h - 46 }
    var blockY: Double { h - 18 }
    let blockSize: Double = 18
    let blockGap: Double = 26
    var blockCount: Int { max(Int((w - 20) / blockGap), 4) }

    /// Centre of a block counted from the right: 0 is the next block.
    func block(_ fromRight: Int) -> CGPoint {
        let first = (w - Double(blockCount - 1) * blockGap) / 2
        let index = blockCount - 1 - fromRight
        return pt(first + Double(index) * blockGap, blockY)
    }
}

// MARK: - Drawing

enum ArkDraw {
    static func text(_ gc: GraphicsContext, _ string: String, _ p: CGPoint, size: CGFloat = 11,
                     color: Color = Ink.sub, bold: Bool = false, anchor: UnitPoint = .center, opacity: Double = 1) {
        guard opacity > 0.01 else { return }
        var g = gc
        g.opacity = opacity
        let font = bold ? Brush.bold(size) : Brush.text(size)
        g.draw(Text(string).font(font).foregroundColor(color), at: p, anchor: anchor)
    }

    /// A pending block on the chain: how solid it is (0 = still the next,
    /// empty block) and the colour it fills with.
    struct Landing {
        var fill: Double
        var color: Color = Ink.orange
    }

    /// The two layers: Ark above (violet tint), the bitcoin chain below
    /// (teal band) with its row of blocks. `landings` are the newest
    /// blocks, left to right, ending with the next block.
    static func ground(_ gc: GraphicsContext, _ st: ArkStage, landings: [Landing] = [], quiet: String? = nil) {
        let ark = CGRect(x: 0, y: 0, width: st.w, height: st.lineY - 3)
        gc.fill(Path(roundedRect: ark, cornerRadius: 18), with: .color(Ink.serverSoft.opacity(0.55)))
        let chain = CGRect(x: 0, y: st.lineY + 3, width: st.w, height: st.h - st.lineY - 3)
        gc.fill(Path(roundedRect: chain, cornerRadius: 14), with: .color(Ink.chainSoft))
        text(gc, "Ark（チェーンの外）", pt(12, st.lineY - 14), size: 10, color: Ink.server, bold: true, anchor: .leading)
        text(gc, "ビットコイン", pt(12, st.lineY + 13), size: 10, color: Ink.chain, bold: true, anchor: .leading)

        var links = Path()
        links.move(to: st.block(st.blockCount - 1))
        links.addLine(to: st.block(0))
        gc.stroke(links, with: .color(Ink.chain.opacity(0.4)), lineWidth: 2)

        let pending = landings.count
        for k in 0..<st.blockCount {
            let c = st.block(k)
            var s = st.blockSize
            var landing: Landing?
            if k < pending {
                landing = landings[pending - 1 - k]
                // a block swells as it is found, then settles
                s *= 1 + 0.35 * Tween.hump(landing?.fill ?? 0)
            }
            let rect = CGRect(x: Double(c.x) - s / 2, y: Double(c.y) - s / 2, width: s, height: s)
            let shape = Path(roundedRect: rect, cornerRadius: 5)
            if let landing {
                gc.fill(shape, with: .color(Ink.paper))
                if landing.fill > 0.01 {
                    gc.fill(shape, with: .color(landing.color.opacity(landing.fill)))
                } else {
                    gc.stroke(shape, with: .color(Ink.chain.opacity(0.8)), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                }
            } else {
                gc.fill(shape, with: .color(Ink.chain.opacity(0.32)))
            }
        }
        if let quiet {
            // a plate so the words sit over the blocks, not on them
            let label = gc.resolve(Text(quiet).font(Brush.bold(10)).foregroundColor(Ink.chain))
            let size = label.measure(in: CGSize(width: st.w, height: 40))
            let plate = CGRect(x: st.w / 2 - Double(size.width) / 2 - 10, y: st.blockY - Double(size.height) / 2 - 5,
                               width: Double(size.width) + 20, height: Double(size.height) + 10)
            gc.fill(Path(roundedRect: plate, cornerRadius: plate.height / 2), with: .color(Ink.paper))
            gc.draw(label, at: pt(st.w / 2, st.blockY))
        }
    }

    static func server(_ gc: GraphicsContext, _ st: ArkStage, title: String = "Ark サーバー",
                       pulse: Double = 0, offline: Double = 0) {
        let c = st.server
        let rect = CGRect(x: Double(c.x) - 62, y: Double(c.y) - 17, width: 124, height: 34)
        let shape = Path(roundedRect: rect, cornerRadius: 17)
        if pulse > 0.01 {
            let grow = 12 * pulse
            let halo = Path(roundedRect: rect.insetBy(dx: -grow, dy: -grow), cornerRadius: 17 + grow)
            gc.fill(halo, with: .color(Ink.server.opacity(0.28 * (1 - pulse))))
        }
        if offline > 0.01 {
            gc.fill(shape, with: .color(Ink.wash))
            gc.stroke(shape, with: .color(Ink.sub.opacity(0.6)), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
            text(gc, title, c, size: 12, color: Ink.sub, bold: true, opacity: 1 - offline * 0.4)
            text(gc, "応答なし", pt(Double(c.x) + 68, Double(c.y)), size: 10, color: Ink.alert, bold: true,
                 anchor: .leading, opacity: offline)
        } else {
            gc.fill(shape, with: .linearGradient(Gradient(colors: [Ink.server, Ink.serverDeep]),
                                                 startPoint: pt(0, rect.minY), endPoint: pt(0, rect.maxY)))
            text(gc, title, c, size: 12, color: Ink.onColor, bold: true)
        }
    }

    /// Who is who keeps its colour: you are orange, others teal and pink.
    static func personColor(_ initial: String) -> Color {
        switch initial {
        case "あ": return Ink.orange
        case "C": return Ink.alert
        default: return Ink.chain
        }
    }

    static func person(_ gc: GraphicsContext, _ c: CGPoint, initial: String, name: String) {
        let r = 15.0
        let color = personColor(initial)
        let circle = Path(ellipseIn: CGRect(x: Double(c.x) - r, y: Double(c.y) - r, width: r * 2, height: r * 2))
        gc.fill(circle, with: .color(Ink.paper))
        gc.fill(circle, with: .color(color.opacity(0.18)))
        gc.stroke(circle, with: .color(color), lineWidth: 2)
        text(gc, initial, c, size: 12, color: color, bold: true)
        text(gc, name, pt(Double(c.x), Double(c.y) + 25), size: 10, color: Ink.ink, bold: true)
    }

    /// A VTXO (or UTXO): a glossy coin, its lifetime ring and a label under it.
    static func coin(_ gc: GraphicsContext, _ c: CGPoint, r: Double = 10, color: Color = Ink.orange,
                     life: Double? = nil, label: String? = nil, opacity: Double = 1) {
        guard opacity > 0.01 else { return }
        var g = gc
        g.opacity = opacity
        let x = Double(c.x), y = Double(c.y)
        // a soft glow so the eye follows the coin
        let glow = r * 2.4
        g.fill(Path(ellipseIn: CGRect(x: x - glow, y: y - glow, width: glow * 2, height: glow * 2)),
               with: .radialGradient(Gradient(colors: [color.opacity(0.3), color.opacity(0)]),
                                     center: c, startRadius: r * 0.6, endRadius: glow))
        if let life {
            let rr = r + 4.5
            let track = Path(ellipseIn: CGRect(x: x - rr, y: y - rr, width: rr * 2, height: rr * 2))
            g.stroke(track, with: .color(Ink.paper), lineWidth: 3.5)
            g.stroke(track, with: .color(Ink.line), lineWidth: 2.5)
            var ring = Path()
            ring.addArc(center: c, radius: rr, startAngle: .degrees(-90),
                        endAngle: .degrees(-90 + 360 * Tween.clamp(life)), clockwise: false)
            g.stroke(ring, with: .color(life < 0.25 ? Ink.alert : (life < 0.5 ? Ink.bolt : Ink.good)),
                     style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
        }
        g.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(color))
        // highlight
        g.fill(Path(ellipseIn: CGRect(x: x - r * 0.55, y: y - r * 0.62, width: r * 0.6, height: r * 0.42)),
               with: .color(Color.white.opacity(0.45)))
        if let label {
            text(g, label, pt(x, y + r + (life == nil ? 10 : 14)), size: 10, color: Ink.ink, bold: true)
        }
    }

    /// A transaction: a small sheet with two lines on it.
    static func tx(_ gc: GraphicsContext, _ c: CGPoint, color: Color = Ink.server, opacity: Double = 1) {
        guard opacity > 0.01 else { return }
        var g = gc
        g.opacity = opacity
        let x = Double(c.x), y = Double(c.y)
        let shadow = Path(roundedRect: CGRect(x: x - 12, y: y - 7, width: 24, height: 18), cornerRadius: 5)
        g.fill(shadow, with: .color(color.opacity(0.25)))
        let sheet = Path(roundedRect: CGRect(x: x - 12, y: y - 9, width: 24, height: 18), cornerRadius: 5)
        g.fill(sheet, with: .color(Ink.paper))
        g.stroke(sheet, with: .color(color), lineWidth: 2)
        var lines = Path()
        lines.move(to: pt(x - 6, y - 3)); lines.addLine(to: pt(x + 6, y - 3))
        lines.move(to: pt(x - 6, y + 3)); lines.addLine(to: pt(x + 2, y + 3))
        g.stroke(lines, with: .color(color.opacity(0.8)), style: StrokeStyle(lineWidth: 2, lineCap: .round))
    }

    /// A line drawn from `a` toward `b`, `progress` of the way.
    static func link(_ gc: GraphicsContext, _ a: CGPoint, _ b: CGPoint, progress: Double = 1,
                     color: Color = Ink.line, dashed: Bool = false, width: Double = 2) {
        guard progress > 0.01 else { return }
        var path = Path()
        path.move(to: a)
        path.addLine(to: Tween.mix(a, b, Tween.clamp(progress)))
        gc.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round, dash: dashed ? [1, 6] : []))
    }

    static func lock(_ gc: GraphicsContext, _ c: CGPoint, open: Double = 0) {
        let x = Double(c.x), y = Double(c.y)
        let body = Path(roundedRect: CGRect(x: x - 6, y: y - 1, width: 12, height: 9), cornerRadius: 2)
        gc.fill(body, with: .color(Ink.server))
        var shackle = Path()
        let lift = 4 * open
        shackle.addArc(center: pt(x, y - 1 - lift), radius: 4, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
        gc.stroke(shackle, with: .color(Ink.server), lineWidth: 2)
    }

    static func key(_ gc: GraphicsContext, _ c: CGPoint) {
        let x = Double(c.x), y = Double(c.y)
        gc.stroke(Path(ellipseIn: CGRect(x: x - 7, y: y - 3.5, width: 7, height: 7)), with: .color(Ink.bolt), lineWidth: 2)
        var stem = Path()
        stem.move(to: pt(x, y)); stem.addLine(to: pt(x + 8, y))
        stem.move(to: pt(x + 5, y)); stem.addLine(to: pt(x + 5, y + 3))
        stem.move(to: pt(x + 8, y)); stem.addLine(to: pt(x + 8, y + 3))
        gc.stroke(stem, with: .color(Ink.bolt), lineWidth: 2)
    }

    static func check(_ gc: GraphicsContext, _ c: CGPoint, color: Color = Ink.good, opacity: Double = 1) {
        guard opacity > 0.01 else { return }
        var g = gc
        g.opacity = opacity
        let x = Double(c.x), y = Double(c.y)
        var path = Path()
        path.move(to: pt(x - 5, y)); path.addLine(to: pt(x - 1.5, y + 3.5)); path.addLine(to: pt(x + 5, y - 3.5))
        g.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round))
    }

    /// A thin bar that fills, with a label over it.
    static func bar(_ gc: GraphicsContext, center c: CGPoint, width: Double, fill: Double, label: String) {
        let x = Double(c.x) - width / 2, y = Double(c.y)
        let track = Path(roundedRect: CGRect(x: x, y: y - 3, width: width, height: 6), cornerRadius: 3)
        gc.fill(track, with: .color(Ink.paper))
        gc.fill(Path(roundedRect: CGRect(x: x, y: y - 3, width: width * Tween.clamp(fill), height: 6), cornerRadius: 3),
                with: .color(Ink.chain))
        text(gc, label, pt(Double(c.x), y - 11), size: 10, color: Ink.ink, bold: true)
    }

    /// 0...1 pulse while `p` is between `a` and `b`.
    static func pulse(_ p: Double, _ a: Double, _ b: Double, speed: Double = 3) -> Double {
        guard p > a, p < b else { return 0 }
        return ((p - a) * speed * 10).truncatingRemainder(dividingBy: 1)
    }
}

// MARK: - Scenes

enum ArkScene: String, CaseIterable, Identifiable {
    case board, arkoor, round, refresh, lightning, offboard, exit

    var id: String { rawValue }

    struct Beat {
        let at: Double
        let text: String
    }

    /// Chip label.
    var title: String {
        switch self {
        case .board: return "ボード"
        case .arkoor: return "Ark で送る"
        case .round: return "ラウンド"
        case .refresh: return "期限と Refresh"
        case .lightning: return "ライトニング"
        case .offboard: return "オンチェーンへ"
        case .exit: return "ひとりで脱出"
        }
    }

    var summary: String {
        switch self {
        case .board: return "オンチェーンの ビットコインを Ark に 入れる"
        case .arkoor: return "ラウンドを またず、すぐに 届く 送金"
        case .round: return "みんなの こうかんを 1つの 取引に まとめる"
        case .refresh: return "期限が くる前に 新しい VTXO と こうかん"
        case .lightning: return "サーバーが ライトニングへの 入り口に なる"
        case .offboard: return "VTXO を ふつうの ビットコインに もどして 送る"
        case .exit: return "サーバーが 止まっても 自分で とりだせる"
        }
    }

    /// Seconds per loop.
    var duration: Double { 10 }

    var beats: [Beat] {
        switch self {
        case .board:
            return [
                Beat(at: 0, text: "チェーン上に ビットコイン（UTXO）が あります"),
                Beat(at: 0.15, text: "サーバーと いっしょに ボード取引を つくります"),
                Beat(at: 0.45, text: "取引が ブロックに 入り、承認を まちます"),
                Beat(at: 0.72, text: "Ark の中で つかえる VTXO に。リングは 期限までの のこり"),
            ]
        case .arkoor:
            return [
                Beat(at: 0, text: "あなたの VTXO（10,000 sats）"),
                Beat(at: 0.15, text: "サーバーと 共同署名。ラウンドは まちません"),
                Beat(at: 0.5, text: "あいてへ 3,000 と おつり 7,000、2つの VTXO に わかれます"),
                Beat(at: 0.78, text: "チェーンは つかわないので すぐ届いて 安い"),
            ]
        case .round:
            return [
                Beat(at: 0, text: "みんなの VTXO が サーバーに あつまります"),
                Beat(at: 0.25, text: "サーバーが 1つの 取引（木の形）に まとめ、全員が 署名"),
                Beat(at: 0.45, text: "チェーンには 1件だけ。手数料を みんなで わけあいます"),
                Beat(at: 0.65, text: "木の 枝から 新しい VTXO が それぞれに 届きます"),
            ]
        case .refresh:
            return [
                Beat(at: 0, text: "ブロックが 進むたび、VTXO の 期限が ちかづきます"),
                Beat(at: 0.38, text: "期限の 前に ラウンドへ 出して…"),
                Beat(at: 0.56, text: "新しい 取引に のりかえ"),
                Beat(at: 0.74, text: "期限が のびた 新しい VTXO に。これが Refresh"),
            ]
        case .lightning:
            return [
                Beat(at: 0, text: "VTXO を 条件つき（HTLC）で サーバーへ あずけます"),
                Beat(at: 0.25, text: "サーバーが ライトニングで おみせへ 支払います"),
                Beat(at: 0.58, text: "支払いの しょうめい（preimage）が もどってくると…"),
                Beat(at: 0.8, text: "条件が そろい、支払い 完了"),
            ]
        case .offboard:
            return [
                Beat(at: 0, text: "あなたの VTXO を サーバーへ"),
                Beat(at: 0.3, text: "サーバーが オンチェーンの 取引を つくります"),
                Beat(at: 0.52, text: "取引が ブロックに 入ると…"),
                Beat(at: 0.72, text: "あいての アドレスに ふつうの ビットコインが 届きます"),
            ]
        case .exit:
            return [
                Beat(at: 0, text: "サーバーが 止まってしまっても…"),
                Beat(at: 0.18, text: "VTXO の 署名ずみ 取引を 1つずつ チェーンに 出します"),
                Beat(at: 0.6, text: "決まった ブロック数 まって…"),
                Beat(at: 0.8, text: "あなたの オンチェーン ビットコインに。許可は いりません"),
            ]
        }
    }

    func beatIndex(_ p: Double) -> Int {
        beats.lastIndex { p >= $0.at } ?? 0
    }

    /// The point just before the next caption: what a still frame of this beat shows.
    func stillProgress(_ beat: Int) -> Double {
        let next = beat + 1 < beats.count ? beats[beat + 1].at : 1
        return max(next - 0.03, beats[beat].at)
    }

    // MARK: drawing

    func draw(_ gc: GraphicsContext, _ st: ArkStage, _ p: Double) {
        switch self {
        case .board: drawBoard(gc, st, p)
        case .arkoor: drawArkoor(gc, st, p)
        case .round: drawRound(gc, st, p)
        case .refresh: drawRefresh(gc, st, p)
        case .lightning: drawLightning(gc, st, p)
        case .offboard: drawOffboard(gc, st, p)
        case .exit: drawExit(gc, st, p)
        }
    }

    /// Moving parts fade in at the start of a loop and out at the end.
    private func fade(_ gc: GraphicsContext, _ p: Double) -> GraphicsContext {
        var g = gc
        g.opacity = min(Tween.seg(p, 0, 0.04), 1 - Tween.seg(p, 0.95, 1))
        return g
    }

    private func drawBoard(_ gc: GraphicsContext, _ st: ArkStage, _ p: Double) {
        let land = Tween.seg(p, 0.55, 0.6)
        ArkDraw.ground(gc, st, landings: [ArkDraw.Landing(fill: land)])
        ArkDraw.server(gc, st, pulse: ArkDraw.pulse(p, 0.3, 0.45))
        ArkDraw.person(gc, st.you, initial: "あ", name: "あなた")
        let g = fade(gc, p)

        let utxoHome = pt(Double(st.block(st.blockCount - 2).x), st.blockY - 18)
        let txPoint = pt(st.w / 2, st.rowY)
        if p < 0.32 {
            let rise = Tween.seg(p, 0.15, 0.32)
            ArkDraw.coin(g, Tween.arc(utxoHome, txPoint, rise, lift: 30), label: rise < 0.05 ? "UTXO" : nil)
        }
        if p >= 0.3, p < 0.6 {
            let drop = Tween.seg(p, 0.45, 0.58)
            let at = Tween.mix(txPoint, st.block(0), drop)
            ArkDraw.link(g, st.serverDock, txPoint, progress: Tween.seg(p, 0.3, 0.38), color: Ink.server, dashed: true)
            ArkDraw.tx(g, at, color: Ink.orange)
            ArkDraw.text(g, "ボード取引", pt(Double(at.x), Double(at.y) - 16), size: 10, color: Ink.ink, bold: true,
                         opacity: 1 - drop)
            ArkDraw.check(g, pt(st.w / 2 + 74, 26), color: Ink.good, opacity: Tween.seg(p, 0.36, 0.42) * (1 - drop))
        }
        if p >= 0.6, p < 0.74 {
            let confirmations = Int(Tween.clamp((p - 0.6) / 0.12) * 3.99)
            for i in 0..<3 {
                let c = pt(Double(st.block(0).x) - 10 + Double(i) * 10, st.blockY - 18)
                let dot = Path(ellipseIn: CGRect(x: Double(c.x) - 2.5, y: Double(c.y) - 2.5, width: 5, height: 5))
                g.fill(dot, with: .color(i < confirmations ? Ink.chain : Ink.line))
            }
            ArkDraw.text(g, "承認", pt(Double(st.block(0).x), st.blockY - 30), size: 10, color: Ink.ink, bold: true)
        }
        if p >= 0.72 {
            let up = Tween.seg(p, 0.72, 0.88)
            let at = Tween.arc(st.block(0), st.yourCoin, up, lift: 40)
            ArkDraw.coin(g, at, life: up, label: up > 0.95 ? "VTXO" : nil)
        }
    }

    private func drawArkoor(_ gc: GraphicsContext, _ st: ArkStage, _ p: Double) {
        ArkDraw.ground(gc, st, quiet: p > 0.78 ? "チェーンは つかわない" : nil)
        ArkDraw.server(gc, st, pulse: ArkDraw.pulse(p, 0.36, 0.5))
        ArkDraw.person(gc, st.you, initial: "あ", name: "あなた")
        ArkDraw.person(gc, st.peer, initial: "B", name: "あいて")
        let g = fade(gc, p)

        if p < 0.5 {
            let go = Tween.seg(p, 0.15, 0.36)
            ArkDraw.coin(g, Tween.arc(st.yourCoin, st.serverDock, go, lift: 20), r: 11, life: 0.8,
                         label: go < 0.05 ? "10,000" : nil)
            ArkDraw.check(g, pt(st.w / 2 + 74, 26), color: Ink.good, opacity: Tween.seg(p, 0.4, 0.46))
            ArkDraw.text(g, "共同署名", pt(st.w / 2 + 84, 26), size: 10, color: Ink.ink, bold: true, anchor: .leading,
                         opacity: Tween.seg(p, 0.4, 0.46))
        } else {
            let split = Tween.seg(p, 0.5, 0.74)
            let done = split > 0.97
            ArkDraw.coin(g, Tween.arc(st.serverDock, st.peerCoin, split, lift: 16), r: 7.5, life: 1,
                         label: done ? "3,000" : nil)
            ArkDraw.coin(g, Tween.arc(st.serverDock, st.yourCoin, split, lift: 16), r: 10, life: 1,
                         label: done ? "7,000 おつり" : nil)
            if p > 0.78 {
                ArkDraw.text(g, "てわたし +1", pt(Double(st.peerCoin.x), Double(st.peerCoin.y) - 22), size: 10,
                             opacity: Tween.seg(p, 0.78, 0.84))
            }
        }
    }

    private func drawRound(_ gc: GraphicsContext, _ st: ArkStage, _ p: Double) {
        let land = Tween.seg(p, 0.58, 0.63)
        ArkDraw.ground(gc, st, landings: [ArkDraw.Landing(fill: land)])
        ArkDraw.server(gc, st, pulse: ArkDraw.pulse(p, 0.25, 0.45))
        let xs = [st.w * 0.17, st.w * 0.5, st.w * 0.83]
        let names = [("あ", "あなた"), ("B", "Bさん"), ("C", "Cさん")]
        let peopleY = st.rowY + 8
        for (i, x) in xs.enumerated() {
            ArkDraw.person(gc, pt(x, peopleY), initial: names[i].0, name: names[i].1)
        }
        let g = fade(gc, p)
        let coinY = peopleY - 34
        let root = pt(st.w / 2, 70)

        if p < 0.3 {
            for (i, x) in xs.enumerated() {
                let go = Tween.seg(p, 0.04 + Double(i) * 0.04, 0.22 + Double(i) * 0.03)
                ArkDraw.coin(g, Tween.mix(pt(x, coinY), st.serverDock, go), r: 8, color: Color(light: 0xD9A566, dark: 0xB98B56), life: 0.2,
                             opacity: 1 - Tween.seg(go, 0.85, 1))
            }
        }
        if p >= 0.25 {
            let grow = Tween.seg(p, 0.28, 0.42)
            for x in xs {
                ArkDraw.link(g, root, pt(x, coinY), progress: grow, color: Ink.server.opacity(0.7), dashed: true)
            }
            ArkDraw.tx(g, root, color: Ink.orange, opacity: Tween.seg(p, 0.26, 0.3))
            let signedFade = 1 - Tween.seg(p, 0.62, 0.66)
            for (i, x) in xs.enumerated() {
                let signed = Tween.seg(p, 0.36 + Double(i) * 0.02, 0.4 + Double(i) * 0.02)
                ArkDraw.check(g, pt(x + 20, peopleY - 16), color: Ink.good, opacity: signed * signedFade)
            }
        }
        if p >= 0.45, p < 0.63 {
            ArkDraw.tx(g, Tween.mix(root, st.block(0), Tween.seg(p, 0.46, 0.6)), color: Ink.orange)
        }
        if p >= 0.6 {
            ArkDraw.text(g, "1件", pt(Double(st.block(0).x), st.blockY - 18), size: 10, color: Ink.ink, bold: true)
        }
        if p >= 0.65 {
            for (i, x) in xs.enumerated() {
                let back = Tween.seg(p, 0.66 + Double(i) * 0.04, 0.82 + Double(i) * 0.03)
                ArkDraw.coin(g, Tween.mix(root, pt(x, coinY), back), r: 7, life: back, opacity: Tween.seg(back, 0, 0.1))
            }
        }
    }

    private func drawRefresh(_ gc: GraphicsContext, _ st: ArkStage, _ p: Double) {
        let ticks = [ArkDraw.Landing(fill: Tween.seg(p, 0.06, 0.1), color: Ink.chain),
                     ArkDraw.Landing(fill: Tween.seg(p, 0.16, 0.2), color: Ink.chain),
                     ArkDraw.Landing(fill: Tween.seg(p, 0.26, 0.3), color: Ink.chain),
                     ArkDraw.Landing(fill: Tween.seg(p, 0.66, 0.71))]
        ArkDraw.ground(gc, st, landings: ticks)
        ArkDraw.server(gc, st, pulse: ArkDraw.pulse(p, 0.48, 0.58))
        ArkDraw.person(gc, st.you, initial: "あ", name: "あなた")
        let g = fade(gc, p)

        if p < 0.56 {
            let life = 0.9 - 0.75 * Tween.seg(p, 0, 0.34)
            let go = Tween.seg(p, 0.38, 0.52)
            let label: String? = go > 0.05 ? nil : (life < 0.25 ? "期限 まぢか" : "VTXO")
            ArkDraw.coin(g, Tween.arc(st.yourCoin, st.serverDock, go, lift: 20), color: Color(light: 0xD9A566, dark: 0xB98B56), life: life, label: label)
            if p < 0.36 {
                ArkDraw.text(g, "ブロックが すすむ →", pt(st.w - 14, st.lineY - 9), size: 10, color: Ink.sub, anchor: .trailing)
            }
        }
        if p >= 0.55, p < 0.71 {
            ArkDraw.tx(g, Tween.mix(pt(st.w / 2, 70), st.block(0), Tween.seg(p, 0.56, 0.68)), color: Ink.orange)
        }
        if p >= 0.74 {
            let back = Tween.seg(p, 0.74, 0.9)
            ArkDraw.coin(g, Tween.arc(st.serverDock, st.yourCoin, back, lift: 20), life: back,
                         label: back > 0.95 ? "新しい VTXO" : nil)
        }
    }

    private func drawLightning(_ gc: GraphicsContext, _ st: ArkStage, _ p: Double) {
        ArkDraw.ground(gc, st, quiet: "チェーンは つかわない")
        ArkDraw.server(gc, st, title: "Ark サーバー（入口）", pulse: ArkDraw.pulse(p, 0.22, 0.3))
        ArkDraw.person(gc, st.you, initial: "あ", name: "あなた")
        let shop = st.peer
        ArkDraw.person(gc, shop, initial: "店", name: "おみせ")
        let n1 = pt(st.w * 0.66, st.rowY - 34)
        let n2 = pt(st.w * 0.72, st.rowY + 4)
        let route = [st.serverDock, n1, n2, pt(Double(shop.x) - 14, Double(shop.y))]
        for i in 1..<route.count {
            ArkDraw.link(gc, route[i - 1], route[i], color: Ink.bolt.opacity(0.6), width: 2)
        }
        for node in [n1, n2] {
            let c = Path(ellipseIn: CGRect(x: Double(node.x) - 5, y: Double(node.y) - 5, width: 10, height: 10))
            gc.fill(c, with: .color(Ink.paper))
            gc.stroke(c, with: .color(Ink.bolt), lineWidth: 2)
        }
        ArkDraw.text(gc, "ライトニング", pt(Double(n1.x) + 8, Double(n1.y) - 12), size: 10, anchor: .leading)
        let g = fade(gc, p)

        let go = Tween.seg(p, 0.05, 0.22)
        let coinAt = Tween.arc(st.yourCoin, pt(st.w / 2 - 22, 58), go, lift: 16)
        ArkDraw.coin(g, coinAt, life: 0.8, opacity: p < 0.82 ? 1 : 1 - Tween.seg(p, 0.82, 0.9))
        ArkDraw.lock(g, pt(Double(coinAt.x), Double(coinAt.y) - 18), open: Tween.seg(p, 0.8, 0.86))
        if p >= 0.25, p < 0.6 {
            let t = Tween.seg(p, 0.26, 0.56)
            let bolt = Tween.along(route, t)
            let dot = Path(ellipseIn: CGRect(x: Double(bolt.x) - 4, y: Double(bolt.y) - 4, width: 8, height: 8))
            g.fill(dot, with: .color(Ink.bolt))
            ArkDraw.text(g, "⚡", pt(Double(bolt.x), Double(bolt.y) - 13), size: 13, color: Ink.bolt)
        }
        if p >= 0.58, p < 0.82 {
            let t = Tween.seg(p, 0.6, 0.8)
            ArkDraw.key(g, Tween.along(Array(route.reversed()), t))
        }
        if p >= 0.56 {
            ArkDraw.check(g, pt(Double(shop.x), Double(shop.y) - 26), color: Ink.good, opacity: Tween.seg(p, 0.56, 0.6))
        }
        if p >= 0.84 {
            ArkDraw.text(g, "支払い 完了", pt(st.w / 2, st.rowY + 10), size: 12, color: Ink.ink, bold: true,
                         opacity: Tween.seg(p, 0.84, 0.88))
        }
    }

    private func drawOffboard(_ gc: GraphicsContext, _ st: ArkStage, _ p: Double) {
        let land = Tween.seg(p, 0.66, 0.71)
        ArkDraw.ground(gc, st, landings: [ArkDraw.Landing(fill: land)])
        ArkDraw.server(gc, st, pulse: ArkDraw.pulse(p, 0.3, 0.5))
        ArkDraw.person(gc, st.you, initial: "あ", name: "あなた")
        let g = fade(gc, p)

        if p < 0.32 {
            let go = Tween.seg(p, 0.08, 0.3)
            ArkDraw.coin(g, Tween.arc(st.yourCoin, st.serverDock, go, lift: 20), life: 0.7, label: go < 0.05 ? "VTXO" : nil)
        }
        if p >= 0.3, p < 0.71 {
            let drop = Tween.seg(p, 0.52, 0.68)
            ArkDraw.tx(g, Tween.mix(pt(st.w / 2, 70), st.block(0), drop), color: Ink.orange,
                       opacity: Tween.seg(p, 0.3, 0.34))
        }
        if p >= 0.72 {
            let b = st.block(0)
            ArkDraw.coin(g, pt(Double(b.x), st.blockY - 24), r: 7, opacity: Tween.seg(p, 0.72, 0.78))
            ArkDraw.text(g, "あいての アドレス", pt(Double(b.x) - 14, st.blockY - 24), size: 10, color: Ink.ink, bold: true,
                         anchor: .trailing, opacity: Tween.seg(p, 0.74, 0.8))
        }
    }

    private func drawExit(_ gc: GraphicsContext, _ st: ArkStage, _ p: Double) {
        let drops = (0..<3).map { i in Tween.seg(p, 0.3 + Double(i) * 0.1, 0.36 + Double(i) * 0.1) }
        ArkDraw.ground(gc, st, landings: drops.map { ArkDraw.Landing(fill: $0, color: Ink.chain) })
        let offline = Tween.seg(p, 0.04, 0.12) * (1 - Tween.seg(p, 0.95, 1))
        ArkDraw.server(gc, st, offline: offline)
        ArkDraw.person(gc, st.you, initial: "あ", name: "あなた")
        let g = fade(gc, p)

        let coin = st.yourCoin
        if p < 0.8 {
            ArkDraw.coin(g, coin, life: 0.6, label: p < 0.18 ? "VTXO" : nil)
        }
        if p >= 0.18, p < 0.62 {
            for i in 0..<3 {
                let appear = Tween.seg(p, 0.18 + Double(i) * 0.03, 0.22 + Double(i) * 0.03)
                let start = pt(Double(coin.x) + 30 + Double(i) * 26, st.rowY - 26)
                let fall = Tween.seg(p, 0.3 + Double(i) * 0.1 - 0.05, 0.36 + Double(i) * 0.1)
                let target = st.block(2 - i)
                ArkDraw.tx(g, Tween.mix(start, target, fall), color: Ink.chain, opacity: appear * (1 - Tween.seg(fall, 0.95, 1)))
            }
            ArkDraw.text(g, "署名ずみの 取引", pt(Double(coin.x) + 56, st.rowY - 44), size: 10, color: Ink.ink, bold: true,
                         opacity: Tween.seg(p, 0.2, 0.24) * (1 - Tween.seg(p, 0.5, 0.56)))
        }
        if p >= 0.6, p < 0.82 {
            ArkDraw.bar(g, center: pt(st.w / 2 + 20, st.rowY), width: 120, fill: Tween.seg(p, 0.62, 0.8),
                        label: "待ち ブロック")
        }
        if p >= 0.8 {
            let down = Tween.seg(p, 0.8, 0.9)
            let b = st.block(0)
            let at = Tween.arc(coin, pt(Double(b.x), st.blockY - 24), down, lift: 10)
            ArkDraw.coin(g, at)
            if down > 0.95 {
                ArkDraw.text(g, "あなたの ビットコイン", pt(Double(b.x) - 14, st.blockY - 24), size: 10, color: Ink.ink,
                             bold: true, anchor: .trailing)
            }
        }
    }
}

// MARK: - Player

/// Plays an `ArkScene` in a loop with its captions. Tap the diagram to
/// pause; tap a caption to jump there. Under Reduce Motion it shows still
/// frames you step through instead.
struct ArkScenePlayer: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var scene: ArkScene
    var height: CGFloat = 230
    /// The numbered caption list under the diagram; otherwise one caption line.
    var showsBeats = true
    var showsControls = true

    @State private var start = Date()
    @State private var pausedAt: Date?
    @State private var still = 0
    @Namespace private var beatSpace

    private var paused: Bool { reduceMotion || pausedAt != nil }

    var body: some View {
        TimelineView(.animation(paused: paused)) { context in
            let p = progress(at: context.date)
            let beat = scene.beatIndex(p)
            VStack(alignment: .leading, spacing: 12) {
                Canvas { gc, size in
                    scene.draw(gc, ArkStage(size), p)
                }
                .frame(height: height)
                .contentShape(Rectangle())
                .onTapGesture { togglePause() }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(scene.title)の 図: \(scene.beats[beat].text)")

                // one segment per step, each filling while its step plays
                HStack(spacing: 5) {
                    ForEach(Array(scene.beats.enumerated()), id: \.offset) { index, item in
                        let end = index + 1 < scene.beats.count ? scene.beats[index + 1].at : 1
                        let fill = Tween.clamp((p - item.at) / max(end - item.at, 0.001))
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Ink.serverSoft)
                                Capsule().fill(Ink.server).frame(width: geo.size.width * fill)
                            }
                        }
                        .frame(height: 5)
                    }
                }
                .accessibilityHidden(true)

                if showsBeats {
                    beatList(beat)
                } else {
                    caption(beat)
                }
                if showsControls {
                    controls(beat)
                }
            }
            .animation(Motion.glide, value: beat)
        }
        .onChange(of: scene) { _, _ in restart() }
    }

    /// The current step, big, sliding up as the story moves on.
    private func caption(_ beat: Int) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(beat + 1)")
                .font(Brush.bold(13))
                .foregroundStyle(Ink.onColor)
                .frame(width: 24, height: 24)
                .background(Ink.server, in: Circle())
                .contentTransition(.numericText(value: Double(beat)))
            Text(scene.beats[beat].text)
                .font(Brush.bold(15))
                .foregroundStyle(Ink.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: 42, alignment: .topLeading)
                .id(beat)
                .transition(.asymmetric(insertion: .move(edge: .bottom).combined(with: .opacity),
                                        removal: .move(edge: .top).combined(with: .opacity)))
        }
        .padding(12)
        .background(Ink.serverSoft.opacity(0.6), in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        .clipped()
    }

    private func beatList(_ current: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(scene.beats.enumerated()), id: \.offset) { index, beat in
                let active = index == current
                Button {
                    jump(to: index)
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        ZStack {
                            Circle().fill(active ? Ink.server : (index < current ? Ink.serverSoft : Ink.wash))
                            if index < current {
                                InkIcon(kind: .check, size: 11, lineWidth: 3, color: Ink.server)
                            } else {
                                Text("\(index + 1)")
                                    .font(Brush.bold(11))
                                    .foregroundStyle(active ? Ink.onColor : Ink.sub)
                            }
                        }
                        .frame(width: 22, height: 22)
                        .scaleEffect(active ? 1.12 : 1)
                        Text(beat.text)
                            .font(active ? Brush.bold(14) : Brush.text(14))
                            .foregroundStyle(active ? Ink.ink : Ink.sub)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background {
                        if active {
                            RoundedRectangle(cornerRadius: Radius.small + 2, style: .continuous)
                                .fill(Ink.serverSoft.opacity(0.7))
                                .matchedGeometryEffect(id: "beat", in: beatSpace)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle(scale: 0.98))
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(.horizontal, -4)
    }

    private func controls(_ current: Int) -> some View {
        HStack(spacing: 8) {
            if reduceMotion {
                smallButton(icon: .back, label: "まえ") { still = max(still - 1, 0) }
                    .disabled(still == 0)
                smallButton(icon: .back, label: "つぎ", flipped: true) { still = min(still + 1, scene.beats.count - 1) }
                    .disabled(still == scene.beats.count - 1)
            } else {
                smallButton(icon: paused ? .play : .pause, label: paused ? "再生" : "一時停止") { togglePause() }
                smallButton(icon: .refresh, label: "はじめから") { restart() }
            }
            Spacer()
            Text(paused && !reduceMotion ? "とまっています" : "図を タップで 一時停止")
                .font(Brush.text(12))
                .foregroundStyle(Ink.sub)
        }
    }

    private func smallButton(icon: InkIcon.Kind, label: String, flipped: Bool = false, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            InkIcon(kind: icon, size: 15, lineWidth: 2.4, color: Ink.server)
                .rotationEffect(.degrees(flipped ? 180 : 0))
                .frame(width: 44, height: 36)
                .background(Ink.serverSoft, in: Capsule())
        }
        .buttonStyle(PressableStyle(scale: 0.88))
        .accessibilityLabel(label)
    }

    private func progress(at date: Date) -> Double {
        if reduceMotion { return scene.stillProgress(min(still, scene.beats.count - 1)) }
        let elapsed = (pausedAt ?? date).timeIntervalSince(start)
        return (elapsed / scene.duration).truncatingRemainder(dividingBy: 1)
    }

    private func togglePause() {
        guard !reduceMotion else { return }
        if let pausedAt {
            start = start.addingTimeInterval(Date().timeIntervalSince(pausedAt))
            self.pausedAt = nil
        } else {
            pausedAt = Date()
        }
    }

    private func restart() {
        start = Date()
        still = 0
        if pausedAt != nil { pausedAt = Date() }
    }

    private func jump(to beat: Int) {
        Haptics.tap()
        if reduceMotion {
            still = beat
            return
        }
        let now = Date()
        start = now.addingTimeInterval(-scene.beats[beat].at * scene.duration)
        if pausedAt != nil { pausedAt = now }
    }
}

// MARK: - Mark

/// The app's quiet mark: a VTXO coin whose lifetime ring keeps refilling.
/// Used while the wallet starts.
struct ArkMark: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var size: CGFloat = 72

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 0.75 : context.date.timeIntervalSinceReferenceDate
            Canvas { gc, canvas in
                let c = CGPoint(x: canvas.width / 2, y: canvas.height / 2)
                let s = Double(canvas.width)
                let phase = (t / 2.4).truncatingRemainder(dividingBy: 1)
                let life = reduceMotion ? 0.75 : Tween.ease(phase < 0.8 ? phase / 0.8 : 1)
                let r = s * 0.2
                let rr = s * 0.36
                let x = Double(c.x), y = Double(c.y)
                gc.stroke(Path(ellipseIn: CGRect(x: x - rr, y: y - rr, width: rr * 2, height: rr * 2)),
                          with: .color(Ink.serverSoft), lineWidth: s * 0.07)
                var ring = Path()
                ring.addArc(center: c, radius: rr, startAngle: .degrees(-90),
                            endAngle: .degrees(-90 + 360 * life), clockwise: false)
                gc.stroke(ring, with: .color(Ink.server),
                          style: StrokeStyle(lineWidth: s * 0.07, lineCap: .round))
                let pop = phase > 0.8 ? 1 + 0.16 * sin((phase - 0.8) / 0.2 * Double.pi) : 1
                let cr = r * pop
                gc.fill(Path(ellipseIn: CGRect(x: x - cr, y: y - cr, width: cr * 2, height: cr * 2)),
                        with: .color(Ink.orange))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
