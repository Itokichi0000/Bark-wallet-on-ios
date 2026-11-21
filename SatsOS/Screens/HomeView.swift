import Bark
import SwiftUI

/// ホーム: the balance, send / receive, what Ark is doing right now (your
/// VTXOs, the next round, the chain tip) and the latest few movements.
struct HomeView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    var open: (MainSheet) -> Void
    var showHistory: () -> Void
    var showAquarium: () -> Void
    var showLearn: () -> Void

    @State private var balanceTick = 0
    @State private var deltas: [BalanceDelta] = []

    struct BalanceDelta: Identifiable {
        let id = UUID()
        let amount: Int64
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                balanceCard
                    .appearIn()
                if !store.fishNeedingCare.isEmpty {
                    tankNotice
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
                ArkStatusCard(showAquarium: showAquarium, showLearn: showLearn)
                    .appearIn(delay: 0.06)
                recent
                    .appearIn(delay: 0.12)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
            .animation(.easeOut(duration: 0.25), value: store.fishNeedingCare.count)
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
            Task {
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                deltas.removeAll { $0.id == delta.id }
            }
        }
    }

    // MARK: header

    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            SealStamp(text: "寿", size: 22)
            Text("ちょうじゅ")
                .font(Brush.bold(17, relativeTo: .headline))
                .foregroundStyle(Ink.ink)
            InkBadge(text: store.network.isRealMoney ? "MAINNET" : "テスト用",
                     color: store.network.isRealMoney ? Ink.sub : Ink.orange)
            Spacer()
            CircleIconButton(icon: .gear, label: "せってい") { open(.settings) }
        }
        .padding(.top, 10)
    }

    // MARK: balance

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                SectionLabel(text: "つかえる残高")
                Button {
                    Chiptune.shared.play(.select)
                    Haptics.tap()
                    settings.toggleUnit()
                } label: {
                    AmountText(sats: store.spendable, unit: settings.unit, size: 40)
                        .pop(trigger: balanceTick, from: 0.97)
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
                }
                if store.pendingTotal > 0 {
                    HStack(spacing: 6) {
                        InkDots(color: Ink.sub, size: 4)
                        Text("処理中 \(SatFormat.amount(store.pendingTotal, unit: settings.unit))")
                            .font(Brush.text(13))
                            .foregroundStyle(Ink.sub)
                    }
                }
            }
            HStack(spacing: 10) {
                InkButton("おくる", icon: .send, height: 46, sound: .select) { open(.send) }
                InkButton("もらう", icon: .receive, kind: .quiet, height: 46, sound: .select) { open(.receive) }
            }
        }
        .inkCard(padding: 18)
    }

    private func deltaText(_ amount: Int64) -> String {
        let magnitude = UInt64(amount.magnitude)
        let body = settings.unit == .sats ? SatFormat.sats(magnitude) : SatFormat.btc(magnitude)
        return amount >= 0 ? "+\(body)" : "-\(body)"
    }

    // MARK: tank notice

    /// A nudge to the aquarium when VTXOs near their expiry.
    private var tankNotice: some View {
        Button {
            Chiptune.shared.play(.select)
            Haptics.tap()
            showAquarium()
        } label: {
            HStack(spacing: 12) {
                InkIcon(kind: .alert, size: 18, color: Ink.alert)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(store.fishNeedingCare.count)つの VTXO が 期限まぢか")
                        .font(Brush.bold(14))
                        .foregroundStyle(Ink.ink)
                    Text("すいそうで Refresh すると 期限が のびます")
                        .font(Brush.text(12))
                        .foregroundStyle(Ink.sub)
                }
                Spacer(minLength: 6)
                InkIcon(kind: .back, size: 14, color: Ink.sub)
                    .rotationEffect(.degrees(180))
            }
            .inkCard(padding: 14, border: Ink.alert.opacity(0.45))
        }
        .buttonStyle(.plain)
    }

    // MARK: recent

    private var recent: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("さいきん")
                    .font(Brush.bold(15))
                    .foregroundStyle(Ink.ink)
                Spacer()
                if !store.movements.isEmpty {
                    Button("すべて見る", action: showHistory)
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
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
                .inkCard()
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(store.movements.prefix(4).enumerated()), id: \.element.id) { index, movement in
                        TransactionRow(movement: movement)
                            .padding(.horizontal, 14)
                            .transition(.move(edge: .top).combined(with: .opacity))
                        if index < min(store.movements.count, 4) - 1 {
                            DashedDivider().padding(.leading, 40)
                        }
                    }
                }
                .padding(.vertical, 2)
                .background(Ink.paper, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .overlay(BrushFrame())
                .animation(.spring(duration: 0.4), value: store.movements.prefix(4).map(\.id))
            }
        }
    }
}

// MARK: - Ark status

/// What Ark is doing for you right now: your VTXOs as a strip, the next
/// round counting down, and the chain tip.
struct ArkStatusCard: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    var showAquarium: () -> Void
    var showLearn: () -> Void

    @State private var blockPop = 0

    private var school: [Fish] { store.school }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Ark の ようす")
                    .font(Brush.bold(15))
                    .foregroundStyle(Ink.ink)
                Spacer()
                Text(store.network.serverHost)
                    .font(Brush.mono(11))
                    .foregroundStyle(Ink.sub)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Button(action: showAquarium) {
                vtxoStrip
            }
            .buttonStyle(.plain)

            DashedDivider()
            RoundCountdown()
            DashedDivider()

            HStack(spacing: 10) {
                BlockGlyph(pop: blockPop)
                VStack(alignment: .leading, spacing: 1) {
                    Text(store.blockHeight.map { "ブロック #\(SatFormat.sats($0))" } ?? "ブロック —")
                        .font(Brush.bold(14))
                        .foregroundStyle(Ink.ink)
                        .contentTransition(.numericText())
                    Text("約10分ごとに 1つ。VTXO の 期限は ブロックで 数えます")
                        .font(Brush.text(12))
                        .foregroundStyle(Ink.sub)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .animation(.snappy, value: store.blockHeight)

            InkButton("Ark の しくみを 見る", icon: .book, kind: .secondary, height: 42) { showLearn() }
        }
        .inkCard(padding: 18)
        .onChange(of: store.newBlockTick) { _, _ in blockPop += 1 }
    }

    // MARK: VTXO strip

    private var vtxoStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("VTXO \(school.count)こ")
                    .font(Brush.bold(14))
                    .foregroundStyle(Ink.ink)
                Text(nextExpiryText)
                    .font(Brush.text(12))
                    .foregroundStyle(school.contains(where: \.needsCare) ? Ink.alert : Ink.sub)
                Spacer()
                InkIcon(kind: .back, size: 12, color: Ink.sub)
                    .rotationEffect(.degrees(180))
            }
            GeometryReader { geo in
                let total = max(school.reduce(0) { $0 + $1.amount }, 1)
                let gaps = CGFloat(max(school.count - 1, 0)) * 3
                HStack(spacing: 3) {
                    if school.isEmpty {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .strokeBorder(Ink.line, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    }
                    ForEach(school) { fish in
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(color(for: fish))
                            .opacity(fish.isBusy ? 0.4 : 1)
                            .frame(width: max((geo.size.width - gaps) * CGFloat(Double(fish.amount) / Double(total)), 4))
                    }
                }
                .animation(.spring(duration: 0.5), value: school.map(\.id))
            }
            .frame(height: 14)
            Text(school.isEmpty
                 ? "うけとると、残高は VTXO という 期限つきの かけらで 届きます"
                 : "残高は これらの VTXO の 合計。幅は 金額、色は 期限までの のこり")
                .font(Brush.text(12))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("すいそうを 開きます")
    }

    private func color(for fish: Fish) -> Color {
        if fish.needsCare { return Ink.alert }
        return fish.health == .fresh ? Ink.orange : Ink.ink
    }

    private var nextExpiryText: String {
        guard let soonest = school.compactMap(\.blocksLeft).min() else { return "" }
        if soonest <= 0 { return "期限切れ あり" }
        return "つぎの 期限 \(Fish.roughTime(blocks: soonest))"
    }
}

/// つぎの ラウンドまで 0:23, with a bar that fills toward it.
struct RoundCountdown: View {
    @EnvironmentObject private var store: WalletStore

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let interval = Double(max(store.arkInfo?.roundIntervalSecs ?? 0, 1))
            let remaining = store.nextRoundAt.map { max($0.timeIntervalSince(context.date), 0) }
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("つぎの ラウンドまで")
                        .font(Brush.bold(14))
                        .foregroundStyle(Ink.ink)
                    Spacer()
                    Text(remaining.map(Self.clock) ?? "—")
                        .font(Brush.bold(14))
                        .foregroundStyle(remaining.map { $0 < 3 } == true ? Ink.orange : Ink.ink)
                        .monospacedDigit()
                        .contentTransition(.numericText(countsDown: true))
                }
                GeometryReader { geo in
                    let fill = remaining.map { 1 - min($0 / interval, 1) } ?? 0
                    ZStack(alignment: .leading) {
                        Capsule().fill(Ink.wash)
                        Capsule().fill(Ink.ink).frame(width: geo.size.width * fill)
                    }
                    .animation(.linear(duration: 1), value: fill)
                }
                .frame(height: 4)
                Text("サーバーは 決まった 間隔で みんなの Refresh や 入出金を 1つの 取引に まとめます")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .task {
            // ask again once the round we were counting to has started
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                if let at = store.nextRoundAt, at.timeIntervalSinceNow < -1 {
                    await store.refreshNextRound()
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                } else if store.nextRoundAt == nil {
                    await store.refreshNextRound()
                    try? await Task.sleep(nanoseconds: 10_000_000_000)
                }
            }
        }
    }

    static func clock(_ seconds: Double) -> String {
        let total = Int(seconds.rounded(.up))
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

/// A little block that drops in when a new one is found.
struct BlockGlyph: View {
    var pop: Int

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(Ink.wash)
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .strokeBorder(Ink.line, lineWidth: 1)
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(Ink.orange)
                .frame(width: 10, height: 10)
                .pop(trigger: pop, from: 0.3)
        }
        .frame(width: 28, height: 28)
        .accessibilityHidden(true)
    }
}
