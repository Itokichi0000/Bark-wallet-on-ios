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
    @State private var copyTick = 0

    // motion
    @State private var railForward = true
    /// Ark (or any non-invoice) arrival shown as an overlay.
    @State private var arrival: IncomingPayment?
    @State private var arrivalBalanceFrom: UInt64 = 0
    /// Spendable when the invoice was made, so the paid card can count up.
    @State private var invoiceBalanceFrom: UInt64 = 0

    var body: some View {
        ZStack {
            ScrollView {
                VStack(spacing: 22) {
                    HStack(spacing: 10) {
                        ForEach(Rail.allCases) { item in
                            PixelChip(title: item.label, selected: rail == item) { switchRail(to: item) }
                        }
                    }

                    ZStack(alignment: .top) {
                        Group {
                            switch rail {
                            case .ark: arkSection
                            case .lightning: lightningSection
                            }
                        }
                        .id(rail)
                        .transition(railTransition)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 22)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)

            if let arrival {
                arrivalOverlay(arrival)
                    .transition(.opacity)
                    .zIndex(3)
            }
        }
        .onAppear { store.receiveOnScreen = true }
        .onDisappear { store.receiveOnScreen = false }
        .onChange(of: store.lastIncoming) { _, incoming in
            guard let incoming else { return }
            // an invoice on screen celebrates inline instead
            if let hash = incoming.paymentHash, hash == invoice?.paymentHash { return }
            arrivalBalanceFrom = store.spendable >= incoming.amount ? store.spendable - incoming.amount : 0
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            withAnimation(.linear(duration: 0.12)) { arrival = incoming }
        }
        .task {
            if arkAddress == nil { await loadArkAddress() }
            #if DEBUG
            if Autopilot.fakeIncoming {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                store.simulateIncoming(21_000)
            }
            #endif
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
                                .pixelPop(trigger: copyTick, from: 0.9)
                            ShareLink(item: arkAddress) {
                                Text("⇪ Share")
                            }
                            .buttonStyle(PixelButtonStyle(kind: .secondary, theme: t))
                        }
                        HStack(spacing: 8) {
                            SignalBars()
                            LoadingDots(text: "着金を待機中 / listening")
                                .font(PixelFont.body(13))
                                .foregroundStyle(t.dim)
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
                    Text("> signet faucet でテストコインをもらう ↗︎")
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
                .transition(.offset(y: 16).combined(with: .opacity))
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
            .transition(.opacity)
        }
    }

    private func invoiceView(_ invoice: LightningInvoice) -> some View {
        let paid = store.settledInvoices.contains(invoice.paymentHash)
        return VStack(spacing: 22) {
            if paid {
                ReceivedCard(
                    amount: invoice.amountSats,
                    rail: "⚡ LN",
                    balanceFrom: invoiceBalanceFrom,
                    balanceTo: store.spendable
                )
                .transition(.scale(scale: 0.9).combined(with: .opacity))
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
                                .pixelPop(trigger: copyTick, from: 0.9)
                            ShareLink(item: invoice.invoice) {
                                Text("⇪ Share")
                            }
                            .buttonStyle(PixelButtonStyle(kind: .secondary, theme: t))
                        }
                        if stateLabel == "CLAIMING" {
                            VStack(alignment: .leading, spacing: 10) {
                                PacketTransfer(from: "⚡ LN", to: "YOU")
                                HStack(spacing: 8) {
                                    PixelSpinner()
                                    LoadingDots(text: "受け取り処理中 / claiming")
                                        .font(PixelFont.body(13))
                                        .foregroundStyle(t.encre)
                                }
                            }
                            .transition(.opacity)
                        } else {
                            HStack(spacing: 8) {
                                SignalBars()
                                LoadingDots(text: "支払い待ち / waiting for payment")
                                    .font(PixelFont.body(13))
                                    .foregroundStyle(t.dim)
                            }
                            .transition(.opacity)
                        }
                    }
                    .animation(.linear(duration: 0.15), value: stateLabel)
                }
                .transition(.opacity)
            }

            PixelButton(paid ? "New invoice" : "Cancel / 別の金額", kind: .secondary) {
                withAnimation(.easeOut(duration: 0.2)) {
                    self.invoice = nil
                    receiveState = nil
                    copied = false
                }
            }
        }
        .animation(.easeOut(duration: 0.25), value: paid)
    }

    // MARK: Arrival overlay

    private func arrivalOverlay(_ payment: IncomingPayment) -> some View {
        ZStack {
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture { dismissArrival() }
            ScrollView {
                VStack(spacing: 18) {
                    ReceivedCard(
                        amount: payment.amount,
                        rail: payment.rail,
                        balanceFrom: arrivalBalanceFrom,
                        balanceTo: store.spendable
                    )
                    PixelButton("OK ▶︎", sound: .select) { dismissArrival() }
                }
                .padding(20)
                .background(t.papier)
                .overlay(Rectangle().stroke(t.encre, lineWidth: 3))
                .background(Rectangle().fill(t.braise).offset(x: 6, y: 6))
                .padding(.horizontal, 22)
                .padding(.vertical, 40)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .id(payment.id)
    }

    private func dismissArrival() {
        withAnimation(.linear(duration: 0.12)) { arrival = nil }
    }

    private var railTransition: AnyTransition {
        let distance: CGFloat = railForward ? 30 : -30
        return .asymmetric(
            insertion: .offset(x: distance).combined(with: .opacity),
            removal: .offset(x: -distance).combined(with: .opacity)
        )
    }

    private func switchRail(to item: Rail) {
        guard item != rail else { return }
        railForward = item == .lightning
        withAnimation(.easeOut(duration: 0.22)) { rail = item }
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
            let created = try await store.newInvoice(amount: amount, memo: memo)
            invoiceBalanceFrom = store.spendable
            withAnimation(.easeOut(duration: 0.22)) { invoice = created }
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
        copyTick += 1
        Haptics.success()
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            copied = false
        }
    }
}

// MARK: - Received card

/// The "sats arrived" moment: title pop, amount counting up, bitty jumping,
/// a deposit slip whose balance rolls from old to new, and a stamp.
struct ReceivedCard: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.sats) private var t
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var amount: UInt64
    var rail: String
    var balanceFrom: UInt64
    var balanceTo: UInt64

    @State private var titleTick = 0
    @State private var stampTick = 0
    @State private var stampVisible = false
    @State private var slipVisible = false
    @State private var line = BittyLines.received.randomElement() ?? "+1 EXP"

    var body: some View {
        VStack(spacing: 14) {
            BlackletterTitle(text: "Received!", size: 54)
                .pixelPop(trigger: titleTick)

            Text(rail)
                .font(PixelFont.ui(13, bold: true))
                .foregroundStyle(t.onEncre)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(t.encre)

            CountUpText(value: amount, duration: 0.9) { "+" + SatFormat.amount($0, unit: settings.unit) }
                .font(PixelFont.ui(38, bold: true))
                .foregroundStyle(t.encre)
                .shadow(color: t.rouille, radius: 0, x: 3, y: 3)
                .lineLimit(1)
                .minimumScaleFactor(0.5)

            BittyView(scale: 1.8, hopHeight: 24)

            Text(line)
                .font(PixelFont.body(15))
                .foregroundStyle(t.creme)

            PixelWindow(title: "deposit.log") {
                VStack(spacing: 8) {
                    LeaderRow(label: "rail", value: rail)
                    LeaderRow(label: "amount", value: "+" + SatFormat.amount(amount, unit: settings.unit), valueColor: t.encre)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("balance")
                            .font(PixelFont.body(14))
                            .foregroundStyle(t.dim)
                        DottedLine()
                            .stroke(t.line, style: StrokeStyle(lineWidth: 2, dash: [2, 4]))
                            .frame(height: 2)
                            .frame(minWidth: 12)
                        if slipVisible {
                            CountUpText(value: balanceTo, from: balanceFrom, duration: 0.8) {
                                SatFormat.amount($0, unit: settings.unit)
                            }
                            .font(PixelFont.body(14))
                            .foregroundStyle(t.creme)
                            .lineLimit(1)
                        } else {
                            Text(SatFormat.amount(balanceFrom, unit: settings.unit))
                                .font(PixelFont.body(14))
                                .foregroundStyle(t.dim)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .overlay(alignment: .bottomTrailing) {
                PixelStamp(text: "RECEIVED ✓", color: t.encre)
                    .opacity(stampVisible ? 1 : 0)
                    .pixelPop(trigger: stampTick, from: 2.2)
                    .offset(x: -12, y: 14)
                    .allowsHitTesting(false)
            }
            .opacity(slipVisible ? 1 : 0)
            .offset(y: slipVisible ? 0 : 10)
        }
        .padding(.top, 6)
        .accessibilityElement(children: .combine)
        .task { await play() }
    }

    private func play() async {
        titleTick += 1
        if reduceMotion {
            slipVisible = true
            stampVisible = true
            return
        }
        // let the coin jingle and the count-up breathe first
        try? await Task.sleep(nanoseconds: 700_000_000)
        guard !Task.isCancelled else { return }
        withAnimation(.easeOut(duration: 0.2)) { slipVisible = true }
        try? await Task.sleep(nanoseconds: 900_000_000)
        guard !Task.isCancelled else { return }
        stampVisible = true
        stampTick += 1
        Haptics.heavy()
        Chiptune.shared.play(.select)
    }
}
