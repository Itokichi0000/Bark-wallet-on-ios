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
    @State private var forward = true
    @State private var bounce: [MainTab: Int] = [:]
    @Namespace private var tabSpace
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            switch tab {
            case .home:
                HomeView(open: open, showHistory: { select(.history) }, showAquarium: { select(.aquarium) },
                         showLearn: { select(.learn) })
                    .transition(slide)
            case .aquarium:
                AquariumView().transition(slide)
            case .history:
                HistoryView().transition(slide)
            case .learn:
                LearnView().transition(slide)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // room for the floating tab bar at the end of every scroll
        .safeAreaInset(edge: .bottom, spacing: 0) {
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
            .presentationCornerRadius(32)
        }
        .onAppear {
            if let autoTab = Autopilot.tab { tab = autoTab }
            if let autoSheet = Autopilot.sheet { sheet = autoSheet }
        }
    }

    private func open(_ target: MainSheet) {
        sheet = target
    }

    /// Tabs slide in from the side you are heading to.
    private var slide: AnyTransition {
        guard !reduceMotion else { return .opacity }
        let edge: Edge = forward ? .trailing : .leading
        let other: Edge = forward ? .leading : .trailing
        return .asymmetric(
            insertion: .move(edge: edge).combined(with: .opacity),
            removal: .move(edge: other).combined(with: .opacity)
        )
    }

    private func select(_ target: MainTab) {
        guard target != tab else { return }
        Chiptune.shared.play(.select)
        Haptics.tap()
        let all = MainTab.allCases
        forward = (all.firstIndex(of: target) ?? 0) > (all.firstIndex(of: tab) ?? 0)
        bounce[target, default: 0] += 1
        withAnimation(Motion.glide) { tab = target }
    }

    /// A floating pill; a violet bubble slides under the chosen tab.
    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases) { item in
                let selected = item == tab
                Button {
                    select(item)
                } label: {
                    VStack(spacing: 3) {
                        InkIcon(kind: item.icon, size: 22, lineWidth: selected ? 2.2 : 1.8,
                                color: selected ? Ink.server : Ink.sub)
                            .pop(trigger: bounce[item, default: 0], from: 0.6)
                            .overlay(alignment: .topTrailing) {
                                // fish that want fresh water
                                if item == .aquarium, !store.fishNeedingCare.isEmpty {
                                    Circle()
                                        .fill(Ink.alert)
                                        .overlay(Circle().stroke(Ink.paper, lineWidth: 2))
                                        .frame(width: 11, height: 11)
                                        .offset(x: 5, y: -3)
                                        .transition(.scale)
                                }
                            }
                        Text(item.title)
                            .font(Brush.bold(11, relativeTo: .caption))
                            .foregroundStyle(selected ? Ink.server : Ink.sub)
                    }
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background {
                        if selected {
                            Capsule()
                                .fill(Ink.serverSoft)
                                .matchedGeometryEffect(id: "tab", in: tabSpace)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle(scale: 0.9))
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(5)
        .background(Ink.paper, in: Capsule())
        .overlay(Capsule().strokeBorder(Ink.line.opacity(0.6), lineWidth: 1))
        .softShadow(1.6)
        .padding(.horizontal, 20)
        .padding(.top, 6)
        .padding(.bottom, 4)
        .frame(maxWidth: 520)
    }
}
