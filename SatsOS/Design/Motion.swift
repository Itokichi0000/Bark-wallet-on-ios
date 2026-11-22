import SwiftUI

// Soft, springy motion. Everything checks Reduce Motion and falls back to
// a plain state change.

extension View {
    /// A gentle "nope" shake. Bump `trigger` to play.
    func shake(trigger: Int) -> some View {
        modifier(ShakeModifier(trigger: trigger))
    }

    /// Pop in: small → a bit big → settle. Bump `trigger` to play.
    func pop(trigger: Int, from start: CGFloat = 0.85) -> some View {
        modifier(PopModifier(trigger: trigger, start: start))
    }

    /// Rise and fade in once, `delay` seconds after first appearing.
    func appearIn(delay: Double = 0, distance: CGFloat = 22) -> some View {
        modifier(AppearInModifier(delay: delay, distance: distance))
    }
}

private struct ShakeModifier: ViewModifier {
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
                    CubicKeyframe(CGFloat(-9), duration: 0.06)
                    CubicKeyframe(CGFloat(8), duration: 0.08)
                    CubicKeyframe(CGFloat(-5), duration: 0.08)
                    CubicKeyframe(CGFloat(3), duration: 0.08)
                    CubicKeyframe(CGFloat(0), duration: 0.08)
                }
            }
        }
    }
}

private struct PopModifier: ViewModifier {
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
                    SpringKeyframe(CGFloat(1), duration: 0.45, spring: .bouncy)
                }
            }
        }
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
            .scaleEffect(shown || reduceMotion ? 1 : 0.94)
            .offset(y: shown || reduceMotion ? 0 : distance)
            .onAppear {
                guard !shown, !reduceMotion else { return }
                withAnimation(Motion.bounce.delay(delay)) { shown = true }
            }
    }
}

// MARK: - Busy

/// Three ink dots bobbing in turn.
struct InkDots: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var color: Color = Ink.sub
    var size: CGFloat = 7

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: size * 0.7) {
                ForEach(0..<3, id: \.self) { index in
                    let phase = time * 4 - Double(index) * 0.7
                    Circle()
                        .fill(color)
                        .frame(width: size, height: size)
                        .offset(y: reduceMotion ? 0 : -max(0, sin(phase)) * size * 0.8)
                }
            }
        }
        .frame(height: size * 2)
        .accessibilityHidden(true)
    }
}

// MARK: - Numbers

/// A number that counts up when it first appears.
struct CountUpText: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var value: UInt64
    var from: UInt64 = 0
    var duration: Double = 0.8
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
                withAnimation(.easeOut(duration: reduceMotion ? 0 : 0.35)) { shown = Double(newValue) }
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

/// `+21,000` floating up from the balance and fading.
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
            .font(Brush.bold(18))
            .foregroundStyle(color)
            .fixedSize()
            .keyframeAnimator(initialValue: Rise(), repeating: false) { view, value in
                view
                    .offset(y: reduceMotion ? 0 : value.y)
                    .opacity(value.opacity)
            } keyframes: { _ in
                KeyframeTrack(\.y) {
                    LinearKeyframe(0, duration: 0.05)
                    CubicKeyframe(-40, duration: 1.3)
                }
                KeyframeTrack(\.opacity) {
                    LinearKeyframe(1, duration: 0.1)
                    LinearKeyframe(1, duration: 0.8)
                    LinearKeyframe(0, duration: 0.5)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

// MARK: - Hold to send

/// Press and hold: an orange bar fills along the bottom, then it fires.
/// VoiceOver users get a normal activate action instead of the hold.
struct HoldToSendButton: View {
    @Environment(\.isEnabled) private var isEnabled
    var title: String
    var holdingTitle: String
    var duration: Double = 0.9
    /// Told when a hold starts (true) and when it ends or fires (false).
    var onHoldChange: ((Bool) -> Void)? = nil
    var action: () -> Void

    @State private var progress: Double = 0
    @State private var holding = false
    @State private var fired = false
    @State private var chargeTask: Task<Void, Never>?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // the charge fills the whole button from the left
            GeometryReader { proxy in
                Rectangle()
                    .fill(Ink.orange)
                    .frame(width: proxy.size.width * progress)
            }
            Text(holding ? holdingTitle : title)
                .font(Brush.bold(17))
                .foregroundStyle(Ink.onTint)
                .frame(maxWidth: .infinity, minHeight: 52)
        }
        .background(Ink.tint)
        .clipShape(Capsule())
        .scaleEffect(holding ? 0.97 : 1)
        .animation(Motion.press, value: holding)
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
        onHoldChange?(true)
        Haptics.tap()
        chargeTask?.cancel()
        chargeTask = Task { @MainActor in
            let start = Date()
            var lastStep = 0
            while !Task.isCancelled {
                let value = min(Date().timeIntervalSince(start) / duration, 1)
                progress = value
                let step = Int(value * 6)
                if step > lastStep {
                    lastStep = step
                    Haptics.tap()
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
        onHoldChange?(false)
        withAnimation(.easeOut(duration: 0.2)) { progress = 0 }
    }

    private func complete() {
        guard !fired else { return }
        fired = true
        holding = false
        onHoldChange?(false)
        progress = 1
        chargeTask?.cancel()
        Chiptune.shared.play(.send)
        Haptics.heavy()
        action()
    }
}

// MARK: - Always moving

extension View {
    /// Bobs gently up and down for as long as it is on screen.
    func floating(_ distance: CGFloat = 5, period: Double = 2.6) -> some View {
        modifier(FloatingModifier(distance: distance, period: period))
    }
}

private struct FloatingModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var distance: CGFloat
    var period: Double
    @State private var up = false

    func body(content: Content) -> some View {
        content
            .offset(y: up ? -distance : distance)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: period / 2).repeatForever(autoreverses: true)) { up = true }
            }
    }
}

/// Liquid: two soft waves rolling across the bottom of whatever it sits in.
/// `level` is how full it is (0...1 of the height).
struct LiquidWave: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var color: Color = .white
    var level: Double = 0.3

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            Canvas { gc, size in
                let w = Double(size.width), h = Double(size.height)
                let base = h * (1 - level)
                for layer in 0..<2 {
                    let speed = layer == 0 ? 0.9 : -0.6
                    let length = layer == 0 ? 150.0 : 210.0
                    let height = layer == 0 ? 7.0 : 10.0
                    var path = Path()
                    path.move(to: CGPoint(x: 0, y: h))
                    path.addLine(to: CGPoint(x: 0, y: base))
                    for x in stride(from: 0.0, through: w + 6, by: 6) {
                        let y = base + sin(x / length * 2 * .pi + t * speed + Double(layer) * 1.7) * height
                            + sin(x / (length * 0.37) + t * speed * 1.6) * height * 0.25
                        path.addLine(to: CGPoint(x: x, y: y))
                    }
                    path.addLine(to: CGPoint(x: w, y: h))
                    path.closeSubpath()
                    gc.fill(path, with: .color(color.opacity(layer == 0 ? 0.10 : 0.14)))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// A ring that fills smoothly; `progress` 0...1.
struct RingProgress<Center: View>: View {
    var progress: Double
    var color: Color = Ink.tint
    var track: Color = Ink.wash
    var lineWidth: CGFloat = 7
    @ViewBuilder var center: () -> Center

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(max(progress, 0), 1))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            center()
        }
        .padding(lineWidth / 2)
    }
}
