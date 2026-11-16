import SwiftUI

// Moving parts of the "もらった！" screen. All of them hold still under
// Reduce Motion.

/// Coins that bob and flip in the air, crosses that twinkle, and a handful
/// of coins that drop in and bounce on the ground (the bottom edge).
struct JoyField: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    private struct Floater { let x, y, r, phase: Double }
    private struct Drop { let x, delay, r: Double }

    private let floaters = [
        Floater(x: 0.16, y: 0.22, r: 11, phase: 0),
        Floater(x: 0.84, y: 0.16, r: 9, phase: 1.3),
        Floater(x: 0.24, y: 0.58, r: 7, phase: 2.1),
        Floater(x: 0.8, y: 0.54, r: 12, phase: 0.7),
        Floater(x: 0.66, y: 0.08, r: 6, phase: 2.8),
    ]
    private let crosses: [(x: Double, y: Double, phase: Double)] = [
        (0.08, 0.42, 0), (0.9, 0.36, 1.1), (0.3, 0.1, 2.0), (0.52, 0.04, 0.6),
    ]
    private let drops: [Drop] = [
        Drop(x: 0.1, delay: 0.25, r: 6), Drop(x: 0.9, delay: 0.4, r: 7), Drop(x: 0.2, delay: 0.55, r: 5),
        Drop(x: 0.74, delay: 0.7, r: 6), Drop(x: 0.32, delay: 0.85, r: 4), Drop(x: 0.95, delay: 1.0, r: 5),
        Drop(x: 0.04, delay: 1.15, r: 6),
    ]

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 2.5 : context.date.timeIntervalSince(start)
            Canvas { gc, size in
                for f in floaters {
                    let bob = sin(t * 2.2 + f.phase) * 6
                    let flip = abs(cos(t * 2.6 + f.phase))
                    coin(gc, x: f.x * size.width, y: f.y * size.height + bob, r: f.r, flip: flip)
                }
                for c in crosses {
                    let glow = abs(sin(t * 2.4 + c.phase))
                    let arm = 2.5 + 3.5 * glow
                    let center = CGPoint(x: c.x * size.width, y: c.y * size.height)
                    var path = Path()
                    path.move(to: CGPoint(x: center.x - arm, y: center.y))
                    path.addLine(to: CGPoint(x: center.x + arm, y: center.y))
                    path.move(to: CGPoint(x: center.x, y: center.y - arm))
                    path.addLine(to: CGPoint(x: center.x, y: center.y + arm))
                    gc.stroke(path, with: .color(Ink.ink.opacity(0.35 + 0.65 * glow)),
                              style: StrokeStyle(lineWidth: 2, lineCap: .round))
                }
                for d in drops {
                    let local = t - d.delay
                    guard local > 0 else { continue }
                    let ground = size.height - d.r - 2
                    let y = Self.bounce(local, from: -12, to: ground)
                    let settled = y >= ground - 0.5 && local > 1
                    coin(gc, x: d.x * size.width, y: y, r: d.r, flip: settled ? 1 : abs(cos(local * 9)))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func coin(_ gc: GraphicsContext, x: Double, y: Double, r: Double, flip: Double) {
        let w = max(1.5, r * 2 * flip)
        gc.fill(Path(ellipseIn: CGRect(x: x - w / 2, y: y - r, width: w, height: r * 2)), with: .color(Ink.orange))
    }

    /// Falls under gravity, then bounces lower and lower until it rests.
    private static func bounce(_ time: Double, from top: Double, to ground: Double) -> Double {
        let g = 1500.0
        let fall = sqrt(2 * (ground - top) / g)
        if time < fall { return top + 0.5 * g * time * time }
        var tau = time - fall
        var v = g * fall * 0.42
        while v > 40 {
            let flight = 2 * v / g
            if tau < flight { return ground - (v * tau - 0.5 * g * tau * tau) }
            tau -= flight
            v *= 0.42
        }
        return ground
    }
}

/// The rabbit jumping for joy; every third jump is a somersault, and each
/// landing kicks up a little dust.
struct CelebratingRabbit: View {
    var height: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dy: CGFloat = 0
    @State private var angle: Double = 0
    @State private var sx: CGFloat = 1
    @State private var sy: CGFloat = 1
    @State private var puff = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            DustPuff(trigger: puff)
                .frame(width: height * 0.7, height: 24)
            CharacterView(art: .rabbitJump, height: height)
                .scaleEffect(x: sx, y: sy, anchor: .bottom)
                .rotationEffect(.degrees(angle))
                .offset(y: dy)
        }
        .task { await jumpForJoy() }
    }

    private func jumpForJoy() async {
        guard !reduceMotion else { return }
        var count = 0
        while !Task.isCancelled {
            count += 1
            let flip = count % 3 == 0
            await move(0.1) { sy = 0.88; sx = 1.08 }
            if flip {
                withAnimation(.easeInOut(duration: 0.66)) { angle += 360 }
            }
            await move(flip ? 0.36 : 0.3, .easeOut(duration: flip ? 0.36 : 0.3)) {
                dy = flip ? -72 : -32; sy = 1.06; sx = 0.96
            }
            await move(flip ? 0.34 : 0.28, .easeIn(duration: flip ? 0.34 : 0.28)) { dy = 0; sy = 1 }
            puff += 1
            await move(0.08) { sy = 0.86; sx = 1.1 }
            await move(0.14) { sy = 1; sx = 1 }
            await pause(flip ? 0.4 : 0.12)
        }
    }

    private func move(_ seconds: Double, _ curve: Animation? = nil, _ change: () -> Void) async {
        guard !Task.isCancelled else { return }
        withAnimation(curve ?? .easeInOut(duration: seconds)) { change() }
        await pause(seconds)
    }

    private func pause(_ seconds: Double) async {
        try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }
}

/// Two little clouds of dust puffing out sideways.
struct DustPuff: View {
    var trigger: Int
    @State private var spread: CGFloat = 1

    var body: some View {
        ZStack {
            cloud(-1)
            cloud(1)
        }
        .opacity(Double(1 - spread))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: trigger) { _, _ in
            spread = 0
            withAnimation(.easeOut(duration: 0.5)) { spread = 1 }
        }
    }

    private func cloud(_ side: CGFloat) -> some View {
        Ellipse()
            .fill(Ink.ink.opacity(0.22))
            .frame(width: 12 + spread * 10, height: 6 + spread * 4)
            .offset(x: side * (14 + spread * 30), y: 6 - spread * 8)
    }
}

/// A title whose letters bob one after another, like a cheer.
struct WavyTitle: View {
    var text: String
    var font: Font

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSince(start)
            HStack(spacing: 0) {
                ForEach(Array(text.enumerated()), id: \.offset) { index, letter in
                    Text(String(letter))
                        .offset(y: -abs(sin(t * 3.2 - Double(index) * 0.55)) * 7)
                }
            }
        }
        .font(font)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .accessibilityAddTraits(.isHeader)
    }
}

/// The friends who live with the rabbit, hopping in a row; the ones the
/// payment just brought walk in from the right.
struct FriendParade: View {
    var friends: [Friend]
    var newcomers: [Friend]

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 10 : context.date.timeIntervalSince(start)
            HStack(alignment: .bottom, spacing: 12) {
                ForEach(Array(friends.enumerated()), id: \.element) { index, friend in
                    let isNew = newcomers.contains(friend)
                    let arrive = isNew ? min(max((t - 1.0) / 1.1, 0), 1) : 1
                    let hop = max(0, sin(t * 6 - Double(index) * 0.8)) * 9
                    CharacterView(art: friend.art, height: 44)
                        .offset(x: (1 - arrive) * 260, y: -hop * arrive)
                        .opacity(arrive > 0 ? 1 : 0)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("なかま " + friends.map(\.name).joined(separator: "、"))
    }
}
