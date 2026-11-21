import SwiftUI
import CoreText
import UIKit

// ちょうじゅ / Choju — quiet and plain.
//
// A neutral zinc palette with hairline borders, after shadcn/ui: almost no
// colour, so the one accent (bitcoin orange) and the Ark animations carry
// the meaning. Every colour follows the device's light / dark setting.
//
// The names (`Ink`, `Brush`) are kept from the ink-on-paper design so every
// screen picked up the new look at once.

enum Ink {
    /// Page background.
    static let bg = Color(light: 0xFAFAFA, dark: 0x09090B)
    /// Cards and inputs (shadcn `card`).
    static let paper = Color(light: 0xFFFFFF, dark: 0x111113)
    /// Main text, primary buttons (shadcn `foreground` / `primary`).
    static let ink = Color(light: 0x09090B, dark: 0xFAFAFA)
    /// Secondary text (shadcn `muted-foreground`).
    static let sub = Color(light: 0x71717A, dark: 0xA1A1AA)
    /// Hairlines and borders (shadcn `border`).
    static let line = Color(light: 0xE4E4E7, dark: 0x27272A)
    /// Quiet fills: chips, tracks, secondary buttons (shadcn `muted`).
    static let wash = Color(light: 0xF4F4F5, dark: 0x1C1C1F)
    /// Bitcoin orange: the one accent. Your sats, arrivals, the live part of a diagram.
    static let orange = Color(hex: 0xF7931A)
    /// Warnings and errors (shadcn `destructive`).
    static let alert = Color(light: 0xDC2626, dark: 0xF87171)
    /// The Ark server and rounds in diagrams.
    static let server = Color(light: 0x3F3F46, dark: 0xD4D4D8)
}

/// Corner radii (shadcn `--radius` scale).
enum Radius {
    static let small: CGFloat = 8
    static let control: CGFloat = 10
    static let card: CGFloat = 14
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }

    /// A color that switches with the light / dark appearance.
    init(light: UInt32, dark: UInt32, opacity: CGFloat = 1) {
        self.init(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: opacity
            )
        })
    }
}

/// The system font (SF Pro / Hiragino), scaled with Dynamic Type from the
/// given size. Amounts use tabular digits so they don't jiggle while counting.
enum Brush {
    static func text(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        scaled(size, .regular, style)
    }

    static func bold(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        scaled(size, .semibold, style)
    }

    /// Big balances and amounts.
    static func amount(_ size: CGFloat) -> Font {
        scaled(size, .semibold, .largeTitle).monospacedDigit()
    }

    /// Addresses, invoices, hashes.
    static func mono(_ size: CGFloat = 13) -> Font {
        .system(size: size, design: .monospaced)
    }

    private static func scaled(_ size: CGFloat, _ weight: UIFont.Weight, _ style: Font.TextStyle) -> Font {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        let metrics = UIFontMetrics(forTextStyle: style.uiTextStyle)
        return Font(metrics.scaledFont(for: base) as CTFont)
    }
}

private extension Font.TextStyle {
    var uiTextStyle: UIFont.TextStyle {
        switch self {
        case .largeTitle: return .largeTitle
        case .title: return .title1
        case .title2: return .title2
        case .title3: return .title3
        case .headline: return .headline
        case .subheadline: return .subheadline
        case .callout: return .callout
        case .footnote: return .footnote
        case .caption: return .caption1
        case .caption2: return .caption2
        default: return .body
        }
    }
}

// MARK: - Settings

@MainActor
final class AppSettings: ObservableObject {
    private let defaults = UserDefaults.standard

    @Published var sound: Bool { didSet { defaults.set(sound, forKey: Keys.sound) } }
    @Published var haptics: Bool { didSet { defaults.set(haptics, forKey: Keys.haptics) } }
    @Published var unit: AmountUnit { didSet { defaults.set(unit.rawValue, forKey: Keys.unit) } }

    enum Keys {
        static let sound = AppSettingsKeys.sound
        static let haptics = AppSettingsKeys.haptics
        static let unit = "unit"
    }

    static func registerDefaults() {
        UserDefaults.standard.register(defaults: [
            Keys.sound: true,
            Keys.haptics: true,
            Keys.unit: AmountUnit.sats.rawValue,
        ])
    }

    init() {
        Self.registerDefaults()
        sound = defaults.bool(forKey: Keys.sound)
        haptics = defaults.bool(forKey: Keys.haptics)
        unit = AmountUnit(rawValue: defaults.string(forKey: Keys.unit) ?? "") ?? .sats
    }

    func toggleUnit() {
        unit = unit == .sats ? .btc : .sats
    }
}
