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
            VStack(alignment: .leading, spacing: 18) {
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
            .animation(Motion.bounce, value: store.fishNeedingCare.count)
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
            SealStamp(text: "寿", size: 30)
            Text("ちょうじゅ")
                .font(Brush.bold(20, relativeTo: .headline))
                .foregroundStyle(Ink.ink)
            InkBadge(text: store.network.isRealMoney ? "MAINNET" : "テスト用",
                     color: store.network.isRealMoney ? Ink.good : Ink.orange)
            Spacer()
            CircleIconButton(icon: .gear, label: "せってい") { open(.settings) }
        }
        .padding(.top, 10)
    }

    // MARK: balance

    /// The hero: a violet card with liquid rolling along the bottom.
    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text("つかえる残高")
                        .font(Brush.bold(13, relativeTo: .footnote))
                        .foregroundStyle(Color.white.opacity(0.8))
                    Spacer()
                    Text("タップで 単位きりかえ")
                        .font(Brush.text(11, relativeTo: .caption))
                        .foregroundStyle(Color.white.opacity(0.55))
                }
                Button {
                    Chiptune.shared.play(.select)
                    Haptics.tap()
                    settings.toggleUnit()
                } label: {
                    AmountText(sats: store.spendable, unit: settings.unit, size: 46, color: .white)
                        .pop(trigger: balanceTick, from: 0.9)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(PressableStyle(scale: 0.97))
                .accessibilityHint("単位を切りかえます")
                .overlay(alignment: .topTrailing) {
                    ZStack {
                        ForEach(deltas) { delta in
                            FloatingDelta(text: deltaText(delta.amount), color: .white)
                        }
                    }
                }
                if store.pendingTotal > 0 {
                    HStack(spacing: 6) {
                        InkDots(color: .white, size: 4)
                        Text("処理中 \(SatFormat.amount(store.pendingTotal, unit: settings.unit))")
                            .font(Brush.text(13))
                            .foregroundStyle(Color.white.opacity(0.85))
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            HStack(spacing: 10) {
                heroButton("おくる", icon: .send, solid: true) { open(.send) }
                heroButton("もらう", icon: .receive, solid: false) { open(.receive) }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0x8B6CFF), Color(hex: 0x5B3DF0), Color(hex: 0x4326C9)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                // a warm glow, as if the sats inside were shining through
                Circle()
                    .fill(RadialGradient(colors: [Color(hex: 0xFFB13D, opacity: 0.55), .clear],
                                         center: .center, startRadius: 0, endRadius: 110))
                    .frame(width: 220, height: 220)
                    .offset(x: 130, y: -70)
                    .floating(8, period: 5)
                LiquidWave(color: .white, level: 0.34)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .shadow(color: Color(hex: 0x4B2FD6, opacity: 0.35), radius: 20, y: 10)
        .animation(Motion.glide, value: store.pendingTotal > 0)
    }

    private func heroButton(_ title: String, icon: InkIcon.Kind, solid: Bool, action: @escaping () -> Void) -> some View {
        Button {
            Chiptune.shared.play(.select)
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 8) {
                InkIcon(kind: icon, size: 18, lineWidth: 2.6, color: solid ? Ink.serverDeep : .white)
                Text(title)
                    .font(Brush.bold(16))
                    .foregroundStyle(solid ? Ink.serverDeep : .white)
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(solid ? Color.white : Color.white.opacity(0.2), in: Capsule())
            .overlay(Capsule().strokeBorder(Color.white.opacity(solid ? 0 : 0.35), lineWidth: 1))
        }
        .buttonStyle(PressableStyle(scale: 0.93))
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
                    .font(Brush.bold(17))
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
                                .foregroundStyle(Ink.server)
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
                            DashedDivider().padding(.leading, 64)
                        }
                    }
                }
                .padding(.vertical, 4)
                .background(Ink.paper, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .overlay(BrushFrame())
                .softShadow()
                .animation(Motion.bounce, value: store.movements.prefix(4).map(\.id))
            }
        }
    }
}

// MARK: - Ark status

/// What Ark is doing for you right now, one coloured tile per idea:
/// your VTXOs (orange), the next round (violet) and the chain tip (teal).
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
                    .font(Brush.bold(17))
                    .foregroundStyle(Ink.ink)
                Spacer()
                Text(store.network.serverHost)
                    .font(Brush.mono(11))
                    .foregroundStyle(Ink.sub)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Button(action: showAquarium) {
                vtxoTile
            }
            .buttonStyle(PressableStyle(scale: 0.97))

            HStack(alignment: .top, spacing: 12) {
                RoundCountdown()
                chainTile
            }
            .fixedSize(horizontal: false, vertical: true)

            Button {
                Chiptune.shared.play(.click)
                Haptics.tap()
                showLearn()
            } label: {
                HStack(spacing: 12) {
                    IconBubble(icon: .play, color: Ink.server)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Ark の しくみを 見る")
                            .font(Brush.bold(15))
                            .foregroundStyle(Ink.ink)
                        Text("うごく 図で 7つの しくみを まなぶ")
                            .font(Brush.text(12))
                            .foregroundStyle(Ink.sub)
                    }
                    Spacer(minLength: 0)
                    InkIcon(kind: .back, size: 14, lineWidth: 2.2, color: Ink.server)
                        .rotationEffect(.degrees(180))
                }
                .inkCard(padding: 14)
            }
            .buttonStyle(PressableStyle(scale: 0.97))
        }
    }

    // MARK: VTXO tile

    private var vtxoTile: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                Text("あなたの VTXO")
                    .font(Brush.bold(15))
                    .foregroundStyle(Ink.ink)
                InkBadge(text: "\(school.count)こ", color: Ink.orange)
                    .contentTransition(.numericText(value: Double(school.count)))
                Spacer()
                Text(nextExpiryText)
                    .font(Brush.bold(12))
                    .foregroundStyle(school.contains(where: \.needsCare) ? Ink.alert : Ink.sub)
                InkIcon(kind: .back, size: 12, lineWidth: 2.2, color: Ink.sub)
                    .rotationEffect(.degrees(180))
            }
            bubbles
            Text(school.isEmpty
                 ? "うけとると、残高は VTXO という 期限つきの コインで 届きます"
                 : "残高は これらの VTXO の 合計。大きさは 金額、リングは 期限までの のこり")
                .font(Brush.text(12))
                .foregroundStyle(Ink.sub)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .inkCard(padding: 16)
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
                        .strokeBorder(Ink.orange.opacity(0.45), style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
                        .frame(width: 34 - CGFloat(index) * 5, height: 34 - CGFloat(index) * 5)
                        .floating(3, period: 2.4 + Double(index) * 0.6)
                }
            }
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, fish in
                let size = 26 + 22 * (Double(fish.amount) / most).squareRoot()
                RingProgress(progress: fish.freshness ?? 1, color: ring(for: fish), track: Ink.wash, lineWidth: 3.5) {
                    Circle()
                        .fill(LinearGradient(colors: [Color(hex: 0xFFB648), Color(hex: 0xF7831A)],
                                             startPoint: .top, endPoint: .bottom))
                        .padding(3)
                }
                .frame(width: size, height: size)
                .opacity(fish.isBusy ? 0.4 : 1)
                .floating(2 + CGFloat(index % 3), period: 2.2 + Double(index % 4) * 0.5)
                .transition(.scale.combined(with: .opacity))
            }
            if school.count > shown.count {
                Text("+\(school.count - shown.count)")
                    .font(Brush.bold(13))
                    .foregroundStyle(Ink.sub)
            }
            Spacer(minLength: 0)
        }
        .frame(height: 56)
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

    // MARK: chain tile

    private var chainTile: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle().fill(Ink.chain).frame(width: 8, height: 8)
                Text("ブロック")
                    .font(Brush.bold(13))
                    .foregroundStyle(Ink.chain)
            }
            ChainStrip(height: store.blockHeight)
                .frame(height: 44)
            Text(store.blockHeight.map { "#\(SatFormat.sats($0))" } ?? "—")
                .font(Brush.bold(17))
                .foregroundStyle(Ink.ink)
                .monospacedDigit()
                .contentTransition(.numericText())
                .animation(Motion.glide, value: store.blockHeight)
            Text("約10分に 1つ。期限は ブロックで 数えます")
                .font(Brush.text(11, relativeTo: .caption))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .inkCard(padding: 14)
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
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(block == tip && height != nil ? Ink.chain : Ink.chain.opacity(0.28))
                    .frame(width: 24, height: 24)
                    .transition(.asymmetric(
                        insertion: .scale(scale: 0.2).combined(with: .opacity),
                        removal: .scale(scale: 0.5).combined(with: .opacity)))
                Capsule().fill(Ink.chain.opacity(0.35)).frame(width: 5, height: 3)
            }
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .strokeBorder(Ink.chain.opacity(0.7), style: StrokeStyle(lineWidth: 2, dash: [3, 3]))
                .frame(width: 24, height: 24)
                .floating(2, period: 1.6)
            Spacer(minLength: 0)
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
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle().fill(Ink.server).frame(width: 8, height: 8)
                Text("つぎの ラウンド")
                    .font(Brush.bold(13))
                    .foregroundStyle(Ink.server)
            }
            TimelineView(.animation(minimumInterval: reduceMotion ? 1 : nil)) { context in
                let interval = Double(max(store.arkInfo?.roundIntervalSecs ?? 0, 1))
                let remaining = store.nextRoundAt.map { max($0.timeIntervalSince(context.date), 0) }
                let fill = remaining.map { 1 - min($0 / interval, 1) } ?? 0
                let soon = remaining.map { $0 < 3 } == true
                HStack(spacing: 10) {
                    RingProgress(progress: fill, color: soon ? Ink.orange : Ink.server, track: Ink.serverSoft, lineWidth: 6) {
                        Circle()
                            .fill(soon ? Ink.orange : Ink.server)
                            .frame(width: 10, height: 10)
                            .scaleEffect(soon ? 1.5 : 1)
                            .animation(Motion.bounce, value: soon)
                    }
                    .frame(width: 44, height: 44)
                    Text(remaining.map(Self.clock) ?? "—")
                        .font(Brush.bold(22))
                        .foregroundStyle(soon ? Ink.orange : Ink.ink)
                        .monospacedDigit()
                        .contentTransition(.numericText(countsDown: true))
                        .animation(.snappy, value: remaining.map { Int($0.rounded(.up)) })
                }
            }
            .frame(height: 44)
            Text("みんなの Refresh や 入出金を 1つの 取引に まとめます")
                .font(Brush.text(11, relativeTo: .caption))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .inkCard(padding: 14)
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
