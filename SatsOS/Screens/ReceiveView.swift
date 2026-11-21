import Bark
import SwiftUI

/// もらう: show an Ark address, or make a Lightning invoice.
struct ReceiveView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    var close: () -> Void

    enum Rail: String, CaseIterable, Identifiable {
        case ark, lightning
        var id: String { rawValue }
        var label: String { self == .ark ? "Ark" : "ライトニング" }
    }

    @State private var rail: Rail = .ark
    @State private var railForward = true

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
    @State private var arrival: IncomingPayment?

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                SheetHeader(title: "もらう", onClose: { close() })
                ScrollView {
                    VStack(spacing: 18) {
                        HStack(spacing: 10) {
                            ForEach(Rail.allCases) { item in
                                InkChip(title: item.label, selected: rail == item) { switchRail(to: item) }
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
                    .padding(.vertical, 12)
                    .frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .background(PaperBackground())

            if let arrival {
                ReceivedPanel(payment: arrival) {
                    withAnimation(.easeOut(duration: 0.2)) { self.arrival = nil }
                }
                .transition(.opacity)
                .zIndex(3)
            }
        }
        .onAppear { store.receiveOnScreen = true }
        .onDisappear { store.receiveOnScreen = false }
        .onChange(of: store.lastIncoming) { _, incoming in
            guard let incoming else { return }
            // a paid invoice on screen shows it in place
            if let hash = incoming.paymentHash, hash == invoice?.paymentHash { return }
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            withAnimation(.spring(duration: 0.4)) { arrival = incoming }
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

    private var railTransition: AnyTransition {
        let distance: CGFloat = railForward ? 36 : -36
        return .asymmetric(
            insertion: .offset(x: distance).combined(with: .opacity),
            removal: .offset(x: -distance).combined(with: .opacity)
        )
    }

    private func switchRail(to item: Rail) {
        guard item != rail else { return }
        railForward = item == .lightning
        withAnimation(.spring(duration: 0.35, bounce: 0.15)) { rail = item }
    }

    // MARK: Ark

    private var arkSection: some View {
        VStack(spacing: 16) {
            VStack(spacing: 14) {
                if let arkAddress {
                    QRCodeView(content: arkAddress)
                        .frame(maxWidth: 300)
                    Text(arkAddress)
                        .font(Brush.mono(12))
                        .foregroundStyle(Ink.ink)
                        .multilineTextAlignment(.center)
                        .textSelection(.enabled)
                    HStack(spacing: 12) {
                        InkButton(copied ? "コピーした" : "コピー", icon: copied ? .check : .copy, height: 48) { copy(arkAddress) }
                            .pop(trigger: copyTick, from: 0.92)
                        ShareLink(item: arkAddress) {
                            HStack(spacing: 8) {
                                InkIcon(kind: .share, size: 18, lineWidth: 2.2)
                                Text("おくる")
                            }
                        }
                        .buttonStyle(InkButtonStyle(kind: .secondary, height: 48))
                    }
                    waiting(text: "まっています")
                } else if let arkError {
                    Text(arkError)
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.alert)
                } else {
                    HStack(spacing: 8) {
                        InkDots(size: 5)
                        Text("アドレスを つくっています")
                            .font(Brush.text(14))
                            .foregroundStyle(Ink.sub)
                    }
                    .frame(minHeight: 200)
                }
            }
            .frame(maxWidth: .infinity)
            .inkCard()

            InkButton(loadingAddress ? "つくっています…" : "あたらしい アドレス", icon: .refresh, kind: .quiet, height: 48) {
                Task { await loadArkAddress() }
            }
            .disabled(loadingAddress)

            Text("Ark アドレスは、同じ Ark サーバーを使う おさいふ同士で すぐに送りあえます。")
                .font(Brush.text(12))
                .foregroundStyle(Ink.sub)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let faucet = store.network.faucetURL {
                Link(destination: faucet) {
                    Text("テスト用コインを もらう ↗︎")
                        .font(Brush.bold(14))
                        .foregroundStyle(Ink.ink)
                        .underline()
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func waiting(text: String) -> some View {
        HStack(spacing: 8) {
            Text(text)
                .font(Brush.text(13))
                .foregroundStyle(Ink.sub)
            InkDots(color: Ink.sub, size: 4)
        }
        .padding(.top, 2)
    }

    // MARK: Lightning

    @ViewBuilder
    private var lightningSection: some View {
        if let invoice {
            invoiceView(invoice)
                .transition(.offset(y: 16).combined(with: .opacity))
        } else {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(text: "もらう金額")
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        TextField("0", text: $amountText)
                            .keyboardType(.numberPad)
                            .font(Brush.amount(40))
                            .foregroundStyle(Ink.ink)
                            .onChange(of: amountText) { _, value in
                                let digits = String(value.filter(\.isNumber).prefix(12))
                                if digits != value { amountText = digits }
                            }
                        Text("sats")
                            .font(Brush.text(18))
                            .foregroundStyle(Ink.ink)
                    }
                    HStack(spacing: 8) {
                        ForEach([1_000, 5_000, 21_000, 100_000], id: \.self) { preset in
                            InkChip(title: SatFormat.sats(UInt64(preset)), selected: UInt64(amountText) == UInt64(preset)) {
                                amountText = String(preset)
                            }
                        }
                    }
                    TextField("メモ（なくてもOK）", text: $memo)
                        .font(Brush.text(15))
                        .padding(12)
                        .background(Ink.paper, in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).strokeBorder(Ink.line, lineWidth: 1))
                    if let receiveFee {
                        InfoRow(label: "てすうりょう", value: "\(SatFormat.sats(receiveFee.feeSats)) sats")
                        InfoRow(label: "うけとる金額", value: "\(SatFormat.sats(receiveFee.netAmountSats)) sats", emphasized: true)
                    }
                    if let invoiceError {
                        Text(invoiceError)
                            .font(Brush.text(13))
                            .foregroundStyle(Ink.alert)
                    }
                }
                .inkCard()

                InkButton(creatingInvoice ? "つくっています…" : "請求書（invoice）を つくる", sound: .select) {
                    Task { await createInvoice() }
                }
                .disabled((UInt64(amountText) ?? 0) == 0 || creatingInvoice)

                Text("どのライトニングのおさいふからでも 払ってもらえます。うけとるまで アプリを ひらいたままにしてください。")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .transition(.opacity)
        }
    }

    private func invoiceView(_ invoice: LightningInvoice) -> some View {
        let paid = store.settledInvoices.contains(invoice.paymentHash)
        return VStack(spacing: 16) {
            if paid {
                VStack(spacing: 10) {
                    InkIcon(kind: .check, size: 26, lineWidth: 2.2, color: Ink.paper)
                        .frame(width: 52, height: 52)
                        .background(Ink.orange, in: Circle())
                        .pop(trigger: 1, from: 0.5)
                    Text("うけとりました")
                        .font(Brush.bold(22))
                        .foregroundStyle(Ink.ink)
                    CountUpText(value: invoice.amountSats) { "+" + SatFormat.amount($0, unit: settings.unit) }
                        .font(Brush.amount(34))
                        .foregroundStyle(Ink.ink)
                }
                .frame(maxWidth: .infinity)
                .inkCard()
                .transition(.scale(scale: 0.9).combined(with: .opacity))
            } else {
                VStack(spacing: 14) {
                    QRCodeView(content: invoice.invoice)
                        .frame(maxWidth: 300)
                    AmountText(sats: invoice.amountSats, unit: settings.unit, size: 34)
                    Text(invoice.invoice)
                        .font(Brush.mono(11))
                        .foregroundStyle(Ink.sub)
                        .lineLimit(2)
                        .truncationMode(.middle)
                        .textSelection(.enabled)
                    HStack(spacing: 12) {
                        InkButton(copied ? "コピーした" : "コピー", icon: copied ? .check : .copy, height: 48) { copy(invoice.invoice) }
                            .pop(trigger: copyTick, from: 0.92)
                        ShareLink(item: invoice.invoice) {
                            HStack(spacing: 8) {
                                InkIcon(kind: .share, size: 18, lineWidth: 2.2)
                                Text("おくる")
                            }
                        }
                        .buttonStyle(InkButtonStyle(kind: .secondary, height: 48))
                    }
                    if claiming {
                        HStack(spacing: 8) {
                            InkDots(size: 4)
                            Text("うけとり中")
                                .font(Brush.text(13))
                                .foregroundStyle(Ink.ink)
                        }
                        .transition(.opacity)
                    } else {
                        waiting(text: "はらってもらうのを まっています")
                            .transition(.opacity)
                    }
                }
                .frame(maxWidth: .infinity)
                .inkCard()
                .animation(.easeOut(duration: 0.2), value: claiming)
                .transition(.opacity)
            }

            InkButton(paid ? "あたらしい請求書" : "やめる・金額を かえる", kind: .secondary, height: 48) {
                withAnimation(.easeOut(duration: 0.2)) {
                    self.invoice = nil
                    receiveState = nil
                    copied = false
                }
            }
        }
        .animation(.spring(duration: 0.45), value: paid)
    }

    private var claiming: Bool {
        switch receiveState {
        case "htlcs-ready", "preimage-revealed", "delivering": return true
        default: return false
        }
    }

    // MARK: Actions

    private func loadArkAddress() async {
        loadingAddress = true
        defer { loadingAddress = false }
        do {
            let address = try await store.newArkAddress()
            withAnimation(.easeOut(duration: 0.2)) { arkAddress = address }
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
            withAnimation(.spring(duration: 0.4)) { invoice = created }
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

/// Over the receive sheet when sats arrive: the amount, and how they got
/// here as a diagram.
struct ReceivedPanel: View {
    @EnvironmentObject private var settings: AppSettings
    var payment: IncomingPayment
    var onClose: () -> Void

    private var scene: ArkScene { payment.rail == "Ark" ? .arkoor : .lightning }

    var body: some View {
        ZStack {
            Ink.bg.opacity(0.92)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 10) {
                    InkIcon(kind: .check, size: 18, lineWidth: 2.2, color: Ink.paper)
                        .frame(width: 34, height: 34)
                        .background(Ink.orange, in: Circle())
                    VStack(alignment: .leading, spacing: 0) {
                        Text("うけとりました")
                            .font(Brush.bold(16))
                            .foregroundStyle(Ink.ink)
                        Text(payment.rail)
                            .font(Brush.text(12))
                            .foregroundStyle(Ink.sub)
                    }
                }
                CountUpText(value: payment.amount, duration: 0.8) { "+" + SatFormat.amount($0, unit: settings.unit) }
                    .font(Brush.amount(36))
                    .foregroundStyle(Ink.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: "とどいた しくみ")
                    ArkScenePlayer(scene: scene, height: 180, showsBeats: false, showsControls: false)
                }
                InkButton("とじる", action: onClose)
            }
            .inkCard(padding: 20)
            .shadow(color: .black.opacity(0.08), radius: 24, y: 8)
            .padding(.horizontal, 20)
        }
    }
}
