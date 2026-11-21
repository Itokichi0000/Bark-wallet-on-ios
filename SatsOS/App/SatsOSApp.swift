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
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: WalletStore
    @Environment(\.scenePhase) private var scenePhase

    /// The splash stays up briefly after the wallet is ready.
    @State private var entered = false

    var body: some View {
        ZStack {
            PaperBackground()

            Group {
                switch store.phase {
                case .needsSetup:
                    SetupView()
                        .transition(.opacity)
                case .ready where entered:
                    MainView()
                        .transition(.opacity.combined(with: .scale(scale: 0.98)))
                default:
                    SplashView()
                        .transition(.opacity)
                }
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
            .animation(.spring(duration: 0.35), value: store.toast)
        }
        .tint(Ink.server)
        .task {
            await store.boot()
        }
        .onChange(of: store.bootGeneration) { _, _ in
            entered = false
        }
        .onChange(of: store.phase) { _, phase in
            if phase == .ready, !entered, !Autopilot.holdAtBoot {
                Task {
                    try? await Task.sleep(nanoseconds: 600_000_000)
                    withAnimation(.easeOut(duration: 0.35)) { entered = true }
                }
            }
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
        if case .needsSetup = phase, !Autopilot.holdAtSetup {
            guard let words = try? store.makeMnemonic() else { return }
            Task { await store.installWallet(mnemonic: words, restored: false) }
        }
    }
}
