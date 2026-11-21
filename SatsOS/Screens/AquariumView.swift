import Bark
import SwiftUI

/// すいそう: your VTXOs as fish. Payments make fish swim out, change and
/// receipts swim in, and the water clouds over when a fish's expiry is near.
/// みずかえ (Refresh) trades old fish for new ones in the next round.
struct AquariumView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings

    @State private var selected: PickedFish?
    @State private var plan: RefreshPlan?
    @State private var showGuide = false
    @State private var ghosts: [FishGhost] = []
    @State private var arrivals: [String: Date] = [:]
    @State private var tapTick = 0

    struct PickedFish: Identifiable {
        let id: String
    }

    // MARK: data

    private var height: UInt64? {
        #if DEBUG
        if Autopilot.demoAquarium, store.vtxos.isEmpty { return store.blockHeight ?? 250_000 }
        #endif
        return store.blockHeight
    }

    private var school: [Fish] {
        #if DEBUG
        if Autopilot.demoAquarium, store.vtxos.isEmpty {
            let demo = DemoFish.make(height: height)
            return Fish.school(from: demo, height: height, lifetime: store.arkInfo?.vtxoLifetime ?? 4_320,
                               refreshIDs: [demo[3].id])
        }
        #endif
        return store.school
    }

    private var needingCare: [Fish] {
        school.filter { $0.needsCare && !$0.isBusy }
    }

    private var swimming: [Fish] {
        school.filter { !$0.isBusy }
    }

    private var murk: Double {
        guard !school.isEmpty else { return 0 }
        let worst = needingCare.count
        guard worst > 0 else { return 0 }
        return min(0.35 + Double(worst) / Double(school.count), 1)
    }

    // MARK: body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                    .padding(.top, 14)
                tank
                    .appearIn()
                if store.isRefreshingFish {
                    refreshing
                        .transition(.opacity.combined(with: .move(edge: .top)))
                } else if !needingCare.isEmpty {
                    warning
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
                if !school.isEmpty {
                    BlockClock(school: school, height: height)
                        .appearIn(delay: 0.06)
                    list
                        .appearIn(delay: 0.1)
                    if needingCare.isEmpty, !swimming.isEmpty, !store.isRefreshingFish {
                        InkButton("ぜんぶ みずかえ（期限を のばす）", icon: .refresh, kind: .quiet, height: 48) {
                            plan = RefreshPlan(fish: swimming)
                        }
                    }
                }
                lesson
                    .appearIn(delay: 0.14)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 28)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
            .animation(.spring(duration: 0.4), value: needingCare.count)
            .animation(.spring(duration: 0.4), value: store.isRefreshingFish)
        }
        .refreshable {
            await store.sync()
        }
        .background(PaperBackground())
        .onAppear {
            takeFishEvents()
            if Autopilot.openGuide { showGuide = true }
        }
        .onChange(of: store.fishGhosts) { _, _ in takeFishEvents() }
        .onChange(of: store.fishArrivals) { _, _ in takeFishEvents() }
        .sheet(item: $selected) { picked in
            FishDetailView(
                fish: school.first(where: { $0.id == picked.id }),
                height: height,
                onRefresh: { fish in
                    selected = nil
                    Task {
                        try? await Task.sleep(nanoseconds: 450_000_000)
                        plan = RefreshPlan(fish: [fish])
                    }
                },
                onGuide: {
                    selected = nil
                    Task {
                        try? await Task.sleep(nanoseconds: 450_000_000)
                        showGuide = true
                    }
                }
            )
            .presentationDetents([.medium, .large])
            .presentationBackground { PaperBackground() }
            .presentationCornerRadius(20)
        }
        .sheet(item: $plan) { plan in
            RefreshSheet(plan: plan)
                .presentationDetents([.medium, .large])
                .presentationBackground { PaperBackground() }
                .presentationCornerRadius(20)
        }
        .sheet(isPresented: $showGuide) {
            ArkGuideView()
                .presentationBackground { PaperBackground() }
                .presentationCornerRadius(20)
        }
    }

    /// Plays the fish that came and went while the tank was off screen, too.
    private func takeFishEvents() {
        let now = Date()
        let newGhosts = store.fishGhosts
        let newArrivals = store.fishArrivals
        guard !newGhosts.isEmpty || !newArrivals.isEmpty else { return }
        // stagger the leavers so a big payment is a little parade
        ghosts = ghosts.filter { now.timeIntervalSince($0.at) < 4 }
            + newGhosts.enumerated().map { index, ghost in
                FishGhost(id: ghost.id, amount: ghost.amount, at: now.addingTimeInterval(Double(index) * 0.35))
            }
        for (index, id) in newArrivals.keys.sorted().enumerated() {
            arrivals[id] = now.addingTimeInterval(0.6 + Double(index) * 0.3)
        }
        if !newGhosts.isEmpty {
            Chiptune.shared.play(.send)
        } else {
            Chiptune.shared.play(.coin)
        }
        store.clearFishEvents()
    }

    // MARK: header

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("すいそう")
                    .font(Brush.bold(26, relativeTo: .title))
                    .foregroundStyle(Ink.ink)
                    .accessibilityAddTraits(.isHeader)
                Text("VTXO を さかなで 見てみよう")
                    .font(Brush.text(13))
                    .foregroundStyle(Ink.sub)
            }
            Spacer()
            CircleIconButton(icon: .book, label: "しくみ図鑑") { showGuide = true }
        }
    }

    // MARK: tank

    private var tank: some View {
        ZStack {
            FishTank(school: school, ghosts: ghosts, arrivals: arrivals, murk: murk) { fish in
                Chiptune.shared.play(.select)
                Haptics.tap()
                tapTick += 1
                selected = PickedFish(id: fish.id)
            }

            VStack {
                HStack(alignment: .top) {
                    Text("さかな \(school.count)ひき")
                        .font(Brush.bold(13))
                        .foregroundStyle(Ink.paper)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(Ink.ink, in: Capsule())
                        .contentTransition(.numericText(value: Double(school.count)))
                    Spacer()
                    if let height {
                        Text("ブロック #\(SatFormat.sats(height))")
                            .font(Brush.text(12))
                            .foregroundStyle(Ink.sub)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Ink.paper.opacity(0.85), in: Capsule())
                            .contentTransition(.numericText())
                    }
                }
                Spacer()
            }
            .padding(12)
            .allowsHitTesting(false)

            if school.isEmpty {
                VStack(spacing: 6) {
                    Text("まだ さかなが いません")
                        .font(Brush.bold(16))
                        .foregroundStyle(Ink.ink)
                    Text("「もらう」と さかなが やってくるよ")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Ink.paper.opacity(0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .allowsHitTesting(false)
            }
        }
        .frame(height: 300)
        .background(Ink.paper, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(BrushFrame())
        .animation(.easeInOut(duration: 1.2), value: murk)
    }

    // MARK: warning / refreshing

    private var warning: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                InkIcon(kind: .alert, size: 20, color: Ink.alert)
                Text("\(needingCare.count)ひき が みずかえ時です")
                    .font(Brush.bold(16))
                    .foregroundStyle(Ink.alert)
            }
            Text(warningText)
                .font(Brush.text(13))
                .foregroundStyle(Ink.ink)
                .fixedSize(horizontal: false, vertical: true)
            InkButton("みずかえ する（Refresh）", icon: .refresh, height: 48) {
                plan = RefreshPlan(fish: needingCare)
            }
        }
        .inkCard(border: Ink.alert)
    }

    private var warningText: String {
        if needingCare.contains(where: { $0.health == .expired }) {
            return "期限を すぎた さかなが います。サーバーが 回収できる 状態なので、はやめに みずかえ しよう。まにあわない ときは 「ひとりで脱出」で チェーンに 出せます（しくみ図鑑）。"
        }
        return "VTXO には 期限（ブロックの高さ）が あります。期限を すぎると サーバーが 回収できるので、その前に Refresh して 新しい さかなに とりかえよう。"
    }

    private var refreshing: some View {
        HStack(alignment: .center, spacing: 12) {
            InkDots(size: 6)
            VStack(alignment: .leading, spacing: 2) {
                Text("みずかえ中…")
                    .font(Brush.bold(15))
                    .foregroundStyle(Ink.ink)
                Text(roundText)
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .inkCard()
    }

    private var roundText: String {
        if let seconds = store.arkInfo?.roundIntervalSecs, seconds > 0 {
            return "あみの さかなは 次の ラウンド（\(RoundTime.text(seconds))ごと）で 新しい さかなと こうかん されます"
        }
        return "あみの さかなは 次の ラウンドで 新しい さかなと こうかん されます"
    }

    // MARK: list

    private var list: some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionLabel(text: "さかな いちらん（タップで くわしく）")
            VStack(spacing: 0) {
                ForEach(Array(school.enumerated()), id: \.element.id) { index, fish in
                    Button {
                        Chiptune.shared.play(.select)
                        Haptics.tap()
                        selected = PickedFish(id: fish.id)
                    } label: {
                        FishRow(fish: fish, unit: settings.unit)
                            .padding(.horizontal, 14)
                    }
                    .buttonStyle(.plain)
                    if index < school.count - 1 {
                        DashedDivider().padding(.horizontal, 14)
                    }
                }
            }
            .padding(.vertical, 4)
            .background(Ink.paper, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(BrushFrame())
            .animation(.spring(duration: 0.4), value: school.map(\.id))
        }
    }

    // MARK: lesson

    private var lesson: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel(text: "すいそうの 見かた")
            LegendRow(look: FishLook(spot: Ink.orange), title: "げんきな さかな", detail: "期限まで まだ たっぷり")
            LegendRow(look: FishLook(), title: "ふつうの さかな", detail: "のこり 3分の1 より すくない")
            LegendRow(look: FishLook(body: Ink.bg, line: Ink.sub), title: "「!」の さかな", detail: "みずかえ時。Refresh しよう")
            LegendRow(look: FishLook(dashed: true), title: "あみの中", detail: "送金・ラウンドで 使用中")
            Text("大きさは 金額。おくると さかなが 右へ 泳ぎさり、おつりや もらった お金は 新しい さかなとして 左から やってきます。")
                .font(Brush.text(13))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)
        }
        .inkCard()
    }
}

/// "30秒" / "約2分"
enum RoundTime {
    static func text(_ seconds: UInt64) -> String {
        seconds < 120 ? "\(seconds)秒" : "約\(seconds / 60)分"
    }
}

// MARK: - Pieces

private struct LegendRow: View {
    var look: FishLook
    var title: String
    var detail: String

    var body: some View {
        HStack(spacing: 12) {
            Canvas { gc, size in
                InkFish.draw(in: gc, at: CGPoint(x: size.width / 2, y: size.height / 2),
                             length: size.width * 0.9, facing: 1, look: look)
            }
            .frame(width: 40, height: 24)
            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(Brush.bold(14))
                    .foregroundStyle(Ink.ink)
                Text(detail)
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }
}

struct FishRow: View {
    var fish: Fish
    var unit: AmountUnit

    var body: some View {
        HStack(spacing: 12) {
            FishGlyph(fish: fish, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(SatFormat.amount(fish.amount, unit: unit))
                    .font(Brush.bold(16))
                    .foregroundStyle(Ink.ink)
                Text(fish.blocksLeftText)
                    .font(Brush.text(12))
                    .foregroundStyle(fish.needsCare ? Ink.alert : Ink.sub)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 6)
            HealthChip(fish: fish)
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

struct HealthChip: View {
    var fish: Fish

    var body: some View {
        let alert = fish.needsCare && !fish.isBusy
        Text(fish.healthLabel)
            .font(Brush.bold(12))
            .foregroundStyle(alert ? Ink.paper : Ink.ink)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(alert ? Ink.alert : Color.clear, in: Capsule())
            .overlay(Capsule().stroke(alert ? Ink.alert : Ink.line, lineWidth: 1.2))
            .fixedSize()
    }
}

/// ブロックの とけい: where each fish's expiry sits on the chain's clock.
struct BlockClock: View {
    var school: [Fish]
    var height: UInt64?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionLabel(text: "ブロックの とけい（1ブロック ≒ 10分）")
            }
            if let horizon {
                GeometryReader { geo in
                    let width = geo.size.width
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Ink.ink.opacity(0.06))
                            .frame(height: 10)
                        // the last day before expiry: time to refresh
                        Capsule()
                            .fill(Ink.alert.opacity(0.25))
                            .frame(width: max(width * min(144 / horizon, 1), 6), height: 10)
                        ForEach(school) { fish in
                            let left = Double(max(fish.blocksLeft ?? 0, 0))
                            Circle()
                                .fill(fish.needsCare ? Ink.alert : (fish.health == .fresh ? Ink.orange : Ink.ink))
                                .overlay(Circle().stroke(Ink.paper, lineWidth: 1.5))
                                .frame(width: 12, height: 12)
                                .offset(x: width * min(left / horizon, 1) - 6)
                        }
                    }
                    .frame(height: 14)
                }
                .frame(height: 14)
                HStack {
                    Text("いま")
                    Spacer()
                    Text("+\(SatFormat.sats(UInt64(horizon))) ブロック（\(Fish.roughTime(blocks: Int64(horizon)))）")
                }
                .font(Brush.text(12))
                .foregroundStyle(Ink.sub)
                Text("赤いところに 入った さかなは みずかえ時。ブロックが 進むと 点は 左へ 動きます。")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("ブロックの 高さを 読みこみ中…")
                    .font(Brush.text(13))
                    .foregroundStyle(Ink.sub)
            }
        }
        .inkCard()
        .accessibilityElement(children: .combine)
    }

    /// The right end of the bar: the furthest expiry, at least a day.
    private var horizon: Double? {
        guard height != nil else { return nil }
        let furthest = school.compactMap(\.blocksLeft).max() ?? 0
        return Double(max(furthest, 144))
    }
}

// MARK: - Refresh

struct RefreshPlan: Identifiable {
    let id = UUID()
    let fish: [Fish]

    var ids: [String] { fish.map(\.id) }
    var total: UInt64 { fish.reduce(0) { $0 + $1.amount } }
}

/// みずかえ: explains what a refresh does, shows the fee, then starts it.
struct RefreshSheet: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.dismiss) private var dismiss
    var plan: RefreshPlan

    @State private var fee: FeeEstimate?
    @State private var feeError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SheetHeader(title: "みずかえ（Refresh）", onClose: { dismiss() })
                    .padding(.horizontal, -20)

                ArkScenePlayer(scene: .refresh, height: 190, showsBeats: false, showsControls: false)
                    .inkCard()

                VStack(spacing: 12) {
                    InfoRow(label: "さかな", value: "\(plan.fish.count)ひき")
                    InfoRow(label: "ごうけい", value: SatFormat.amount(plan.total, unit: settings.unit))
                    if let fee {
                        InfoRow(label: "てすうりょう", value: SatFormat.amount(fee.feeSats, unit: settings.unit))
                        DashedDivider()
                        InfoRow(label: "新しい さかな", value: SatFormat.amount(fee.netAmountSats, unit: settings.unit),
                                emphasized: true)
                    } else if feeError == nil {
                        HStack {
                            Text("てすうりょうを 計算中")
                                .font(Brush.text(14))
                                .foregroundStyle(Ink.sub)
                            Spacer()
                            InkDots(color: Ink.sub, size: 5)
                        }
                    }
                }
                .inkCard()

                if let feeError {
                    Text(feeError)
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.alert)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text("てすうりょうは 期限が ちかい さかなほど 安く なります。ラウンドが おわるまで 少し 待ってね（アプリを とじても だいじょうぶ）。")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                    .fixedSize(horizontal: false, vertical: true)

                InkButton("みずかえ する", icon: .refresh, sound: .send) {
                    let ids = plan.ids
                    Task { await store.refreshFish(ids: ids) }
                    dismiss()
                }
                .disabled(fee == nil || store.isRefreshingFish)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
        .background(PaperBackground())
        .task {
            do {
                fee = try await store.refreshFee(ids: plan.ids)
            } catch {
                feeError = "みずかえ できません: \(error.barkMessage)"
            }
        }
    }

}
