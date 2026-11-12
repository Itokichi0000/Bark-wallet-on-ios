import Foundation

/// DEBUG-only helper for CI screenshots: `-SatsOSAutopilot <mode>` makes the
/// app create a throwaway signet wallet, skip "TAP TO ENTER" and open a
/// window, so the simulator can be captured without UI automation.
///
/// Modes: `setup`, `boot`, `desktop`, `send`, `receive`, `history`, `system`.
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
        return AppWindowKind(rawValue: mode)
    }
}
