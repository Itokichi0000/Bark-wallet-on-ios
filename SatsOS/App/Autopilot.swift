import Foundation

/// DEBUG-only helper for CI screenshots: `-SatsOSAutopilot <mode>` makes the
/// app create a throwaway signet wallet and open a screen, so the simulator
/// can be captured without UI automation.
///
/// Modes: `setup`, `boot`, `home`, `send`, `receive`, `receive-incoming`,
/// `history`, `growth`, `settings`.
/// Release builds always return nil.
enum Autopilot {
    static var mode: String? {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: "-SatsOSAutopilot"), index + 1 < args.count else { return nil }
        return args[index + 1]
        #else
        return nil
        #endif
    }

    /// Stop at the setup screen.
    static var holdAtSetup: Bool { mode == "setup" }

    /// Stop at the splash screen.
    static var holdAtBoot: Bool { mode == "boot" }

    static var tab: MainTab? {
        switch mode {
        case "history": return .history
        case "growth": return .growth
        default: return mode == nil ? nil : .home
        }
    }

    static var sheet: MainSheet? {
        switch mode {
        case "send": return .send
        case "receive", "receive-incoming": return .receive
        case "settings": return .settings
        default: return nil
        }
    }

    /// Open the receive sheet and fake an incoming payment.
    static var fakeIncoming: Bool { mode == "receive-incoming" }
}
