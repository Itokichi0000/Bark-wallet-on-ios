import SwiftUI

@main
struct SatsOSApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var store = WalletStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .environmentObject(store)
                .environment(\.sats, settings.theme)
                .preferredColorScheme(settings.theme.isLight ? .light : .dark)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.sats) private var t
    @Environment(\.scenePhase) private var scenePhase

    /// The boot screen waits for a tap ("PRESS ANY KEY") before the desktop.
    @State private var entered = false

    var body: some View {
        ZStack {
            CRTBackground()

            Group {
                switch store.phase {
                case .needsSetup:
                    SetupView()
                        .transition(.opacity)
                case .ready where entered:
                    DesktopView()
                        .transition(.opacity)
                default:
                    BootView {
                        Chiptune.shared.play(.boot)
                        Haptics.heavy()
                        withAnimation(.easeOut(duration: 0.25)) { entered = true }
                    }
                    .transition(.opacity)
                }
            }

            CoinBurst(trigger: store.celebrationTick)
                .ignoresSafeArea()

            if settings.crt {
                ScanlineOverlay()
            }

            VStack {
                if let toast = store.toast {
                    ToastView(toast: toast)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .onTapGesture { store.toast = nil }
                }
                Spacer()
            }
            .padding(.top, 6)
            .animation(.spring(duration: 0.3), value: store.toast)
        }
        .tint(t.encre)
        .task {
            await store.boot()
        }
        .onChange(of: store.bootGeneration) { _, _ in
            entered = false
        }
        .onChange(of: store.phase) { _, phase in
            runAutopilot(phase)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, store.phase == .ready {
                Task { await store.sync() }
            }
        }
    }

    /// CI screenshots only (see Autopilot.swift); a no-op in release builds.
    private func runAutopilot(_ phase: WalletStore.Phase) {
        guard Autopilot.mode != nil else { return }
        switch phase {
        case .needsSetup where !Autopilot.holdAtSetup:
            guard let words = try? store.makeMnemonic() else { return }
            Task { await store.installWallet(mnemonic: words, restored: false) }
        case .ready where !Autopilot.holdAtBoot:
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                entered = true
            }
        default:
            break
        }
    }
}
