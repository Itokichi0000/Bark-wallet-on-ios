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
        .background(Ink.bg)
        .onChange(of: store.spendable) { old, new in
            guard old != new else { return }
            balanceTick += 1
            let delta = BalanceDelta(amount: Int64(new) - Int64(old))
            deltas.append(delta)
            if new > old {
                rabbitHop += 1
                say(RabbitLines.received.randomElement() ?? "やったね！")
            }
            Task {
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                deltas.removeAll { $0.id == delta.id }
            }
        }
        .task {
            // little signs of life
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64.random(in: 7_000_000_000...12_000_000_000))
                guard !Task.isCancelled else { return }
                if Bool.random() { frogHop += 1 } else { rabbitHop += 1 }
            }
        }
    }

    // MARK: header

    private var header: some View {
        HStack(alignment: .center) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("ちょうじゅ")
                    .font(Brush.bold(26, relativeTo: .title))
                    .foregroundStyle(Ink.ink)
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
        let growth = store.growth
        return ZStack {
            VStack {
                HStack(alignment: .top) {
                    LevelBadge(stage: growth.stage)
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

            VStack(spacing: 0) {
                Spacer()
                ZStack(alignment: .bottom) {
                    CharacterView(art: growth.stage.art, height: 190)
                        .breathing()
                        .hop(trigger: rabbitHop)
                        .onTapGesture {
                            Chiptune.shared.play(.select)
                            Haptics.tap()
                            rabbitHop += 1
                            say(RabbitLines.random())
                        }
                        .accessibilityAddTraits(.isButton)
                        .accessibilityHint("うさぎが しゃべります")
                    CharacterView(art: .frogSit, height: 64)
                        .scaleEffect(x: -1, y: 1)
                        .breathing(0.04, period: 1.2)
                        .hop(trigger: frogHop, height: 16)
                        .onTapGesture {
                            Chiptune.shared.play(.click)
                            Haptics.tap()
                            frogHop += 1
                        }
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.trailing, 16)
                }
                GroundLine()
                    .padding(.horizontal, 4)
                HStack(spacing: 10) {
                    GrowthDots(progress: growth.progress)
                    Text(growth.remainingText)
                        .font(Brush.text(12))
                        .foregroundStyle(Ink.sub)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.top, 2)
                .padding(.bottom, 12)
            }
        }
        .frame(height: 310)
        .background(Ink.paper, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Ink.ink, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
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
