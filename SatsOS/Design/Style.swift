import SwiftUI
import UIKit

// ちょうじゅ / Choju — ink on paper.
//
// White and black like a Chōjū-giga scroll, with a little bitcoin orange.
// Every color follows the device's light / dark setting.

enum Ink {
    /// Page background (warm paper / near black).
    static let bg = Color(light: 0xF6F5F1, dark: 0x111111)
    /// Cards, buttons, the characters' bodies.
    static let paper = Color(light: 0xFFFFFF, dark: 0x1B1B1A)
    /// Main text and brush lines.
    static let ink = Color(light: 0x151515, dark: 0xF1F0EC)
    /// Secondary text.
    static let sub = Color(light: 0x5E5E5A, dark: 0xA8A7A2)
    /// Hairlines and borders.
    static let line = Color(light: 0xD6D4CC, dark: 0x3A3A37)
    /// Light ink wash (薄墨) on the characters.
    static let wash = Color(light: 0x151515, dark: 0xF1F0EC, opacity: 0.2)
    /// Bitcoin orange, used sparingly: arrivals, growth, the hold bar.
    static let orange = Color(hex: 0xF7931A)
    /// Warnings and errors: a dark orange-brown that reads on both papers.
    static let alert = Color(light: 0xA4370F, dark: 0xFFB066)
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

/// Klee One (SIL OFL 1.1): pencil handwriting that stays readable for
/// amounts and addresses. Scales with Dynamic Type.
enum Brush {
    static func text(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("KleeOne-Regular", size: size, relativeTo: style)
    }

    static func bold(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("KleeOne-SemiBold", size: size, relativeTo: style)
    }

    /// Big balances and amounts.
    static func amount(_ size: CGFloat) -> Font {
        .custom("KleeOne-SemiBold", size: size, relativeTo: .largeTitle)
    }

    /// Addresses, invoices, hashes.
    static func mono(_ size: CGFloat = 13) -> Font {
        .system(size: size, design: .monospaced)
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
