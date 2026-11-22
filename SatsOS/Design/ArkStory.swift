import AVFoundation
import SwiftUI

// 1分で わかる Ark: the whole idea as one short film.
//
// Ten scenes on one stage that never changes: the bitcoin chain along the
// bottom, the Ark "room" above it. Each scene has a two-or-three word
// title and one sentence, read aloud if you like, so nobody has to study
// a page of text to get the picture. The detailed diagrams (ArkScenes)
// stay available underneath for people who want more.

// MARK: - Chapters

struct StoryChapter: Identifiable {
    let id: Int
    let title: String
    let line: String

    /// Seconds on screen: long enough to hear the sentence once.
    var duration: Double { max(6.5, Double(line.count) * 0.16 + 2.5) }

    /// The sentence as the voice should say it.
    var speech: String {
        var text = "\(title)。\(line)"
        for (from, to) in [("Ark", "アーク"), ("VTXO", "ブイティーエックスオー"), ("Refresh", "リフレッシュ"),
                           ("1本", "いっぽん"), ("1件", "いっけん"), ("3つ", "みっつ"), ("OK", "オーケー"),
                           ("手数料", "てすうりょう"), ("外", "そと"), ("中", "なか"), (" ", "")] {
            text = text.replacingOccurrences(of: from, with: to)
        }
        return text
    }

    static let all: [StoryChapter] = [
        StoryChapter(id: 0, title: "こまったこと",
                     line: "ビットコインは みんなが 1本の チェーンに ならぶので、おそくて 手数料が 高くなりがち。"),
        StoryChapter(id: 1, title: "Ark の アイデア",
                     line: "そこで チェーンの 外に「Ark」という 部屋を つくり、その 中で やりとりします。"),
        StoryChapter(id: 2, title: "入る",
                     line: "ビットコインを Ark に 入れると、「VTXO」という コインに なります。"),
        StoryChapter(id: 3, title: "送る",
                     line: "Ark の 中なら 一瞬。チェーンを 使わないので 手数料も ほとんど かかりません。"),
        StoryChapter(id: 4, title: "カギは あなた",
                     line: "コインを 動かせるのは カギを もつ あなただけ。サーバーが 勝手に 使うことは できません。"),
        StoryChapter(id: 5, title: "期限が ある",
                     line: "ただし VTXO には 期限が あります。まわりの リングが だんだん へっていきます。"),
        StoryChapter(id: 6, title: "Refresh",
                     line: "期限の 前に 新しい コインと こうかん。これが Refresh。ふだんは アプリが 自動で やります。"),
        StoryChapter(id: 7, title: "ラウンド",
                     line: "サーバーは みんなの こうかんを まとめて、チェーンには 1件だけ 書きます。だから 安い。"),
        StoryChapter(id: 8, title: "いつでも 出られる",
                     line: "もし サーバーが 止まっても、自分だけで チェーンに もどせます。"),
        StoryChapter(id: 9, title: "まとめ",
                     line: "Ark は、はやい・安い・カギは 自分。この 3つを おぼえれば OK！"),
    ]

    static let total: Double = all.reduce(0) { $0 + $1.duration }

    static func start(of index: Int) -> Double {
        all.prefix(index).reduce(0) { $0 + $1.duration }
    }

    /// Which chapter is playing at `elapsed`, and how far through it (0...1).
    static func locate(_ elapsed: Double) -> (index: Int, progress: Double) {
        var left = max(elapsed, 0)
        for chapter in all {
            if left < chapter.duration { return (chapter.id, left / chapter.duration) }
            left -= chapter.duration
        }
        return (all.count - 1, 1)
    }
}

// MARK: - Stage

private func sp(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: y) }

private struct StoryStage {
    let w: Double
    let h: Double

    init(_ size: CGSize) {
        w = Double(size.width)
        h = Double(size.height)
    }

    var chainTop: Double { h - 66 }
    var blockY: Double { h - 28 }
    let blockSize: Double = 24
    let blockGap: Double = 34
    var blockCount: Int { max(Int((w - 28) / blockGap), 4) }

    /// Centre of a block counted from the right: 0 is the next block.
    func block(_ fromRight: Int) -> CGPoint {
        let first = (w - Double(blockCount - 1) * blockGap) / 2
        return sp(first + Double(blockCount - 1 - fromRight) * blockGap, blockY)
    }

    var room: CGRect { CGRect(x: 4, y: 4, width: w - 8, height: chainTop - 14) }
    var server: CGPoint { sp(w / 2, 46) }
    var dock: CGPoint { sp(w / 2, 82) }
    var rowY: Double { Double(room.maxY) - 58 }
    var you: CGPoint { sp(44, rowY) }
    var friend: CGPoint { sp(w - 44, rowY) }
    var yourCoin: CGPoint { sp(104, rowY - 6) }
    var friendCoin: CGPoint { sp(w - 104, rowY - 6) }
    var centre: CGPoint { sp(w / 2, rowY - 14) }
}

// MARK: - Drawing

private enum StoryDraw {
    /// A coloured pill with white words: the one thing to notice right now.
    static func tag(_ gc: GraphicsContext, _ text: String, at p: CGPoint, color: Color, appear: Double, size: CGFloat = 13) {
        guard appear > 0.01 else { return }
        let label = gc.resolve(Text(text).font(Brush.bold(size)).foregroundColor(.white))
        let measured = label.measure(in: CGSize(width: 400, height: 60))
        let scale = Tween.back(appear)
        var g = gc
        g.opacity = Tween.clamp(appear * 2)
        g.translateBy(x: p.x, y: p.y)
        g.scaleBy(x: scale, y: scale)
        let rect = CGRect(x: -Double(measured.width) / 2 - 12, y: -Double(measured.height) / 2 - 6,
                          width: Double(measured.width) + 24, height: Double(measured.height) + 12)
        g.fill(Path(roundedRect: rect.offsetBy(dx: 0, dy: 3), cornerRadius: rect.height / 2), with: .color(color.opacity(0.3)))
        g.fill(Path(roundedRect: rect, cornerRadius: rect.height / 2), with: .color(color))
        g.draw(label, at: .zero)
    }

    /// The bitcoin chain: a teal band with a row of blocks. `landings` are
    /// the newest blocks filling in, left to right, ending with the next one.
    static func chain(_ gc: GraphicsContext, _ st: StoryStage, landings: [ArkDraw.Landing] = [], asleep: Double = 0) {
        let band = CGRect(x: 4, y: st.chainTop, width: st.w - 8, height: st.h - st.chainTop - 4)
        gc.fill(Path(roundedRect: band, cornerRadius: 20), with: .color(Ink.chainSoft))
        ArkDraw.text(gc, "ビットコインの チェーン", sp(18, st.chainTop + 13), size: 11, color: Ink.chain, bold: true, anchor: .leading)
        var links = Path()
        links.move(to: st.block(st.blockCount - 1))
        links.addLine(to: st.block(0))
        gc.stroke(links, with: .color(Ink.chain.opacity(0.4)), lineWidth: 3)
        let pending = landings.count
        for k in 0..<st.blockCount {
            let c = st.block(k)
            var s = st.blockSize
            var landing: ArkDraw.Landing?
            if k < pending {
                landing = landings[pending - 1 - k]
                s *= 1 + 0.4 * Tween.hump(landing?.fill ?? 0)
            }
            let shape = Path(roundedRect: CGRect(x: Double(c.x) - s / 2, y: Double(c.y) - s / 2, width: s, height: s), cornerRadius: 7)
            if let landing {
                gc.fill(shape, with: .color(Ink.paper))
                if landing.fill > 0.01 {
                    gc.fill(shape, with: .color(landing.color.opacity(landing.fill)))
                } else {
                    gc.stroke(shape, with: .color(Ink.chain.opacity(0.8)), style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
                }
            } else {
                gc.fill(shape, with: .color(Ink.chain.opacity(0.32)))
            }
        }
        if asleep > 0.01 {
            let label = gc.resolve(Text("チェーンは おやすみ中 💤").font(Brush.bold(12)).foregroundColor(Ink.chain))
            let measured = label.measure(in: CGSize(width: 400, height: 40))
            var g = gc
            g.opacity = asleep
            let plate = CGRect(x: st.w / 2 - Double(measured.width) / 2 - 12, y: st.blockY - Double(measured.height) / 2 - 6,
                               width: Double(measured.width) + 24, height: Double(measured.height) + 12)
            g.fill(Path(roundedRect: plate, cornerRadius: plate.height / 2), with: .color(Ink.paper))
            g.draw(label, at: sp(st.w / 2, st.blockY))
        }
    }

    /// The Ark room, growing out of its centre as it appears.
    static func room(_ gc: GraphicsContext, _ st: StoryStage, appear: Double = 1) {
        guard appear > 0.01 else { return }
        let grow = Tween.back(appear)
        var g = gc
        g.opacity = Tween.clamp(appear * 1.5)
        let full = st.room
        let rect = CGRect(x: full.midX - full.width / 2 * grow, y: full.midY - full.height / 2 * grow,
                          width: full.width * grow, height: full.height * grow)
        g.fill(Path(roundedRect: rect, cornerRadius: 24), with: .color(Ink.serverSoft.opacity(0.7)))
        g.stroke(Path(roundedRect: rect.insetBy(dx: 1, dy: 1), cornerRadius: 23), with: .color(Ink.server.opacity(0.25)),
                 style: StrokeStyle(lineWidth: 2, dash: [6, 6]))
        ArkDraw.text(g, "Ark（チェーンの 外）", sp(18, Double(full.maxY) - 16), size: 11, color: Ink.server, bold: true,
                     anchor: .leading, opacity: Tween.seg(appear, 0.7, 1))
    }

    /// Room, server and the two people: what most scenes start from.
    static func cast(_ gc: GraphicsContext, _ st: StoryStage, pulse: Double = 0, offline: Double = 0, friend: Bool = true) {
        room(gc, st)
        ArkDraw.serverBox(gc, at: st.server, pulse: pulse, offline: offline)
        ArkDraw.person(gc, st.you, initial: "あ", name: "あなた")
        if friend {
            ArkDraw.person(gc, st.friend, initial: "B", name: "ともだち")
        }
    }

    /// Draws something from ArkDraw bigger, centred on `p`.
    static func big(_ gc: GraphicsContext, at p: CGPoint, scale: Double, opacity: Double = 1, _ body: (GraphicsContext) -> Void) {
        guard opacity > 0.01, scale > 0.01 else { return }
        var g = gc
        g.opacity = opacity
        g.translateBy(x: p.x, y: p.y)
        g.scaleBy(x: scale, y: scale)
        body(g)
    }

    static func cross(_ gc: GraphicsContext, at p: CGPoint, appear: Double) {
        guard appear > 0.01 else { return }
        let s = 8 * Tween.back(appear)
        let x = Double(p.x), y = Double(p.y)
        let disc = Path(ellipseIn: CGRect(x: x - s * 1.7, y: y - s * 1.7, width: s * 3.4, height: s * 3.4))
        gc.fill(disc, with: .color(Ink.alert))
        var path = Path()
        path.move(to: sp(x - s * 0.7, y - s * 0.7)); path.addLine(to: sp(x + s * 0.7, y + s * 0.7))
        path.move(to: sp(x + s * 0.7, y - s * 0.7)); path.addLine(to: sp(x - s * 0.7, y + s * 0.7))
        gc.stroke(path, with: .color(.white), style: StrokeStyle(lineWidth: 3, lineCap: .round))
    }
}

// MARK: - Scenes

private enum StoryScene {
    static let others: [Color] = [Ink.chain, Ink.alert, Ink.bolt, Ink.server, Ink.good]

    static func draw(_ gc: GraphicsContext, _ size: CGSize, chapter: Int, p: Double) {
        let st = StoryStage(size)
        // moving parts fade in as a scene starts and out as it ends
        var g = gc
        g.opacity = min(Tween.seg(p, 0, 0.05), 1 - Tween.seg(p, 0.96, 1))
        switch chapter {
        case 0: problem(gc, g, st, p)
        case 1: idea(gc, st, p)
        case 2: board(gc, g, st, p)
        case 3: send(gc, g, st, p)
        case 4: keys(gc, g, st, p)
        case 5: expiry(gc, g, st, p)
        case 6: refresh(gc, g, st, p)
        case 7: round(gc, g, st, p)
        case 8: exit(gc, g, st, p)
        default: summary(gc, st, p)
        }
    }

    /// Everyone queues for the same chain.
    private static func problem(_ gc: GraphicsContext, _ g: GraphicsContext, _ st: StoryStage, _ p: Double) {
        let land = Tween.seg(p, 0.42, 0.5)
        StoryDraw.chain(gc, st, landings: [ArkDraw.Landing(fill: land, color: Ink.orange)])
        let queueY = st.chainTop - 34
        let door = sp(Double(st.block(0).x), queueY)
        let shuffle = Tween.seg(p, 0.5, 0.75)
        for i in 0..<6 {
            let home = sp(Double(door.x) - Double(i) * 38, queueY)
            let bob = sin(p * 40 + Double(i)) * 2
            if i == 0 {
                let drop = Tween.seg(p, 0.28, 0.44)
                let at = Tween.mix(home, st.block(0), drop)
                ArkDraw.coin(g, at, r: 13, opacity: 1 - Tween.seg(drop, 0.85, 1))
            } else {
                let x = Double(home.x) + 38 * shuffle
                guard x > 12 else { continue }
                ArkDraw.coin(g, sp(x, queueY + bob), r: 13, color: others[(i - 1) % others.count])
            }
        }
        ArkDraw.text(g, "じゅんばん まち…", sp(st.w / 2, queueY - 34), size: 13, color: Ink.sub, bold: true,
                     opacity: 1 - Tween.seg(p, 0.5, 0.56))
        StoryDraw.tag(g, "10分に 1ブロックだけ", at: sp(st.w / 2, st.h * 0.2), color: Ink.chain, appear: Tween.seg(p, 0.12, 0.24))
        StoryDraw.tag(g, "おそい 🐢", at: sp(st.w * 0.3, st.h * 0.4), color: Ink.alert, appear: Tween.seg(p, 0.55, 0.65), size: 16)
        StoryDraw.tag(g, "手数料が 高い 💸", at: sp(st.w * 0.66, st.h * 0.4), color: Ink.alert, appear: Tween.seg(p, 0.7, 0.8), size: 16)
    }

    /// A room off the chain.
    private static func idea(_ gc: GraphicsContext, _ st: StoryStage, _ p: Double) {
        StoryDraw.chain(gc, st)
        StoryDraw.room(gc, st, appear: Tween.seg(p, 0.08, 0.4))
        let server = Tween.seg(p, 0.4, 0.55)
        StoryDraw.big(gc, at: st.server, scale: Tween.back(server), opacity: Tween.clamp(server * 2)) { g in
            ArkDraw.serverBox(g, at: .zero, pulse: ArkDraw.pulse(p, 0.55, 0.9, speed: 1.2))
        }
        let you = Tween.seg(p, 0.55, 0.68)
        StoryDraw.big(gc, at: st.you, scale: Tween.back(you), opacity: Tween.clamp(you * 2)) { g in
            ArkDraw.person(g, .zero, initial: "あ", name: "あなた")
        }
        let friend = Tween.seg(p, 0.63, 0.76)
        StoryDraw.big(gc, at: st.friend, scale: Tween.back(friend), opacity: Tween.clamp(friend * 2)) { g in
            ArkDraw.person(g, .zero, initial: "B", name: "ともだち")
        }
        StoryDraw.tag(gc, "やりとりは この 中で", at: st.centre, color: Ink.server, appear: Tween.seg(p, 0.78, 0.9), size: 15)
    }

    /// Bitcoin from the chain becomes a VTXO in the room.
    private static func board(_ gc: GraphicsContext, _ g: GraphicsContext, _ st: StoryStage, _ p: Double) {
        StoryDraw.chain(gc, st, landings: [ArkDraw.Landing(fill: Tween.seg(p, 0.3, 0.38), color: Ink.orange)])
        StoryDraw.cast(gc, st, pulse: ArkDraw.pulse(p, 0.3, 0.5, speed: 1.2))
        let from = sp(Double(st.block(0).x), st.blockY)
        let rise = Tween.seg(p, 0.34, 0.66)
        if p < 0.34 {
            let appear = Tween.seg(p, 0.08, 0.18)
            let start = sp(Double(from.x), st.chainTop - 24)
            ArkDraw.coin(g, Tween.mix(start, from, Tween.seg(p, 0.2, 0.32)), r: 14, label: appear > 0.9 && p < 0.2 ? "ビットコイン" : nil,
                         opacity: appear)
        } else {
            let life = Tween.seg(p, 0.66, 0.84)
            ArkDraw.coin(g, Tween.arc(from, st.yourCoin, rise, lift: 70), r: 15, life: rise > 0.98 ? life : nil,
                         label: p > 0.8 ? "VTXO" : nil)
        }
        StoryDraw.tag(g, "Ark の コインに 変身 ✨", at: sp(st.w * 0.6, st.rowY - 16), color: Ink.orange, appear: Tween.seg(p, 0.78, 0.88))
    }

    /// Paying inside the room: instant, and the chain sleeps through it.
    private static func send(_ gc: GraphicsContext, _ g: GraphicsContext, _ st: StoryStage, _ p: Double) {
        StoryDraw.chain(gc, st, asleep: Tween.seg(p, 0.5, 0.6))
        StoryDraw.cast(gc, st, pulse: ArkDraw.pulse(p, 0.24, 0.36, speed: 1.5))
        let fly = Tween.seg(p, 0.3, 0.44)
        let shrink = 15 - 4 * Tween.seg(p, 0.28, 0.34)
        ArkDraw.coin(g, st.yourCoin, r: shrink, life: 0.9, label: fly > 0.9 ? "おつり" : nil)
        if p >= 0.28 {
            let at = Tween.arc(st.yourCoin, st.friendCoin, Tween.back(fly), lift: 50)
            ArkDraw.coin(g, at, r: 10, life: 0.9)
            // a streak behind it
            for k in 1...3 where fly > 0.02 && fly < 0.98 {
                let trail = Tween.arc(st.yourCoin, st.friendCoin, max(fly - Double(k) * 0.07, 0), lift: 50)
                ArkDraw.coin(g, trail, r: 10 - Double(k) * 2, opacity: 0.3 - Double(k) * 0.08)
            }
        }
        StoryDraw.tag(g, "一瞬で とどく ⚡", at: sp(st.w / 2, st.rowY - 62), color: Ink.orange, appear: Tween.seg(p, 0.46, 0.56), size: 16)
    }

    /// Only your key moves your coin.
    private static func keys(_ gc: GraphicsContext, _ g: GraphicsContext, _ st: StoryStage, _ p: Double) {
        StoryDraw.chain(gc, st)
        StoryDraw.cast(gc, st, friend: false)
        let coin = sp(st.w * 0.58, st.rowY - 8)
        ArkDraw.coin(g, coin, r: 18, life: 0.9)
        // your key
        let key = Tween.seg(p, 0.12, 0.26)
        StoryDraw.big(g, at: sp(Double(st.you.x) + 34, Double(st.you.y) - 30), scale: 2 * Tween.back(key), opacity: Tween.clamp(key * 2)) { k in
            ArkDraw.key(k, .zero)
        }
        ArkDraw.link(g, sp(Double(st.you.x) + 22, Double(st.you.y) - 4), sp(Double(coin.x) - 26, Double(coin.y)),
                     progress: Tween.seg(p, 0.26, 0.4), color: Ink.good, width: 3)
        ArkDraw.check(g, sp((Double(st.you.x) + Double(coin.x)) / 2, Double(coin.y) - 14), opacity: Tween.seg(p, 0.4, 0.46))
        // the server reaches for it and is stopped
        let reach = Tween.seg(p, 0.52, 0.66)
        let stop = Tween.mix(st.dock, sp(Double(coin.x), Double(coin.y) - 26), 0.62)
        ArkDraw.link(g, st.dock, stop, progress: reach, color: Ink.alert, dashed: true, width: 3)
        StoryDraw.cross(g, at: stop, appear: Tween.seg(p, 0.66, 0.74))
        StoryDraw.tag(g, "サーバーは さわれない", at: sp(st.w * 0.62, st.rowY + 34), color: Ink.server, appear: Tween.seg(p, 0.76, 0.86))
    }

    /// The ring drains as blocks go by.
    private static func expiry(_ gc: GraphicsContext, _ g: GraphicsContext, _ st: StoryStage, _ p: Double) {
        let ticks = (0..<4).map { i in
            ArkDraw.Landing(fill: Tween.seg(p, 0.14 + Double(i) * 0.16, 0.2 + Double(i) * 0.16), color: Ink.chain)
        }
        StoryDraw.chain(gc, st, landings: ticks)
        StoryDraw.cast(gc, st, friend: false)
        let life = 1 - 0.86 * Tween.seg(p, 0.1, 0.78)
        let shake = life < 0.25 ? sin(p * 260) * 2 : 0
        ArkDraw.coin(g, sp(Double(st.centre.x) + shake, Double(st.centre.y)), r: 24, life: life)
        ArkDraw.text(g, "ブロックが すすむ →", sp(st.w - 18, st.chainTop + 13), size: 11, color: Ink.chain, bold: true, anchor: .trailing)
        StoryDraw.tag(g, life < 0.25 ? "期限 まぢか！" : "期限まで のこり \(Int(life * 100))%",
                      at: sp(st.w / 2, Double(st.centre.y) + 52), color: life < 0.25 ? Ink.alert : (life < 0.5 ? Ink.bolt : Ink.good),
                      appear: Tween.seg(p, 0.06, 0.14))
    }

    /// Swap the old coin for a fresh one.
    private static func refresh(_ gc: GraphicsContext, _ g: GraphicsContext, _ st: StoryStage, _ p: Double) {
        StoryDraw.chain(gc, st)
        StoryDraw.cast(gc, st, pulse: ArkDraw.pulse(p, 0.34, 0.52, speed: 1.2), friend: false)
        if p < 0.4 {
            let go = Tween.seg(p, 0.12, 0.34)
            ArkDraw.coin(g, Tween.arc(st.centre, st.dock, go, lift: 20), r: 24 - 8 * go, color: Color(light: 0xD9A566, dark: 0xB98B56),
                         life: 0.14, label: go < 0.05 ? "古い コイン" : nil, opacity: 1 - Tween.seg(p, 0.34, 0.4))
        }
        if p >= 0.48 {
            let back = Tween.seg(p, 0.48, 0.7)
            ArkDraw.coin(g, Tween.arc(st.dock, st.centre, Tween.back(back), lift: 20), r: 16 + 8 * back,
                         life: Tween.seg(p, 0.56, 0.8), label: back > 0.95 ? "新しい コイン" : nil)
        }
        StoryDraw.tag(g, "期限が まんたんに 🔄", at: sp(st.w / 2, Double(st.centre.y) + 58), color: Ink.good,
                      appear: Tween.seg(p, 0.76, 0.86), size: 15)
    }

    /// Everyone's swap in one transaction on the chain.
    private static func round(_ gc: GraphicsContext, _ g: GraphicsContext, _ st: StoryStage, _ p: Double) {
        StoryDraw.chain(gc, st, landings: [ArkDraw.Landing(fill: Tween.seg(p, 0.54, 0.6), color: Ink.orange)])
        StoryDraw.room(gc, st)
        ArkDraw.serverBox(gc, at: st.server, pulse: ArkDraw.pulse(p, 0.26, 0.42, speed: 1.2))
        let xs = [st.w * 0.16, st.w * 0.5, st.w * 0.84]
        let names = [("あ", "あなた"), ("B", "Bさん"), ("C", "Cさん")]
        for (i, x) in xs.enumerated() {
            ArkDraw.person(gc, sp(x, st.rowY + 4), initial: names[i].0, name: names[i].1)
        }
        let coinY = st.rowY - 36
        let tan = Color(light: 0xD9A566, dark: 0xB98B56)
        if p < 0.32 {
            for (i, x) in xs.enumerated() {
                let go = Tween.seg(p, 0.06 + Double(i) * 0.04, 0.24 + Double(i) * 0.03)
                ArkDraw.coin(g, Tween.mix(sp(x, coinY), st.dock, go), r: 11, color: tan, life: 0.2,
                             opacity: 1 - Tween.seg(go, 0.85, 1))
            }
        }
        if p >= 0.28, p < 0.6 {
            let drop = Tween.seg(p, 0.42, 0.56)
            StoryDraw.big(g, at: Tween.mix(sp(st.w / 2, 96), st.block(0), drop), scale: 1.6 * Tween.back(Tween.seg(p, 0.28, 0.36))) { t in
                ArkDraw.tx(t, .zero, color: Ink.orange)
            }
        }
        if p >= 0.62 {
            for (i, x) in xs.enumerated() {
                let back = Tween.seg(p, 0.62 + Double(i) * 0.04, 0.8 + Double(i) * 0.03)
                ArkDraw.coin(g, Tween.mix(st.dock, sp(x, coinY), back), r: 11, life: back, opacity: Tween.seg(back, 0, 0.1))
            }
        }
        StoryDraw.tag(g, "チェーンには 1件だけ", at: sp(st.w / 2, 104), color: Ink.chain,
                      appear: Tween.seg(p, 0.56, 0.64) * (1 - Tween.seg(p, 0.8, 0.84)))
        StoryDraw.tag(g, "手数料は みんなで わりかん 🪙", at: sp(st.w / 2, 104), color: Ink.orange, appear: Tween.seg(p, 0.84, 0.92))
    }

    /// The server is gone; you leave on your own.
    private static func exit(_ gc: GraphicsContext, _ g: GraphicsContext, _ st: StoryStage, _ p: Double) {
        let land = Tween.seg(p, 0.66, 0.72)
        StoryDraw.chain(gc, st, landings: [ArkDraw.Landing(fill: land, color: Ink.orange)])
        let offline = Tween.seg(p, 0.06, 0.18)
        StoryDraw.cast(gc, st, offline: offline, friend: false)
        ArkDraw.text(g, "zzz…", sp(st.w / 2, 84), size: 14, color: Ink.sub, bold: true, opacity: offline * (1 - Tween.seg(p, 0.9, 1)))
        let fall = Tween.seg(p, 0.38, 0.68)
        let above = sp(Double(st.block(0).x), st.chainTop - 20)
        if fall < 0.99 {
            ArkDraw.coin(g, Tween.arc(st.yourCoin, above, fall, lift: 46), r: 15, life: fall < 0.5 ? 0.6 : nil)
        } else {
            ArkDraw.coin(g, above, r: 15, label: nil)
            StoryDraw.tag(g, "あなたの ビットコイン", at: sp(Double(above.x) - 96, Double(above.y)), color: Ink.orange,
                          appear: Tween.seg(p, 0.72, 0.8))
        }
        StoryDraw.tag(g, "サーバーの 許可は いらない 🔑", at: sp(st.w / 2, st.rowY - 44), color: Ink.good,
                      appear: Tween.seg(p, 0.22, 0.32))
    }

    /// The three things to remember.
    private static func summary(_ gc: GraphicsContext, _ st: StoryStage, _ p: Double) {
        let items: [(String, String, Color)] = [
            ("⚡", "はやい", Ink.orange),
            ("🪙", "安い", Ink.chain),
            ("🔑", "カギは 自分", Ink.server),
        ]
        let rowHeight = min((st.h - 40) / 3, 82)
        let top = (st.h - rowHeight * 3) / 2
        for (i, item) in items.enumerated() {
            let appear = Tween.seg(p, 0.06 + Double(i) * 0.14, 0.2 + Double(i) * 0.14)
            guard appear > 0.01 else { continue }
            let y = top + rowHeight * (Double(i) + 0.5)
            var g = gc
            g.opacity = Tween.clamp(appear * 2)
            g.translateBy(x: st.w / 2, y: y)
            let scale = Tween.back(appear)
            g.scaleBy(x: scale, y: scale)
            let width = min(st.w - 40, 300)
            let rect = CGRect(x: -width / 2, y: -rowHeight / 2 + 6, width: width, height: rowHeight - 12)
            g.fill(Path(roundedRect: rect.offsetBy(dx: 0, dy: 4), cornerRadius: 22), with: .color(item.2.opacity(0.3)))
            g.fill(Path(roundedRect: rect, cornerRadius: 22), with: .color(item.2))
            g.draw(Text(item.0).font(.system(size: 30)), at: sp(-width / 2 + 44, 0))
            g.draw(Text(item.1).font(Brush.bold(24)).foregroundColor(.white), at: sp(-width / 2 + 82, 0), anchor: .leading)
        }
    }
}

// MARK: - Voice

/// Reads the film's sentences aloud in Japanese.
@MainActor
final class Narrator {
    static let shared = Narrator()
    private let synthesizer = AVSpeechSynthesizer()

    func say(_ text: String) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "ja-JP")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.pitchMultiplier = 1.08
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }
}

// MARK: - Player

/// The film. Starts on a poster with a play button; then plays through the
/// ten scenes, reading each sentence aloud unless muted. Tap the left or
/// right of the picture to step, the middle to pause. Under Reduce Motion
/// it shows one still per scene.
struct ArkStoryPlayer: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("storyNarration") private var narration = true
    /// Start already playing at this scene (screenshots).
    var autoStart: Int? = nil

    @State private var started = false
    /// Seconds played up to the last pause or jump.
    @State private var offset: Double = 0
    /// When playback last resumed; nil while paused.
    @State private var resumedAt: Date?

    private var playing: Bool { resumedAt != nil }
    private let chapters = StoryChapter.all

    var body: some View {
        TimelineView(.animation(paused: !playing || reduceMotion)) { context in
            let elapsed = elapsed(at: context.date)
            let spot = StoryChapter.locate(elapsed)
            let chapter = chapters[spot.index]
            let progress = reduceMotion ? 0.9 : spot.progress
            VStack(alignment: .leading, spacing: 14) {
                header
                segments(index: spot.index, progress: spot.progress)
                stage(chapter: spot.index, progress: progress)
                caption(chapter)
                controls(index: spot.index, finished: elapsed >= StoryChapter.total)
            }
            .animation(Motion.glide, value: spot.index)
            .onChange(of: spot.index) { _, index in
                if playing || reduceMotion { speak(index) }
            }
            .onChange(of: elapsed >= StoryChapter.total) { _, finished in
                if finished { pause() }
            }
        }
        .onAppear {
            if let autoStart, !started {
                started = true
                offset = StoryChapter.start(of: autoStart) + chapters[autoStart].duration * 0.62
            }
        }
        .onDisappear {
            pause()
        }
    }

    // MARK: pieces

    private var header: some View {
        HStack(spacing: 8) {
            InkBadge(text: "1分 どうが", color: Ink.tint)
            Text("Ark って なに？")
                .font(Brush.bold(20))
                .foregroundStyle(Ink.ink)
            Spacer()
            Button {
                Haptics.tap()
                narration.toggle()
                if !narration { Narrator.shared.stop() }
            } label: {
                InkIcon(kind: narration ? .sound : .mute, size: 18, lineWidth: 2, color: narration ? Ink.tint : Ink.sub)
                    .frame(width: 40, height: 36)
                    .background(narration ? Ink.wash : Ink.wash, in: Capsule())
            }
            .buttonStyle(PressableStyle(scale: 0.88))
            .accessibilityLabel(narration ? "よみあげ オン" : "よみあげ オフ")
        }
    }

    private func segments(index: Int, progress: Double) -> some View {
        HStack(spacing: 4) {
            ForEach(chapters) { chapter in
                let fill: Double = chapter.id < index ? 1 : (chapter.id == index && started ? progress : 0)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Ink.wash)
                        Capsule().fill(Ink.tint).frame(width: geo.size.width * fill)
                    }
                }
                .frame(height: 5)
            }
        }
        .accessibilityHidden(true)
    }

    private func stage(chapter: Int, progress: Double) -> some View {
        Canvas { gc, size in
            if started {
                StoryScene.draw(gc, size, chapter: chapter, p: progress)
            } else {
                // the poster: the finished stage, waiting
                StoryScene.draw(gc, size, chapter: 1, p: 0.74)
            }
        }
        .frame(height: 300)
        .overlay {
            if !started {
                poster
            }
        }
        .contentShape(Rectangle())
        .gesture(
            SpatialTapGesture().onEnded { value in
                guard started else {
                    play()
                    return
                }
                tapped(x: value.location.x)
            }
        )
        .background(GeometryReader { geo in
            Color.clear.onAppear { stageWidth = geo.size.width }
                .onChange(of: geo.size.width) { _, width in stageWidth = width }
        })
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Ark の しくみの どうが")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { started && playing ? pause() : play() }
    }

    @State private var stageWidth: CGFloat = 320

    private var poster: some View {
        VStack(spacing: 10) {
            InkIcon(kind: .play, size: 30, lineWidth: 2.6, color: Ink.onTint)
                .offset(x: 2)
                .frame(width: 84, height: 84)
                .background(Ink.tint, in: Circle())
                .floating(4, period: 2.4)
            Text("タップして 見る")
                .font(Brush.bold(15))
                .foregroundStyle(Ink.tint)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(Ink.paper, in: Capsule())
        }
        .offset(y: -14)
        .transition(.scale.combined(with: .opacity))
        .allowsHitTesting(false)
    }

    private func caption(_ chapter: StoryChapter) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(chapter.id + 1)")
                .font(Brush.bold(15))
                .foregroundStyle(Ink.onTint)
                .frame(width: 30, height: 30)
                .background(Ink.tint, in: Circle())
                .contentTransition(.numericText(value: Double(chapter.id)))
            VStack(alignment: .leading, spacing: 4) {
                Text(started ? chapter.title : "10の ばめんで ぜんぶ わかる")
                    .font(Brush.bold(22))
                    .foregroundStyle(Ink.ink)
                Text(started ? chapter.line : "読まなくて だいじょうぶ。再生すると 絵と 声で Ark の しくみを 説明します。")
                    .font(Brush.text(16))
                    .foregroundStyle(Ink.ink)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .topLeading)
            .id(started ? chapter.id : -1)
            .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                    removal: .move(edge: .leading).combined(with: .opacity)))
        }
        .padding(14)
        .background(Ink.bg, in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func controls(index: Int, finished: Bool) -> some View {
        HStack(spacing: 14) {
            Text("\(index + 1) / \(chapters.count)")
                .font(Brush.bold(13))
                .foregroundStyle(Ink.sub)
                .monospacedDigit()
                .frame(width: 54, alignment: .leading)
            Spacer()
            roundButton(icon: .back, label: "まえの ばめん", size: 46, solid: false) { jump(to: index - 1) }
                .disabled(index == 0 || !started)
            roundButton(icon: finished ? .refresh : (playing ? .pause : .play), label: finished ? "もう一度" : (playing ? "一時停止" : "再生"),
                        size: 60, solid: true) {
                if finished {
                    jump(to: 0, forcePlay: true)
                } else if playing {
                    pause()
                } else {
                    play()
                }
            }
            roundButton(icon: .back, label: "つぎの ばめん", size: 46, solid: false, flipped: true) { jump(to: index + 1) }
                .disabled(index == chapters.count - 1 || !started)
            Spacer()
            Color.clear.frame(width: 54, height: 1)
        }
    }

    private func roundButton(icon: InkIcon.Kind, label: String, size: CGFloat, solid: Bool, flipped: Bool = false,
                             action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            InkIcon(kind: icon, size: size * 0.38, lineWidth: 2.6, color: solid ? Ink.onTint : Ink.tint)
                .rotationEffect(.degrees(flipped ? 180 : 0))
                .frame(width: size, height: size)
                .background {
                    if solid {
                        Circle().fill(Ink.tint)
                    } else {
                        Circle().fill(Ink.wash)
                    }
                }
        }
        .buttonStyle(PressableStyle(scale: 0.86))
        .accessibilityLabel(label)
    }

    // MARK: playback

    private func elapsed(at date: Date) -> Double {
        let running = resumedAt.map { date.timeIntervalSince($0) } ?? 0
        return min(offset + max(running, 0), StoryChapter.total)
    }

    private func play() {
        let wasStarted = started
        withAnimation(Motion.bounce) { started = true }
        if offset >= StoryChapter.total { offset = 0 }
        if reduceMotion {
            speak(StoryChapter.locate(offset).index)
            return
        }
        guard resumedAt == nil else { return }
        resumedAt = Date()
        Chiptune.shared.play(.select)
        if !wasStarted || StoryChapter.locate(offset).progress < 0.5 {
            speak(StoryChapter.locate(offset).index)
        }
    }

    private func pause() {
        guard let resumedAt else { return }
        offset = min(offset + Date().timeIntervalSince(resumedAt), StoryChapter.total)
        self.resumedAt = nil
        Narrator.shared.stop()
    }

    private func jump(to index: Int, forcePlay: Bool = false) {
        let target = min(max(index, 0), chapters.count - 1)
        let keepPlaying = playing || forcePlay
        offset = StoryChapter.start(of: target) + 0.001
        resumedAt = keepPlaying && !reduceMotion ? Date() : nil
        speak(target)
    }

    private func tapped(x: CGFloat) {
        Haptics.tap()
        let index = StoryChapter.locate(elapsed(at: Date())).index
        if x < stageWidth * 0.28 {
            jump(to: index - 1)
        } else if x > stageWidth * 0.72 {
            jump(to: index + 1)
        } else if playing {
            pause()
        } else {
            play()
        }
    }

    private func speak(_ index: Int) {
        guard narration, autoStart == nil else { return }
        Narrator.shared.say(chapters[index].speech)
    }
}
