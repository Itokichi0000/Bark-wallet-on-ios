import Foundation

/// DEBUG-only helper for CI screenshots: `-SatsOSAutopilot <mode>` makes the
/// app create a throwaway signet wallet, skip "TAP TO ENTER" and open a
/// window, so the simulator can be captured without UI automation.
///
/// Modes: `setup`, `boot`, `desktop`, `send`, `receive`, `receive-incoming`,
/// `history`, `system`.
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

    /// Stop at the boot screen.
    static var holdAtBoot: Bool { mode == "boot" }

    static var window: AppWindowKind? {
        guard let mode else { return nil }
        if mode == "receive-incoming" { return .receive }
        return AppWindowKind(rawValue: mode)
    }

    /// Open recv.exe and fake an incoming payment to show the celebration.
    static var fakeIncoming: Bool { mode == "receive-incoming" }
}
