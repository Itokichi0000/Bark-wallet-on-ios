import SwiftUI

/// First run: make a new wallet or bring one back from a seed phrase.
struct SetupView: View {
    @EnvironmentObject private var store: WalletStore

    enum Step: Equatable {
        case welcome
        case showSeed(String)
        case restore
    }

    @State private var step: Step = .welcome
    @State private var forward = true
    @State private var wroteItDown = false
    @State private var restoreText = ""
    @State private var error: String?
    @State private var working = false
    @State private var checkTick = 0

    var body: some View {
        ScrollView {
            ZStack(alignment: .top) {
                Group {
                    switch step {
                    case .welcome: welcome
                    case .showSeed(let words): seedBackup(words)
                    case .restore: restore
                    }
                }
                .id(stepKey)
                .transition(stepTransition)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(PaperBackground())
    }

    private var stepKey: String {
        switch step {
        case .welcome: return "welcome"
        case .showSeed: return "seed"
        case .restore: return "restore"
        }
    }

    private var stepTransition: AnyTransition {
        let distance: CGFloat = forward ? 40 : -40
        return .asymmetric(
            insertion: .offset(x: distance).combined(with: .opacity),
            removal: .offset(x: -distance).combined(with: .opacity)
        )
    }

    private func go(_ next: Step, forward: Bool) {
        self.forward = forward
        withAnimation(.spring(duration: 0.4, bounce: 0.15)) { step = next }
    }

    // MARK: welcome

    private var welcome: some View {
        VStack(spacing: 22) {
            VStack(spacing: 8) {
                SealStamp(text: "寿", size: 36)
                Text("ちょうじゅ")
                    .font(Brush.bold(28, relativeTo: .largeTitle))
                    .foregroundStyle(Ink.ink)
                Text("Ark で ビットコインを すばやく・安く。\nしくみが 見える おさいふ")
                    .font(Brush.text(14))
                    .foregroundStyle(Ink.sub)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 40)
            .appearIn()

            ArkScenePlayer(scene: .arkoor, height: 190, showsBeats: false, showsControls: false)
                .inkCard()
                .appearIn(delay: 0.1)

            VStack(spacing: 12) {
                InkButton("あたらしく つくる", sound: .select) {
                    do {
                        let words = try store.makeMnemonic()
                        wroteItDown = false
                        error = nil
                        go(.showSeed(words), forward: true)
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
                InkButton("シードフレーズから もどす", kind: .secondary, sound: .select) {
                    error = nil
                    go(.restore, forward: true)
                }
                if let error {
                    Text(error)
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.alert)
                }
            }
            .appearIn(delay: 0.2)

            VStack(alignment: .leading, spacing: 10) {
                SectionLabel(text: "ネットワーク")
                HStack(spacing: 10) {
                    ForEach(ArkNetwork.allCases) { net in
                        InkChip(title: net == .mainnet ? "本番（MAINNET）" : "テスト（SIGNET）", selected: store.network == net) {
                            store.chooseNetworkForSetup(net)
                        }
                    }
                }
                Text(store.network.isRealMoney
                     ? "本物のビットコインを あつかいます。さいしょは 少しの金額で ためしてください。"
                     : "テスト用のネットワーク。無料のテストコインで あそべます。")
                    .font(Brush.text(12))
                    .foregroundStyle(store.network.isRealMoney ? Ink.alert : Ink.sub)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .inkCard()
            .appearIn(delay: 0.3)

            Text("Bark SDK \(AppInfo.barkSDKVersion) ・ Ark protocol")
                .font(Brush.text(11))
                .foregroundStyle(Ink.sub)
        }
    }

    // MARK: new wallet

    private func seedBackup(_ mnemonic: String) -> some View {
        let words = mnemonic.split(separator: " ").map(String.init)
        return VStack(spacing: 20) {
            header("シードフレーズ") { go(.welcome, forward: false) }

            Text("この \(words.count) 個の ことばが あなたの 鍵です")
                .font(Brush.bold(16))
                .foregroundStyle(Ink.ink)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 14) {
                Text("紙に書いて、安全な場所に しまってください。スクリーンショットは とらないで。")
                    .font(Brush.text(14))
                    .foregroundStyle(Ink.ink)
                SeedGrid(words: words, animated: true)
                Button {
                    Chiptune.shared.play(.select)
                    Haptics.tap()
                    wroteItDown.toggle()
                    checkTick += 1
                } label: {
                    HStack(spacing: 10) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .fill(wroteItDown ? Ink.ink : Ink.paper)
                                .frame(width: 26, height: 26)
                                .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(Ink.ink, lineWidth: 1.5))
                            if wroteItDown {
                                InkIcon(kind: .check, size: 18, lineWidth: 2.6, color: Ink.paper)
                            }
                        }
                        .pop(trigger: checkTick, from: 0.75)
                        Text("書きとめました")
                            .font(Brush.text(15))
                            .foregroundStyle(Ink.ink)
                    }
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(wroteItDown ? .isSelected : [])
            }
            .inkCard()

            InkButton(working ? "じゅんび中…" : "はじめる", sound: .boot) {
                guard !working else { return }
                working = true
                Task {
                    await store.installWallet(mnemonic: mnemonic, restored: false)
                    working = false
                }
            }
            .disabled(!wroteItDown || working)
        }
        .padding(.top, 8)
    }

    // MARK: restore

    private var restore: some View {
        let count = store.normalizedMnemonic(restoreText).split(separator: " ").count
        let valid = store.isValidMnemonic(restoreText)
        return VStack(spacing: 20) {
            header("シードから もどす") {
                restoreText = ""
                go(.welcome, forward: false)
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("12 / 24 個の ことばを スペースで区切って 入れてください")
                    .font(Brush.text(14))
                    .foregroundStyle(Ink.ink)
                TextEditor(text: $restoreText)
                    .font(Brush.mono(15))
                    .foregroundStyle(Ink.ink)
                    .scrollContentBackground(.hidden)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .frame(minHeight: 130)
                    .padding(10)
                    .background(Ink.bg, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Ink.line, lineWidth: 1.5))
                HStack {
                    Text("\(count) 個")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                        .contentTransition(.numericText(value: Double(count)))
                        .animation(.snappy(duration: 0.2), value: count)
                    Spacer()
                    if count > 0 {
                        HStack(spacing: 4) {
                            if valid { InkIcon(kind: .check, size: 16, lineWidth: 2.4) }
                            Text(valid ? "ただしい ことばです" : "たしかめ中…")
                        }
                        .font(Brush.text(13))
                        .foregroundStyle(valid ? Ink.ink : Ink.sub)
                        .pop(trigger: valid ? 1 : 0, from: 0.85)
                    }
                }
                Text("もどすとき、サーバーの mailbox から残高を さがします（\(store.network.isRealMoney ? "本番" : "テスト用")ネットワーク）。")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
            }
            .inkCard()

            InkButton(working ? "もどしています…" : "もどす", sound: .boot) {
                guard !working else { return }
                working = true
                Task {
                    await store.installWallet(mnemonic: restoreText, restored: true)
                    working = false
                }
            }
            .disabled(!valid || working)
        }
        .padding(.top, 8)
    }

    private func header(_ title: String, back: @escaping () -> Void) -> some View {
        HStack(spacing: 4) {
            Button {
                Chiptune.shared.play(.click)
                Haptics.tap()
                back()
            } label: {
                InkIcon(kind: .back, size: 22, lineWidth: 2)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("もどる")
            Text(title)
                .font(Brush.bold(22, relativeTo: .title2))
                .foregroundStyle(Ink.ink)
            Spacer()
        }
        .padding(.top, 10)
    }
}
