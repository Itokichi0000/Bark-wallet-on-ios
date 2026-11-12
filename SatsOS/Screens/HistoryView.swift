import Bark
import SwiftUI

/// history.log — every wallet movement as a terminal log.
struct HistoryView: View {
    @EnvironmentObject private var store: WalletStore
    @Environment(\.sats) private var t

    @State private var detail: Movement?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text("$ tail -f history.log")
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.dim)
                    Spacer()
                    Text("\(store.movements.count) entries")
                        .font(PixelFont.ui(13))
                        .foregroundStyle(t.dim)
                }

                if store.movements.isEmpty {
                    PixelWindow(title: "history.log") {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("(empty)")
                                .font(PixelFont.ui(16))
                                .foregroundStyle(t.encre)
                            Text("まだ取引がありません。下に引っ張ると同期します。")
                                .font(PixelFont.body(13))
                                .foregroundStyle(t.dim)
                        }
                    }
                } else {
                    PixelWindow(title: "history.log", padding: 0) {
                        LazyVStack(spacing: 0) {
                            ForEach(store.movements) { movement in
                                Button {
                                    Chiptune.shared.play(.select)
                                    Haptics.tap()
                                    detail = movement
                                } label: {
                                    HistoryRow(movement: movement)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 10)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                Rectangle()
                                    .fill(t.grid)
                                    .frame(height: 2)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 22)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .refreshable {
            await store.sync()
        }
        .sheet(item: $detail) { movement in
            MovementDetailView(movement: movement)
                .environment(\.sats, t)
                .presentationDetents([.medium, .large])
                .presentationBackground(t.papier)
        }
    }
}

struct HistoryRow: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.sats) private var t
    var movement: Movement
    var compact = false

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Text("[\(movement.statusTag)]")
                .font(PixelFont.ui(13))
                .foregroundStyle(statusColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(movement.logName)
                    .font(PixelFont.body(14))
                    .foregroundStyle(t.creme)
                if !compact {
                    Text("\(BarkDate.short(movement.createdAt)) · #\(movement.id)")
                        .font(PixelFont.body(11))
                        .foregroundStyle(t.dim)
                }
            }
            Spacer(minLength: 6)
            Text(amountText)
                .font(PixelFont.ui(compact ? 15 : 17, bold: true))
                .foregroundStyle(movement.effectiveBalanceSats >= 0 ? t.encre : t.creme)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }

    private var amountText: String {
        let value = movement.effectiveBalanceSats
        switch settings.unit {
        case .sats:
            return SatFormat.signed(value)
        case .btc:
            let body = SatFormat.btc(UInt64(value.magnitude))
            return value >= 0 ? "+\(body)" : "-\(body)"
        }
    }

    private var statusColor: Color {
        if movement.isPending { return t.dim }
        if movement.isFailed { return t.braise }
        return t.encre
    }
}

struct MovementDetailView: View {
    @Environment(\.sats) private var t
    @Environment(\.dismiss) private var dismiss
    var movement: Movement

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text("movement_\(movement.id).log")
                        .font(PixelFont.body(14))
                        .foregroundStyle(t.creme)
                    Spacer()
                    Button("✕") { dismiss() }
                        .font(PixelFont.ui(18, bold: true))
                        .foregroundStyle(t.encre)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(movement.kindLabel)
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.dim)
                    Text("\(SatFormat.signed(movement.effectiveBalanceSats)) sats")
                        .font(PixelFont.ui(36, bold: true))
                        .foregroundStyle(movement.effectiveBalanceSats >= 0 ? t.encre : t.creme)
                        .shadow(color: t.rouille, radius: 0, x: 3, y: 3)
                }

                VStack(spacing: 8) {
                    LeaderRow(label: "status", value: "[\(movement.statusTag)] \(movement.status)")
                    LeaderRow(label: "subsystem", value: "\(movement.subsystemName)/\(movement.subsystemKind)")
                    LeaderRow(label: "intended", value: "\(SatFormat.signed(movement.intendedBalanceSats)) sats")
                    LeaderRow(label: "fee", value: "\(SatFormat.sats(movement.offchainFeeSats)) sats")
                    LeaderRow(label: "created", value: BarkDate.display(movement.createdAt))
                    if let completed = movement.completedAt {
                        LeaderRow(label: "completed", value: BarkDate.display(completed))
                    }
                }

                ForEach(movement.sentTo, id: \.self) { value in
                    copyBlock(title: "sent to", value: value)
                }
                ForEach(movement.receivedOn, id: \.self) { value in
                    copyBlock(title: "received on", value: value)
                }
                if let hash = movement.paymentHash {
                    copyBlock(title: "payment hash", value: hash)
                }
                if let invoice = movement.lightningInvoice {
                    copyBlock(title: "invoice", value: invoice)
                }
                if !movement.outputVtxoIds.isEmpty {
                    copyBlock(title: "output VTXOs", value: movement.outputVtxoIds.joined(separator: "\n"))
                }
                if !movement.inputVtxoIds.isEmpty {
                    copyBlock(title: "input VTXOs", value: movement.inputVtxoIds.joined(separator: "\n"))
                }
            }
            .padding(20)
        }
        .background(t.papier)
    }

    private func copyBlock(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(PixelFont.body(12))
                .foregroundStyle(t.dim)
            Text(value)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(t.creme)
                .textSelection(.enabled)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(t.bgLo)
                .overlay(Rectangle().stroke(t.line, lineWidth: 2))
        }
    }
}
