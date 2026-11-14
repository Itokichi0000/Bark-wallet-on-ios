import Bark
import SwiftUI

/// send.exe — paste/scan anything Bark understands (Ark address, BOLT11,
/// BOLT12, lightning address, LNURL, bitcoin: URI, on-chain address),
/// review the fee, confirm, pay.
struct SendView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.sats) private var t
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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

    // motion state
    /// Direction of the last stage change, so "Back" slides the other way.
    @State private var forward = true
    @State private var parseErrorTick = 0
    @State private var insufficientTick = 0
    @State private var sendStart = Date()
    @State private var delivered = false
    @State private var titleTick = 0
    @State private var receiptRows = 0
    @State private var stampVisible = false
    @State private var stampTick = 0
    @State private var failTick = 0
    @State private var dialogTick = 0

    var body: some View {
        ZStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 18) {
                        SendSteps(step: stepIndex, failed: isFailed)
                            .id("top")

                        ZStack(alignment: .top) {
                            stageContent
                                .id(stageKey)
                                .transition(stageTransition)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 18)
                    .frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: stageKey) { _, _ in
                    withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("top", anchor: .top) }
                }
            }

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
        .onChange(of: insufficient) { _, isShort in
            if isShort { insufficientTick += 1 }
        }
    }

    @ViewBuilder
    private var stageContent: some View {
        switch stage {
        case .input: inputStage
        case .review: reviewStage
        case .sending: sendingStage
        case .done: doneStage
        case .failed(let message): failedStage(message)
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

    private var stageKey: String {
        switch stage {
        case .input: return "input"
        case .review: return "review"
        case .sending: return "sending"
        case .done: return "done"
        case .failed: return "failed"
        }
    }

    private var isFailed: Bool {
        if case .failed = stage { return true }
        if case .failed = lightning, stage == .done { return true }
        return false
    }

    /// 0 宛先, 1 確認, 2 送金, 3 all done.
    private var stepIndex: Int {
        switch stage {
        case .input: return 0
        case .review: return 1
        case .sending, .failed: return 2
        case .done: return lightning == .routing || isFailed ? 2 : 3
        }
    }

    private var stageTransition: AnyTransition {
        if reduceMotion { return .opacity }
        let distance: CGFloat = forward ? 36 : -36
        return .asymmetric(
            insertion: .offset(x: distance).combined(with: .opacity),
            removal: .offset(x: -distance).combined(with: .opacity)
        )
    }

    private var isEstimatingFee: Bool {
        fee == nil && feeError == nil && displayAmount != nil
    }

    // MARK: - Stages

    private var inputStage: some View {
        VStack(spacing: 22) {
            PixelWindow(title: "send.exe", status: parsing ? "DECODE" : "READY", statusColor: t.encre, blinkStatus: true) {
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
                        .overlay(Rectangle().stroke(parseError == nil ? .clear : t.braise, lineWidth: 2))
                    Text("Ark address · ⚡ invoice / offer · lightning address · LNURL · bitcoin: URI · on-chain address")
                        .font(PixelFont.body(11))
                        .foregroundStyle(t.dim)
                    HStack(spacing: 12) {
                        PixelButton("▣ Scan", kind: .secondary) { showScanner = true }
                        PixelButton("⎘ Paste", kind: .secondary) { paste() }
                    }
                    if parsing {
                        HStack(spacing: 8) {
                            PixelSpinner()
                            LoadingDots(text: "decoding")
                                .font(PixelFont.body(12))
                                .foregroundStyle(t.encre)
                        }
                        .transition(.opacity)
                    }
                    if let parseError {
                        Text("[ !! ] \(parseError)")
                            .font(PixelFont.body(12))
                            .foregroundStyle(t.braise)
                            .transition(.opacity)
                    }
                }
                .animation(.linear(duration: 0.12), value: parsing)
                .animation(.linear(duration: 0.12), value: parseError)
            }
            .pixelShake(trigger: parseErrorTick)

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
                            .id(selected.method.typeLabel)
                            .transition(.opacity)

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
                                        withAnimation(.linear(duration: 0.1)) { select(option) }
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
                            feeRow
                            if let total {
                                LeaderRow(label: "total", value: SatFormat.amount(total, unit: settings.unit),
                                          valueColor: insufficient ? t.braise : t.creme)
                                    .contentTransition(.numericText(value: Double(total)))
                                    .animation(.snappy(duration: 0.25), value: total)
                            }
                            LeaderRow(label: "spendable", value: SatFormat.amount(store.spendable, unit: settings.unit))
                        }
                        if insufficient {
                            Text("[ !! ] 残高が足りません / insufficient funds")
                                .font(PixelFont.body(12))
                                .foregroundStyle(t.braise)
                                .transition(.opacity)
                        }
                        if store.network.isRealMoney {
                            Text("MAINNET — 本物のビットコインが動きます")
                                .font(PixelFont.body(11))
                                .foregroundStyle(t.braise)
                        }
                    }
                    .animation(.linear(duration: 0.12), value: insufficient)
                }

                PixelButton("Send ▶︎", sound: .select) {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    withAnimation(.linear(duration: 0.12)) { confirming = true }
                }
                .disabled(!canSend)

                PixelButton("Back", kind: .secondary) {
                    go(.input, forward: false)
                }
            }
        }
    }

    @ViewBuilder
    private var feeRow: some View {
        if isEstimatingFee {
            HStack(alignment: .center, spacing: 6) {
                Text("fee")
                    .font(PixelFont.body(14))
                    .foregroundStyle(t.dim)
                DottedLine()
                    .stroke(t.line, style: StrokeStyle(lineWidth: 2, dash: [2, 4]))
                    .frame(height: 2)
                    .frame(minWidth: 12)
                PixelSpinner()
                LoadingDots(text: "estimating")
                    .font(PixelFont.body(14))
                    .foregroundStyle(t.dim)
            }
        } else {
            LeaderRow(label: "fee", value: feeText, valueColor: t.encre)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.25), value: feeText)
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
                    .foregroundStyle(insufficient ? t.braise : t.creme)
                    .tint(t.encre)
                    .padding(10)
                    .background(t.bgLo)
                    .overlay(Rectangle().stroke(insufficient ? t.braise : t.encre, lineWidth: 2))
                    .pixelShake(trigger: insufficientTick)
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

    // MARK: sending

    private var sendingRows: [(name: String, busy: String, done: String)] {
        [
            ("tx.build", "building", "built"),
            ("sign.sys", "signing", "signed"),
            (selected?.method.rail ?? "ark.drv", "broadcasting", "sent"),
        ]
    }

    private var sendingStage: some View {
        VStack(spacing: 24) {
            PixelWindow(title: "send.exe", status: delivered ? "SENT" : "BUSY", statusColor: t.encre, blinkStatus: !delivered) {
                VStack(alignment: .leading, spacing: 14) {
                    if let sentAmount {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("-\(SatFormat.amount(sentAmount, unit: settings.unit))")
                                .font(PixelFont.ui(26, bold: true))
                                .foregroundStyle(t.creme)
                                .shadow(color: t.rouille, radius: 0, x: 2, y: 2)
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)
                        }
                    }

                    PacketTransfer(to: selected.map { shortLabel($0.method) } ?? "ARK", delivered: delivered)

                    TimelineView(.periodic(from: sendStart, by: 0.1)) { context in
                        let elapsed = context.date.timeIntervalSince(sendStart)
                        let visible = delivered ? sendingRows.count : 1 + (elapsed > 0.45 ? 1 : 0) + (elapsed > 0.9 ? 1 : 0)
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(0..<visible, id: \.self) { index in
                                let row = sendingRows[index]
                                let ok = delivered || index < visible - 1
                                BootLogRow(line: BootLine(status: ok ? .ok : .busy, name: row.name, detail: ok ? row.done : row.busy))
                                    .transition(.opacity)
                            }
                            // creeps toward 90% while we wait, then snaps full on success
                            SegmentProgress(progress: delivered ? 1 : 0.9 * (1 - exp(-elapsed / 1.6)))
                        }
                        .animation(.linear(duration: 0.1), value: visible)
                    }

                    HStack(spacing: 8) {
                        if delivered {
                            Text("[ OK ] 送信完了")
                                .font(PixelFont.body(13))
                                .foregroundStyle(t.encre)
                        } else {
                            PixelSpinner()
                            LoadingDots(text: "送金中 / transmitting")
                                .font(PixelFont.body(13))
                                .foregroundStyle(t.dim)
                        }
                    }
                }
            }
            BittyView(scale: 1.6, hopHeight: delivered ? 22 : 12)
        }
        .padding(.top, 8)
    }

    // MARK: done

    private var doneTitle: String {
        switch lightning {
        case .routing: return "Routing…"
        case .failed: return "Failed"
        default: return "Complete!"
        }
    }

    private var stamp: (text: String, color: Color)? {
        switch lightning {
        case .routing: return nil
        case .failed: return ("FAILED", t.braise)
        case .paid: return ("PAID ✓", t.encre)
        case .none: return ("SENT ✓", t.encre)
        }
    }

    private var doneStage: some View {
        VStack(spacing: 18) {
            BlackletterTitle(text: doneTitle, size: 54, color: isFailed ? t.braise : nil)
                .pixelPop(trigger: titleTick)
                .padding(.top, 8)
                .contentTransition(.opacity)
                .animation(.linear(duration: 0.12), value: doneTitle)

            if let sentAmount {
                CountUpText(value: sentAmount) { "-" + SatFormat.amount($0, unit: settings.unit) }
                    .font(PixelFont.ui(30, bold: true))
                    .foregroundStyle(t.creme)
                    .shadow(color: t.rouille, radius: 0, x: 3, y: 3)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }

            BittyView(scale: 1.8, hopping: !isFailed, hopHeight: lightning == .routing ? 6 : 18)

            Group {
                switch lightning {
                case .routing:
                    HStack(spacing: 8) {
                        PixelSpinner()
                        LoadingDots(text: "⚡ ルーティング中")
                    }
                case .failed:
                    Text("[FAIL] 支払いが完了しませんでした")
                default:
                    Text(successLine)
                }
            }
            .font(PixelFont.body(15))
            .foregroundStyle(isFailed ? t.braise : t.encre)

            PixelWindow(title: "receipt.txt") {
                VStack(spacing: 8) {
                    if let sentAmount {
                        LeaderRow(label: "amount", value: SatFormat.amount(sentAmount, unit: settings.unit))
                            .receiptRow(0, shown: receiptRows)
                    }
                    if let selected {
                        LeaderRow(label: "rail", value: selected.method.rail)
                            .receiptRow(1, shown: receiptRows)
                        LeaderRow(label: "to", value: selected.method.value, monospaced: true)
                            .receiptRow(2, shown: receiptRows)
                    }
                    if let result {
                        switch result {
                        case .ark(let movementId):
                            LeaderRow(label: "movement", value: "#\(movementId)")
                                .receiptRow(3, shown: receiptRows)
                        case .onchain(let txid):
                            LeaderRow(label: "txid", value: txid, monospaced: true)
                                .receiptRow(3, shown: receiptRows)
                        case .lightning(_, let paymentHash):
                            LeaderRow(label: "hash", value: paymentHash, monospaced: true)
                                .receiptRow(3, shown: receiptRows)
                            LeaderRow(label: "status", value: lightningStatusText,
                                      valueColor: lightning == .paid ? t.encre : (isFailed ? t.braise : t.creme))
                                .receiptRow(4, shown: receiptRows)
                        }
                    }
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if let stamp {
                    PixelStamp(text: stamp.text, color: stamp.color)
                        .opacity(stampVisible ? 1 : 0)
                        .pixelPop(trigger: stampTick, from: 2.2)
                        .offset(x: -14, y: -10)
                        .allowsHitTesting(false)
                }
            }

            PixelButton("Done / 閉じる") { close() }
            PixelButton("Send another", kind: .secondary) { reset() }
        }
        .task { await revealReceipt() }
        .onChange(of: lightning) { _, value in
            guard value == .paid || isLightningFailure(value) else { return }
            titleTick += 1
            slamStamp()
        }
    }

    // MARK: failed

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
                    Text("残高は変わっていません。内容を確認してもう一度お試しください。")
                        .font(PixelFont.body(12))
                        .foregroundStyle(t.dim)
                }
            }
            .pixelShake(trigger: failTick)
            .task {
                try? await Task.sleep(nanoseconds: 120_000_000)
                failTick += 1
            }
            BittyView(scale: 1.4, hopping: false)
                .opacity(0.7)
            PixelButton("Retry") { go(.review, forward: false) }
            PixelButton("Back", kind: .secondary) { reset() }
        }
    }

    // MARK: - Confirm dialog (RPG style)

    private var confirmDialog: some View {
        ZStack {
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture { dismissConfirm() }
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 6) {
                    Text("▶︎")
                        .font(PixelFont.ui(16, bold: true))
                        .foregroundStyle(t.encre)
                    TypewriterText(text: "本当に送りますか？", font: PixelFont.body(18), color: t.creme)
                }
                if let amount = displayAmount {
                    Text("\(SatFormat.sats(amount)) sats ⇢ \(selected.map { shortLabel($0.method) } ?? "")")
                        .font(PixelFont.ui(20, bold: true))
                        .foregroundStyle(t.encre)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                if let value = selected?.method.value {
                    Text(value)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(t.dim)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                if let fee {
                    LeaderRow(label: "fee", value: "\(SatFormat.sats(fee.feeSats)) sats")
                }
                if let total {
                    LeaderRow(label: "total", value: SatFormat.amount(total, unit: settings.unit), valueColor: t.creme)
                }
                if store.network.isRealMoney {
                    Text("MAINNET — 本物のビットコインが動きます")
                        .font(PixelFont.body(11))
                        .foregroundStyle(t.braise)
                }
                HoldToConfirmButton(title: "▶︎ 長押しで送金 / HOLD", holdingTitle: "チャージ中… / CHARGING") {
                    withAnimation(.linear(duration: 0.1)) { confirming = false }
                    Task { await send() }
                }
                .padding(.top, 4)
                PixelButton("いいえ / NO", kind: .secondary) {
                    dismissConfirm()
                }
            }
            .pixelBox(t, padding: 20)
            .padding(.horizontal, 24)
            .pixelPop(trigger: dialogTick, from: 0.86)
            .task { dialogTick += 1 }
        }
    }

    private func dismissConfirm() {
        withAnimation(.linear(duration: 0.1)) { confirming = false }
    }

    // MARK: - Actions

    private func go(_ next: Stage, forward: Bool) {
        self.forward = forward
        withAnimation(reduceMotion ? .linear(duration: 0.15) : .easeOut(duration: 0.24)) {
            stage = next
        }
    }

    private func paste() {
        guard let text = UIPasteboard.general.string, !text.isEmpty else {
            parseError = "クリップボードが空です / clipboard is empty"
            parseErrorTick += 1
            Haptics.error()
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
                parseErrorTick += 1
                Haptics.error()
                return
            }
            amountText = ""
            comment = ""
            select(choice)
            go(.review, forward: true)
        } catch {
            parseError = error.barkMessage
            parseErrorTick += 1
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
        delivered = false
        sendStart = Date()
        go(.sending, forward: true)
        do {
            let paid = try await store.pay(method, amount: amount, comment: comment.isEmpty ? nil : comment)
            result = paid
            // let the bar fill and the packets land before the receipt
            withAnimation(.linear(duration: 0.1)) { delivered = true }
            try? await Task.sleep(nanoseconds: reduceMotion ? 150_000_000 : 550_000_000)
            if case .lightning(_, let paymentHash) = paid {
                lightning = .routing
                go(.done, forward: true)
                Chiptune.shared.play(.select)
                await followLightning(paymentHash)
            } else {
                lightning = nil
                go(.done, forward: true)
                Chiptune.shared.play(.coin)
                Haptics.success()
                store.celebrate()
            }
        } catch {
            go(.failed(error.barkMessage), forward: true)
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
                Chiptune.shared.play(.error)
                Haptics.error()
            }
        } catch {
            lightning = .failed(error.barkMessage)
            Chiptune.shared.play(.error)
            Haptics.error()
        }
    }

    /// Prints the receipt line by line (after the success jingle), then
    /// slams the stamp on it.
    private func revealReceipt() async {
        receiptRows = 0
        stampVisible = false
        titleTick += 1
        if reduceMotion {
            receiptRows = 5
            if stamp != nil { stampVisible = true }
            return
        }
        try? await Task.sleep(nanoseconds: 380_000_000)
        for row in 1...5 {
            guard !Task.isCancelled else { return }
            withAnimation(.linear(duration: 0.08)) { receiptRows = row }
            Chiptune.shared.play(.tick)
            try? await Task.sleep(nanoseconds: 110_000_000)
        }
        guard !Task.isCancelled, stamp != nil else { return }
        try? await Task.sleep(nanoseconds: 120_000_000)
        slamStamp()
    }

    private func slamStamp() {
        guard stamp != nil else { return }
        stampVisible = true
        stampTick += 1
        Haptics.heavy()
    }

    private func isLightningFailure(_ value: LightningProgress?) -> Bool {
        if case .failed = value { return true }
        return false
    }

    private func reset() {
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
        delivered = false
        stampVisible = false
        receiptRows = 0
        successLine = BittyLines.success.randomElement() ?? "+1 EXP"
        go(.input, forward: false)
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

// MARK: - Step indicator

/// `[1 宛先]━━[2 確認]━━[3 送金]` — where you are in the send flow.
private struct SendSteps: View {
    @Environment(\.sats) private var t
    /// 0...2 = current step, 3 = everything done.
    var step: Int
    var failed = false

    private let titles = ["宛先", "確認", "送金"]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<titles.count, id: \.self) { index in
                if index > 0 {
                    Rectangle()
                        .fill(index <= step ? t.encre : t.line)
                        .frame(height: 3)
                        .frame(maxWidth: .infinity)
                }
                chip(index)
            }
        }
        .animation(.linear(duration: 0.12), value: step)
        .animation(.linear(duration: 0.12), value: failed)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(min(step + 1, titles.count)) of \(titles.count): \(titles[min(step, titles.count - 1)])")
    }

    private func chip(_ index: Int) -> some View {
        let isCurrent = index == step
        let isDone = index < step
        let isFailedStep = failed && isCurrent
        let ink: Color = isFailedStep ? t.braise : (isCurrent || isDone ? t.encre : t.dim)
        return HStack(spacing: 4) {
            Text(isDone ? "✓" : "\(index + 1)")
                .font(PixelFont.ui(12, bold: true))
            Text(titles[index])
                .font(PixelFont.body(12))
        }
        .foregroundStyle(isCurrent ? (isFailedStep ? t.papier : t.onEncre) : ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(isCurrent ? ink : t.papier)
        .overlay(Rectangle().stroke(isCurrent || isDone ? ink : t.line, lineWidth: 2))
        .fixedSize()
    }
}

private extension View {
    /// Receipt line that "prints" in when its turn comes.
    func receiptRow(_ index: Int, shown: Int) -> some View {
        opacity(index < shown ? 1 : 0)
            .offset(y: index < shown ? 0 : -4)
    }
}
