import Bark
import SwiftUI

/// きろく: every movement, newest first.
struct HistoryView: View {
    @EnvironmentObject private var store: WalletStore

    @State private var detail: Movement?
    @State private var filter: Filter = .all

    enum Filter: String, CaseIterable, Identifiable {
        case all, incoming, outgoing
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: return "すべて"
            case .incoming: return "もらった"
            case .outgoing: return "おくった"
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
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("きろく")
                        .font(Brush.bold(26, relativeTo: .title))
                        .foregroundStyle(Ink.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("\(store.movements.count) 件")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                        .contentTransition(.numericText())
                }
                .padding(.top, 14)

                if !store.movements.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(Filter.allCases) { item in
                            InkChip(title: item.label, selected: filter == item) {
                                withAnimation(.easeOut(duration: 0.2)) { filter = item }
                            }
                        }
                    }
                }

                if rows.isEmpty {
                    HStack(alignment: .bottom, spacing: 12) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("まだ ありません")
                                .font(Brush.bold(16))
                                .foregroundStyle(Ink.ink)
                            Text(store.movements.isEmpty
                                 ? "下に引っぱると 同期します"
                                 : "この条件の きろくは ありません")
                                .font(Brush.text(13))
                                .foregroundStyle(Ink.sub)
                        }
                        Spacer(minLength: 8)
                        CharacterView(art: .frogSit, height: 56)
                            .breathing(0.04, period: 1.2)
                    }
                    .inkCard()
                    .appearIn()
                } else {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(rows.enumerated()), id: \.element.id) { index, movement in
                            Button {
                                Chiptune.shared.play(.select)
                                Haptics.tap()
                                detail = movement
                            } label: {
                                TransactionRow(movement: movement)
                                    .padding(.horizontal, 16)
                            }
                            .buttonStyle(RowPressStyle())
                            .appearIn(delay: index < 12 ? Double(index) * 0.03 : 0, distance: 8)
                            if index < rows.count - 1 {
                                DashedDivider().padding(.horizontal, 16)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                    .background(Ink.paper, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Ink.line, lineWidth: 1.5))
                    .id(filter)
                    .transition(.opacity)
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .refreshable {
            await store.sync()
        }
        .background(Ink.bg)
        .sheet(item: $detail) { movement in
            MovementDetailView(movement: movement)
                .presentationDetents([.medium, .large])
                .presentationBackground(Ink.bg)
                .presentationCornerRadius(28)
        }
    }
}

private struct RowPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Ink.bg : Color.clear)
    }
}

struct MovementDetailView: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.dismiss) private var dismiss
    var movement: Movement

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SheetHeader(title: movement.title, onClose: { dismiss() })
                    .padding(.horizontal, -20)

                VStack(alignment: .leading, spacing: 4) {
                    Text("\(movement.railName) ・ \(movement.statusText)")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                    CountUpText(value: UInt64(movement.effectiveBalanceSats.magnitude), duration: 0.5) {
                        (movement.effectiveBalanceSats >= 0 ? "+" : "-") + SatFormat.sats($0) + " sats"
                    }
                    .font(Brush.amount(38))
                    .foregroundStyle(Ink.ink)
                }

                VStack(spacing: 12) {
                    InfoRow(label: "じょうたい", value: movement.statusText)
                    InfoRow(label: "しゅるい", value: movement.kindLabel)
                    InfoRow(label: "予定の金額", value: "\(SatFormat.signed(movement.intendedBalanceSats)) sats")
                    InfoRow(label: "てすうりょう", value: "\(SatFormat.sats(movement.offchainFeeSats)) sats")
                    InfoRow(label: "はじまり", value: BarkDate.display(movement.createdAt))
                    if let completed = movement.completedAt {
                        InfoRow(label: "おわり", value: BarkDate.display(completed))
                    }
                    InfoRow(label: "ID", value: "#\(movement.id)")
                }
                .inkCard()

                ForEach(movement.sentTo, id: \.self) { value in
                    CopyBlock(title: "あて先", value: value)
                }
                ForEach(movement.receivedOn, id: \.self) { value in
                    CopyBlock(title: "うけとった アドレス", value: value)
                }
                if let hash = movement.paymentHash {
                    CopyBlock(title: "payment hash", value: hash)
                }
                if let invoice = movement.lightningInvoice {
                    CopyBlock(title: "invoice", value: invoice)
                }
                if !movement.outputVtxoIds.isEmpty {
                    CopyBlock(title: "output VTXO", value: movement.outputVtxoIds.joined(separator: "\n"))
                }
                if !movement.inputVtxoIds.isEmpty {
                    CopyBlock(title: "input VTXO", value: movement.inputVtxoIds.joined(separator: "\n"))
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
        .background(Ink.bg)
    }
}

/// A long value with a copy button.
struct CopyBlock: View {
    var title: String
    var value: String
    @State private var copied = false
    @State private var tick = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionLabel(text: title)
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
                    HStack(spacing: 4) {
                        InkIcon(kind: copied ? .check : .copy, size: 14, lineWidth: 2.2, color: copied ? Ink.paper : Ink.ink)
                        Text(copied ? "コピーした" : "コピー")
                    }
                    .font(Brush.bold(12))
                    .foregroundStyle(copied ? Ink.paper : Ink.ink)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 32)
                    .background(copied ? Ink.ink : Color.clear, in: Capsule())
                    .overlay(Capsule().stroke(Ink.ink, lineWidth: 1.2))
                }
                .buttonStyle(.plain)
                .pop(trigger: tick, from: 0.85)
            }
            Text(value)
                .font(Brush.mono(12))
                .foregroundStyle(Ink.ink)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Ink.paper, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Ink.line, lineWidth: 1.5))
        }
    }
}
