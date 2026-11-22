import SwiftUI
import CoreText
import UIKit

// ちょうじゅ / Choju — calm, spacious, typographic.
//
// After apple.com: a pale grey page, white cards without borders, very
// large numbers, pill buttons, frosted glass for anything that floats.
// The interface itself is black and white; colour is kept for meaning:
//   orange  your sats (VTXOs)
//   indigo  the Ark server and its rounds
//   teal    the bitcoin chain and its blocks
//   yellow  lightning
//   red     "look here": expiry near, errors
//   green   done, healthy
// Every colour follows the device's light / dark setting.
//
// The names (`Ink`, `Brush`) are kept from the ink-on-paper design.

enum Ink {
    /// Page background.
    static let bg = Color(light: 0xF5F5F7, dark: 0x000000)
    /// Cards and inputs.
    static let paper = Color(light: 0xFFFFFF, dark: 0x1C1C1E)
    /// Main text.
    static let ink = Color(light: 0x1D1D1F, dark: 0xF5F5F7)
    /// Secondary text.
    static let sub = Color(light: 0x6E6E73, dark: 0x98989D)
    /// Hairlines.
    static let line = Color(light: 0xD2D2D7, dark: 0x38383A)
    /// Quiet fills: tracks, secondary buttons, wells.
    static let wash = Color(light: 0xE8E8ED, dark: 0x2C2C2E)
    /// The colour of controls: black on white, white on black.
    static let tint = ink
    static let tintSoft = Color(light: 0xF0F0F3, dark: 0x2C2C2E)
    /// Text and icons on `tint`.
    static let onTint = Color(light: 0xFFFFFF, dark: 0x000000)
    /// Bitcoin orange: your sats.
    static let orange = Color(light: 0xF28A0A, dark: 0xFF9F0A)
    static let orangeSoft = Color(light: 0xFFF1DE, dark: 0x3A2A10)
    /// "Look here": expiry near, errors.
    static let alert = Color(light: 0xE0302A, dark: 0xFF453A)
    static let alertSoft = Color(light: 0xFFECEB, dark: 0x3A1614)
    /// The Ark server and rounds.
    static let server = Color(light: 0x5856D6, dark: 0x7D7AFF)
    static let serverDeep = Color(light: 0x4543B8, dark: 0x5E5CE6)
    static let serverSoft = Color(light: 0xEFEFFB, dark: 0x25254A)
    /// The bitcoin chain.
    static let chain = Color(light: 0x1A9CB0, dark: 0x40C8E0)
    static let chainSoft = Color(light: 0xE4F4F7, dark: 0x12292E)
    /// Lightning.
    static let bolt = Color(light: 0xE0A400, dark: 0xFFD60A)
    /// Done, healthy.
    static let good = Color(light: 0x28A745, dark: 0x30D158)
    /// Text on a coloured (not `tint`) fill.
    static let onColor = Color.white
}

/// Corner radii.
enum Radius {
    static let small: CGFloat = 10
    static let control: CGFloat = 14
    static let card: CGFloat = 22
}

/// The springs every screen shares: smooth, with barely any bounce.
enum Motion {
    /// Things you touch.
    static let press = Animation.spring(response: 0.28, dampingFraction: 0.8)
    /// Things that slide or resize.
    static let glide = Animation.spring(response: 0.5, dampingFraction: 0.88)
    /// Things that arrive.
    static let bounce = Animation.spring(response: 0.5, dampingFraction: 0.78)
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
