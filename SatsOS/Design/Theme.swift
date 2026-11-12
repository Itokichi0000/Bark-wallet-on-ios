import SwiftUI

/// The six Sats-OS themes, same palette as the personal website
/// (`src/styles/global.css` / `themes-data.ts`).
struct SatsTheme: Identifiable, Equatable {
    let id: String
    let name: String
    /// background
    let papier: Color
    /// grid / faint lines
    let grid: Color
    /// dark accent (text shadow)
    let rouille: Color
    /// shadow accent (window shadow)
    let braise: Color
    /// main ink (bitcoin orange in Genesis)
    let encre: Color
    /// bright text
    let creme: Color
    /// dim text
    let dim: Color
    let line: Color
    let bgHi: Color
    let bgLo: Color
    let onEncre: Color
    let isLight: Bool

    var swatches: [Color] { [papier, grid, rouille, braise, encre, creme] }

    static let genesis = SatsTheme(
        id: "genesis", name: "Genesis",
        papier: Color(hex: 0x120E09), grid: Color(hex: 0x2A1D10), rouille: Color(hex: 0x7E2A16),
        braise: Color(hex: 0xD9481C), encre: Color(hex: 0xF7931A), creme: Color(hex: 0xF3E3C3),
        dim: Color(hex: 0x9A7A52), line: Color(hex: 0x5A4020), bgHi: Color(hex: 0x2A2014),
        bgLo: Color(hex: 0x0C0906), onEncre: Color(hex: 0x120E09), isLight: false
    )

    static let coldStorage = SatsTheme(
        id: "cold-storage", name: "Cold Storage",
        papier: Color(hex: 0x0A1220), grid: Color(hex: 0x14243A), rouille: Color(hex: 0x1D3A5C),
        braise: Color(hex: 0x3B7FC4), encre: Color(hex: 0x8FD3FF), creme: Color(hex: 0xE6F6FF),
        dim: Color(hex: 0x6F8FAE), line: Color(hex: 0x24405E), bgHi: Color(hex: 0x142640),
        bgLo: Color(hex: 0x060B14), onEncre: Color(hex: 0x0A1220), isLight: false
    )

    static let lightning = SatsTheme(
        id: "lightning", name: "Lightning",
        papier: Color(hex: 0x120A1A), grid: Color(hex: 0x24143A), rouille: Color(hex: 0x4A2A6E),
        braise: Color(hex: 0x9B4DFF), encre: Color(hex: 0xFFD31A), creme: Color(hex: 0xFFF6C8),
        dim: Color(hex: 0x9E8AB4), line: Color(hex: 0x3E2A58), bgHi: Color(hex: 0x24163A),
        bgLo: Color(hex: 0x08050C), onEncre: Color(hex: 0x120A1A), isLight: false
    )

    static let mempool = SatsTheme(
        id: "mempool", name: "Mempool",
        papier: Color(hex: 0x0A140C), grid: Color(hex: 0x13261A), rouille: Color(hex: 0x1F4A2A),
        braise: Color(hex: 0x3FA34D), encre: Color(hex: 0xB8F046), creme: Color(hex: 0xEAFFD0),
        dim: Color(hex: 0x82A273), line: Color(hex: 0x24452C), bgHi: Color(hex: 0x16301C),
        bgLo: Color(hex: 0x050A06), onEncre: Color(hex: 0x0A140C), isLight: false
    )

    static let paperWallet = SatsTheme(
        id: "paper-wallet", name: "Paper Wallet",
        papier: Color(hex: 0xEFE6D2), grid: Color(hex: 0xE0D4BA), rouille: Color(hex: 0xCDB994),
        braise: Color(hex: 0xB5452A), encre: Color(hex: 0x3A2C1C), creme: Color(hex: 0x0E0A06),
        dim: Color(hex: 0x6E5E46), line: Color(hex: 0xB8A67E), bgHi: Color(hex: 0xF8F1E2),
        bgLo: Color(hex: 0xD9CCB0), onEncre: Color(hex: 0xEFE6D2), isLight: true
    )

    static let fiat = SatsTheme(
        id: "fiat", name: "Fiat",
        papier: Color(hex: 0x1A1A1A), grid: Color(hex: 0x262626), rouille: Color(hex: 0x3A3A3A),
        braise: Color(hex: 0x909090), encre: Color(hex: 0xA0A0A0), creme: Color(hex: 0xD0D0D0),
        dim: Color(hex: 0x8A8A8A), line: Color(hex: 0x3A3A3A), bgHi: Color(hex: 0x242424),
        bgLo: Color(hex: 0x101010), onEncre: Color(hex: 0x1A1A1A), isLight: false
    )

    static let all: [SatsTheme] = [.genesis, .coldStorage, .lightning, .mempool, .paperWallet, .fiat]

    static func named(_ id: String) -> SatsTheme {
        all.first { $0.id == id } ?? .genesis
    }
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
}

// MARK: - Environment

private struct SatsThemeKey: EnvironmentKey {
    static let defaultValue: SatsTheme = .genesis
}

extension EnvironmentValues {
    var sats: SatsTheme {
        get { self[SatsThemeKey.self] }
        set { self[SatsThemeKey.self] = newValue }
    }
}

// MARK: - Fonts

/// Pixel fonts bundled from Google Fonts (SIL OFL 1.1), same as the website:
/// * Jacquard 12  – blackletter pixel display face (titles like "Sats-OS")
/// * DotGothic16  – body text, covers Japanese
/// * Pixelify Sans – numbers and UI labels
enum PixelFont {
    static func head(_ size: CGFloat) -> Font {
        .custom("Jacquard12-Regular", fixedSize: size)
    }

    static func body(_ size: CGFloat) -> Font {
        .custom("DotGothic16-Regular", size: size)
    }

    static func ui(_ size: CGFloat, bold: Bool = false) -> Font {
        .custom(bold ? "PixelifySans-Bold" : "PixelifySans-Regular", fixedSize: size)
    }
}

// MARK: - Settings

@MainActor
final class AppSettings: ObservableObject {
    private let defaults = UserDefaults.standard

    @Published var themeID: String { didSet { defaults.set(themeID, forKey: Keys.theme) } }
    @Published var crt: Bool { didSet { defaults.set(crt, forKey: Keys.crt) } }
    @Published var sound: Bool { didSet { defaults.set(sound, forKey: Keys.sound) } }
    @Published var haptics: Bool { didSet { defaults.set(haptics, forKey: Keys.haptics) } }
    @Published var unit: AmountUnit { didSet { defaults.set(unit.rawValue, forKey: Keys.unit) } }

    enum Keys {
        static let theme = "theme"
        static let crt = "crt"
        static let sound = "sound"
        static let haptics = "haptics"
        static let unit = "unit"
    }

    static func registerDefaults() {
        UserDefaults.standard.register(defaults: [
            Keys.theme: SatsTheme.genesis.id,
            Keys.crt: true,
            Keys.sound: true,
            Keys.haptics: true,
            Keys.unit: AmountUnit.sats.rawValue,
        ])
    }

    init() {
        Self.registerDefaults()
        themeID = defaults.string(forKey: Keys.theme) ?? SatsTheme.genesis.id
        crt = defaults.bool(forKey: Keys.crt)
        sound = defaults.bool(forKey: Keys.sound)
        haptics = defaults.bool(forKey: Keys.haptics)
        unit = AmountUnit(rawValue: defaults.string(forKey: Keys.unit) ?? "") ?? .sats
    }

    var theme: SatsTheme { SatsTheme.named(themeID) }

    func toggleUnit() {
        unit = unit == .sats ? .btc : .sats
    }
}
