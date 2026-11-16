import Bark
import Combine
import Foundation

/// One line of the boot log: `[ OK ] ark.drv ........ online`
struct BootLine: Identifiable, Equatable {
    enum Status: Equatable { case ok, busy, warn, fail }

    let id = UUID()
    var status: Status
    var name: String
    var detail: String
}

struct WalletToast: Identifiable, Equatable {
    enum Style { case incoming, outgoing, info, error }

    let id = UUID()
    let title: String
    let message: String
    let style: Style
}

/// A payment that just landed, for the receive screen's celebration.
struct IncomingPayment: Identifiable, Equatable {
    let id = UUID()
    let amount: UInt64
    /// "Ark" or "ライトニング"
    let rail: String
    let paymentHash: String?
}

/// Owns the Bark `Wallet` and publishes everything the UI shows.
///
/// Bark rules worth remembering (from the SDK docs):
/// * open a datadir only once per process and reuse the `Wallet`
/// * always reopen with the same mnemonic
/// * `Wallet.open` creates the wallet on first launch
@MainActor
final class WalletStore: ObservableObject {
    enum Phase: Equatable {
        case booting
        case needsSetup
        case ready
        case failed(String)
    }

    enum StoreError: LocalizedError {
        case notReady

        var errorDescription: String? {
            switch self {
            case .notReady: return "ウォレットがまだ起きていません"
            }
        }
    }

    @Published private(set) var phase: Phase = .booting
    @Published private(set) var bootLog: [BootLine] = []
    /// Bumped whenever the OS "reboots" (network switch, delete, restore).
    @Published private(set) var bootGeneration = 0
    @Published private(set) var network: ArkNetwork
    @Published private(set) var balance: Balance?
    @Published private(set) var movements: [Movement] = []
    @Published private(set) var blockHeight: UInt64?
    /// Bumped when a new block is seen, to animate the desktop.
    @Published private(set) var newBlockTick = 0
    @Published private(set) var arkInfo: ArkInfo?
    @Published private(set) var fingerprint: String?
    @Published private(set) var isSyncing = false
    @Published private(set) var lastSync: Date?
    @Published private(set) var celebrationTick = 0
    @Published private(set) var settledInvoices: Set<String> = []
    @Published var toast: WalletToast?
    /// Latest successful receive (Ark or Lightning).
    @Published private(set) var lastIncoming: IncomingPayment?
    /// The receive sheet is open and celebrates arrivals itself.
    var receiveOnScreen = false
    /// Highest balance this wallet has ever held on the current network.
    /// Friends arrive as it grows and never leave.
    @Published private(set) var highestBalance: UInt64 = 0
    /// The friends who just arrived, for the home room and the celebration.
    @Published private(set) var friendArrival: FriendArrival?
    private var highestLoaded = false

    private var wallet: Wallet?
    private var notificationTask: Task<Void, Never>?
    private var heightTask: Task<Void, Never>?
    private var toastTask: Task<Void, Never>?
    private var announced: Set<String> = []
    private var isBooting = false

    init() {
        let defaults = UserDefaults.standard
        if Autopilot.mode != nil {
            // CI screenshots (DEBUG only): never create throwaway wallets on mainnet.
            network = .signet
            return
        }
        // Since 1.0.1 the app starts on mainnet. Move existing installs over once;
        // after that, whatever the user picks in system.cfg sticks.
        if !defaults.bool(forKey: Self.mainnetDefaultKey) {
            defaults.set(true, forKey: Self.mainnetDefaultKey)
            defaults.set(ArkNetwork.mainnet.rawValue, forKey: "network")
        }
        let raw = defaults.string(forKey: "network") ?? ArkNetwork.mainnet.rawValue
        network = ArkNetwork(rawValue: raw) ?? .mainnet
    }

    private static let mainnetDefaultKey = "mainnetDefaultApplied"

    // MARK: - Derived values

    var spendable: UInt64 { balance?.spendableSats ?? 0 }

    var pendingTotal: UInt64 {
        guard let b = balance else { return 0 }
        return b.pendingInRoundSats + b.pendingLightningSendSats + b.claimableLightningReceiveSats
            + b.pendingBoardSats + b.pendingArkoorSendSats + b.pendingOffboardSats + b.pendingExitSats
    }

    var needsRefresh: UInt64 { balance?.needsRefreshSats ?? 0 }

    var friends: Friends { Friends(highest: highestBalance) }

    // MARK: - Boot

    func boot() async {
        guard !isBooting else { return }
        isBooting = true
        defer { isBooting = false }

        phase = .booting
        bootLog = []
        await log(.busy, "self-custody.sys", "reading keychain")
        guard let mnemonic = Keychain.loadMnemonic() else {
            updateLast(.warn, "no keys found")
            await pause(350)
            phase = .needsSetup
            return
        }
        updateLast(.ok, "keys loaded")
        await open(mnemonic: mnemonic)
    }

    private func open(mnemonic: String) async {
        phase = .booting
        await log(.busy, "ark.drv", network.serverHost)
        do {
            try FileManager.default.createDirectory(at: network.datadir, withIntermediateDirectories: true)
            let opened = try await Wallet.open(
                network: network.barkNetwork,
                mnemonicOrSeed: mnemonic,
                config: network.barkConfig,
                args: WalletOpenArgs(datadir: network.datadir.path, onchain: nil)
            )
            wallet = opened
            fingerprint = opened.fingerprint()
            updateLast(.ok, "online")
        } catch {
            updateLast(.fail, "offline")
            phase = .failed(error.barkMessage)
            return
        }

        await log(.busy, "vtxo.sync", "syncing")
        do {
            try await wallet?.sync()
            updateLast(.ok, "synced")
        } catch {
            updateLast(.warn, "retry later")
        }
        await refreshData()
        arkInfo = await wallet?.arkInfo()
        await log(.ok, "lightning.drv", "ready")
        await refreshHeight()
        if let height = blockHeight {
            await log(.ok, "headers", "\(SatFormat.sats(height)) / \(SatFormat.sats(height))")
        }
        await log(.ok, "verify.sys", "don't trust, verify")
        await log(.warn, "fiat.sys", "deprecated")
        lastSync = Date()
        startBackgroundTasks()
        phase = .ready
    }

    // MARK: - Setup (new / restore)

    func makeMnemonic() throws -> String {
        try generateMnemonic()
    }

    /// Lower-cases and collapses whitespace so pasted seeds work.
    func normalizedMnemonic(_ input: String) -> String {
        input.lowercased()
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    func isValidMnemonic(_ input: String) -> Bool {
        let words = normalizedMnemonic(input)
        guard !words.isEmpty else { return false }
        return (try? validateMnemonic(mnemonic: words)) ?? false
    }

    func installWallet(mnemonic: String, restored: Bool) async {
        let words = normalizedMnemonic(mnemonic)
        do {
            try Keychain.saveMnemonic(words)
        } catch {
            phase = .failed(error.localizedDescription)
            return
        }
        bootGeneration += 1
        bootLog = []
        await log(.ok, "self-custody.sys", restored ? "keys restored" : "keys generated")
        await open(mnemonic: words)
    }

    /// Picks the network before a wallet exists (setup screen).
    func chooseNetworkForSetup(_ newNetwork: ArkNetwork) {
        guard wallet == nil else { return }
        network = newNetwork
        UserDefaults.standard.set(newNetwork.rawValue, forKey: "network")
    }

    // MARK: - Lifecycle

    func reboot() async {
        await shutdown()
        bootGeneration += 1
        await boot()
    }

    func switchNetwork(to newNetwork: ArkNetwork) async {
        guard newNetwork != network else { return }
        await shutdown()
        network = newNetwork
        UserDefaults.standard.set(newNetwork.rawValue, forKey: "network")
        bootGeneration += 1
        await boot()
    }

    /// Removes the local database of the current network but keeps the seed.
    /// The next boot restores from the seed with the server's help.
    func resetLocalData() async {
        await shutdown()
        try? FileManager.default.removeItem(at: network.datadir)
        bootGeneration += 1
        await boot()
    }

    /// Wipes the seed and every network's data from this device.
    func deleteWallet() async {
        await shutdown()
        Keychain.deleteMnemonic()
        for net in ArkNetwork.allCases {
            try? FileManager.default.removeItem(at: net.datadir)
        }
        bootGeneration += 1
        bootLog = []
        phase = .needsSetup
    }

    private func shutdown() async {
        notificationTask?.cancel()
        heightTask?.cancel()
        // Let the notification loop finish so it drops its Wallet reference
        // before the datadir is reopened.
        await notificationTask?.value
        notificationTask = nil
        heightTask = nil
        if let current = wallet {
            try? await current.stopDaemonWait()
        }
        wallet = nil
        balance = nil
        movements = []
        arkInfo = nil
        fingerprint = nil
        blockHeight = nil
        announced = []
        settledInvoices = []
        highestLoaded = false
        highestBalance = 0
        friendArrival = nil
    }

    func revealMnemonic() -> String? {
        Keychain.loadMnemonic()
    }

    // MARK: - Sync & data

    func sync() async {
        guard let wallet, !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }
        do {
            try await wallet.sync()
        } catch {
            showToast(.error, "同期できませんでした", error.barkMessage)
        }
        _ = try? await wallet.tryClaimAllLightningReceives(wait: false)
        await refreshData()
        await refreshHeight()
        lastSync = Date()
    }

    func refreshData() async {
        guard let wallet else { return }
        if let newBalance = try? await wallet.balance() {
            balance = newBalance
        }
        if let history = try? await wallet.history() {
            movements = history.sorted { $0.id > $1.id }
        }
        updateHighest()
    }

    // MARK: - Friends

    private var highestKey: String { "highestBalance.\(network.rawValue)" }

    /// Raises the highest balance from the current balance and from the
    /// history (the running total at its peak), so friends also come for
    /// highs reached on another device or before this version.
    private func updateHighest() {
        let hadRecord = UserDefaults.standard.object(forKey: highestKey) != nil
        loadHighestIfNeeded()
        var running: Int64 = 0
        var peak: Int64 = 0
        for movement in movements.reversed() where movement.isSuccessful {
            running += Int64(movement.effectiveBalanceSats)
            peak = max(peak, running)
        }
        let candidate = max(spendable, UInt64(peak))
        // The first time on this network: remember quietly, no fanfare for
        // friends who were "always" there.
        raiseHighest(to: candidate, announce: hadRecord, force: !hadRecord)
    }

    private func loadHighestIfNeeded() {
        guard !highestLoaded else { return }
        highestLoaded = true
        highestBalance = UInt64(max(UserDefaults.standard.integer(forKey: highestKey), 0))
        #if DEBUG
        if let seed = Autopilot.seedHighest { highestBalance = seed }
        #endif
    }

    private func raiseHighest(to candidate: UInt64, announce: Bool, force: Bool = false) {
        guard candidate > highestBalance || force else { return }
        let before = Set(Friend.arrived(for: highestBalance))
        let value = max(candidate, highestBalance)
        highestBalance = value
        UserDefaults.standard.set(Int(clamping: value), forKey: highestKey)
        let fresh = Friend.arrived(for: value).filter { !before.contains($0) }
        if announce, !fresh.isEmpty {
            friendArrival = FriendArrival(friends: fresh)
        }
    }

    func refreshHeight() async {
        guard let url = URL(string: network.esploraAddress + "/blocks/tip/height") else { return }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let text = String(data: data, encoding: .utf8),
                  let height = UInt64(text.trimmingCharacters(in: .whitespacesAndNewlines))
            else { return }
            if let old = blockHeight, height > old {
                newBlockTick += 1
            }
            blockHeight = height
        } catch {
            // Offline: keep the last known height.
        }
    }

    func runMaintenance() async throws {
        try await requireWallet().maintenance()
        await refreshData()
    }

    private func startBackgroundTasks() {
        notificationTask?.cancel()
        if let wallet {
            notificationTask = Task { [weak self] in
                for await event in wallet.notificationStream() {
                    guard let self else { return }
                    await self.handle(event)
                }
            }
        }
        heightTask?.cancel()
        heightTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000)
                guard !Task.isCancelled, let self else { return }
                await self.refreshHeight()
            }
        }
    }

    private func handle(_ event: WalletNotification) async {
        switch event {
        case .movementCreated(let movement), .movementUpdated(let movement):
            await refreshData()
            announce(movement)
        case .channelLagging:
            await refreshData()
        }
    }

    private func announce(_ movement: Movement) {
        if movement.kind == .lightningReceive, movement.isSuccessful, let hash = movement.paymentHash {
            settledInvoices.insert(hash)
        }
        let key = "\(movement.id)-\(movement.status)"
        guard !announced.contains(key) else { return }
        announced.insert(key)

        let amount = SatFormat.sats(UInt64(movement.effectiveBalanceSats.magnitude))
        switch movement.kind {
        case .arkReceive, .lightningReceive:
            guard movement.isSuccessful else { return }
            lastIncoming = IncomingPayment(
                amount: UInt64(movement.effectiveBalanceSats.magnitude),
                rail: movement.kind == .arkReceive ? "Ark" : "ライトニング",
                paymentHash: movement.paymentHash
            )
            celebrate()
            Chiptune.shared.play(.coin)
            Haptics.success()
        case .arkSend, .lightningSend, .onchainSend:
            if movement.isSuccessful {
                showToast(.outgoing, "おくったよ", "-\(amount) sats")
            } else if movement.isFailed {
                showToast(.error, "おくれませんでした", "\(movement.title) ・ \(movement.railName)")
                Chiptune.shared.play(.error)
            }
        default:
            break
        }
    }

    // MARK: - Send

    func parse(_ input: String) async throws -> PaymentRequest {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        return try await requireWallet().parsePaymentRequest(payment: trimmed)
    }

    func estimateFee(_ method: PaymentMethod, amount: UInt64) async throws -> FeeEstimate {
        try await requireWallet().estimatePaymentFee(method: method, amountSats: amount)
    }

    func pay(_ method: PaymentMethod, amount: UInt64?, comment: String?) async throws -> PaymentResult {
        let result = try await requireWallet().sendPayment(
            method: method,
            amountSats: amount,
            comment: comment,
            wait: false,
            retryForSecs: nil
        )
        await refreshData()
        return result
    }

    /// Blocks until a lightning send settles or fails.
    func waitForLightningSend(paymentHash: String) async throws -> LightningSendStatus {
        let status = try await requireWallet().checkLightningPayment(paymentHash: paymentHash, wait: true)
        await refreshData()
        return status
    }

    // MARK: - Receive

    func newArkAddress() async throws -> String {
        try await requireWallet().newAddress()
    }

    func newInvoice(amount: UInt64, memo: String?) async throws -> LightningInvoice {
        let description = memo?.isEmpty == false ? memo : nil
        return try await requireWallet().bolt11Invoice(
            amountSats: amount,
            description: description,
            token: nil,
            expirySecs: nil
        )
    }

    func lightningReceiveFee(amount: UInt64) async throws -> FeeEstimate {
        try await requireWallet().estimateLightningReceiveFee(amountSats: amount)
    }

    func receiveState(paymentHash: String) async throws -> LightningReceive {
        try await requireWallet().lightningReceiveState(paymentHash: paymentHash)
    }

    func tryClaim(paymentHash: String) async {
        _ = try? await wallet?.tryClaimLightningReceive(paymentHash: paymentHash, wait: false)
    }

    func markInvoiceSettled(_ paymentHash: String) {
        guard !settledInvoices.contains(paymentHash) else { return }
        settledInvoices.insert(paymentHash)
        celebrate()
        Chiptune.shared.play(.coin)
        Haptics.success()
        Task { await refreshData() }
    }

    // MARK: - Toasts & effects

    func showToast(_ style: WalletToast.Style, _ title: String, _ message: String) {
        toastTask?.cancel()
        toast = WalletToast(title: title, message: message, style: style)
        toastTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            guard !Task.isCancelled else { return }
            self?.toast = nil
        }
    }

    func celebrate() {
        celebrationTick += 1
    }

    #if DEBUG
    /// CI screenshots only: pretend an Ark payment just arrived.
    func simulateIncoming(_ amount: UInt64) {
        lastIncoming = IncomingPayment(amount: amount, rail: "Ark", paymentHash: nil)
        loadHighestIfNeeded()
        raiseHighest(to: highestBalance + amount, announce: true)
        celebrate()
        Chiptune.shared.play(.coin)
    }
    #endif

    // MARK: - Helpers

    private func requireWallet() throws -> Wallet {
        guard let wallet else { throw StoreError.notReady }
        return wallet
    }

    private func log(_ status: BootLine.Status, _ name: String, _ detail: String) async {
        bootLog.append(BootLine(status: status, name: name, detail: detail))
        await pause(110)
    }

    private func updateLast(_ status: BootLine.Status, _ detail: String) {
        guard !bootLog.isEmpty else { return }
        bootLog[bootLog.count - 1].status = status
        bootLog[bootLog.count - 1].detail = detail
    }

    private func pause(_ milliseconds: UInt64) async {
        try? await Task.sleep(nanoseconds: milliseconds * 1_000_000)
    }
}
