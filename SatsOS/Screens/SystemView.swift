import Bark
import LocalAuthentication
import SwiftUI

/// system.cfg — themes, effects, network, seed, server info, danger zone.
struct SystemView: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.sats) private var t

    @State private var revealedSeed: String?
    @State private var seedError: String?
    @State private var pendingNetwork: ArkNetwork?
    @State private var confirmDelete = false
    @State private var deleteText = ""
    @State private var maintenanceStatus: String?
    @State private var runningMaintenance = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                displaySection
                networkSection
                walletSection
                serverSection
                aboutSection
                dangerSection
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 22)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .alert(
            pendingNetwork == .mainnet ? "MAINNET に切り替えますか？" : "SIGNET に切り替えますか？",
            isPresented: Binding(get: { pendingNetwork != nil }, set: { if !$0 { pendingNetwork = nil } })
        ) {
            Button(pendingNetwork == .mainnet ? "本物のビットコインで使う" : "切り替える",
                   role: pendingNetwork == .mainnet ? .destructive : nil) {
                if let target = pendingNetwork {
                    Task { await store.switchNetwork(to: target) }
                }
                pendingNetwork = nil
            }
            Button("キャンセル", role: .cancel) { pendingNetwork = nil }
        } message: {
            if pendingNetwork == .mainnet {
                Text("MAINNET では本物の bitcoin を扱います。Ark サーバー: ark.second.tech。同じシードを使います。最初は少額で試してください。")
            } else {
                Text("テスト用の signet に切り替えます。")
            }
        }
    }

    // MARK: display

    private var displaySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "display", subtitle: "見た目")
            Text("theme")
                .font(PixelFont.body(13))
                .foregroundStyle(t.dim)
            let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(SatsTheme.all) { theme in
                    ThemeSwatch(theme: theme, selected: settings.themeID == theme.id) {
                        Chiptune.shared.play(.select)
                        Haptics.tap()
                        settings.themeID = theme.id
                    }
                }
            }
            ToggleRow(label: "crt scanlines", detail: "走査線", isOn: $settings.crt)
            ToggleRow(label: "sound", detail: "8-bit 効果音", isOn: $settings.sound)
            ToggleRow(label: "haptics", detail: "振動", isOn: $settings.haptics)
            HStack(spacing: 10) {
                Text("unit")
                    .font(PixelFont.body(14))
                    .foregroundStyle(t.creme)
                Spacer()
                ForEach(AmountUnit.allCases) { unit in
                    PixelChip(title: unit.label, selected: settings.unit == unit) { settings.unit = unit }
                        .frame(width: 84)
                }
            }
        }
    }

    // MARK: network

    private var networkSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "network", subtitle: "ネットワーク")
            HStack(spacing: 10) {
                ForEach(ArkNetwork.allCases) { net in
                    PixelChip(title: net.label, selected: store.network == net) {
                        if net != store.network { pendingNetwork = net }
                    }
                }
            }
            LeaderRow(label: "ark server", value: store.network.serverHost)
            LeaderRow(label: "esplora", value: URL(string: store.network.esploraAddress)?.host ?? store.network.esploraAddress)
            LeaderRow(label: "block", value: store.blockHeight.map { SatFormat.sats($0) } ?? "…")
        }
    }

    // MARK: wallet

    private var walletSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "wallet", subtitle: "ウォレット")
            LeaderRow(label: "fingerprint", value: store.fingerprint ?? "…", monospaced: true)
            if let balance = store.balance {
                LeaderRow(label: "spendable", value: "\(SatFormat.sats(balance.spendableSats)) sats")
                if balance.pendingLightningSendSats > 0 {
                    LeaderRow(label: "ln sending", value: "\(SatFormat.sats(balance.pendingLightningSendSats)) sats")
                }
                if balance.claimableLightningReceiveSats > 0 {
                    LeaderRow(label: "ln claimable", value: "\(SatFormat.sats(balance.claimableLightningReceiveSats)) sats")
                }
                if balance.pendingInRoundSats > 0 {
                    LeaderRow(label: "in round", value: "\(SatFormat.sats(balance.pendingInRoundSats)) sats")
                }
                if balance.needsRefreshSats > 0 {
                    LeaderRow(label: "needs refresh", value: "\(SatFormat.sats(balance.needsRefreshSats)) sats", valueColor: t.braise)
                }
                if balance.pendingExitSats > 0 {
                    LeaderRow(label: "exiting", value: "\(SatFormat.sats(balance.pendingExitSats)) sats")
                }
            }

            HStack(spacing: 12) {
                PixelButton(store.isSyncing ? "syncing…" : "⟳ Sync", kind: .secondary) {
                    Task { await store.sync() }
                }
                .disabled(store.isSyncing)
                PixelButton(runningMaintenance ? "running…" : "Maintenance", kind: .secondary) {
                    Task { await maintenance() }
                }
                .disabled(runningMaintenance)
            }
            if let maintenanceStatus {
                Text(maintenanceStatus)
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.dim)
            }
            Text("Maintenance は期限が近い VTXO を更新します（バックグラウンドでも自動実行されます）。")
                .font(PixelFont.body(11))
                .foregroundStyle(t.dim)

            if let revealedSeed {
                VStack(alignment: .leading, spacing: 10) {
                    Text("[ !! ] 誰にも見せないでください")
                        .font(PixelFont.body(12))
                        .foregroundStyle(t.braise)
                    SeedGrid(words: revealedSeed.split(separator: " ").map(String.init))
                    PixelButton("Hide seed", kind: .secondary) { self.revealedSeed = nil }
                }
            } else {
                PixelButton("Show seed phrase / シードを表示", kind: .secondary) {
                    Task { await revealSeed() }
                }
                if let seedError {
                    Text(seedError)
                        .font(PixelFont.body(12))
                        .foregroundStyle(t.braise)
                }
            }
        }
    }

    // MARK: server

    private var serverSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "ark server", subtitle: "サーバー情報")
            if let info = store.arkInfo {
                LeaderRow(label: "pubkey", value: info.serverPubkey, monospaced: true)
                LeaderRow(label: "round interval", value: "\(info.roundIntervalSecs)s")
                LeaderRow(label: "vtxo lifetime", value: "\(info.vtxoLifetime) blocks")
                LeaderRow(label: "exit delta", value: "\(info.vtxoExitDelta) blocks")
                LeaderRow(label: "min board", value: "\(SatFormat.sats(info.minBoardAmountSats)) sats")
                if let max = info.maxVtxoAmountSats {
                    LeaderRow(label: "max vtxo", value: "\(SatFormat.sats(max)) sats")
                }
            } else {
                Text("server info unavailable")
                    .font(PixelFont.body(13))
                    .foregroundStyle(t.dim)
            }
        }
    }

    // MARK: about

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "about", subtitle: "このアプリ")
            LeaderRow(label: "Sats-OS", value: "v\(AppInfo.version) (\(AppInfo.build))")
            LeaderRow(label: "Bark SDK", value: AppInfo.barkSDKVersion)
            Text("Ark プロトコルによる自己管理型ビットコインウォレット。鍵はこの iPhone のキーチェーンにだけ保存されます。\nfonts: Jacquard 12 / DotGothic16 / Pixelify Sans (SIL OFL 1.1) · mascot: bitty")
                .font(PixelFont.body(11))
                .foregroundStyle(t.dim)
            HStack {
                Spacer()
                TalkingBitty(scale: 1.0)
            }
        }
    }

    // MARK: danger

    private var dangerSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "danger zone", subtitle: "取り扱い注意")
            PixelButton("Reboot / 再起動", kind: .secondary, sound: .power) {
                Task { await store.reboot() }
            }
            if confirmDelete {
                VStack(alignment: .leading, spacing: 10) {
                    Text("シードとすべてのデータをこの端末から消去します。シードを控えていない場合、資金は永久に失われます。続けるには DELETE と入力してください。")
                        .font(PixelFont.body(12))
                        .foregroundStyle(t.braise)
                    TextField("DELETE", text: $deleteText)
                        .pixelField()
                    HStack(spacing: 12) {
                        PixelButton("Delete wallet", kind: .danger, sound: .error) {
                            Task { await store.deleteWallet() }
                        }
                        .disabled(deleteText != "DELETE")
                        PixelButton("Cancel", kind: .secondary) {
                            confirmDelete = false
                            deleteText = ""
                        }
                    }
                }
                .pixelBox(t, padding: 14, border: t.braise)
            } else {
                PixelButton("Delete wallet / ウォレット削除", kind: .danger) {
                    confirmDelete = true
                }
            }
        }
    }

    // MARK: actions

    private func revealSeed() async {
        let context = LAContext()
        var authError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &authError) else {
            // No passcode set on the device: show it anyway, this is the owner's phone.
            revealedSeed = store.revealMnemonic()
            return
        }
        do {
            let ok = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "シードフレーズを表示します")
            if ok {
                revealedSeed = store.revealMnemonic()
                seedError = nil
            }
        } catch {
            seedError = "認証に失敗しました / authentication failed"
        }
    }

    private func maintenance() async {
        runningMaintenance = true
        defer { runningMaintenance = false }
        do {
            try await store.runMaintenance()
            maintenanceStatus = "[ OK ] maintenance done"
        } catch {
            maintenanceStatus = "[ !! ] \(error.barkMessage)"
        }
    }
}

struct ThemeSwatch: View {
    var theme: SatsTheme
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 0) {
                    ForEach(Array(theme.swatches.enumerated()), id: \.offset) { _, color in
                        Rectangle().fill(color)
                    }
                }
                .frame(height: 16)
                .overlay(Rectangle().stroke(theme.line, lineWidth: 1))
                HStack {
                    Text(theme.name)
                        .font(PixelFont.ui(14, bold: true))
                        .foregroundStyle(theme.encre)
                    Spacer()
                    if selected {
                        Text("●")
                            .font(PixelFont.ui(12))
                            .foregroundStyle(theme.encre)
                    }
                }
            }
            .padding(10)
            .background(theme.papier)
            .overlay(Rectangle().stroke(selected ? theme.encre : theme.line, lineWidth: selected ? 3 : 2))
            .background(Rectangle().fill(theme.braise).offset(x: selected ? 4 : 0, y: selected ? 4 : 0))
        }
        .buttonStyle(.plain)
    }
}

struct ToggleRow: View {
    @Environment(\.sats) private var t
    var label: String
    var detail: String
    @Binding var isOn: Bool

    var body: some View {
        Button {
            Chiptune.shared.play(.select)
            Haptics.tap()
            isOn.toggle()
        } label: {
            HStack(spacing: 10) {
                Text(label)
                    .font(PixelFont.body(14))
                    .foregroundStyle(t.creme)
                Text(detail)
                    .font(PixelFont.body(11))
                    .foregroundStyle(t.dim)
                Spacer()
                Text(isOn ? "[ ON  ]" : "[ OFF ]")
                    .font(PixelFont.ui(14, bold: true))
                    .foregroundStyle(isOn ? t.encre : t.dim)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
