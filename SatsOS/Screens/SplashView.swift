import SwiftUI

/// While the wallet wakes up: the rabbit on the ground and the app name.
/// If the Ark server can't be reached, the ways out are offered here.
struct SplashView: View {
    @EnvironmentObject private var store: WalletStore
    @State private var hopTick = 0
    @State private var confirmReset = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Spacer(minLength: 80)

                VStack(spacing: 0) {
                    CharacterView(art: .rabbit2, height: 170)
                        .breathing()
                        .hop(trigger: hopTick)
                        .onTapGesture {
                            Haptics.tap()
                            hopTick += 1
                        }
                    GroundLine()
                        .frame(width: 220)
                }
                .appearIn()

                VStack(spacing: 4) {
                    Text("ちょうじゅ")
                        .font(Brush.bold(34, relativeTo: .largeTitle))
                        .foregroundStyle(Ink.ink)
                    Text("Choju")
                        .font(Brush.text(14))
                        .foregroundStyle(Ink.sub)
                }
                .appearIn(delay: 0.12)

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
        .task {
            // an occasional hop while waiting
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_400_000_000)
                hopTick += 1
            }
        }
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
                Text(store.phase == .ready ? "おはよう" : "うさぎが 目をさましています")
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
