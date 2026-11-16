import SwiftUI

/// いえ: the rabbit's room, the balance, send / receive, and the latest few.
struct HomeView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    var open: (MainSheet) -> Void
    var showHistory: () -> Void

    @State private var line = RabbitLines.greeting()
    @State private var lineID = 0
    @State private var rabbitHop = 0
    @State private var frogHop = 0
    @State private var friendPokes: [Friend: Int] = [:]
    @State private var cheerTick = 0
    @State private var balanceTick = 0
    @State private var deltas: [BalanceDelta] = []

    struct BalanceDelta: Identifiable {
        let id = UUID()
        let amount: Int64
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                room
                    .padding(.horizontal, 18)
                    .padding(.top, 6)
                    .appearIn()
                balance
                    .padding(.horizontal, 26)
                    .padding(.top, 22)
                    .appearIn(delay: 0.08)
                actions
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .appearIn(delay: 0.14)
                recent
                    .padding(.horizontal, 22)
                    .padding(.top, 24)
                    .padding(.bottom, 24)
                    .appearIn(delay: 0.2)
            }
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .refreshable {
            await store.sync()
        }
        .background(PaperBackground())
        .onChange(of: store.spendable) { old, new in
            guard old != new else { return }
            balanceTick += 1
            let delta = BalanceDelta(amount: Int64(new) - Int64(old))
            deltas.append(delta)
            if new > old {
                cheerTick += 1
                say(RabbitLines.received.randomElement() ?? "やったね！")
            }
            Task {
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                deltas.removeAll { $0.id == delta.id }
            }
        }
        .onChange(of: store.friendArrival?.id) { _, _ in
            guard let arrival = store.friendArrival, let newest = arrival.friends.last else { return }
            Chiptune.shared.play(.boot)
            Haptics.success()
            rabbitHop += 1
            say(newest.arrivalLine)
        }
    }

    // MARK: header

    private var header: some View {
        HStack(alignment: .center) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("ちょうじゅ")
                    .font(Brush.bold(26, relativeTo: .title))
                    .foregroundStyle(Ink.ink)
                SealStamp(text: "寿", size: 22)
                    .alignmentGuide(.firstTextBaseline) { d in d[.bottom] - 4 }
                Text("Choju")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                if !store.network.isRealMoney {
                    Text("テスト用")
                        .font(Brush.bold(11))
                        .foregroundStyle(Ink.ink)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .overlay(Capsule().stroke(Ink.ink, lineWidth: 1.2))
                }
            }
            Spacer()
            CircleIconButton(icon: .gear, label: "せってい") { open(.settings) }
        }
        .padding(.horizontal, 22)
        .padding(.top, 14)
        .padding(.bottom, 4)
    }

    // MARK: room

    private var room: some View {
        let friends = store.friends
        return ZStack {
            // bush clover, pampas grass, misty hills and the moon
            SceneView(name: "home")

            VStack {
                HStack(alignment: .top) {
                    FriendsBadge(count: friends.arrived.count)
                    Spacer()
                }
                Spacer()
            }
            .padding(16)

            SpeechBubble(text: line)
                .id(lineID)
                .transition(.scale(scale: 0.7, anchor: .bottomLeading).combined(with: .opacity))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(.leading, 140)
                .padding(.top, 22)
                .zIndex(2)

            VStack(spacing: 0) {
                Spacer()
                ZStack(alignment: .bottom) {
                    // far ones first, so the near ones stand in front
                    friend(.deer, friends)
                    friend(.pheasant, friends)
                    friend(.fox, friends)
                    friend(.monkey, friends)
                    FriendActor(
                        critter: .rabbit,
                        height: 180,
                        range: -26...22,
                        poke: rabbitHop,
                        cheer: cheerTick,
                        cheerDelay: 0,
                        onSay: { say($0) }
                    )
                    .onTapGesture {
                        Chiptune.shared.play(.select)
                        Haptics.tap()
                        rabbitHop += 1
                        say(RabbitLines.random())
                    }
                    .accessibilityAddTraits(.isButton)
                    .accessibilityHint("うさぎが しゃべります")
                    friend(.cat, friends)
                    FriendActor(
                        critter: .frog,
                        height: 64,
                        range: -22...0,
                        poke: frogHop,
                        cheer: cheerTick,
                        cheerDelay: 0.05,
                        baseFacing: -1
                    )
                    .onTapGesture {
                        Chiptune.shared.play(.click)
                        Haptics.tap()
                        frogHop += 1
                    }
                    .accessibilityAddTraits(.isButton)
                    .accessibilityHint("かえるが うごきます")
                    .offset(x: 128)
                }
                .frame(maxWidth: .infinity)
                .animation(.spring(duration: 0.6, bounce: 0.4), value: friends.arrived.count)
                // the scene draws the ground; keep the characters standing on it
                Color.clear
                    .frame(height: 20)
                HStack(spacing: 10) {
                    GrowthDots(progress: friends.progress)
                    Text(friends.remainingText)
                        .font(Brush.text(12))
                        .foregroundStyle(Ink.sub)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.top, 2)
                .padding(.bottom, 12)
            }
        }
        .frame(height: 310)
        .background(Ink.paper, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(BrushFrame(color: Ink.ink))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }

    /// Where each friend settles in the room: offset from the middle, how far
    /// above the rabbit's feet (the far ones sit up on the hill), size, and
    /// how far it may wander from there.
    private static let spots: [Friend: (x: CGFloat, lift: CGFloat, height: CGFloat, range: ClosedRange<CGFloat>)] = [
        .monkey: (-132, -2, 80, -6...6),
        .cat: (-60, -6, 46, 0...0),
        .fox: (80, 2, 84, 0...14),
        .deer: (134, 54, 70, -34...12),
        .pheasant: (80, 76, 36, -16...14),
    ]

    @ViewBuilder
    private func friend(_ friend: Friend, _ friends: Friends) -> some View {
        if friends.has(friend), let spot = Self.spots[friend] {
            let order = Double(Friend.allCases.firstIndex(of: friend) ?? 0)
            FriendActor(
                critter: .friend(friend),
                height: spot.height,
                range: spot.range,
                poke: friendPokes[friend, default: 0],
                cheer: cheerTick,
                cheerDelay: 0.12 + order * 0.09,
                enterFrom: justArrived(friend) ? (spot.x < 0 ? -220 : 220) : nil
            )
            .onTapGesture {
                Chiptune.shared.play(.click)
                Haptics.tap()
                friendPokes[friend, default: 0] += 1
                say(friend.voice)
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("\(friend.name)が うごきます")
            .offset(x: spot.x, y: -spot.lift)
            .transition(.opacity)
        }
    }

    /// Walks in from the side instead of just being there.
    private func justArrived(_ friend: Friend) -> Bool {
        guard let arrival = store.friendArrival, arrival.isRecent else { return false }
        return arrival.friends.contains(friend)
    }

    private func say(_ text: String) {
        withAnimation(.spring(duration: 0.35, bounce: 0.3)) {
            line = text
            lineID += 1
        }
    }

    // MARK: balance

    private var balance: some View {
        VStack(alignment: .leading, spacing: 2) {
            SectionLabel(text: "ざんだか")
            Button {
                Chiptune.shared.play(.select)
                Haptics.tap()
                settings.toggleUnit()
            } label: {
                AmountText(sats: store.spendable, unit: settings.unit)
                    .pop(trigger: balanceTick, from: 0.94)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityHint("単位を切りかえます")
            .overlay(alignment: .topTrailing) {
                ZStack {
                    ForEach(deltas) { delta in
                        FloatingDelta(text: deltaText(delta.amount), color: delta.amount >= 0 ? Ink.orange : Ink.sub)
                    }
                }
                .padding(.trailing, 8)
            }
            if store.pendingTotal > 0 {
                HStack(spacing: 6) {
                    InkDots(color: Ink.sub, size: 4)
                    Text("とどけ中 \(SatFormat.amount(store.pendingTotal, unit: settings.unit))")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                }
            }
        }
    }

    private func deltaText(_ amount: Int64) -> String {
        let magnitude = UInt64(amount.magnitude)
        let body = settings.unit == .sats ? SatFormat.sats(magnitude) : SatFormat.btc(magnitude)
        return amount >= 0 ? "+\(body)" : "-\(body)"
    }

    // MARK: actions

    private var actions: some View {
        HStack(spacing: 12) {
            InkButton("おくる", icon: .send, height: 58, sound: .select) { open(.send) }
            InkButton("もらう", icon: .receive, kind: .secondary, height: 58, sound: .select) { open(.receive) }
        }
    }

    // MARK: recent

    private var recent: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                SectionLabel(text: "さいきん")
                if !store.movements.isEmpty {
                    Button("ぜんぶ見る", action: showHistory)
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.ink)
                }
            }
            if store.movements.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("まだ なにもありません。「もらう」から はじめてみよう。")
                        .font(Brush.text(14))
                        .foregroundStyle(Ink.sub)
                    if let faucet = store.network.faucetURL {
                        Link(destination: faucet) {
                            Text("テスト用コインを もらう ↗︎")
                                .font(Brush.bold(14))
                                .foregroundStyle(Ink.ink)
                                .underline()
                        }
                    }
                }
                .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(store.movements.prefix(3).enumerated()), id: \.element.id) { index, movement in
                        TransactionRow(movement: movement)
                            .transition(.move(edge: .top).combined(with: .opacity))
                        if index < min(store.movements.count, 3) - 1 {
                            DashedDivider()
                        }
                    }
                }
                .animation(.spring(duration: 0.4), value: store.movements.prefix(3).map(\.id))
            }
        }
    }
}
