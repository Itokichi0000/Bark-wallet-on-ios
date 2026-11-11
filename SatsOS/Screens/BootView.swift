import SwiftUI

extension View {
    /// The bordered box with the hard orange shadow used all over Sats-OS.
    func pixelBox(_ theme: SatsTheme, padding: CGFloat = 16, border: Color? = nil) -> some View {
        self
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(theme.papier)
            .overlay(Rectangle().stroke(border ?? theme.encre, lineWidth: 3))
            .background(Rectangle().fill(theme.braise).offset(x: 6, y: 6))
    }
}

/// Boot screen, modeled on the website's Sats-OS boot:
/// title box, `[ OK ]` log, progress bar, "PRESS ANY KEY".
struct BootView: View {
    @EnvironmentObject private var store: WalletStore
    @Environment(\.sats) private var t
    var onEnter: () -> Void

    @State private var confirmReset = false

    private var progress: Double {
        switch store.phase {
        case .ready: return 1
        default: return min(Double(store.bootLog.count) / 7.0, 0.95)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                Spacer(minLength: 24)

                VStack(spacing: 10) {
                    BlackletterTitle(text: "Sats-OS", size: 64)
                        .frame(maxWidth: .infinity)
                    Text("WALLET EDITION · v\(AppInfo.version) · \(store.network.label) · BLOCK \(heightText)")
                        .font(PixelFont.ui(12))
                        .foregroundStyle(t.encre)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                    SegmentBar()
                        .padding(.top, 6)
                }
                .pixelBox(t, padding: 18)

                VStack(alignment: .leading, spacing: 9) {
                    ForEach(store.bootLog) { line in
                        BootLogRow(line: line)
                            .transition(.opacity)
                    }
                    if store.bootLog.isEmpty {
                        Text("POST… memory check 21,000,000 OK")
                            .font(PixelFont.body(13))
                            .foregroundStyle(t.dim)
                    }
                    SegmentProgress(progress: progress)
                        .padding(.top, 8)
                        .animation(.linear(duration: 0.2), value: progress)
                }
                .pixelBox(t, padding: 16)

                footer
                    .frame(maxWidth: .infinity)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .contentShape(Rectangle())
        .onTapGesture {
            if store.phase == .ready { onEnter() }
        }
        .confirmationDialog(
            "このネットワークのローカルデータを消して、シードから復元しますか？",
            isPresented: $confirmReset,
            titleVisibility: .visible
        ) {
            Button("RESET LOCAL DATA", role: .destructive) {
                Task { await store.resetLocalData() }
            }
        } message: {
            Text("シードフレーズは残ります。残高はサーバーの協力で復元されます。")
        }
    }

    private var heightText: String {
        store.blockHeight.map { SatFormat.sats($0) } ?? "…"
    }

    @ViewBuilder
    private var footer: some View {
        switch store.phase {
        case .ready:
            VStack(spacing: 6) {
                HStack(spacing: 8) {
                    BlinkingSquare(color: t.encre, size: 7)
                    Text("TAP TO ENTER")
                        .font(PixelFont.ui(16, bold: true))
                        .foregroundStyle(t.encre)
                    BlinkingSquare(color: t.encre, size: 7)
                }
                Text("タップして入ります")
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.dim)
            }
            .padding(.vertical, 8)
        case .failed(let message):
            VStack(alignment: .leading, spacing: 12) {
                Text("[FAIL] ark.drv が起動できませんでした")
                    .font(PixelFont.ui(15, bold: true))
                    .foregroundStyle(t.braise)
                Text(message)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(t.creme)
                    .textSelection(.enabled)
                PixelButton("Retry / 再起動", sound: .power) {
                    Task { await store.reboot() }
                }
                PixelButton("Reset local data", kind: .secondary) {
                    confirmReset = true
                }
                let other: ArkNetwork = store.network == .signet ? .mainnet : .signet
                if other == .signet {
                    PixelButton("Switch to \(other.label)", kind: .secondary) {
                        Task { await store.switchNetwork(to: other) }
                    }
                }
            }
            .pixelBox(t, padding: 16, border: t.braise)
        default:
            HStack(spacing: 4) {
                Text("booting")
                    .font(PixelFont.body(13))
                    .foregroundStyle(t.dim)
                BlinkingCursor(color: t.dim)
                    .font(PixelFont.body(13))
            }
        }
    }
}

struct BootLogRow: View {
    @Environment(\.sats) private var t
    var line: BootLine

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            StatusTag(status: line.status)
            Text(line.name)
                .font(PixelFont.body(13))
                .foregroundStyle(t.encre)
                .lineLimit(1)
                .layoutPriority(1)
            DottedLine()
                .stroke(t.line, style: StrokeStyle(lineWidth: 2, dash: [2, 4]))
                .frame(height: 2)
                .frame(minWidth: 10)
            Text(line.detail)
                .font(PixelFont.body(13))
                .foregroundStyle(line.status == .fail ? t.braise : t.creme)
                .lineLimit(1)
                .layoutPriority(1)
        }
    }
}
