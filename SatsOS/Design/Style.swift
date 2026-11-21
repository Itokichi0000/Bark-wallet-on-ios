import SwiftUI
import CoreText
import UIKit

// ちょうじゅ / Choju — soft, colourful and always gently moving.
//
// A picture-book palette for learning: every idea in Ark has its own colour
// and keeps it on every screen and in every diagram.
//   orange  your sats (VTXOs)
//   violet  the Ark server and its rounds; also the app's main buttons
//   teal    the bitcoin chain and its blocks
//   yellow  lightning
//   pink    "look here": expiry near, errors
// Every colour follows the device's light / dark setting.
//
// The names (`Ink`, `Brush`) are kept from the ink-on-paper design so every
// screen picks the new look up at once.

enum Ink {
    /// Page background.
    static let bg = Color(light: 0xF3F1FC, dark: 0x0E0D18)
    /// Cards and inputs.
    static let paper = Color(light: 0xFFFFFF, dark: 0x1B1929)
    /// Main text.
    static let ink = Color(light: 0x1F1B3D, dark: 0xF4F2FF)
    /// Secondary text.
    static let sub = Color(light: 0x6B6789, dark: 0xA9A5C6)
    /// Hairlines and borders.
    static let line = Color(light: 0xE3E0F3, dark: 0x302D45)
    /// Quiet fills: chips, tracks, secondary buttons.
    static let wash = Color(light: 0xECE9F9, dark: 0x262338)
    /// Bitcoin orange: your sats.
    static let orange = Color(light: 0xF98A0C, dark: 0xFFA43A)
    static let orangeSoft = Color(light: 0xFFEFD9, dark: 0x3A2A14)
    /// "Look here": expiry near, errors.
    static let alert = Color(light: 0xE8356D, dark: 0xFF6F98)
    static let alertSoft = Color(light: 0xFFE4EC, dark: 0x3B1826)
    /// The Ark server and rounds; the app's main colour.
    static let server = Color(light: 0x6B4EFF, dark: 0x9C89FF)
    static let serverDeep = Color(light: 0x4B2FD6, dark: 0x6B4EFF)
    static let serverSoft = Color(light: 0xEAE5FF, dark: 0x2A2450)
    /// The bitcoin chain.
    static let chain = Color(light: 0x0FA896, dark: 0x3FD9C6)
    static let chainSoft = Color(light: 0xDDF6F2, dark: 0x12322F)
    /// Lightning.
    static let bolt = Color(light: 0xF2B100, dark: 0xFFD04A)
    /// Done, healthy.
    static let good = Color(light: 0x21B573, dark: 0x4FDB9B)
    /// Text on a coloured fill.
    static let onColor = Color.white
}

/// Corner radii: round and friendly.
enum Radius {
    static let small: CGFloat = 12
    static let control: CGFloat = 18
    static let card: CGFloat = 26
}

/// The springs every screen shares, so the whole app moves the same way.
enum Motion {
    /// Things you touch: quick, a little bounce.
    static let press = Animation.spring(response: 0.3, dampingFraction: 0.6)
    /// Things that slide or resize.
    static let glide = Animation.spring(response: 0.5, dampingFraction: 0.82)
    /// Things that arrive.
    static let bounce = Animation.spring(response: 0.55, dampingFraction: 0.62)
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

/// The rounded system font (SF Rounded / Hiragino), scaled with Dynamic Type from the
/// given size. Amounts use tabular digits so they don't jiggle while counting.
enum Brush {
    static func text(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        scaled(size, .regular, style)
    }

    static func bold(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        scaled(size, .bold, style)
    }

    /// Big balances and amounts.
    static func amount(_ size: CGFloat) -> Font {
        scaled(size, .heavy, .largeTitle).monospacedDigit()
    }

    /// Addresses, invoices, hashes.
    static func mono(_ size: CGFloat = 13) -> Font {
        .system(size: size, design: .monospaced)
    }

    private static func scaled(_ size: CGFloat, _ weight: UIFont.Weight, _ style: Font.TextStyle) -> Font {
        var base = UIFont.systemFont(ofSize: size, weight: weight)
        if let rounded = base.fontDescriptor.withDesign(.rounded) {
            base = UIFont(descriptor: rounded, size: size)
        }
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
