import SwiftUI

enum MainTab: String, CaseIterable, Identifiable {
    case home, history, growth
    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "いえ"
        case .history: return "きろく"
        case .growth: return "うさぎ"
        }
    }

    var icon: InkIcon.Kind {
        switch self {
        case .home: return .home
        case .history: return .record
        case .growth: return .rabbit
        }
    }
}

enum MainSheet: String, Identifiable {
    case send, receive, settings
    var id: String { rawValue }
}

/// Home / history / rabbit tabs, the send / receive / settings sheets, and
/// the "もらった！" celebration whenever sats arrive.
struct MainView: View {
    @EnvironmentObject private var store: WalletStore

    @State private var tab: MainTab = .home
    @State private var sheet: MainSheet?
    @State private var celebration: IncomingPayment?

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                switch tab {
                case .home:
                    HomeView(open: open, showHistory: { select(.history) })
                case .history:
                    HistoryView()
                case .growth:
                    GrowthView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .transition(.opacity)

            tabBar
        }
        .background(PaperBackground())
        .overlay {
            if let celebration {
                ReceivedCelebration(payment: celebration) {
                    withAnimation(.easeOut(duration: 0.2)) { self.celebration = nil }
                    store.clearLevelUp()
                }
                .transition(.opacity)
                .zIndex(5)
            }
        }
        .sheet(item: $sheet) { sheet in
            Group {
                switch sheet {
                case .send: SendView { self.sheet = nil }
                case .receive: ReceiveView { self.sheet = nil }
                case .settings: SettingsView { self.sheet = nil }
                }
            }
            .presentationBackground { PaperBackground() }
            .presentationCornerRadius(28)
        }
        .onChange(of: store.lastIncoming) { _, incoming in
            // the receive sheet celebrates by itself
            guard let incoming, !store.receiveOnScreen else { return }
            withAnimation(.spring(duration: 0.4)) { celebration = incoming }
        }
        .onAppear {
            if let autoTab = Autopilot.tab { tab = autoTab }
            if let autoSheet = Autopilot.sheet { sheet = autoSheet }
        }
    }

    private func open(_ target: MainSheet) {
        sheet = target
    }

    private func select(_ target: MainTab) {
        guard target != tab else { return }
        Chiptune.shared.play(.select)
        Haptics.tap()
        withAnimation(.easeOut(duration: 0.18)) { tab = target }
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases) { item in
                let selected = item == tab
                Button {
                    select(item)
                } label: {
                    VStack(spacing: 3) {
                        InkIcon(kind: item.icon, size: 24, color: selected ? Ink.ink : Ink.sub)
                            .pop(trigger: selected ? 1 : 0, from: 0.8)
                        Text(item.title)
                            .font(selected ? Brush.bold(12) : Brush.text(12))
                            .foregroundStyle(selected ? Ink.ink : Ink.sub)
                    }
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 6)
        .background(PaperBackground())
        .overlay(alignment: .top) {
            DashedDivider(color: Ink.ink.opacity(0.35))
                .offset(y: -3)
        }
    }
}
