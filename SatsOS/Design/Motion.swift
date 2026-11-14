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
    func appearIn(delay: Double = 0, distance: CGFloat = 14) -> some View {
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
            .offset(y: shown || reduceMotion ? 0 : distance)
            .onAppear {
                guard !shown, !reduceMotion else { return }
                withAnimation(.spring(duration: 0.5, bounce: 0.25).delay(delay)) { shown = true }
            }
    }
}

// MARK: - Busy

/// Three ink dots bobbing in turn.
struct InkDots: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var color: Color = Ink.ink
    var size: CGFloat = 7

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { context in
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

// MARK: - Celebration

/// Orange coins drifting down when sats arrive.
struct CoinShower: View {
    var trigger: Int

    @State private var start: Date?
    @State private var coins: [Coin] = (0..<36).map { _ in Coin() }

    struct Coin {
        let x = Double.random(in: 0...1)
        let delay = Double.random(in: 0...0.7)
        let speed = Double.random(in: 0.8...1.2)
        let size = Double.random(in: 8...16)
        let sway = Double.random(in: 8...22)
    }

    var body: some View {
        TimelineView(.animation(paused: start == nil)) { context in
            Canvas { gc, size in
                guard let start else { return }
                let elapsed = context.date.timeIntervalSince(start)
                for coin in coins {
                    let local = elapsed - coin.delay
                    guard local > 0 else { continue }
                    let y = -20 + local * local * 520 * coin.speed
                    guard y < size.height + 20 else { continue }
                    let x = coin.x * size.width + sin(local * 3 + coin.x * 9) * coin.sway
                    let rect = CGRect(x: x, y: y, width: coin.size, height: coin.size)
                    gc.fill(Path(ellipseIn: rect), with: .color(Ink.orange))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: trigger) { _, _ in
            coins = (0..<36).map { _ in Coin() }
            start = Date()
            Task {
                try? await Task.sleep(nanoseconds: 2_800_000_000)
                start = nil
            }
        }
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
    var action: () -> Void

    @State private var progress: Double = 0
    @State private var holding = false
    @State private var fired = false
    @State private var chargeTask: Task<Void, Never>?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Text(holding ? holdingTitle : title)
                .font(Brush.bold(18))
                .foregroundStyle(Ink.paper)
                .frame(maxWidth: .infinity, minHeight: 64)
            GeometryReader { proxy in
                Rectangle()
                    .fill(Ink.orange)
                    .frame(width: proxy.size.width * progress, height: 6)
                    .frame(maxHeight: .infinity, alignment: .bottom)
            }
        }
        .background(Ink.ink)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .scaleEffect(holding ? 0.97 : 1)
        .animation(.spring(duration: 0.25), value: holding)
        .opacity(isEnabled ? 1 : 0.35)
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
        withAnimation(.easeOut(duration: 0.2)) { progress = 0 }
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
