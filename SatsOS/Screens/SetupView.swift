import SwiftUI

/// First run: create a new wallet ("NEW GAME") or restore one from a seed.
struct SetupView: View {
    @EnvironmentObject private var store: WalletStore
    @Environment(\.sats) private var t

    enum Step: Equatable {
        case menu
        case showSeed(String)
        case restore
    }

    @State private var step: Step = .menu
    @State private var wroteItDown = false
    @State private var restoreText = ""
    @State private var error: String?
    @State private var working = false

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 6) {
                    BlackletterTitle(text: "Sats-OS", size: 58)
                    Text("SETUP.EXE — ウォレットのセットアップ")
                        .font(PixelFont.ui(13))
                        .foregroundStyle(t.encre)
                }
                .padding(.top, 36)

                switch step {
                case .menu:
                    menu
                case .showSeed(let words):
                    seedBackup(words)
                case .restore:
                    restore
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: menu

    private var menu: some View {
        VStack(spacing: 22) {
            PixelWindow(title: "setup.exe", status: "NO WALLET", statusColor: t.braise, blinkStatus: true) {
                VStack(alignment: .leading, spacing: 16) {
                    Text("> ゲームをはじめますか？")
                        .font(PixelFont.body(15))
                        .foregroundStyle(t.creme)

                    PixelButton("▶ New wallet / 新しく作る", sound: .select) {
                        do {
                            let words = try store.makeMnemonic()
                            wroteItDown = false
                            step = .showSeed(words)
                        } catch {
                            self.error = error.localizedDescription
                        }
                    }
                    PixelButton("Restore / シードから復元", kind: .secondary, sound: .select) {
                        error = nil
                        step = .restore
                    }
                    if let error {
                        Text(error)
                            .font(PixelFont.body(12))
                            .foregroundStyle(t.braise)
                    }
                }
            }

            PixelWindow(title: "network.cfg") {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        ForEach(ArkNetwork.allCases) { net in
                            PixelChip(title: net.label, selected: store.network == net) {
                                store.chooseNetworkForSetup(net)
                            }
                        }
                    }
                    if store.network.isRealMoney {
                        Text("[ !! ] MAINNET は本物のビットコインです。最初は少額で試してください。")
                            .font(PixelFont.body(12))
                            .foregroundStyle(t.braise)
                    } else {
                        Text("SIGNET はテスト用ネットワーク。無料のテストコインで遊べます。")
                            .font(PixelFont.body(12))
                            .foregroundStyle(t.dim)
                    }
                    LeaderRow(label: "ark server", value: store.network.serverHost)
                }
            }

            HStack(alignment: .bottom) {
                Text("powered by Bark SDK \(AppInfo.barkSDKVersion)\nArk protocol · Second")
                    .font(PixelFont.body(11))
                    .foregroundStyle(t.dim)
                Spacer()
                TalkingBitty(scale: 1.1)
            }
        }
    }

    // MARK: new wallet

    private func seedBackup(_ mnemonic: String) -> some View {
        let words = mnemonic.split(separator: " ").map(String.init)
        return VStack(spacing: 22) {
            PixelWindow(title: "seed.txt", status: "SECRET", statusColor: t.braise) {
                VStack(alignment: .leading, spacing: 14) {
                    Text("この \(words.count) 個の単語があなたの鍵です。紙に書いて安全な場所に保管してください。スクリーンショットは撮らないで！")
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.creme)

                    SeedGrid(words: words)

                    Button {
                        Chiptune.shared.play(.select)
                        Haptics.tap()
                        wroteItDown.toggle()
                    } label: {
                        HStack(spacing: 10) {
                            Text(wroteItDown ? "[x]" : "[ ]")
                                .font(PixelFont.ui(16, bold: true))
                                .foregroundStyle(t.encre)
                            Text("書き留めました / I wrote it down")
                                .font(PixelFont.body(14))
                                .foregroundStyle(t.creme)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            PixelButton("Start / はじめる", sound: .boot) {
                guard !working else { return }
                working = true
                Task {
                    await store.installWallet(mnemonic: mnemonic, restored: false)
                    working = false
                }
            }
            .disabled(!wroteItDown || working)

            PixelButton("Back", kind: .secondary) {
                step = .menu
            }
        }
    }

    // MARK: restore

    private var restore: some View {
        let count = store.normalizedMnemonic(restoreText).split(separator: " ").count
        let valid = store.isValidMnemonic(restoreText)
        return VStack(spacing: 22) {
            PixelWindow(title: "restore.exe") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("12 / 24 個の単語をスペース区切りで入力")
                        .font(PixelFont.body(13))
                        .foregroundStyle(t.creme)
                    TextEditor(text: $restoreText)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 130)
                        .pixelField()
                    HStack {
                        Text("\(count) words")
                            .font(PixelFont.ui(13))
                            .foregroundStyle(t.dim)
                        Spacer()
                        if count > 0 {
                            Text(valid ? "[ OK ] checksum" : "[ .. ] checking")
                                .font(PixelFont.ui(13))
                                .foregroundStyle(valid ? t.encre : t.dim)
                        }
                    }
                    Text("復元時はサーバーの mailbox から残高を探します（ネットワーク: \(store.network.label)）。")
                        .font(PixelFont.body(11))
                        .foregroundStyle(t.dim)
                }
            }

            PixelButton("Restore / 復元する", sound: .boot) {
                guard !working else { return }
                working = true
                Task {
                    await store.installWallet(mnemonic: restoreText, restored: true)
                    working = false
                }
            }
            .disabled(!valid || working)

            PixelButton("Back", kind: .secondary) {
                restoreText = ""
                step = .menu
            }
        }
    }
}

struct SeedGrid: View {
    @Environment(\.sats) private var t
    var words: [String]

    var body: some View {
        let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                HStack(spacing: 8) {
                    Text(String(format: "%02d", index + 1))
                        .font(PixelFont.ui(13))
                        .foregroundStyle(t.braise)
                    Text(word)
                        .font(.system(size: 15, weight: .semibold, design: .monospaced))
                        .foregroundStyle(t.creme)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 6)
                .padding(.horizontal, 8)
                .background(t.bgLo)
                .overlay(Rectangle().stroke(t.line, lineWidth: 2))
            }
        }
        .privacySensitive()
    }
}
