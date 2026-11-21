import SwiftUI

/// While the wallet wakes up: the mark, the app name and the boot steps.
/// If the Ark server can't be reached, the ways out are offered here.
struct SplashView: View {
    @EnvironmentObject private var store: WalletStore
    @State private var confirmReset = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Spacer(minLength: 80)

                ArkMark(size: 76)
                    .appearIn()

                VStack(spacing: 4) {
                    Text("ちょうじゅ")
                        .font(Brush.bold(28, relativeTo: .largeTitle))
                        .foregroundStyle(Ink.ink)
                    Text("Ark wallet")
                        .font(Brush.text(14))
                        .foregroundStyle(Ink.sub)
                }
                .appearIn(delay: 0.12)

                if !store.bootLog.isEmpty, store.phase == .booting {
                    bootSteps
                        .appearIn(delay: 0.18)
                }

                status
                    .padding(.top, 10)
                    .appearIn(delay: 0.24)

                Spacer(minLength: 40)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(PaperBackground())
        .confirmationDialog(
            "この端末のデータを消して、シードから もどしますか？",
            isPresented: $confirmReset,
            titleVisibility: .visible
        ) {
            Button("データを消して もどす", role: .destructive) {
                Task { await store.resetLocalData() }
            }
        } message: {
            Text("シードフレーズは残ります。残高はサーバーの助けで もどります。")
        }
    }

    /// What the wallet is doing, one quiet line per step.
    private var bootSteps: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(store.bootLog) { line in
                HStack(spacing: 10) {
                    Group {
                        switch line.status {
                        case .ok: InkIcon(kind: .check, size: 14, color: Ink.ink)
                        case .busy: InkDots(color: Ink.sub, size: 3)
                        case .warn: InkIcon(kind: .alert, size: 14, color: Ink.orange)
                        case .fail: InkIcon(kind: .alert, size: 14, color: Ink.alert)
                        }
                    }
                    .frame(width: 18)
                    Text(line.name)
                        .font(Brush.mono(12))
                        .foregroundStyle(Ink.ink)
                    Spacer(minLength: 8)
                    Text(line.detail)
                        .font(Brush.text(12))
                        .foregroundStyle(Ink.sub)
                        .lineLimit(1)
                }
                .transition(.opacity)
            }
        }
        .inkCard(padding: 14)
        .animation(.easeOut(duration: 0.2), value: store.bootLog.count)
    }

    @ViewBuilder
    private var status: some View {
        switch store.phase {
        case .failed(let message):
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    InkIcon(kind: .alert, size: 20, color: Ink.alert)
                    Text("サーバーに つながりませんでした")
                        .font(Brush.bold(16))
                        .foregroundStyle(Ink.ink)
                }
                Text(message)
                    .font(Brush.mono(12))
                    .foregroundStyle(Ink.sub)
                    .textSelection(.enabled)
                InkButton("もういちど", icon: .refresh, sound: .power) {
                    Task { await store.reboot() }
                }
                InkButton("端末のデータを消して もどす", kind: .secondary) {
                    confirmReset = true
                }
                if store.network != .signet {
                    InkButton("テスト用（SIGNET）に切りかえる", kind: .quiet) {
                        Task { await store.switchNetwork(to: .signet) }
                    }
                }
            }
            .inkCard()
        default:
            HStack(spacing: 10) {
                InkDots(color: Ink.sub, size: 6)
                Text(store.phase == .ready ? "じゅんび できました" : "Ark サーバーに つないでいます")
                    .font(Brush.text(14))
                    .foregroundStyle(Ink.sub)
            }
            if store.network == .signet {
                Text("テスト用ネットワーク（SIGNET）")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
            }
        }
    }
}
