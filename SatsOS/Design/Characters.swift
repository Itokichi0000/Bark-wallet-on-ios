import SwiftUI

/// The rabbit (主役) and the frog (相棒), drawn after the public-domain
/// 鳥獣人物戯画 scrolls. Each pose is four template layers rendered by
/// `tools/characters/render.mjs`, colored here so they follow light / dark.
enum CharacterArt: String, CaseIterable {
    case rabbit1, rabbit2, rabbit3, rabbit4, rabbitJump
    case frogSit, frogLetter, frogBanzai

    /// Width / height of the drawing.
    var aspect: CGFloat {
        switch self {
        case .rabbit1, .rabbit2, .rabbit3, .rabbit4: return 200.0 / 240.0
        case .rabbitJump: return 200.0 / 260.0
        case .frogSit, .frogBanzai: return 160.0 / 140.0
        case .frogLetter: return 220.0 / 140.0
        }
    }

    var hasAccent: Bool { self == .rabbit3 || self == .frogLetter }

    var label: String {
        switch self {
        case .rabbit1, .rabbit2, .rabbit3, .rabbit4: return "うさぎ"
        case .rabbitJump: return "とびはねて よろこぶ うさぎ"
        case .frogSit: return "かえる"
        case .frogLetter: return "手紙をかかえた かえる"
        case .frogBanzai: return "ばんざいする かえる"
        }
    }
}

struct CharacterView: View {
    var art: CharacterArt
    var height: CGFloat
    /// Not reached yet (growth list): just the outline, faded.
    var faded = false

    var body: some View {
        ZStack {
            layer("paper", faded ? Ink.bg : Ink.paper)
            if !faded { layer("wash", Ink.wash) }
            layer("ink", Ink.ink)
            if art.hasAccent && !faded { layer("accent", Ink.orange) }
        }
        .frame(width: height * art.aspect, height: height)
        .opacity(faded ? 0.4 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(art.label)
    }

    private func layer(_ name: String, _ color: Color) -> some View {
        Image("char-\(art.rawValue)-\(name)")
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .foregroundStyle(color)
    }
}

// MARK: - Motion for characters

extension View {
    /// Slow breathing: a tiny stretch from the feet.
    func breathing(_ amount: CGFloat = 0.025, period: Double = 1.7) -> some View {
        modifier(BreathingModifier(amount: amount, period: period))
    }

    /// A single hop with squash on landing. Bump `trigger` to play.
    func hop(trigger: Int, height: CGFloat = 26) -> some View {
        modifier(HopModifier(trigger: trigger, height: height))
    }

    /// Keeps jumping for joy (celebrations).
    func jumpingForJoy(height: CGFloat = 34) -> some View {
        modifier(JumpLoopModifier(height: height))
    }
}

private struct BreathingModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var amount: CGFloat
    var period: Double

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.phaseAnimator([false, true]) { view, inhale in
                view.scaleEffect(x: inhale ? 1 - amount / 3 : 1, y: inhale ? 1 + amount : 1, anchor: .bottom)
            } animation: { _ in
                .easeInOut(duration: period)
            }
        }
    }
}

private struct Bounce {
    var y: CGFloat = 0
    var squash: CGFloat = 1
}

private struct HopModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var trigger: Int
    var height: CGFloat

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.keyframeAnimator(initialValue: Bounce(), trigger: trigger) { view, value in
                view
                    .scaleEffect(x: 2 - value.squash, y: value.squash, anchor: .bottom)
                    .offset(y: value.y)
            } keyframes: { _ in
                KeyframeTrack(\.y) {
                    LinearKeyframe(0, duration: 0.08)
                    CubicKeyframe(-height, duration: 0.2)
                    CubicKeyframe(0, duration: 0.22)
                    LinearKeyframe(0, duration: 0.18)
                }
                KeyframeTrack(\.squash) {
                    CubicKeyframe(0.9, duration: 0.08)
                    CubicKeyframe(1.08, duration: 0.2)
                    CubicKeyframe(1, duration: 0.22)
                    CubicKeyframe(0.9, duration: 0.07)
                    CubicKeyframe(1, duration: 0.11)
                }
            }
        }
    }
}

private struct JumpLoopModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var height: CGFloat

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.keyframeAnimator(initialValue: Bounce(), repeating: true) { view, value in
                view
                    .scaleEffect(x: 2 - value.squash, y: value.squash, anchor: .bottom)
                    .offset(y: value.y)
            } keyframes: { _ in
                KeyframeTrack(\.y) {
                    CubicKeyframe(-height, duration: 0.32)
                    CubicKeyframe(0, duration: 0.3)
                    LinearKeyframe(0, duration: 0.22)
                }
                KeyframeTrack(\.squash) {
                    CubicKeyframe(1.08, duration: 0.32)
                    CubicKeyframe(1, duration: 0.3)
                    CubicKeyframe(0.88, duration: 0.08)
                    CubicKeyframe(1, duration: 0.14)
                }
            }
        }
    }
}

/// The frog hopping off to the right with a letter, over and over.
struct DeliveringFrog: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var height: CGFloat = 96

    private struct Trip {
        var x: CGFloat = -60
        var y: CGFloat = 0
        var opacity: Double = 0
    }

    var body: some View {
        CharacterView(art: .frogLetter, height: height)
            .keyframeAnimator(initialValue: Trip(), repeating: !reduceMotion) { view, trip in
                view
                    .offset(x: reduceMotion ? 0 : trip.x, y: reduceMotion ? 0 : trip.y)
                    .opacity(reduceMotion ? 1 : trip.opacity)
            } keyframes: { _ in
                KeyframeTrack(\.x) {
                    LinearKeyframe(-60, duration: 0.01)
                    LinearKeyframe(60, duration: 1.8)
                }
                KeyframeTrack(\.y) {
                    CubicKeyframe(-18, duration: 0.3)
                    CubicKeyframe(0, duration: 0.3)
                    CubicKeyframe(-18, duration: 0.3)
                    CubicKeyframe(0, duration: 0.3)
                    CubicKeyframe(-18, duration: 0.3)
                    CubicKeyframe(0, duration: 0.3)
                }
                KeyframeTrack(\.opacity) {
                    LinearKeyframe(1, duration: 0.25)
                    LinearKeyframe(1, duration: 1.25)
                    LinearKeyframe(0, duration: 0.3)
                }
            }
    }
}

// MARK: - What they say

enum RabbitLines {
    static let idle = [
        "きょうも いい日だね",
        "ぴょん",
        "ちょっとずつ ためよう",
        "鍵は あなたのもの",
        "ながいきの ひけつは HODL",
        "かえるくん どこいった？",
        "つぎのブロック まだかな",
    ]

    static let night = [
        "そろそろ ねむいね",
        "おやすみ…",
    ]

    static let received = [
        "やったね！",
        "うれしいな",
        "だいじに しよう",
        "ありがとう！",
    ]

    static func greeting(at date: Date = Date()) -> String {
        let hour = Calendar.current.component(.hour, from: date)
        switch hour {
        case 5..<11: return "おはよう"
        case 11..<18: return "こんにちは"
        default: return "こんばんは"
        }
    }

    static func random(at date: Date = Date()) -> String {
        let hour = Calendar.current.component(.hour, from: date)
        let pool = (hour >= 23 || hour < 5) ? night : idle
        return pool.randomElement() ?? "ぴょん"
    }
}
