import SwiftUI

// Moving parts of the おくる screen. All of them hold still under Reduce Motion.

/// Ripples drifting downstream and a leaf bobbing on the water, laid over
/// the stream scene (130 pt tall, the bank at 46 pt, water below it).
struct StreamRipples: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    private struct Ripple { let x, y, length, speed: Double }

    private let ripples = [
        Ripple(x: 0.05, y: 66, length: 18, speed: 16),
        Ripple(x: 0.32, y: 78, length: 26, speed: 22),
        Ripple(x: 0.58, y: 70, length: 14, speed: 14),
        Ripple(x: 0.8, y: 92, length: 30, speed: 26),
        Ripple(x: 0.18, y: 104, length: 22, speed: 20),
        Ripple(x: 0.45, y: 112, length: 16, speed: 18),
        Ripple(x: 0.7, y: 84, length: 12, speed: 12),
    ]

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSince(start)
            Canvas { gc, size in
                let lane = size.width + 80
                for r in ripples {
                    let x = (r.x * lane + t * r.speed).truncatingRemainder(dividingBy: lane) - 40
                    let wobble = sin(t * 1.6 + r.x * 10) * 1.2
                    var path = Path()
                    path.move(to: CGPoint(x: x, y: r.y + wobble))
                    path.addQuadCurve(to: CGPoint(x: x + r.length, y: r.y + wobble),
                                      control: CGPoint(x: x + r.length / 2, y: r.y + wobble - 2.5))
                    gc.stroke(path, with: .color(Ink.ink.opacity(0.28)),
                              style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                }
                // a bush-clover leaf riding the current
                let leafX = (t * 11).truncatingRemainder(dividingBy: lane) - 40
                let leafY = 88 + sin(t * 1.3) * 3
                var leaf = gc
                leaf.translateBy(x: leafX, y: leafY)
                leaf.rotate(by: .degrees(sin(t * 0.9) * 25))
                leaf.fill(Path(ellipseIn: CGRect(x: -6, y: -2.5, width: 12, height: 5)), with: .color(Ink.ink.opacity(0.45)))
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// The frog with the letter hopping along the bank, leaving ripple rings
/// where it lands, then fading out and starting again.
struct DeliveringFrog: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var height: CGFloat = 96

    @State private var start = Date()
    private let period = 2.1
    private let travel = 1.7
    private let hops = 3
    private let span: Double = 130

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 0.85 : context.date.timeIntervalSince(start).truncatingRemainder(dividingBy: period)
            let p = min(t / travel, 1)
            let phase = p * Double(hops)
            let inHop = phase - floor(phase)
            let airborne = p < 1
            let y = airborne ? -sin(.pi * inHop) * 18 : 0
            let squash = airborne && (inHop < 0.12 || inHop > 0.9) ? 0.9 : 1.0
            let fadeIn = min(t / 0.2, 1)
            let fadeOut = t > travel ? max(0, 1 - (t - travel) / 0.3) : 1
            ZStack(alignment: .bottom) {
                Canvas { gc, size in
                    guard !reduceMotion else { return }
                    for k in 1...hops {
                        let landed = travel * Double(k) / Double(hops)
                        let age = t - landed
                        guard age > 0, age < 0.6 else { continue }
                        let x = size.width / 2 - span / 2 + span * Double(k) / Double(hops)
                        let r = 6 + age * 30
                        let ring = CGRect(x: x - r, y: size.height - 3 - r * 0.25, width: r * 2, height: r * 0.5)
                        gc.stroke(Path(ellipseIn: ring), with: .color(Ink.ink.opacity(0.4 * (1 - age / 0.6))), lineWidth: 1.4)
                    }
                }
                CharacterView(art: .frogLetter, height: height)
                    .scaleEffect(x: 2 - squash, y: squash, anchor: .bottom)
                    .offset(x: -span / 2 + span * p, y: y)
                    .opacity(reduceMotion ? 1 : fadeIn * fadeOut)
            }
        }
    }
}

/// The letter frog waiting on the bank; while the send button is held it
/// crouches and trembles, ready to leap.
struct ReadyFrog: View {
    var height: CGFloat
    var holding: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: !holding || reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            CharacterView(art: .frogLetter, height: height)
                .breathing(0.03, period: 1.3)
                .scaleEffect(x: holding ? 1.07 : 1, y: holding ? 0.88 : 1, anchor: .bottom)
                .offset(x: holding && !reduceMotion ? sin(t * 70) * 1.3 : 0)
                .animation(.spring(duration: 0.25), value: holding)
        }
    }
}

/// The frog after a failed send: shakes its head, droops and sighs.
struct DroopyFrog: View {
    var height: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var angle: Double = 0
    @State private var droop: CGFloat = 1
    @State private var sigh = false

    var body: some View {
        CharacterView(art: .frogSit, height: height)
            .scaleEffect(x: 1, y: droop, anchor: .bottom)
            .rotationEffect(.degrees(angle), anchor: .bottom)
            .overlay(alignment: .topTrailing) {
                if sigh {
                    Text("はぁ…")
                        .font(Brush.bold(13))
                        .foregroundStyle(Ink.sub)
                        .fixedSize()
                        .offset(x: 18, y: -8)
                        .transition(.opacity.combined(with: .offset(y: 6)))
                        .accessibilityHidden(true)
                }
            }
            .task {
                guard !reduceMotion else { return }
                while !Task.isCancelled {
                    for _ in 0..<2 {
                        await move(0.12) { angle = -4 }
                        await move(0.12) { angle = 4 }
                    }
                    await move(0.15) { angle = 0 }
                    await move(0.5) { droop = 0.93; sigh = true }
                    await pause(1.6)
                    await move(0.5) { droop = 1; sigh = false }
                    await pause(Double.random(in: 2.5...4))
                }
            }
    }

    private func move(_ seconds: Double, _ change: () -> Void) async {
        guard !Task.isCancelled else { return }
        withAnimation(.easeInOut(duration: seconds)) { change() }
        await pause(seconds)
    }

    private func pause(_ seconds: Double) async {
        try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }
}

/// A seal that slams down once `active` turns true.
struct SlamSeal: View {
    var text: String
    var active: Bool
    var size: CGFloat = 32
    var delay: Double = 0.45

    @State private var stamped = false

    var body: some View {
        SealStamp(text: text, size: size)
            .scaleEffect(stamped ? 1 : 2.6)
            .rotationEffect(.degrees(stamped ? -10 : -32))
            .opacity(stamped ? 1 : 0)
            .accessibilityHidden(true)
            .onAppear { if active { slam() } }
            .onChange(of: active) { _, now in if now { slam() } }
    }

    private func slam() {
        guard !stamped else { return }
        Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            withAnimation(.spring(duration: 0.3, bounce: 0.35)) { stamped = true }
            Haptics.heavy()
        }
    }
}
