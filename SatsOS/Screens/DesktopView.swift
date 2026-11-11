import SwiftUI

enum AppWindowKind: String, Identifiable, CaseIterable {
    case send, receive, history, system

    var id: String { rawValue }

    var file: String {
        switch self {
        case .send: return "send.exe"
        case .receive: return "recv.exe"
        case .history: return "history.log"
        case .system: return "system.cfg"
        }
    }

    var title: String {
        switch self {
        case .send: return "Send"
        case .receive: return "Receive"
        case .history: return "History"
        case .system: return "System"
        }
    }

    var subtitle: String {
        switch self {
        case .send: return "送る"
        case .receive: return "受け取る"
        case .history: return "履歴"
        case .system: return "設定"
        }
    }

    var number: String {
        switch self {
        case .send: return "01"
        case .receive: return "02"
        case .history: return "03"
        case .system: return "04"
        }
    }

    var glyph: String {
        switch self {
        case .send: return "⇢"
        case .receive: return "⇠"
        case .history: return "≡"
        case .system: return "⚙︎"
        }
    }
}

struct DesktopView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.sats) private var t

    @State private var openWindow: AppWindowKind?

    var body: some View {
        ZStack {
            BitcoinParticles(burstTick: store.newBlockTick)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                MenuBar()
                ScrollView {
                    VStack(spacing: 30) {
                        balanceWindow
                            .padding(.top, 62)
                        iconGrid
                        recentWindow
                        footer
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 30)
                    .frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
                }
                .refreshable {
                    await store.sync()
                }
            }

            if let kind = openWindow {
                AppWindowContainer(kind: kind) {
                    withAnimation(.easeOut(duration: 0.16)) { openWindow = nil }
                }
                .transition(.asymmetric(
                    insertion: .scale(scale: 0.94).combined(with: .opacity),
                    removal: .opacity
                ))
                .zIndex(2)
            }
        }
    }

    // MARK: balance

    private var balanceWindow: some View {
        PixelWindow(
            title: "wallet.dat",
            status: store.isSyncing ? "SYNC" : (store.network.isRealMoney ? "MAINNET" : "SIGNET"),
            statusColor: store.network.isRealMoney ? t.braise : t.encre,
            blinkStatus: true
        ) {
            VStack(alignment: .leading, spacing: 10) {
                Text("SPENDABLE · 使える残高")
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.dim)

                Button {
                    Chiptune.shared.play(.select)
                    Haptics.tap()
                    settings.toggleUnit()
                } label: {
                    BalanceText(sats: store.spendable, unit: settings.unit)
                }
                .buttonStyle(.plain)
                .accessibilityHint("単位を切り替え")

                if store.pendingTotal > 0 {
                    LeaderRow(label: "pending", value: SatFormat.amount(store.pendingTotal, unit: settings.unit), valueColor: t.encre)
                }
                if store.needsRefresh > 0 {
                    LeaderRow(label: "needs refresh", value: SatFormat.amount(store.needsRefresh, unit: settings.unit), valueColor: t.braise)
                }
                if let last = store.lastSync {
                    LeaderRow(label: "last sync", value: last.formatted(date: .omitted, time: .standard))
                }

                HStack(spacing: 12) {
                    PixelButton("⇢ Send") { open(.send) }
                    PixelButton("⇠ Recv", kind: .secondary) { open(.receive) }
                }
                .padding(.top, 6)
            }
        }
        .overlay(alignment: .topTrailing) {
            TalkingBitty(scale: 1.15)
                .offset(x: -14, y: -58)
        }
    }

    // MARK: icons

    private var iconGrid: some View {
        let columns = [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)]
        return LazyVGrid(columns: columns, spacing: 16) {
            ForEach(AppWindowKind.allCases) { kind in
                DesktopIcon(kind: kind) { open(kind) }
            }
        }
    }

    // MARK: recent

    private var recentWindow: some View {
        PixelWindow(title: "history.log — tail -4", padding: 12) {
            VStack(alignment: .leading, spacing: 10) {
                if store.movements.isEmpty {
                    Text("まだ取引がありません。recv.exe から受け取ってみよう。")
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.dim)
                    if let faucet = store.network.faucetURL {
                        Link(destination: faucet) {
                            Text("> signet faucet でテストコインをもらう ↗")
                                .font(PixelFont.body(13))
                                .foregroundStyle(t.encre)
                        }
                    }
                } else {
                    ForEach(store.movements.prefix(4)) { movement in
                        HistoryRow(movement: movement, compact: true)
                    }
                    Button {
                        open(.history)
                    } label: {
                        Text("> cat history.log …")
                            .font(PixelFont.body(13))
                            .foregroundStyle(t.encre)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var footer: some View {
        VStack(spacing: 4) {
            Text("Sats-OS v\(AppInfo.version) (\(AppInfo.build)) · Bark \(AppInfo.barkSDKVersion)")
            Text("\(store.network.serverHost) · self-custodial · don't trust, verify")
        }
        .font(PixelFont.body(10))
        .foregroundStyle(t.dim)
        .multilineTextAlignment(.center)
    }

    private func open(_ kind: AppWindowKind) {
        Chiptune.shared.play(.select)
        Haptics.tap()
        withAnimation(.easeOut(duration: 0.18)) { openWindow = kind }
    }
}

// MARK: - Pieces

struct BalanceText: View {
    @Environment(\.sats) private var t
    var sats: UInt64
    var unit: AmountUnit

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            switch unit {
            case .sats:
                Text(SatFormat.sats(sats))
                    .font(PixelFont.ui(44, bold: true))
                    .foregroundStyle(t.creme)
                    .shadow(color: t.rouille, radius: 0, x: 3, y: 3)
                Text("sats")
                    .font(PixelFont.ui(18))
                    .foregroundStyle(t.encre)
            case .btc:
                Text(SatFormat.btc(sats))
                    .font(PixelFont.ui(36, bold: true))
                    .foregroundStyle(t.creme)
                    .shadow(color: t.rouille, radius: 0, x: 3, y: 3)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.5)
        .contentTransition(.numericText())
        .animation(.snappy, value: sats)
    }
}

struct DesktopIcon: View {
    @Environment(\.sats) private var t
    var kind: AppWindowKind
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(kind.number)
                        .font(PixelFont.head(24))
                        .foregroundStyle(t.braise)
                    Spacer()
                    Text(kind.glyph)
                        .font(PixelFont.ui(20, bold: true))
                        .foregroundStyle(t.dim)
                }
                Text(kind.file)
                    .font(PixelFont.body(11))
                    .foregroundStyle(t.dim)
                Text(kind.title)
                    .font(PixelFont.ui(28))
                    .foregroundStyle(t.encre)
                Text(kind.subtitle)
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.dim)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(t.papier.opacity(0.82))
            .overlay(
                Rectangle().stroke(t.line, style: StrokeStyle(lineWidth: 2, dash: [4, 3]))
            )
        }
        .buttonStyle(DesktopIconStyle(theme: t))
    }
}

private struct DesktopIconStyle: ButtonStyle {
    var theme: SatsTheme
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .overlay(
                Rectangle()
                    .stroke(theme.encre, lineWidth: 3)
                    .opacity(configuration.isPressed ? 1 : 0)
            )
            .offset(x: configuration.isPressed ? 2 : 0, y: configuration.isPressed ? 2 : 0)
    }
}

/// `₿ | Sats-OS | SIGNET | ■ block 921,384 | 04:32`
struct MenuBar: View {
    @EnvironmentObject private var store: WalletStore
    @Environment(\.sats) private var t

    var body: some View {
        HStack(spacing: 0) {
            Text("₿")
                .font(PixelFont.ui(20, bold: true))
                .foregroundStyle(t.encre)
                .frame(width: 40)
            divider
            Text("Sats-OS")
                .font(PixelFont.head(22))
                .foregroundStyle(t.creme)
                .padding(.horizontal, 10)
            Spacer(minLength: 4)
            divider
            HStack(spacing: 5) {
                Rectangle()
                    .fill(t.encre)
                    .frame(width: 6, height: 6)
                Text("block \(store.blockHeight.map { SatFormat.sats($0) } ?? "…")")
                    .font(PixelFont.ui(13))
                    .foregroundStyle(t.encre)
                    .contentTransition(.numericText())
                    .animation(.snappy, value: store.blockHeight)
            }
            .padding(.horizontal, 10)
            divider
            TimelineView(.everyMinute) { context in
                Text(context.date.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits)))
                    .font(PixelFont.ui(13))
                    .foregroundStyle(t.encre)
            }
            .padding(.horizontal, 10)
        }
        .frame(height: 42)
        .background(t.papier.opacity(0.92))
        .overlay(alignment: .bottom) {
            Rectangle().fill(t.line).frame(height: 2)
        }
    }

    private var divider: some View {
        Rectangle().fill(t.line).frame(width: 2)
    }
}

/// Full screen "window" for an app, with the website's path bar on top.
struct AppWindowContainer: View {
    @Environment(\.sats) private var t
    var kind: AppWindowKind
    var close: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            MenuBar()
            PathBar(path: kind.file, onClose: close)
                .background(t.papier.opacity(0.92))
            Group {
                switch kind {
                case .send: SendView(close: close)
                case .receive: ReceiveView()
                case .history: HistoryView()
                case .system: SystemView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(CRTBackground())
    }
}
