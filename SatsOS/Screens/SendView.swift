import Bark
import SwiftUI

/// send.exe — paste/scan anything Bark understands (Ark address, BOLT11,
/// BOLT12, lightning address, LNURL, bitcoin: URI, on-chain address),
/// review the fee, confirm, pay.
struct SendView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.sats) private var t
    var close: () -> Void

    enum Stage: Equatable {
        case input
        case review
        case sending
        case done
        case failed(String)
    }

    enum LightningProgress: Equatable {
        case routing, paid, failed(String)
    }

    @State private var stage: Stage = .input
    @State private var input = ""
    @State private var parsing = false
    @State private var parseError: String?
    @State private var request: PaymentRequest?
    @State private var selected: AvailablePaymentMethod?
    @State private var invoiceDetails: Bolt11InvoiceDetails?
    @State private var amountText = ""
    @State private var comment = ""
    @State private var fee: FeeEstimate?
    @State private var feeError: String?
    @State private var showScanner = false
    @State private var confirming = false
    @State private var result: PaymentResult?
    @State private var sentAmount: UInt64?
    @State private var lightning: LightningProgress?
    @State private var successLine = BittyLines.success.randomElement() ?? "+1 EXP"

    var body: some View {
        ZStack {
            ScrollView {
                VStack(spacing: 24) {
                    switch stage {
                    case .input: inputStage
                    case .review: reviewStage
                    case .sending: sendingStage
                    case .done: doneStage
                    case .failed(let message): failedStage(message)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 22)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)

            if confirming {
                confirmDialog
                    .transition(.opacity)
                    .zIndex(3)
            }
        }
        .fullScreenCover(isPresented: $showScanner) {
            ScannerScreen { code in
                showScanner = false
                input = code
                Task { await parse() }
            } onCancel: {
                showScanner = false
            }
            .environment(\.sats, t)
        }
        .task(id: feeKey) {
            await estimateFee()
        }
    }

    // MARK: - Derived

    private var requiresAmount: Bool { selected?.requiresAmount ?? true }

    private var typedAmount: UInt64? {
        guard let value = UInt64(amountText), value > 0 else { return nil }
        return value
    }

    /// What will be paid, for display and fee estimation.
    private var displayAmount: UInt64? {
        requiresAmount ? typedAmount : (invoiceDetails?.amountSats ?? request?.amountSats)
    }

    private var feeKey: String {
        "\(selected?.method.value ?? "-")|\(displayAmount ?? 0)|\(stage == .review)"
    }

    private var total: UInt64? {
        guard let amount = displayAmount else { return nil }
        return amount + (fee?.feeSats ?? 0)
    }

    private var insufficient: Bool {
        guard let total else { return false }
        return total > store.spendable
    }

    private var canSend: Bool {
        guard let selected else { return false }
        if !selected.errors.isEmpty { return false }
        if requiresAmount && typedAmount == nil { return false }
        return !insufficient
    }

    // MARK: - Stages

    private var inputStage: some View {
        VStack(spacing: 22) {
            PixelWindow(title: "send.exe", status: "READY", statusColor: t.encre, blinkStatus: true) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 2) {
                        Text("> 宛先を入力 / paste or scan")
                            .font(PixelFont.body(14))
                            .foregroundStyle(t.creme)
                        BlinkingCursor()
                            .font(PixelFont.body(14))
                    }
                    TextEditor(text: $input)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 110)
                        .pixelField()
                    Text("Ark address · ⚡ invoice / offer · lightning address · LNURL · bitcoin: URI · on-chain address")
                        .font(PixelFont.body(11))
                        .foregroundStyle(t.dim)
                    HStack(spacing: 12) {
                        PixelButton("▣ Scan", kind: .secondary) { showScanner = true }
                        PixelButton("⎘ Paste", kind: .secondary) { paste() }
                    }
                    if let parseError {
                        Text("[ !! ] \(parseError)")
                            .font(PixelFont.body(12))
                            .foregroundStyle(t.braise)
                    }
                }
            }

            PixelButton(parsing ? "decoding…" : "Next ▶︎", sound: .select) {
                Task { await parse() }
            }
            .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || parsing)

            LeaderRow(label: "spendable", value: SatFormat.amount(store.spendable, unit: settings.unit))
                .padding(.horizontal, 4)
        }
    }

    @ViewBuilder
    private var reviewStage: some View {
        if let selected {
            VStack(spacing: 22) {
                PixelWindow(title: "send.exe — review", status: selected.method.rail, statusColor: t.encre) {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(selected.method.typeLabel)
                            .font(PixelFont.ui(14, bold: true))
                            .foregroundStyle(t.onEncre)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(t.encre)

                        Text(selected.method.value)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(t.creme)
                            .lineLimit(3)
                            .truncationMode(.middle)
                            .textSelection(.enabled)

                        if let options = request?.options, options.count > 1 {
                            Text("支払い方法を選択 / pick a rail")
                                .font(PixelFont.body(12))
                                .foregroundStyle(t.dim)
                            HStack(spacing: 8) {
                                ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                                    PixelChip(title: shortLabel(option.method), selected: option.method == selected.method) {
                                        select(option)
                                    }
                                }
                            }
                        }

                        ForEach(Array(selected.errors.enumerated()), id: \.offset) { _, problem in
                            Text("[ !! ] \(problem.message)")
                                .font(PixelFont.body(12))
                                .foregroundStyle(t.braise)
                        }

                        if let memo = invoiceDetails?.description, !memo.isEmpty {
                            LeaderRow(label: "memo", value: memo)
                        }
                        if let label = request?.label ?? request?.message {
                            LeaderRow(label: "label", value: label)
                        }
                        if let expires = invoiceDetails?.expiresAt,
                           Double(expires) < Date().timeIntervalSince1970 {
                            Text("[ !! ] この invoice は期限切れです / expired")
                                .font(PixelFont.body(12))
                                .foregroundStyle(t.braise)
                        }

                        amountSection

                        if selected.method.acceptsComment {
                            TextField("comment (optional)", text: $comment)
                                .pixelField()
                        }

                        VStack(spacing: 8) {
                            LeaderRow(label: "fee", value: feeText, valueColor: t.encre)
                            if let total {
                                LeaderRow(label: "total", value: SatFormat.amount(total, unit: settings.unit),
                                          valueColor: insufficient ? t.braise : t.creme)
                            }
                            LeaderRow(label: "spendable", value: SatFormat.amount(store.spendable, unit: settings.unit))
                        }
                        if insufficient {
                            Text("[ !! ] 残高が足りません / insufficient funds")
                                .font(PixelFont.body(12))
                                .foregroundStyle(t.braise)
                        }
                        if store.network.isRealMoney {
                            Text("MAINNET — 本物のビットコインが動きます")
                                .font(PixelFont.body(11))
                                .foregroundStyle(t.braise)
                        }
                    }
                }

                PixelButton("Send ▶︎", sound: .select) {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    withAnimation(.linear(duration: 0.1)) { confirming = true }
                }
                .disabled(!canSend)

                PixelButton("Back", kind: .secondary) {
                    stage = .input
                }
            }
        }
    }

    @ViewBuilder
    private var amountSection: some View {
        if requiresAmount {
            VStack(alignment: .leading, spacing: 8) {
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
                        let digits = String(value.filter(\.isNumber).prefix(15))
                        if digits != value { amountText = digits }
                    }
                HStack(spacing: 8) {
                    ForEach([1_000, 10_000, 21_000, 100_000], id: \.self) { preset in
                        PixelChip(title: preset >= 1000 ? "\(preset / 1000)k" : "\(preset)", selected: typedAmount == UInt64(preset)) {
                            amountText = String(preset)
                        }
                    }
                }
            }
        } else if let amount = displayAmount {
            VStack(alignment: .leading, spacing: 4) {
                Text("AMOUNT")
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.dim)
                BalanceText(sats: amount, unit: settings.unit)
            }
        } else {
            Text("金額は宛先に含まれています / amount set by recipient")
                .font(PixelFont.body(12))
                .foregroundStyle(t.dim)
        }
    }

    private var sendingStage: some View {
        VStack(spacing: 22) {
            PixelWindow(title: "send.exe", status: "BUSY", statusColor: t.encre, blinkStatus: true) {
                VStack(alignment: .leading, spacing: 10) {
                    BootLogRow(line: BootLine(status: .ok, name: "sign.sys", detail: "signed"))
                    BootLogRow(line: BootLine(status: .busy, name: selected?.method.rail ?? "ark.drv", detail: "broadcasting"))
                    SegmentProgress(progress: 0.6)
                }
            }
            BittyView(scale: 1.6, hopHeight: 16)
        }
        .padding(.top, 30)
    }

    private var doneStage: some View {
        VStack(spacing: 18) {
            BlackletterTitle(text: lightning == .routing ? "Routing…" : "Complete!", size: 54)
                .padding(.top, 20)
            BittyView(scale: 1.8, hopHeight: lightning == .routing ? 6 : 18)
            Text(lightning == .routing ? "⚡ ルーティング中… しばらくお待ちください" : successLine)
                .font(PixelFont.body(15))
                .foregroundStyle(t.encre)

            PixelWindow(title: "receipt.txt") {
                VStack(spacing: 8) {
                    if let sentAmount {
                        LeaderRow(label: "amount", value: SatFormat.amount(sentAmount, unit: settings.unit))
                    }
                    if let selected {
                        LeaderRow(label: "rail", value: selected.method.rail)
                        LeaderRow(label: "to", value: selected.method.value, monospaced: true)
                    }
                    if let result {
                        switch result {
                        case .ark(let movementId):
                            LeaderRow(label: "movement", value: "#\(movementId)")
                        case .onchain(let txid):
                            LeaderRow(label: "txid", value: txid, monospaced: true)
                        case .lightning(_, let paymentHash):
                            LeaderRow(label: "hash", value: paymentHash, monospaced: true)
                            LeaderRow(label: "status", value: lightningStatusText,
                                      valueColor: lightning == .paid ? t.encre : t.creme)
                        }
                    }
                }
            }

            PixelButton("Done / 閉じる") { close() }
            PixelButton("Send another", kind: .secondary) { reset() }
        }
    }

    private func failedStage(_ message: String) -> some View {
        VStack(spacing: 22) {
            PixelWindow(title: "send.exe", status: "ERROR", statusColor: t.braise) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("[FAIL] 送金できませんでした")
                        .font(PixelFont.ui(16, bold: true))
                        .foregroundStyle(t.braise)
                    Text(message)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(t.creme)
                        .textSelection(.enabled)
                }
            }
            PixelButton("Retry") { stage = .review }
            PixelButton("Back", kind: .secondary) { reset() }
        }
    }

    // MARK: - Confirm dialog (RPG style)

    private var confirmDialog: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture { confirming = false }
            VStack(alignment: .leading, spacing: 16) {
                Text("本当に送りますか？")
                    .font(PixelFont.body(18))
                    .foregroundStyle(t.creme)
                if let amount = displayAmount {
                    Text("\(SatFormat.sats(amount)) sats ⇢ \(selected.map { shortLabel($0.method) } ?? "")")
                        .font(PixelFont.ui(20, bold: true))
                        .foregroundStyle(t.encre)
                }
                if let fee {
                    Text("fee \(SatFormat.sats(fee.feeSats)) sats")
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.dim)
                }
                HStack(spacing: 14) {
                    PixelButton("▶︎ はい / YES", sound: .send) {
                        confirming = false
                        Task { await send() }
                    }
                    PixelButton("いいえ", kind: .secondary) {
                        confirming = false
                    }
                }
            }
            .pixelBox(t, padding: 20)
            .padding(.horizontal, 24)
        }
    }

    // MARK: - Actions

    private func paste() {
        guard let text = UIPasteboard.general.string, !text.isEmpty else {
            parseError = "クリップボードが空です / clipboard is empty"
            return
        }
        input = text
        Task { await parse() }
    }

    private func parse() async {
        parseError = nil
        parsing = true
        defer { parsing = false }
        do {
            let parsed = try await store.parse(input)
            request = parsed
            guard let choice = parsed.defaultOption ?? parsed.options.first else {
                parseError = "支払える宛先が見つかりません / nothing payable found"
                return
            }
            amountText = ""
            comment = ""
            select(choice)
            stage = .review
        } catch {
            parseError = error.barkMessage
            Chiptune.shared.play(.error)
            Haptics.error()
        }
    }

    private func select(_ option: AvailablePaymentMethod) {
        selected = option
        fee = nil
        feeError = nil
        if case .invoice(let invoice) = option.method {
            invoiceDetails = try? decodeBolt11Invoice(invoice: invoice)
        } else {
            invoiceDetails = nil
        }
        if option.requiresAmount, amountText.isEmpty, let amount = request?.amountSats {
            amountText = String(amount)
        }
    }

    private func estimateFee() async {
        guard stage == .review, let method = selected?.method, let amount = displayAmount else {
            fee = nil
            return
        }
        try? await Task.sleep(nanoseconds: 350_000_000)
        guard !Task.isCancelled else { return }
        do {
            fee = try await store.estimateFee(method, amount: amount)
            feeError = nil
        } catch {
            fee = nil
            feeError = error.barkMessage
        }
    }

    private func send() async {
        guard let method = selected?.method else { return }
        let amount: UInt64? = requiresAmount ? typedAmount : nil
        sentAmount = displayAmount
        stage = .sending
        do {
            let paid = try await store.pay(method, amount: amount, comment: comment.isEmpty ? nil : comment)
            result = paid
            if case .lightning(_, let paymentHash) = paid {
                lightning = .routing
                stage = .done
                Chiptune.shared.play(.select)
                await followLightning(paymentHash)
            } else {
                lightning = nil
                stage = .done
                Chiptune.shared.play(.coin)
                Haptics.success()
                store.celebrate()
            }
        } catch {
            stage = .failed(error.barkMessage)
            Chiptune.shared.play(.error)
            Haptics.error()
        }
    }

    private func followLightning(_ paymentHash: String) async {
        do {
            let status = try await store.waitForLightningSend(paymentHash: paymentHash)
            switch status {
            case .paid:
                lightning = .paid
                Chiptune.shared.play(.coin)
                Haptics.success()
                store.celebrate()
            case .inProgress:
                lightning = .routing
            case .unknown:
                lightning = .failed("unknown")
            }
        } catch {
            lightning = .failed(error.barkMessage)
            Chiptune.shared.play(.error)
            Haptics.error()
        }
    }

    private func reset() {
        stage = .input
        input = ""
        request = nil
        selected = nil
        invoiceDetails = nil
        amountText = ""
        comment = ""
        fee = nil
        result = nil
        sentAmount = nil
        lightning = nil
        successLine = BittyLines.success.randomElement() ?? "+1 EXP"
    }

    // MARK: - Text helpers

    private var feeText: String {
        if let fee { return "\(SatFormat.sats(fee.feeSats)) sats" }
        if let feeError { return "? (\(feeError.prefix(40)))" }
        return displayAmount == nil ? "—" : "estimating…"
    }

    private var lightningStatusText: String {
        switch lightning {
        case .routing: return "routing ⚡"
        case .paid: return "PAID ✓"
        case .failed(let reason): return "FAILED (\(reason.prefix(40)))"
        case .none: return "—"
        }
    }

    private func shortLabel(_ method: PaymentMethod) -> String {
        switch method {
        case .ark: return "ARK"
        case .bitcoin, .outputScript: return "ON-CHAIN"
        case .invoice, .offer, .lightningAddress, .lnurl: return "⚡ LN"
        case .custom: return "?"
        }
    }
}
