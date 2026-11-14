import Bark
import SwiftUI

/// history.log — every wallet movement as a terminal log.
struct HistoryView: View {
    @EnvironmentObject private var store: WalletStore
    @Environment(\.sats) private var t

    @State private var detail: Movement?
    @State private var filter: Filter = .all

    enum Filter: String, CaseIterable, Identifiable {
        case all, incoming, outgoing
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: return "ALL"
            case .incoming: return "⇠ IN"
            case .outgoing: return "⇢ OUT"
            }
        }
        var grep: String {
            switch self {
            case .all: return ""
            case .incoming: return " | grep IN"
            case .outgoing: return " | grep OUT"
            }
        }
    }

    private var rows: [Movement] {
        switch filter {
        case .all: return store.movements
        case .incoming: return store.movements.filter { $0.effectiveBalanceSats > 0 }
        case .outgoing: return store.movements.filter { $0.effectiveBalanceSats < 0 }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 2) {
                    Text("$ tail -f history.log\(filter.grep)")
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.dim)
                        .lineLimit(1)
                    BlinkingCursor(color: t.dim)
                        .font(PixelFont.body(13))
                    Spacer()
                    Text("\(rows.count) entries")
                        .font(PixelFont.ui(13))
                        .foregroundStyle(t.dim)
                        .contentTransition(.numericText())
                }

                if !store.movements.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(Filter.allCases) { item in
                            PixelChip(title: item.label, selected: filter == item) {
                                withAnimation(.easeOut(duration: 0.2)) { filter = item }
                            }
                        }
                    }
                }

                if rows.isEmpty {
                    PixelWindow(title: "history.log") {
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("(empty)")
                                    .font(PixelFont.ui(16))
                                    .foregroundStyle(t.encre)
                                Text(store.movements.isEmpty
                                     ? "まだ取引がありません。下に引っ張ると同期します。"
                                     : "この条件の取引はありません。")
                                    .font(PixelFont.body(13))
                                    .foregroundStyle(t.dim)
                            }
                            Spacer(minLength: 8)
                            TalkingBitty(scale: 1.0)
                        }
                    }
                    .appearIn()
                } else {
                    PixelWindow(title: "history.log", padding: 0) {
                        LazyVStack(spacing: 0) {
                            ForEach(Array(rows.enumerated()), id: \.element.id) { index, movement in
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
                                .buttonStyle(HistoryRowStyle(theme: t))
                                .appearIn(delay: index < 14 ? Double(index) * 0.035 : 0, distance: 8)
                                Rectangle()
                                    .fill(t.grid)
                                    .frame(height: 2)
                            }
                        }
                    }
                    .id(filter)
                    .transition(.opacity)
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
            Group {
                if movement.isPending {
                    HStack(spacing: 0) {
                        Text("[")
                        PixelSpinner(color: statusColor)
                            .scaleEffect(0.8)
                        Text("]")
                    }
                } else {
                    Text("[\(movement.statusTag)]")
                }
            }
            .font(PixelFont.ui(13))
            .foregroundStyle(statusColor)
            .frame(minWidth: 30, alignment: .leading)
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
                    CountUpText(value: UInt64(movement.effectiveBalanceSats.magnitude), duration: 0.5) {
                        (movement.effectiveBalanceSats >= 0 ? "+" : "-") + SatFormat.sats($0) + " sats"
                    }
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
            HStack {
                Text(title)
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.dim)
                Spacer()
                CopyChip(value: value)
            }
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

/// Row highlight while pressed: an ink bar on the left, like a cursor.
private struct HistoryRowStyle: ButtonStyle {
    var theme: SatsTheme
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? theme.grid : .clear)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(theme.encre)
                    .frame(width: 4)
                    .opacity(configuration.isPressed ? 1 : 0)
            }
    }
}

/// `⎘ copy` → `✓ copied` for a value in the detail sheet.
private struct CopyChip: View {
    @Environment(\.sats) private var t
    var value: String
    @State private var copied = false
    @State private var tick = 0

    var body: some View {
        Button {
            UIPasteboard.general.string = value
            Chiptune.shared.play(.select)
            Haptics.success()
            copied = true
            tick += 1
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                copied = false
            }
        } label: {
            Text(copied ? "✓ copied" : "⎘ copy")
                .font(PixelFont.ui(12, bold: true))
                .foregroundStyle(copied ? t.onEncre : t.encre)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(copied ? t.encre : .clear)
                .overlay(Rectangle().stroke(t.encre, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .pixelPop(trigger: tick, from: 0.85)
    }
}
