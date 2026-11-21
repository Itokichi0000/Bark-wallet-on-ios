import SwiftUI

enum MainTab: String, CaseIterable, Identifiable {
    case home, aquarium, history, learn
    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "ホーム"
        case .aquarium: return "すいそう"
        case .history: return "きろく"
        case .learn: return "しくみ"
        }
    }

    var icon: InkIcon.Kind {
        switch self {
        case .home: return .home
        case .aquarium: return .fish
        case .history: return .record
        case .learn: return .book
        }
    }
}

enum MainSheet: String, Identifiable {
    case send, receive, settings
    var id: String { rawValue }
}

/// Home / aquarium / history / how-it-works tabs and the send / receive /
/// settings sheets. Arrivals show as a toast (WalletStore.announce).
struct MainView: View {
    @EnvironmentObject private var store: WalletStore

    @State private var tab: MainTab = .home
    @State private var sheet: MainSheet?

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                switch tab {
                case .home:
                    HomeView(open: open, showHistory: { select(.history) }, showAquarium: { select(.aquarium) },
                             showLearn: { select(.learn) })
                case .aquarium:
                    AquariumView()
                case .history:
                    HistoryView()
                case .learn:
                    LearnView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .transition(.opacity)

            tabBar
        }
        .background(PaperBackground())
        .sheet(item: $sheet) { sheet in
            Group {
                switch sheet {
                case .send: SendView { self.sheet = nil }
                case .receive: ReceiveView { self.sheet = nil }
                case .settings: SettingsView { self.sheet = nil }
                }
            }
            .presentationBackground { PaperBackground() }
            .presentationCornerRadius(20)
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
                    VStack(spacing: 4) {
                        InkIcon(kind: item.icon, size: 22, color: selected ? Ink.ink : Ink.sub)
                            .overlay(alignment: .topTrailing) {
                                // fish that want fresh water
                                if item == .aquarium, !store.fishNeedingCare.isEmpty {
                                    Circle()
                                        .fill(Ink.alert)
                                        .frame(width: 9, height: 9)
                                        .offset(x: 4, y: -2)
                                        .transition(.scale)
                                }
                            }
                        Text(item.title)
                            .font(Brush.bold(11, relativeTo: .caption))
                            .foregroundStyle(selected ? Ink.ink : Ink.sub)
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .background(Ink.paper.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) {
            DashedDivider()
        }
    }
}
