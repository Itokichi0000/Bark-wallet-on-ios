import Bark
import SwiftUI

/// One fish up close: what this VTXO is, how long it has left, and how it
/// could leave Ark on its own.
struct FishDetailView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.dismiss) private var dismiss

    /// nil once the fish has left the tank while the sheet was open.
    var fish: Fish?
    var height: UInt64?
    var onRefresh: (Fish) -> Void
    var onGuide: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SheetHeader(title: "さかなの カルテ", onClose: { dismiss() })
                    .padding(.horizontal, -20)
                if let fish {
                    content(fish)
                } else {
                    gone
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
        .background(PaperBackground())
    }

    private var gone: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("この さかなは もう いません")
                .font(Brush.bold(17))
                .foregroundStyle(Ink.ink)
            Text("つかわれたか、みずかえで 新しい さかなに なりました。VTXO は 一度 つかうと なくなり、おつりは 新しい VTXO になります。")
                .font(Brush.text(14))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
        }
        .inkCard()
    }

    @ViewBuilder
    private func content(_ fish: Fish) -> some View {
        HStack(alignment: .center, spacing: 14) {
            FishGlyph(fish: fish, size: 96, swim: true)
            VStack(alignment: .leading, spacing: 4) {
                AmountText(sats: fish.amount, unit: settings.unit, size: 32)
                HealthChip(fish: fish)
            }
        }

        life(fish)

        VStack(spacing: 12) {
            InfoRow(label: "じょうたい", value: fish.stateText)
            InfoRow(label: "しゅるい", value: fish.kindText)
            InfoRow(label: "期限の ブロック", value: "#\(SatFormat.sats(UInt64(fish.vtxo.expiryHeight)))")
            if let height {
                InfoRow(label: "いまの ブロック", value: "#\(SatFormat.sats(height))")
            }
            InfoRow(label: "てわたし回数", value: depthText(fish), valueColor: nearDepthLimit(fish) ? Ink.alert : nil)
            InfoRow(label: "ひとりで出る 取引の大きさ", value: "約 \(SatFormat.sats(fish.vtxo.exitTxWeightWu / 4)) vB")
            InfoRow(label: "サーバーに 登録", value: fish.vtxo.registered ? "ずみ" : "まだ")
        }
        .inkCard()

        explain(title: "この さかなは なに？", text: fish.kindExplanation)
        explain(title: "期限が くると？", text: "VTXO は ブロック #\(SatFormat.sats(UInt64(fish.vtxo.expiryHeight))) を すぎると、Ark サーバーが 回収できる ように なります。そのまえに Refresh（みずかえ）すれば、新しい 期限の さかなと こうかんできます。")
        explain(title: "てわたし回数って？", text: "ラウンドを またずに Ark アドレスへ おくると（Arkoor）、さかなは 鎖のように つながって いきます。鎖が 長いほど ひとりで 出るときの 取引が ふえるので、サーバーの 上限\(depthLimitText)に ちかづいたら みずかえ で 鎖を リセットします。")

        CopyBlock(title: "VTXO ID", value: fish.id)

        if !fish.isBusy, fish.health != .fresh || fish.needsCare {
            InkButton("この さかなを みずかえ", icon: .refresh, kind: fish.needsCare ? .primary : .secondary, height: 50) {
                onRefresh(fish)
            }
        }
        InkButton("しくみ図鑑で しらべる", icon: .book, kind: .quiet, height: 46) {
            onGuide()
        }
    }

    private func life(_ fish: Fish) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionLabel(text: "いのち（期限まで）")
                Text(fish.blocksLeftText)
                    .font(Brush.bold(13))
                    .foregroundStyle(fish.needsCare ? Ink.alert : Ink.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Ink.ink.opacity(0.07))
                    Capsule()
                        .fill(fish.needsCare ? Ink.alert : (fish.health == .fresh ? Ink.orange : Ink.ink))
                        .frame(width: max(geo.size.width * (fish.freshness ?? 0), 8))
                }
            }
            .frame(height: 12)
            .accessibilityHidden(true)
        }
        .inkCard()
    }

    private func explain(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(Brush.bold(15))
                .foregroundStyle(Ink.ink)
            Text(text)
                .font(Brush.text(13))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var depthLimit: UInt16? { store.arkInfo?.maxVtxoExitDepth }

    private var depthLimitText: String {
        depthLimit.map { "（\($0)回）" } ?? ""
    }

    private func depthText(_ fish: Fish) -> String {
        if let limit = depthLimit {
            return "\(fish.vtxo.exitDepth) / \(limit)"
        }
        return "\(fish.vtxo.exitDepth)"
    }

    private func nearDepthLimit(_ fish: Fish) -> Bool {
        guard let limit = depthLimit, limit > 0 else { return false }
        return Double(fish.vtxo.exitDepth) >= Double(limit) * 0.8
    }
}
