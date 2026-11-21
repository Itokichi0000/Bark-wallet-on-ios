import Bark
import SwiftUI

/// おくる: paste or scan anything Bark understands (Ark address, BOLT11,
/// BOLT12, lightning address, LNURL, bitcoin: URI, on-chain address),
/// check the amount and fee, then hold to send. While it goes, a diagram
/// shows the route the payment takes (Ark, Lightning or on-chain).
struct SendView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
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
    @State private var forward = true
    @State private var input = ""
    @State private var parsing = false
    @State private var parseError: String?
    @State private var parseErrorTick = 0
    @State private var request: PaymentRequest?
    @State private var selected: AvailablePaymentMethod?
    @State private var invoiceDetails: Bolt11InvoiceDetails?
    @State private var amountText = ""
    @State private var comment = ""
    @State private var fee: FeeEstimate?
    @State private var feeError: String?
    @State private var insufficientTick = 0
    @State private var showScanner = false
    @State private var result: PaymentResult?
    @State private var sentAmount: UInt64?
    @State private var lightning: LightningProgress?
    @State private var holdingSend = false

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "おくる", onBack: backAction, onClose: { close() })
            StepLabels(steps: ["あて先", "きんがく", "かくにん"], current: stepIndex)
                .padding(.bottom, 6)
                .opacity(stage == .input || stage == .review ? 1 : 0)

            ScrollViewReader { proxy in
                ScrollView {
                    ZStack(alignment: .top) {
                        stageContent
                            .id(stageKey)
                            .transition(stageTransition)
                    }
                    .id("top")
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: stageKey) { _, _ in
                    withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("top", anchor: .top) }
                }
            }
        }
        .background(PaperBackground())
        .interactiveDismissDisabled(stage == .sending)
        .fullScreenCover(isPresented: $showScanner) {
            ScannerScreen { code in
                showScanner = false
                input = code
                Task { await parse() }
            } onCancel: {
                showScanner = false
            }
        }
        .task(id: feeKey) {
            await estimateFee()
        }
        .onChange(of: insufficient) { _, short in
            if short { insufficientTick += 1 }
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

    private var backAction: (() -> Void)? {
        stage == .review ? { go(.input, forward: false) } : nil
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

    private var stepIndex: Int {
        switch stage {
        case .input: return 0
        case .review: return requiresAmount && typedAmount == nil ? 1 : 2
        default: return 2
        }
    }

    private var stageTransition: AnyTransition {
        if reduceMotion { return .opacity }
        let distance: CGFloat = forward ? 40 : -40
        return .asymmetric(
            insertion: .offset(x: distance).combined(with: .opacity),
            removal: .offset(x: -distance).combined(with: .opacity)
        )
    }

    private var requiresAmount: Bool { selected?.requiresAmount ?? true }

    private var typedAmount: UInt64? {
        guard let value = UInt64(amountText), value > 0 else { return nil }
        return value
    }

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

    // MARK: - Input

    private var inputStage: some View {
        VStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 12) {
                SectionLabel(text: "あて先")
                ZStack(alignment: .topLeading) {
                    if input.isEmpty {
                        Text("アドレスや invoice を はりつけ")
                            .font(Brush.text(15))
                            .foregroundStyle(Ink.sub)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 18)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $input)
                        .font(Brush.mono(14))
                        .foregroundStyle(Ink.ink)
                        .scrollContentBackground(.hidden)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .padding(10)
                }
                .frame(minHeight: 120)
                .background(Ink.bg, in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                        .strokeBorder(parseError == nil ? Ink.line : Ink.alert, lineWidth: 1)
                )
                Text("Ark アドレス ・ ライトニング（invoice / offer / アドレス / LNURL）・ ビットコインアドレス")
                    .font(Brush.text(11))
                    .foregroundStyle(Ink.sub)
                HStack(spacing: 12) {
                    InkButton("スキャン", icon: .scan, kind: .secondary, height: 48) { showScanner = true }
                    InkButton("はりつけ", icon: .paste, kind: .secondary, height: 48) { paste() }
                }
                if parsing {
                    HStack(spacing: 8) {
                        InkDots(size: 5)
                        Text("よみとり中")
                            .font(Brush.text(13))
                            .foregroundStyle(Ink.sub)
                    }
                    .transition(.opacity)
                }
                if let parseError {
                    HStack(alignment: .top, spacing: 6) {
                        InkIcon(kind: .alert, size: 16, lineWidth: 2.2, color: Ink.alert)
                        Text(parseError)
                            .font(Brush.text(13))
                            .foregroundStyle(Ink.alert)
                    }
                    .transition(.opacity)
                }
            }
            .inkCard()
            .shake(trigger: parseErrorTick)
            .animation(.easeOut(duration: 0.15), value: parsing)
            .animation(.easeOut(duration: 0.15), value: parseError)

            InkButton("つぎへ", sound: .select) {
                Task { await parse() }
            }
            .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || parsing)

            InfoRow(label: "おくれる金額", value: SatFormat.amount(store.spendable, unit: settings.unit))
                .padding(.horizontal, 6)
        }
    }

    // MARK: - Review (amount + confirm + hold)

    @ViewBuilder
    private var reviewStage: some View {
        if let selected {
            VStack(spacing: 16) {
                amountSection

                VStack(alignment: .leading, spacing: 12) {
                    InfoRow(label: "あて先", value: selected.method.value, mono: true)
                    InfoRow(label: "みち", value: railName(selected.method))
                    if let options = request?.options, options.count > 1 {
                        HStack(spacing: 8) {
                            ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                                InkChip(title: railName(option.method), selected: option.method == selected.method) {
                                    withAnimation(.easeOut(duration: 0.15)) { select(option) }
                                }
                            }
                        }
                    }
                    if let memo = invoiceDetails?.description, !memo.isEmpty {
                        InfoRow(label: "メモ", value: memo)
                    }
                    if let label = request?.label ?? request?.message {
                        InfoRow(label: "ラベル", value: label)
                    }
                    if selected.method.acceptsComment {
                        TextField("ひとこと（なくてもOK）", text: $comment)
                            .font(Brush.text(15))
                            .padding(12)
                            .background(Ink.bg, in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).strokeBorder(Ink.line, lineWidth: 1))
                    }
                    feeRow
                    DashedDivider()
                    if let total {
                        InfoRow(label: "ごうけい", value: SatFormat.amount(total, unit: settings.unit), emphasized: true,
                                valueColor: insufficient ? Ink.alert : nil)
                            .contentTransition(.numericText(value: Double(total)))
                            .animation(.snappy(duration: 0.25), value: total)
                    }
                    ForEach(Array(selected.errors.enumerated()), id: \.offset) { _, problem in
                        warning(problem.message)
                    }
                    if let expires = invoiceDetails?.expiresAt, Double(expires) < Date().timeIntervalSince1970 {
                        warning("この invoice は 期限切れです")
                    }
                    if insufficient {
                        warning("残高が たりません（おくれる金額 \(SatFormat.amount(store.spendable, unit: settings.unit))）")
                    }
                }
                .inkCard()
                .animation(.easeOut(duration: 0.15), value: insufficient)

                // the route, before you send
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        SectionLabel(text: "この みちで とどきます")
                        Text(railName(selected.method))
                            .font(Brush.bold(12))
                            .foregroundStyle(Ink.ink)
                    }
                    ArkScenePlayer(scene: Self.scene(for: selected.method), height: 170,
                                   showsBeats: false, showsControls: false)
                        .id(Self.scene(for: selected.method))
                }
                .inkCard()

                VStack(spacing: 8) {
                    HoldToSendButton(title: "ながおしで おくる", holdingTitle: "そのまま…",
                                     onHoldChange: { holdingSend = $0 }) {
                        Task { await send() }
                    }
                    .disabled(!canSend)
                    Text(holdingSend ? "そのまま…" : "ボタンを おしたままにすると オレンジが たまって おくれます")
                        .font(Brush.text(12))
                        .foregroundStyle(Ink.sub)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 4)
            }
        }
    }

    @ViewBuilder
    private var amountSection: some View {
        if requiresAmount {
            VStack(spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    TextField("0", text: $amountText)
                        .keyboardType(.numberPad)
                        .font(Brush.amount(46))
                        .foregroundStyle(insufficient ? Ink.alert : Ink.ink)
                        .multilineTextAlignment(.center)
                        .fixedSize()
                        .onChange(of: amountText) { _, value in
                            let digits = String(value.filter(\.isNumber).prefix(15))
                            if digits != value { amountText = digits }
                        }
                    Text("sats")
                        .font(Brush.text(18))
                        .foregroundStyle(Ink.ink)
                }
                .shake(trigger: insufficientTick)
                HStack(spacing: 8) {
                    ForEach([1_000, 10_000, 21_000, 100_000], id: \.self) { preset in
                        InkChip(title: SatFormat.sats(UInt64(preset)), selected: typedAmount == UInt64(preset)) {
                            amountText = String(preset)
                        }
                    }
                }
            }
        } else if let amount = displayAmount {
            AmountText(sats: amount, unit: settings.unit, size: 46)
        } else {
            Text("金額は あて先が きめています")
                .font(Brush.text(14))
                .foregroundStyle(Ink.sub)
        }
    }

    @ViewBuilder
    private var feeRow: some View {
        if fee == nil && feeError == nil && displayAmount != nil {
            HStack {
                Text("てすうりょう")
                    .font(Brush.text(14))
                    .foregroundStyle(Ink.sub)
                Spacer()
                InkDots(color: Ink.sub, size: 5)
            }
        } else {
            InfoRow(label: "てすうりょう", value: feeText)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.25), value: feeText)
        }
    }

    private func warning(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            InkIcon(kind: .alert, size: 16, lineWidth: 2.2, color: Ink.alert)
            Text(text)
                .font(Brush.text(13))
                .foregroundStyle(Ink.alert)
                .fixedSize(horizontal: false, vertical: true)
        }
        .transition(.opacity)
    }

    // MARK: - Sending

    private var sendingStage: some View {
        VStack(spacing: 18) {
            if let sentAmount {
                AmountText(sats: sentAmount, unit: settings.unit, size: 40)
                    .padding(.top, 12)
            }
            HStack(spacing: 10) {
                InkDots(size: 5)
                Text("とどけています")
                    .font(Brush.text(15))
                    .foregroundStyle(Ink.sub)
            }
            if let method = selected?.method {
                ArkScenePlayer(scene: Self.scene(for: method), height: 210, showsBeats: false, showsControls: false)
                    .inkCard()
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Done

    private var doneTitle: String {
        switch lightning {
        case .routing: return "とどけ中…"
        case .failed: return "とどかなかった"
        default: return "とどいたよ！"
        }
    }

    /// Went through: not still routing over Lightning and not failed.
    private var delivered: Bool {
        lightning != .routing && !lightningFailed
    }

    private var lightningFailed: Bool {
        if case .failed = lightning { return true }
        return false
    }

    private var doneStage: some View {
        VStack(spacing: 18) {
            Group {
                if lightning == .routing {
                    InkDots(size: 6)
                        .frame(width: 56, height: 56)
                } else if lightningFailed {
                    InkIcon(kind: .alert, size: 28, lineWidth: 2, color: Ink.alert)
                        .frame(width: 56, height: 56)
                        .overlay(Circle().strokeBorder(Ink.alert.opacity(0.4), lineWidth: 1))
                } else {
                    InkIcon(kind: .check, size: 28, lineWidth: 2.2, color: Ink.paper)
                        .frame(width: 56, height: 56)
                        .background(Ink.orange, in: Circle())
                        .pop(trigger: 1, from: 0.5)
                }
            }
            .padding(.top, 16)

            Text(doneTitle)
                .font(Brush.bold(24, relativeTo: .title))
                .foregroundStyle(lightningFailed ? Ink.alert : Ink.ink)
                .animation(.easeOut(duration: 0.2), value: doneTitle)

            if let sentAmount {
                CountUpText(value: sentAmount) { "-" + SatFormat.amount($0, unit: settings.unit) }
                    .font(Brush.amount(36))
                    .foregroundStyle(Ink.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }

            VStack(spacing: 12) {
                if let selected {
                    InfoRow(label: "みち", value: railName(selected.method))
                    InfoRow(label: "あて先", value: selected.method.value, mono: true)
                }
                if let result {
                    switch result {
                    case .ark(let movementId):
                        InfoRow(label: "ID", value: "#\(movementId)")
                    case .onchain(let txid):
                        InfoRow(label: "txid", value: txid, mono: true)
                    case .lightning(_, let paymentHash):
                        InfoRow(label: "hash", value: paymentHash, mono: true)
                        InfoRow(label: "じょうたい", value: lightningStatusText,
                                valueColor: lightningFailed ? Ink.alert : nil)
                    }
                }
            }
            .inkCard()

            InkButton("とじる") { close() }
            InkButton("もういちど おくる", kind: .secondary) { reset() }
        }
    }

    // MARK: - Failed

    private func failedStage(_ message: String) -> some View {
        VStack(spacing: 18) {
            InkIcon(kind: .alert, size: 28, lineWidth: 2, color: Ink.alert)
                .frame(width: 56, height: 56)
                .overlay(Circle().strokeBorder(Ink.alert.opacity(0.4), lineWidth: 1))
                .padding(.top, 16)
            Text("おくれませんでした")
                .font(Brush.bold(26, relativeTo: .title))
                .foregroundStyle(Ink.alert)
            VStack(alignment: .leading, spacing: 10) {
                Text(message)
                    .font(Brush.mono(12))
                    .foregroundStyle(Ink.ink)
                    .textSelection(.enabled)
                Text("残高は かわっていません。内容を たしかめて もういちど ためしてください。")
                    .font(Brush.text(13))
                    .foregroundStyle(Ink.sub)
            }
            .inkCard()
            InkButton("やりなおす") { go(.review, forward: false) }
            InkButton("さいしょから", kind: .secondary) { reset() }
        }
    }

    // MARK: - Actions

    private func go(_ next: Stage, forward: Bool) {
        self.forward = forward
        withAnimation(reduceMotion ? .linear(duration: 0.15) : .spring(duration: 0.4, bounce: 0.15)) {
            stage = next
        }
    }

    private func paste() {
        guard let text = UIPasteboard.general.string, !text.isEmpty else {
            parseError = "クリップボードが からっぽです"
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
                parseError = "おくれる あて先が 見つかりません"
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
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        let amount: UInt64? = requiresAmount ? typedAmount : nil
        sentAmount = displayAmount
        go(.sending, forward: true)
        let started = Date()
        do {
            let paid = try await store.pay(method, amount: amount, comment: comment.isEmpty ? nil : comment)
            result = paid
            // let the route diagram play for a moment
            let elapsed = Date().timeIntervalSince(started)
            if !reduceMotion, elapsed < 1.6 {
                try? await Task.sleep(nanoseconds: UInt64((1.6 - elapsed) * 1_000_000_000))
            }
            if case .lightning(_, let paymentHash) = paid {
                lightning = .routing
                go(.done, forward: true)
                await followLightning(paymentHash)
            } else {
                lightning = nil
                go(.done, forward: true)
                Chiptune.shared.play(.coin)
                Haptics.success()
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
                withAnimation(.spring(duration: 0.4)) { lightning = .paid }
                Chiptune.shared.play(.coin)
                Haptics.success()
            case .inProgress:
                lightning = .routing
            case .unknown:
                withAnimation { lightning = .failed("unknown") }
                Chiptune.shared.play(.error)
                Haptics.error()
            }
        } catch {
            withAnimation { lightning = .failed(error.barkMessage) }
            Chiptune.shared.play(.error)
            Haptics.error()
        }
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
        go(.input, forward: false)
    }

    // MARK: - Text

    private var feeText: String {
        if let fee { return "\(SatFormat.sats(fee.feeSats)) sats" }
        if let feeError { return "わからない（\(feeError.prefix(30))）" }
        return displayAmount == nil ? "—" : "しらべ中"
    }

    private var lightningStatusText: String {
        switch lightning {
        case .routing: return "とどけ中"
        case .paid: return "とどいた"
        case .failed(let reason): return "しっぱい（\(reason.prefix(30))）"
        case .none: return "—"
        }
    }

    static func scene(for method: PaymentMethod) -> ArkScene {
        switch method {
        case .ark, .custom: return .arkoor
        case .bitcoin, .outputScript: return .offboard
        case .invoice, .offer, .lightningAddress, .lnurl: return .lightning
        }
    }

    private func railName(_ method: PaymentMethod) -> String {
        switch method {
        case .ark: return "Ark"
        case .bitcoin, .outputScript: return "オンチェーン"
        case .invoice, .offer, .lightningAddress, .lnurl: return "ライトニング"
        case .custom: return "？"
        }
    }
}
