import Bark
import LocalAuthentication
import SwiftUI

/// せってい: display, network, wallet, server info, about, careful zone.
struct SettingsView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    var close: () -> Void

    @State private var revealedSeed: String?
    @State private var seedError: String?
    @State private var pendingNetwork: ArkNetwork?
    @State private var confirmDelete = false
    @State private var deleteText = ""
    @State private var maintenanceStatus: String?
    @State private var runningMaintenance = false
    @State private var deleteShake = 0

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "せってい", onClose: { close() })
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    displaySection.appearIn(delay: 0)
                    networkSection.appearIn(delay: 0.05)
                    walletSection.appearIn(delay: 0.1)
                    serverSection.appearIn(delay: 0.15)
                    aboutSection.appearIn(delay: 0.2)
                    dangerSection.appearIn(delay: 0.25)
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(PaperBackground())
        .onChange(of: confirmDelete) { _, asking in
            if asking { deleteShake += 1 }
        }
        .alert(
            pendingNetwork == .mainnet ? "本番（MAINNET）に切りかえますか？" : "テスト用（SIGNET）に切りかえますか？",
            isPresented: Binding(get: { pendingNetwork != nil }, set: { if !$0 { pendingNetwork = nil } })
        ) {
            Button(pendingNetwork == .mainnet ? "本物のビットコインで使う" : "切りかえる",
                   role: pendingNetwork == .mainnet ? .destructive : nil) {
                if let target = pendingNetwork {
                    close()
                    Task { await store.switchNetwork(to: target) }
                }
                pendingNetwork = nil
            }
            Button("やめる", role: .cancel) { pendingNetwork = nil }
        } message: {
            if pendingNetwork == .mainnet {
                Text("本番では 本物のビットコインを あつかいます（Ark サーバー: ark.second.tech）。同じシードを使います。さいしょは 少しの金額で ためしてください。")
            } else {
                Text("テスト用の signet に切りかえます。同じシードで 別のおさいふに なります。")
            }
        }
    }

    // MARK: display

    private var displaySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "ひょうじ")
            VStack(spacing: 14) {
                HStack(spacing: 10) {
                    Text("単位")
                        .font(Brush.text(15))
                        .foregroundStyle(Ink.ink)
                    Spacer()
                    ForEach(AmountUnit.allCases) { unit in
                        InkChip(title: unit.label, selected: settings.unit == unit) { settings.unit = unit }
                            .frame(width: 84)
                    }
                }
                InkToggle(title: "おと", detail: "ボタンや着金の音", isOn: $settings.sound)
                InkToggle(title: "ふるえ", detail: "タップしたときの振動", isOn: $settings.haptics)
            }
            .inkCard()
        }
    }

    // MARK: network

    private var networkSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "ネットワーク")
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    ForEach(ArkNetwork.allCases) { net in
                        InkChip(title: net == .mainnet ? "本番" : "テスト用", selected: store.network == net) {
                            if net != store.network { pendingNetwork = net }
                        }
                    }
                }
                InfoRow(label: "Ark サーバー", value: store.network.serverHost)
                InfoRow(label: "esplora", value: URL(string: store.network.esploraAddress)?.host ?? store.network.esploraAddress)
                InfoRow(label: "ブロック", value: store.blockHeight.map { SatFormat.sats($0) } ?? "…")
            }
            .inkCard()
        }
    }

    // MARK: wallet

    private var walletSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "おさいふ")
            VStack(alignment: .leading, spacing: 12) {
                InfoRow(label: "fingerprint", value: store.fingerprint ?? "…", mono: true)
                if let balance = store.balance {
                    InfoRow(label: "おくれる金額", value: "\(SatFormat.sats(balance.spendableSats)) sats")
                    if balance.pendingLightningSendSats > 0 {
                        InfoRow(label: "ライトニング送金中", value: "\(SatFormat.sats(balance.pendingLightningSendSats)) sats")
                    }
                    if balance.claimableLightningReceiveSats > 0 {
                        InfoRow(label: "ライトニング うけとり待ち", value: "\(SatFormat.sats(balance.claimableLightningReceiveSats)) sats")
                    }
                    if balance.pendingInRoundSats > 0 {
                        InfoRow(label: "ラウンド中", value: "\(SatFormat.sats(balance.pendingInRoundSats)) sats")
                    }
                    if balance.needsRefreshSats > 0 {
                        InfoRow(label: "こうしんが必要", value: "\(SatFormat.sats(balance.needsRefreshSats)) sats", valueColor: Ink.alert)
                    }
                    if balance.pendingExitSats > 0 {
                        InfoRow(label: "緊急出金中", value: "\(SatFormat.sats(balance.pendingExitSats)) sats")
                    }
                }

                HStack(spacing: 12) {
                    InkButton(store.isSyncing ? "同期中…" : "同期", icon: .refresh, kind: .secondary, height: 48) {
                        Task { await store.sync() }
                    }
                    .disabled(store.isSyncing)
                    InkButton(runningMaintenance ? "おていれ中…" : "おていれ", kind: .secondary, height: 48) {
                        Task { await maintenance() }
                    }
                    .disabled(runningMaintenance)
                }
                if store.isSyncing || runningMaintenance {
                    HStack(spacing: 8) {
                        InkDots(size: 5)
                        Text(runningMaintenance ? "おていれ中" : "同期中")
                            .font(Brush.text(13))
                            .foregroundStyle(Ink.sub)
                    }
                    .transition(.opacity)
                }
                if let maintenanceStatus {
                    Text(maintenanceStatus)
                        .font(Brush.text(13))
                        .foregroundStyle(maintenanceStatus.hasPrefix("おわりました") ? Ink.ink : Ink.alert)
                        .transition(.opacity)
                }
                Text("おていれ は、期限が近い VTXO を更新します（バックグラウンドでも 自動で行います）。")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)

                DashedDivider()

                if let revealedSeed {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 6) {
                            InkIcon(kind: .alert, size: 16, lineWidth: 2.2, color: Ink.alert)
                            Text("だれにも 見せないでください")
                                .font(Brush.bold(14))
                                .foregroundStyle(Ink.alert)
                        }
                        SeedGrid(words: revealedSeed.split(separator: " ").map(String.init), animated: true)
                        InkButton("かくす", kind: .quiet, height: 44) {
                            withAnimation(.easeOut(duration: 0.15)) { self.revealedSeed = nil }
                        }
                    }
                    .transition(.opacity)
                } else {
                    InkButton("シードフレーズを 見る", kind: .quiet, height: 48) {
                        Task { await revealSeed() }
                    }
                    if let seedError {
                        Text(seedError)
                            .font(Brush.text(13))
                            .foregroundStyle(Ink.alert)
                    }
                }
            }
            .inkCard()
            .animation(.easeOut(duration: 0.2), value: store.isSyncing)
            .animation(.easeOut(duration: 0.2), value: runningMaintenance)
            .animation(.easeOut(duration: 0.2), value: maintenanceStatus)
        }
    }

    // MARK: server

    private var serverSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "Ark サーバー")
            VStack(alignment: .leading, spacing: 12) {
                if let info = store.arkInfo {
                    InfoRow(label: "pubkey", value: info.serverPubkey, mono: true)
                    InfoRow(label: "ラウンド間隔", value: "\(info.roundIntervalSecs) 秒")
                    InfoRow(label: "VTXO の寿命", value: "\(info.vtxoLifetime) ブロック")
                    InfoRow(label: "exit delta", value: "\(info.vtxoExitDelta) ブロック")
                    InfoRow(label: "最小の入金", value: "\(SatFormat.sats(info.minBoardAmountSats)) sats")
                    if let max = info.maxVtxoAmountSats {
                        InfoRow(label: "VTXO の上限", value: "\(SatFormat.sats(max)) sats")
                    }
                } else {
                    Text("サーバー情報を よめませんでした")
                        .font(Brush.text(14))
                        .foregroundStyle(Ink.sub)
                }
            }
            .inkCard()
        }
    }

    // MARK: about

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "このアプリ")
            VStack(alignment: .leading, spacing: 12) {
                InfoRow(label: "ちょうじゅ", value: "v\(AppInfo.version) (\(AppInfo.build))")
                InfoRow(label: "Bark SDK", value: AppInfo.barkSDKVersion)
                Text("Ark プロトコルを使う、自分で鍵を持つ ビットコインのおさいふ。鍵は この iPhone のキーチェーンにだけ 保存されます。")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .inkCard()
        }
    }

    // MARK: danger

    private var dangerSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "とりあつかい注意")
            VStack(alignment: .leading, spacing: 12) {
                InkButton("さいきどう", icon: .refresh, kind: .secondary, height: 48, sound: .power) {
                    close()
                    Task { await store.reboot() }
                }
                if confirmDelete {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("シードと すべてのデータを この端末から消します。シードを控えていないと、資金は 二度と もどりません。続けるには DELETE と入力してください。")
                            .font(Brush.text(13))
                            .foregroundStyle(Ink.alert)
                        TextField("DELETE", text: $deleteText)
                            .font(Brush.mono(15))
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.characters)
                            .padding(12)
                            .background(Ink.bg, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Ink.alert, lineWidth: 1.5))
                        HStack(spacing: 12) {
                            InkButton("消す", kind: .danger, height: 48, sound: .error) {
                                close()
                                Task { await store.deleteWallet() }
                            }
                            .disabled(deleteText != "DELETE")
                            InkButton("やめる", kind: .secondary, height: 48) {
                                withAnimation(.easeOut(duration: 0.2)) {
                                    confirmDelete = false
                                    deleteText = ""
                                }
                            }
                        }
                    }
                    .transition(.opacity.combined(with: .offset(y: -8)))
                } else {
                    InkButton("おさいふを 消す", kind: .danger, height: 48) {
                        withAnimation(.easeOut(duration: 0.2)) { confirmDelete = true }
                    }
                }
            }
            .inkCard(border: Ink.alert.opacity(0.5))
            .shake(trigger: deleteShake)
        }
    }

    // MARK: actions

    private func revealSeed() async {
        let context = LAContext()
        var authError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &authError) else {
            // No passcode on the device: show it anyway, this is the owner's phone.
            withAnimation(.easeOut(duration: 0.15)) { revealedSeed = store.revealMnemonic() }
            return
        }
        do {
            let ok = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "シードフレーズを ひょうじします")
            if ok {
                withAnimation(.easeOut(duration: 0.15)) { revealedSeed = store.revealMnemonic() }
                seedError = nil
            }
        } catch {
            seedError = "本人確認が できませんでした"
        }
    }

    private func maintenance() async {
        runningMaintenance = true
        defer { runningMaintenance = false }
        do {
            try await store.runMaintenance()
            maintenanceStatus = "おわりました"
            Haptics.success()
        } catch {
            maintenanceStatus = error.barkMessage
            Haptics.error()
        }
    }
}

/// `おと          ( ●)`
struct InkToggle: View {
    var title: String
    var detail: String
    @Binding var isOn: Bool
    @State private var flips = 0

    var body: some View {
        Button {
            Chiptune.shared.play(.select)
            Haptics.tap()
            flips += 1
            withAnimation(.spring(duration: 0.3, bounce: 0.3)) { isOn.toggle() }
        } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(Brush.text(15))
                        .foregroundStyle(Ink.ink)
                    Text(detail)
                        .font(Brush.text(12))
                        .foregroundStyle(Ink.sub)
                }
                Spacer()
                ZStack(alignment: isOn ? .trailing : .leading) {
                    Capsule()
                        .fill(isOn ? Ink.ink : Ink.paper)
                        .overlay(Capsule().stroke(Ink.ink, lineWidth: 1.5))
                        .frame(width: 52, height: 30)
                    Circle()
                        .fill(isOn ? Ink.orange : Ink.ink)
                        .frame(width: 20, height: 20)
                        .pop(trigger: flips, from: 0.5)
                        .padding(.horizontal, 5)
                }
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityValue(isOn ? "オン" : "オフ")
        .accessibilityAddTraits(.isButton)
    }
}
