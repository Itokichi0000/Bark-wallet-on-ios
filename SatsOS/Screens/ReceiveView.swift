import Bark
import SwiftUI

/// recv.exe — show an Ark address, or create a Lightning invoice.
struct ReceiveView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.sats) private var t

    enum Rail: String, CaseIterable, Identifiable {
        case ark, lightning
        var id: String { rawValue }
        var label: String { self == .ark ? "ARK" : "⚡ LIGHTNING" }
    }

    @State private var rail: Rail = .ark

    // Ark
    @State private var arkAddress: String?
    @State private var arkError: String?
    @State private var loadingAddress = false

    // Lightning
    @State private var amountText = ""
    @State private var memo = ""
    @State private var invoice: LightningInvoice?
    @State private var invoiceError: String?
    @State private var creatingInvoice = false
    @State private var receiveFee: FeeEstimate?
    @State private var receiveState: String?

    @State private var copied = false

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                HStack(spacing: 10) {
                    ForEach(Rail.allCases) { item in
                        PixelChip(title: item.label, selected: rail == item) { rail = item }
                    }
                }

                switch rail {
                case .ark: arkSection
                case .lightning: lightningSection
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 22)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .task {
            if arkAddress == nil { await loadArkAddress() }
        }
        .task(id: invoice?.paymentHash) {
            await watchInvoice()
        }
        .task(id: amountText) {
            await estimateReceiveFee()
        }
    }

    // MARK: Ark

    private var arkSection: some View {
        VStack(spacing: 22) {
            PixelWindow(title: "ark_address.txt", status: store.network.label, statusColor: t.encre) {
                VStack(alignment: .leading, spacing: 14) {
                    if let arkAddress {
                        PixelQRCode(content: arkAddress)
                            .padding(.trailing, 6)
                        Text(arkAddress)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(t.creme)
                            .textSelection(.enabled)
                        HStack(spacing: 12) {
                            PixelButton(copied ? "Copied ✓" : "⎘ Copy") { copy(arkAddress) }
                            ShareLink(item: arkAddress) {
                                Text("⇪ Share")
                            }
                            .buttonStyle(PixelButtonStyle(kind: .secondary, theme: t))
                        }
                    } else if let arkError {
                        Text("[ !! ] \(arkError)")
                            .font(PixelFont.body(12))
                            .foregroundStyle(t.braise)
                    } else {
                        HStack(spacing: 4) {
                            Text("generating address")
                            BlinkingCursor()
                        }
                        .font(PixelFont.body(14))
                        .foregroundStyle(t.dim)
                    }
                }
            }

            PixelButton(loadingAddress ? "…" : "New address / 新しいアドレス", kind: .secondary) {
                Task { await loadArkAddress() }
            }
            .disabled(loadingAddress)

            Text("Ark アドレスは同じ Ark サーバーのウォレット同士で即時に送金できます。")
                .font(PixelFont.body(12))
                .foregroundStyle(t.dim)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let faucet = store.network.faucetURL {
                Link(destination: faucet) {
                    Text("> signet faucet でテストコインをもらう ↗")
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.encre)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    // MARK: Lightning

    @ViewBuilder
    private var lightningSection: some View {
        if let invoice {
            invoiceView(invoice)
        } else {
            VStack(spacing: 22) {
                PixelWindow(title: "invoice.exe") {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("AMOUNT (sats)")
                            .font(PixelFont.body(12))
                            .foregroundStyle(t.dim)
                        TextField("0", text: $amountText)
                            .keyboardType(.numberPad)
                            .font(PixelFont.ui(34, bold: true))
                            .foregroundStyle(t.creme)
                            .tint(t.encre)
                            .padding(10)
                            .background(t.bgLo)
                            .overlay(Rectangle().stroke(t.encre, lineWidth: 2))
                            .onChange(of: amountText) { _, value in
                                let digits = String(value.filter(\.isNumber).prefix(12))
                                if digits != value { amountText = digits }
                            }
                        HStack(spacing: 8) {
                            ForEach([1_000, 5_000, 21_000, 100_000], id: \.self) { preset in
                                PixelChip(title: "\(preset / 1000)k", selected: UInt64(amountText) == UInt64(preset)) {
                                    amountText = String(preset)
                                }
                            }
                        }
                        TextField("memo (optional)", text: $memo)
                            .pixelField()
                        if let receiveFee {
                            LeaderRow(label: "server fee", value: "\(SatFormat.sats(receiveFee.feeSats)) sats", valueColor: t.encre)
                            LeaderRow(label: "you receive", value: "\(SatFormat.sats(receiveFee.netAmountSats)) sats")
                        }
                        if let invoiceError {
                            Text("[ !! ] \(invoiceError)")
                                .font(PixelFont.body(12))
                                .foregroundStyle(t.braise)
                        }
                    }
                }

                PixelButton(creatingInvoice ? "creating…" : "Create invoice ⚡", sound: .select) {
                    Task { await createInvoice() }
                }
                .disabled((UInt64(amountText) ?? 0) == 0 || creatingInvoice)

                Text("Lightning invoice を作ると、どの Lightning ウォレットからでも受け取れます。受け取るまでアプリを開いたままにしてください。")
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.dim)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func invoiceView(_ invoice: LightningInvoice) -> some View {
        let paid = store.settledInvoices.contains(invoice.paymentHash)
        return VStack(spacing: 22) {
            if paid {
                VStack(spacing: 12) {
                    BlackletterTitle(text: "Received!", size: 54)
                    BittyView(scale: 1.8, hopHeight: 18)
                    Text("+\(SatFormat.sats(invoice.amountSats)) sats")
                        .font(PixelFont.ui(30, bold: true))
                        .foregroundStyle(t.encre)
                }
                .padding(.top, 10)
            } else {
                PixelWindow(title: "invoice.bolt11", status: stateLabel, statusColor: t.encre, blinkStatus: true) {
                    VStack(alignment: .leading, spacing: 14) {
                        PixelQRCode(content: invoice.invoice)
                            .padding(.trailing, 6)
                        BalanceText(sats: invoice.amountSats, unit: settings.unit)
                        Text(invoice.invoice)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(t.creme)
                            .lineLimit(3)
                            .truncationMode(.middle)
                            .textSelection(.enabled)
                        HStack(spacing: 12) {
                            PixelButton(copied ? "Copied ✓" : "⎘ Copy") { copy(invoice.invoice) }
                            ShareLink(item: invoice.invoice) {
                                Text("⇪ Share")
                            }
                            .buttonStyle(PixelButtonStyle(kind: .secondary, theme: t))
                        }
                        HStack(spacing: 4) {
                            Text("waiting for payment")
                            BlinkingCursor()
                        }
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.dim)
                    }
                }
            }

            PixelButton(paid ? "New invoice" : "Cancel / 別の金額", kind: .secondary) {
                self.invoice = nil
                receiveState = nil
                copied = false
            }
        }
    }

    private var stateLabel: String {
        switch receiveState {
        case "htlcs-ready", "preimage-revealed", "delivering": return "CLAIMING"
        case "settled": return "PAID"
        default: return "UNPAID"
        }
    }

    // MARK: Actions

    private func loadArkAddress() async {
        loadingAddress = true
        defer { loadingAddress = false }
        do {
            arkAddress = try await store.newArkAddress()
            arkError = nil
            copied = false
        } catch {
            arkError = error.barkMessage
        }
    }

    private func createInvoice() async {
        guard let amount = UInt64(amountText), amount > 0 else { return }
        creatingInvoice = true
        defer { creatingInvoice = false }
        do {
            invoice = try await store.newInvoice(amount: amount, memo: memo)
            invoiceError = nil
            copied = false
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        } catch {
            invoiceError = error.barkMessage
            Chiptune.shared.play(.error)
        }
    }

    private func estimateReceiveFee() async {
        guard let amount = UInt64(amountText), amount > 0 else {
            receiveFee = nil
            return
        }
        try? await Task.sleep(nanoseconds: 350_000_000)
        guard !Task.isCancelled else { return }
        receiveFee = try? await store.lightningReceiveFee(amount: amount)
    }

    /// Polls the receive state while the invoice is on screen. The Bark
    /// daemon claims incoming payments; we nudge it when HTLCs are ready.
    private func watchInvoice() async {
        guard let hash = invoice?.paymentHash else { return }
        var nudged = false
        while !Task.isCancelled {
            if store.settledInvoices.contains(hash) { return }
            if let state = try? await store.receiveState(paymentHash: hash) {
                receiveState = state.state
                if state.state == "settled" {
                    store.markInvoiceSettled(hash)
                    return
                }
                if state.state == "htlcs-ready", !nudged {
                    nudged = true
                    await store.tryClaim(paymentHash: hash)
                }
            }
            try? await Task.sleep(nanoseconds: 3_000_000_000)
        }
    }

    private func copy(_ text: String) {
        UIPasteboard.general.string = text
        copied = true
        Haptics.success()
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            copied = false
        }
    }
}
