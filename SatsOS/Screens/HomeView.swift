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
            VStack(alignment: .leading, spacing: 22) {
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
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
            .animation(Motion.bounce, value: store.fishNeedingCare.count)
        }
        .refreshable {
            await store.sync()
        }
        .background(alignment: .top) {
            ZStack(alignment: .top) {
                PaperBackground()
                // a soft glow for the balance and the glass card to sit over
                Aurora()
                    .frame(height: 520)
                    .mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .top, endPoint: .bottom))
                    .ignoresSafeArea(edges: .top)
            }
        }
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
            SealStamp(text: "寿", size: 26)
            Text("ちょうじゅ")
                .font(Brush.bold(17, relativeTo: .headline))
                .foregroundStyle(Ink.ink)
            InkBadge(text: store.network.isRealMoney ? "MAINNET" : "テスト用",
                     color: store.network.isRealMoney ? Ink.good : Ink.orange)
            Spacer()
            CircleIconButton(icon: .gear, label: "せってい") { open(.settings) }
        }
        .padding(.top, 10)
    }

    // MARK: balance

    /// The balance, very large, straight on the page; then the two actions.
    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 2) {
                Text("つかえる残高")
                    .font(Brush.bold(15, relativeTo: .subheadline))
                    .foregroundStyle(Ink.sub)
                Button {
                    Chiptune.shared.play(.select)
                    Haptics.tap()
                    settings.toggleUnit()
                } label: {
                    AmountText(sats: store.spendable, unit: settings.unit, size: 64)
                        .kerning(-1.5)
                        .pop(trigger: balanceTick, from: 0.96)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(PressableStyle(scale: 0.98))
                .accessibilityHint("単位を切りかえます")
                .overlay(alignment: .topTrailing) {
                    ZStack {
                        ForEach(deltas) { delta in
                            FloatingDelta(text: deltaText(delta.amount), color: delta.amount >= 0 ? Ink.good : Ink.sub)
                        }
                    }
                }
                if store.pendingTotal > 0 {
                    HStack(spacing: 6) {
                        InkDots(color: Ink.sub, size: 4)
                        Text("処理中 \(SatFormat.amount(store.pendingTotal, unit: settings.unit))")
                            .font(Brush.text(14))
                            .foregroundStyle(Ink.sub)
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            HStack(spacing: 12) {
                InkButton("おくる", icon: .send, sound: .select) { open(.send) }
                InkButton("もらう", icon: .receive, kind: .secondary, sound: .select) { open(.receive) }
            }
        }
        .padding(.top, 18)
        .animation(Motion.glide, value: store.pendingTotal > 0)
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
                IconBubble(icon: .alert, color: Ink.alert)
                    .floating(2, period: 1.2)
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
            .inkCard(padding: 14, border: Ink.alert.opacity(0.5), fill: Ink.alertSoft)
        }
        .buttonStyle(PressableStyle())
    }

    // MARK: recent

    private var recent: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("さいきん")
                    .font(Brush.bold(22, relativeTo: .title2))
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
                            .padding(.horizontal, 16)
                            .transition(.move(edge: .top).combined(with: .opacity))
                        if index < min(store.movements.count, 4) - 1 {
                            DashedDivider().padding(.leading, 64)
                        }
                    }
                }
                .padding(.vertical, 4)
                .background(Ink.paper, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                
                .animation(Motion.bounce, value: store.movements.prefix(4).map(\.id))
            }
        }
    }
}

// MARK: - Ark status

/// What Ark is doing for you right now, as one frosted card with three
/// rows: your VTXOs, the next round and the chain tip.
struct ArkStatusCard: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    var showAquarium: () -> Void
    var showLearn: () -> Void

    private var school: [Fish] { store.school }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Ark の ようす")
                    .font(Brush.bold(22, relativeTo: .title2))
                    .foregroundStyle(Ink.ink)
                Spacer()
                Text(store.network.serverHost)
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            VStack(spacing: 0) {
                Button(action: showAquarium) {
                    vtxoRow
                }
                .buttonStyle(PressableStyle(scale: 0.98))
                DashedDivider(color: Ink.line.opacity(0.6))
                RoundCountdown()
                DashedDivider(color: Ink.line.opacity(0.6))
                chainRow
            }
            .glassCard(padding: 0)

            Button {
                Chiptune.shared.play(.click)
                Haptics.tap()
                showLearn()
            } label: {
                HStack(spacing: 14) {
                    InkIcon(kind: .play, size: 16, color: Ink.onTint)
                        .frame(width: 40, height: 40)
                        .background(Ink.tint, in: Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Ark って なに？")
                            .font(Brush.bold(17))
                            .foregroundStyle(Ink.ink)
                        Text("1分の どうがで しくみが わかる")
                            .font(Brush.text(13))
                            .foregroundStyle(Ink.sub)
                    }
                    Spacer(minLength: 0)
                    chevron
                }
                .inkCard(padding: 16)
            }
            .buttonStyle(PressableStyle(scale: 0.98))
        }
    }

    private var chevron: some View {
        InkIcon(kind: .back, size: 13, lineWidth: 2.6, color: Ink.sub.opacity(0.7))
            .rotationEffect(.degrees(180))
    }

    private func rowLabel(_ text: String, _ color: Color) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text)
                .font(Brush.bold(13, relativeTo: .footnote))
                .foregroundStyle(Ink.sub)
        }
    }

    // MARK: VTXO row

    private var vtxoRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                rowLabel("あなたの VTXO", Ink.orange)
                Spacer()
                Text(nextExpiryText)
                    .font(Brush.text(13))
                    .foregroundStyle(school.contains(where: \.needsCare) ? Ink.alert : Ink.sub)
                chevron
            }
            HStack(alignment: .center, spacing: 14) {
                Text("\(school.count)")
                    .font(Brush.amount(34))
                    .foregroundStyle(Ink.ink)
                    .contentTransition(.numericText(value: Double(school.count)))
                bubbles
            }
            Text(school.isEmpty
                 ? "うけとると、残高は VTXO という 期限つきの コインで 届きます"
                 : "残高は これらの コインの 合計。大きさは 金額、リングは 期限までの のこり")
                .font(Brush.text(13))
                .foregroundStyle(Ink.sub)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("すいそうを 開きます")
    }

    /// Each VTXO as a coin: bigger for more sats, its ring draining toward expiry.
    private var bubbles: some View {
        let shown = Array(school.prefix(6))
        let most = Double(max(shown.map(\.amount).max() ?? 1, 1))
        return HStack(spacing: 8) {
            if school.isEmpty {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .strokeBorder(Ink.sub.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [3, 4]))
                        .frame(width: 30 - CGFloat(index) * 5, height: 30 - CGFloat(index) * 5)
                }
            }
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, fish in
                let size = 24 + 18 * (Double(fish.amount) / most).squareRoot()
                RingProgress(progress: fish.freshness ?? 1, color: ring(for: fish), track: Ink.ink.opacity(0.08), lineWidth: 3) {
                    Circle()
                        .fill(Ink.orange)
                        .padding(3)
                }
                .frame(width: size, height: size)
                .opacity(fish.isBusy ? 0.4 : 1)
                .floating(1.5 + CGFloat(index % 3) * 0.5, period: 2.6 + Double(index % 4) * 0.5)
                .transition(.scale.combined(with: .opacity))
            }
            if school.count > shown.count {
                Text("+\(school.count - shown.count)")
                    .font(Brush.bold(13))
                    .foregroundStyle(Ink.sub)
            }
            Spacer(minLength: 0)
        }
        .frame(height: 44)
        .animation(Motion.bounce, value: school.map(\.id))
    }

    private func ring(for fish: Fish) -> Color {
        if fish.needsCare { return Ink.alert }
        return fish.health == .fresh ? Ink.good : Ink.bolt
    }

    private var nextExpiryText: String {
        guard let soonest = school.compactMap(\.blocksLeft).min() else { return "" }
        if soonest <= 0 { return "期限切れ あり" }
        return "つぎの 期限 \(Fish.roughTime(blocks: soonest))"
    }

    // MARK: chain row

    private var chainRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            rowLabel("ビットコインの ブロック", Ink.chain)
            HStack(alignment: .center, spacing: 14) {
                Text(store.blockHeight.map { "#\(SatFormat.sats($0))" } ?? "—")
                    .font(Brush.amount(26))
                    .foregroundStyle(Ink.ink)
                    .contentTransition(.numericText())
                    .animation(Motion.glide, value: store.blockHeight)
                Spacer(minLength: 0)
                ChainStrip(height: store.blockHeight)
                    .fixedSize()
            }
            Text("約10分に 1つ ふえます。VTXO の 期限は ブロックで 数えます")
                .font(Brush.text(13))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
    }
}

/// The last few blocks; a new one bounces in on the right and the rest
/// shuffle along. The dashed one is the block still being mined.
struct ChainStrip: View {
    var height: UInt64?

    var body: some View {
        let tip = Int64(height ?? 0)
        HStack(spacing: 4) {
            ForEach((0..<3).map { tip - Int64(2 - $0) }, id: \.self) { block in
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(block == tip && height != nil ? Ink.chain : Ink.chain.opacity(0.25))
                    .frame(width: 20, height: 20)
                    .transition(.asymmetric(
                        insertion: .scale(scale: 0.2).combined(with: .opacity),
                        removal: .scale(scale: 0.5).combined(with: .opacity)))
                Capsule().fill(Ink.chain.opacity(0.35)).frame(width: 5, height: 3)
            }
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .strokeBorder(Ink.chain.opacity(0.7), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                .frame(width: 20, height: 20)
        }
        .animation(Motion.bounce, value: height)
        .accessibilityHidden(true)
    }
}

/// つぎの ラウンドまで: a ring that fills smoothly toward the next round and
/// flashes when the round fires.
struct RoundCountdown: View {
    @EnvironmentObject private var store: WalletStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Circle().fill(Ink.server).frame(width: 7, height: 7)
                Text("つぎの ラウンドまで")
                    .font(Brush.bold(13, relativeTo: .footnote))
                    .foregroundStyle(Ink.sub)
            }
            TimelineView(.animation(minimumInterval: reduceMotion ? 1 : nil)) { context in
                let interval = Double(max(store.arkInfo?.roundIntervalSecs ?? 0, 1))
                let remaining = store.nextRoundAt.map { max($0.timeIntervalSince(context.date), 0) }
                let fill = remaining.map { 1 - min($0 / interval, 1) } ?? 0
                let soon = remaining.map { $0 < 3 } == true
                HStack(spacing: 14) {
                    Text(remaining.map(Self.clock) ?? "—")
                        .font(Brush.amount(34))
                        .foregroundStyle(soon ? Ink.server : Ink.ink)
                        .contentTransition(.numericText(countsDown: true))
                        .animation(.snappy, value: remaining.map { Int($0.rounded(.up)) })
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Ink.ink.opacity(0.08))
                            Capsule().fill(Ink.server).frame(width: max(geo.size.width * fill, 6))
                        }
                        .frame(height: 6)
                        .frame(maxHeight: .infinity)
                    }
                }
            }
            .frame(height: 40)
            Text("サーバーは 決まった 間隔で みんなの Refresh や 入出金を 1つの 取引に まとめます")
                .font(Brush.text(13))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
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
