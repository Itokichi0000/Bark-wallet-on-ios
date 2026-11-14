import SwiftUI

// Small, reusable motion pieces in the Sats-OS style: short, stepped,
// sprite-like movement rather than smooth springs. Everything checks
// Reduce Motion and falls back to a plain state change.

// MARK: - Shake

extension View {
    /// Horizontal "nope" shake, stepped like a sprite. Bump `trigger` to play.
    func pixelShake(trigger: Int) -> some View {
        modifier(PixelShakeModifier(trigger: trigger))
    }

    /// Stamp-style pop: big → slightly small → settle. Bump `trigger` to play.
    func pixelPop(trigger: Int, from start: CGFloat = 0.6) -> some View {
        modifier(PixelPopModifier(trigger: trigger, start: start))
    }
}

private struct PixelShakeModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var trigger: Int

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.keyframeAnimator(initialValue: CGFloat(0), trigger: trigger) { view, x in
                view.offset(x: x)
            } keyframes: { _ in
                KeyframeTrack {
                    LinearKeyframe(CGFloat(-8), duration: 0.045)
                    LinearKeyframe(CGFloat(8), duration: 0.045)
                    LinearKeyframe(CGFloat(-6), duration: 0.045)
                    LinearKeyframe(CGFloat(6), duration: 0.045)
                    LinearKeyframe(CGFloat(-3), duration: 0.045)
                    LinearKeyframe(CGFloat(3), duration: 0.045)
                    LinearKeyframe(CGFloat(0), duration: 0.045)
                }
            }
        }
    }
}

private struct PixelPopModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var trigger: Int
    var start: CGFloat

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.keyframeAnimator(initialValue: CGFloat(1), trigger: trigger) { view, scale in
                view.scaleEffect(scale)
            } keyframes: { _ in
                KeyframeTrack {
                    LinearKeyframe(start, duration: 0.001)
                    LinearKeyframe(1.12, duration: 0.09)
                    LinearKeyframe(0.96, duration: 0.07)
                    LinearKeyframe(1, duration: 0.06)
                }
            }
        }
    }
}

// MARK: - Typewriter

/// RPG dialog text: characters appear one by one with a soft tick.
/// The full string is laid out invisibly underneath so nothing reflows.
struct TypewriterText: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var text: String
    var font: Font
    var color: Color
    /// Seconds per character.
    var speed: Double = 0.045
    var sound = true

    @State private var shown = 0

    var body: some View {
        ZStack(alignment: .topLeading) {
            Text(text).opacity(0)
            Text(String(text.prefix(shown)))
        }
        .font(font)
        .foregroundStyle(color)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .task(id: text) {
            if reduceMotion {
                shown = text.count
                return
            }
            shown = 0
            for index in 1...max(text.count, 1) {
                try? await Task.sleep(nanoseconds: UInt64(speed * 1_000_000_000))
                guard !Task.isCancelled else { return }
                shown = index
                if sound, index % 2 == 0 { Chiptune.shared.play(.tick) }
            }
        }
    }
}

// MARK: - Busy indicators

/// `|/-\` spinner at 10 fps.
struct PixelSpinner: View {
    @Environment(\.sats) private var t
    var color: Color?

    private static let frames = ["|", "/", "-", "\\"]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.1)) { context in
            let index = Int(context.date.timeIntervalSinceReferenceDate * 10) % Self.frames.count
            Text(Self.frames[index])
                .font(PixelFont.ui(16, bold: true))
                .foregroundStyle(color ?? t.encre)
                .frame(width: 12)
        }
        .accessibilityHidden(true)
    }
}

/// Text followed by `.`, `..`, `...` cycling; the width never changes.
struct LoadingDots: View {
    var text: String

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.35)) { context in
            let count = Int(context.date.timeIntervalSinceReferenceDate / 0.35) % 4
            HStack(spacing: 0) {
                Text(text)
                ZStack(alignment: .leading) {
                    Text("...").opacity(0)
                    Text(String(repeating: ".", count: count))
                }
            }
        }
        .accessibilityLabel(text)
    }
}

/// `▮▮▮▮....` bar with a block that sweeps across: "working, no ETA".
struct SegmentMarquee: View {
    @Environment(\.sats) private var t
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var segments = 28
    var width = 6

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1.0 / 14.0)) { context in
            let step = Int(context.date.timeIntervalSinceReferenceDate * 14)
            let span = segments + width
            let head = reduceMotion ? segments / 2 + width / 2 : step % span
            HStack(spacing: 2) {
                ForEach(0..<segments, id: \.self) { index in
                    Rectangle()
                        .fill(index <= head && index > head - width ? t.encre : t.grid)
                }
            }
            .padding(3)
            .overlay(Rectangle().stroke(t.encre, lineWidth: 2))
        }
        .frame(height: 18)
        .accessibilityHidden(true)
    }
}

// MARK: - Packet transfer

/// `[YOU] ▪ ▪ ▪ ··········· [ARK]` — little packets hopping along a dotted
/// wire from the wallet to the destination, stepped at 12 fps.
struct PacketTransfer: View {
    @Environment(\.sats) private var t
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var from = "YOU"
    var to: String
    /// When true, all packets have arrived and the wire lights up.
    var delivered = false

    var body: some View {
        HStack(spacing: 8) {
            node(from, lit: true)
            TimelineView(.animation(minimumInterval: 1.0 / 12.0, paused: delivered || reduceMotion)) { context in
                Canvas { gc, size in
                    let midY = size.height / 2
                    // dotted wire
                    var x: CGFloat = 0
                    while x < size.width {
                        gc.fill(Path(CGRect(x: x, y: midY - 1, width: 2, height: 2)),
                                with: .color(delivered ? t.encre : t.line))
                        x += 6
                    }
                    guard !delivered else { return }
                    let time = context.date.timeIntervalSinceReferenceDate
                    for packet in 0..<3 {
                        let phase = (time * 0.9 + Double(packet) / 3).truncatingRemainder(dividingBy: 1)
                        let px = ((phase * size.width) / 4).rounded() * 4
                        let hop = abs(sin(phase * .pi * 4)) * 4
                        let rect = CGRect(x: px - 4, y: midY - 4 - hop.rounded(), width: 8, height: 8)
                        gc.fill(Path(rect), with: .color(packet == 0 ? t.encre : t.braise))
                    }
                }
            }
            .frame(height: 20)
            node(to, lit: delivered)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(delivered ? "\(from) → \(to): delivered" : "\(from) → \(to): sending")
    }

    private func node(_ label: String, lit: Bool) -> some View {
        Text(label)
            .font(PixelFont.ui(12, bold: true))
            .foregroundStyle(lit ? t.onEncre : t.encre)
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
            .background(lit ? t.encre : t.papier)
            .overlay(Rectangle().stroke(t.encre, lineWidth: 2))
            .fixedSize()
            .animation(.linear(duration: 0.08), value: lit)
    }
}

// MARK: - Signal bars

/// `▂▄▆█` bars filling one by one: "listening for something to arrive".
struct SignalBars: View {
    @Environment(\.sats) private var t
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.25)) { context in
            let lit = reduceMotion ? 4 : Int(context.date.timeIntervalSinceReferenceDate * 4) % 5
            HStack(alignment: .bottom, spacing: 2) {
                ForEach(0..<4, id: \.self) { index in
                    Rectangle()
                        .fill(index < lit ? t.encre : t.grid)
                        .frame(width: 4, height: CGFloat(4 + index * 3))
                }
            }
        }
        .frame(height: 13)
        .accessibilityHidden(true)
    }
}

// MARK: - Counting number

/// A number that counts up when it first appears (receipt totals etc).
struct CountUpText: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var value: UInt64
    /// Where the count starts (e.g. the old balance). Defaults to 0.
    var from: UInt64 = 0
    var duration: Double = 0.7
    var format: (UInt64) -> String

    @State private var shown: Double?

    var body: some View {
        CountingLabel(value: shown ?? Double(from), format: format)
            .accessibilityLabel(format(value))
            .onAppear {
                guard !reduceMotion else {
                    shown = Double(value)
                    return
                }
                withAnimation(.easeOut(duration: duration)) { shown = Double(value) }
            }
            .onChange(of: value) { _, newValue in
                withAnimation(.easeOut(duration: reduceMotion ? 0 : 0.3)) { shown = Double(newValue) }
            }
    }
}

private struct CountingLabel: View, Animatable {
    var value: Double
    var format: (UInt64) -> String

    var animatableData: Double {
        get { value }
        set { value = newValue }
    }

    var body: some View {
        Text(format(UInt64(max(value, 0).rounded())))
            .monospacedDigit()
    }
}

// MARK: - Stamp

/// Rubber stamp over a receipt: `PAID ✓` / `FAILED`.
struct PixelStamp: View {
    var text: String
    var color: Color

    var body: some View {
        Text(text)
            .font(PixelFont.ui(22, bold: true))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .overlay(Rectangle().stroke(color, lineWidth: 3))
            .padding(3)
            .overlay(Rectangle().stroke(color.opacity(0.5), lineWidth: 1))
            .rotationEffect(.degrees(-8))
            .fixedSize()
    }
}

// MARK: - Hold to confirm

/// Press and hold to charge a segmented bar; fires when full. Ticks and
/// light haptics as it charges, so it reads like charging a move in a game.
/// VoiceOver users get a normal activate action instead of the hold.
struct HoldToConfirmButton: View {
    @Environment(\.sats) private var t
    @Environment(\.isEnabled) private var isEnabled
    var title: String
    var holdingTitle: String
    var duration: Double = 0.9
    var segments = 12
    var action: () -> Void

    @State private var progress: Double = 0
    @State private var holding = false
    @State private var fired = false
    @State private var chargeTask: Task<Void, Never>?

    var body: some View {
        let filled = Int((Double(segments) * progress).rounded(.down))
        VStack(spacing: 0) {
            Text(holding ? holdingTitle : title)
                .font(PixelFont.ui(17, bold: true))
                .textCase(.uppercase)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundStyle(t.onEncre)
                .padding(.vertical, 10)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity)
            HStack(spacing: 2) {
                ForEach(0..<segments, id: \.self) { index in
                    Rectangle()
                        .fill(index < filled ? t.onEncre : t.onEncre.opacity(0.18))
                }
            }
            .frame(height: 6)
            .padding(.horizontal, 8)
            .padding(.bottom, 7)
        }
        .background(t.encre)
        .overlay(Rectangle().stroke(t.encre, lineWidth: 3))
        .background(
            Rectangle()
                .fill(t.braise)
                .offset(x: holding ? 1 : 4, y: holding ? 1 : 4)
        )
        .offset(x: holding ? 3 : 0, y: holding ? 3 : 0)
        .animation(.linear(duration: 0.05), value: holding)
        .opacity(isEnabled ? 1 : 0.4)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in begin() }
                .onEnded { _ in cancel() }
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { complete() }
        .onDisappear { chargeTask?.cancel() }
    }

    private func begin() {
        guard isEnabled, !holding, !fired else { return }
        holding = true
        Haptics.tap()
        chargeTask?.cancel()
        chargeTask = Task { @MainActor in
            let start = Date()
            var lastSegment = 0
            while !Task.isCancelled {
                let value = min(Date().timeIntervalSince(start) / duration, 1)
                progress = value
                let segment = Int(Double(segments) * value)
                if segment > lastSegment {
                    lastSegment = segment
                    Chiptune.shared.play(.tick)
                    if segment % 3 == 0 { Haptics.tap() }
                }
                if value >= 1 {
                    complete()
                    return
                }
                try? await Task.sleep(nanoseconds: 16_000_000)
            }
        }
    }

    private func cancel() {
        guard !fired else { return }
        chargeTask?.cancel()
        holding = false
        withAnimation(.linear(duration: 0.15)) { progress = 0 }
    }

    private func complete() {
        guard !fired else { return }
        fired = true
        holding = false
        progress = 1
        chargeTask?.cancel()
        Chiptune.shared.play(.send)
        Haptics.heavy()
        action()
    }
}

// MARK: - Entrance

extension View {
    /// Slide up + fade in once, `delay` seconds after first appearing.
    /// Use small staggered delays to build a screen piece by piece.
    func appearIn(delay: Double = 0, distance: CGFloat = 12) -> some View {
        modifier(AppearInModifier(delay: delay, distance: distance))
    }

    /// Old CRT turning on: a bright horizontal line that opens vertically.
    func crtPowerOn() -> some View {
        modifier(CRTPowerOnModifier())
    }
}

private struct AppearInModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var delay: Double
    var distance: CGFloat
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown || reduceMotion ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : distance)
            .onAppear {
                guard !shown, !reduceMotion else { return }
                withAnimation(.easeOut(duration: 0.28).delay(delay)) { shown = true }
            }
    }
}

private struct CRTPowerOnModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Beam {
        var scaleX: CGFloat = 0.5
        var scaleY: CGFloat = 0.006
        var flash: Double = 0.9
    }

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.keyframeAnimator(initialValue: Beam(), repeating: false) { view, beam in
                view
                    .scaleEffect(x: beam.scaleX, y: beam.scaleY)
                    .brightness(beam.flash)
            } keyframes: { _ in
                KeyframeTrack(\.scaleX) {
                    LinearKeyframe(0.5, duration: 0.02)
                    LinearKeyframe(1, duration: 0.14)
                }
                KeyframeTrack(\.scaleY) {
                    LinearKeyframe(0.006, duration: 0.16)
                    LinearKeyframe(1.04, duration: 0.14)
                    LinearKeyframe(1, duration: 0.06)
                }
                KeyframeTrack(\.flash) {
                    LinearKeyframe(0.9, duration: 0.16)
                    LinearKeyframe(0, duration: 0.3)
                }
            }
        }
    }
}

// MARK: - Floating delta

/// `+21,000` that floats up from a balance and fades, like damage numbers.
struct FloatingDelta: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var text: String
    var color: Color

    private struct Rise {
        var y: CGFloat = 0
        var opacity: Double = 0
    }

    var body: some View {
        Text(text)
            .font(PixelFont.ui(20, bold: true))
            .foregroundStyle(color)
            .shadow(color: .black.opacity(0.6), radius: 0, x: 2, y: 2)
            .fixedSize()
            .keyframeAnimator(initialValue: Rise(), repeating: false) { view, value in
                view
                    .offset(y: reduceMotion ? 0 : value.y)
                    .opacity(value.opacity)
            } keyframes: { _ in
                KeyframeTrack(\.y) {
                    LinearKeyframe(0, duration: 0.05)
                    CubicKeyframe(-46, duration: 1.3)
                }
                KeyframeTrack(\.opacity) {
                    LinearKeyframe(1, duration: 0.08)
                    LinearKeyframe(1, duration: 0.8)
                    LinearKeyframe(0, duration: 0.5)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
