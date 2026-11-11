import SwiftUI

// MARK: - Backgrounds

/// Dark CRT glass: a warm radial glow in the middle that falls off to the edges.
struct CRTBackground: View {
    @Environment(\.sats) private var t

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                t.bgLo
                RadialGradient(
                    colors: [t.bgHi, t.bgLo],
                    center: .center,
                    startRadius: 0,
                    endRadius: max(proxy.size.width, proxy.size.height) * 0.75
                )
            }
        }
        .ignoresSafeArea()
    }
}

/// Scanlines + vignette laid over the whole app, like the website's CRT pass.
struct ScanlineOverlay: View {
    @Environment(\.sats) private var t

    var body: some View {
        ZStack {
            Canvas { context, size in
                var y: CGFloat = 0
                while y < size.height {
                    context.fill(
                        Path(CGRect(x: 0, y: y, width: size.width, height: 1)),
                        with: .color(.black.opacity(t.isLight ? 0.06 : 0.22))
                    )
                    y += 3
                }
            }
            RadialGradient(
                colors: [.clear, .black.opacity(t.isLight ? 0.18 : 0.55)],
                center: .center,
                startRadius: 180,
                endRadius: 620
            )
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - Window

/// A Sats-OS window: thick ink border, title bar, hard offset shadow.
struct PixelWindow<Content: View>: View {
    @Environment(\.sats) private var t

    var title: String
    var status: String?
    var statusColor: Color?
    var blinkStatus = false
    var onClose: (() -> Void)?
    var padding: CGFloat = 14
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text(title)
                    .font(PixelFont.body(13))
                    .foregroundStyle(t.creme)
                    .lineLimit(1)
                Spacer(minLength: 4)
                if let status {
                    HStack(spacing: 5) {
                        BlinkingSquare(color: statusColor ?? t.braise, blinking: blinkStatus)
                        Text(status)
                            .font(PixelFont.ui(12))
                            .foregroundStyle(statusColor ?? t.braise)
                    }
                }
                if let onClose {
                    Button {
                        Chiptune.shared.play(.click)
                        Haptics.tap()
                        onClose()
                    } label: {
                        Text("✕")
                            .font(PixelFont.ui(14, bold: true))
                            .foregroundStyle(t.encre)
                            .frame(width: 26, height: 22)
                            .overlay(Rectangle().stroke(t.encre, lineWidth: 2))
                    }
                    .accessibilityLabel("Close")
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            Rectangle().fill(t.encre).frame(height: 3)
            content()
                .padding(padding)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(t.papier)
        .overlay(Rectangle().stroke(t.encre, lineWidth: 3))
        .background(Rectangle().fill(t.braise).offset(x: 6, y: 6))
    }
}

struct BlinkingSquare: View {
    var color: Color
    var blinking = true
    var size: CGFloat = 8
    @State private var on = true

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(width: size, height: size)
            .opacity(on ? 1 : 0.15)
            .onAppear {
                guard blinking else { return }
                withAnimation(.linear(duration: 0.01).delay(1).repeatForever(autoreverses: true)) {
                    on = false
                }
            }
    }
}

struct BlinkingCursor: View {
    @Environment(\.sats) private var t
    var color: Color?

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { context in
            let visible = Int(context.date.timeIntervalSinceReferenceDate * 2) % 2 == 0
            Text("▮")
                .foregroundStyle(color ?? t.encre)
                .opacity(visible ? 1 : 0)
        }
    }
}

// MARK: - Buttons

struct PixelButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, danger }

    var kind: Kind = .primary
    var theme: SatsTheme
    var fullWidth = true

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        let fill: Color
        let ink: Color
        let border: Color
        switch kind {
        case .primary:
            fill = theme.encre; ink = theme.onEncre; border = theme.encre
        case .secondary:
            fill = theme.papier; ink = theme.encre; border = theme.encre
        case .danger:
            fill = theme.papier; ink = theme.braise; border = theme.braise
        }
        return configuration.label
            .font(PixelFont.ui(17, bold: true))
            .textCase(.uppercase)
            .foregroundStyle(ink)
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .background(fill)
            .overlay(Rectangle().stroke(border, lineWidth: 3))
            .background(
                Rectangle()
                    .fill(kind == .primary ? theme.braise : theme.rouille)
                    .offset(x: pressed ? 1 : 4, y: pressed ? 1 : 4)
            )
            .offset(x: pressed ? 3 : 0, y: pressed ? 3 : 0)
            .animation(.linear(duration: 0.05), value: pressed)
    }
}

/// Button with the click blip + haptic built in.
struct PixelButton: View {
    @Environment(\.sats) private var t
    @Environment(\.isEnabled) private var isEnabled

    var title: String
    var kind: PixelButtonStyle.Kind = .primary
    var fullWidth = true
    var sound: Chiptune.SFX = .click
    var action: () -> Void

    init(_ title: String, kind: PixelButtonStyle.Kind = .primary, fullWidth: Bool = true,
         sound: Chiptune.SFX = .click, action: @escaping () -> Void) {
        self.title = title
        self.kind = kind
        self.fullWidth = fullWidth
        self.sound = sound
        self.action = action
    }

    var body: some View {
        Button {
            Chiptune.shared.play(sound)
            Haptics.tap()
            action()
        } label: {
            Text(title)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .buttonStyle(PixelButtonStyle(kind: kind, theme: t, fullWidth: fullWidth))
        .opacity(isEnabled ? 1 : 0.4)
    }
}

/// Small bordered chip button used for tabs and toggles.
struct PixelChip: View {
    @Environment(\.sats) private var t
    var title: String
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button {
            Chiptune.shared.play(.select)
            Haptics.tap()
            action()
        } label: {
            Text(title)
                .font(PixelFont.ui(14, bold: true))
                .foregroundStyle(selected ? t.onEncre : t.encre)
                .padding(.vertical, 7)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity)
                .background(selected ? t.encre : t.papier)
                .overlay(Rectangle().stroke(t.encre, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Text rows

/// `label ............ value`
struct LeaderRow: View {
    @Environment(\.sats) private var t
    var label: String
    var value: String
    var valueColor: Color?
    var monospaced = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(label)
                .font(PixelFont.body(14))
                .foregroundStyle(t.dim)
                .lineLimit(1)
                .layoutPriority(1)
            DottedLine()
                .stroke(t.line, style: StrokeStyle(lineWidth: 2, dash: [2, 4]))
                .frame(height: 2)
                .frame(minWidth: 12)
            Text(value)
                .font(monospaced ? .system(size: 13, design: .monospaced) : PixelFont.body(14))
                .foregroundStyle(valueColor ?? t.creme)
                .lineLimit(1)
                .truncationMode(.middle)
                .layoutPriority(2)
        }
    }
}

struct DottedLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return path
    }
}

/// `[ OK ]` `[ .. ]` `[ !! ]`
struct StatusTag: View {
    @Environment(\.sats) private var t
    var status: BootLine.Status

    var body: some View {
        Text(label)
            .font(PixelFont.ui(14))
            .foregroundStyle(color)
    }

    private var label: String {
        switch status {
        case .ok: return "[ OK ]"
        case .busy: return "[ .. ]"
        case .warn: return "[ !! ]"
        case .fail: return "[FAIL]"
        }
    }

    private var color: Color {
        switch status {
        case .ok: return t.encre
        case .busy: return t.dim
        case .warn: return t.braise
        case .fail: return t.braise
        }
    }
}

/// The five color bar from the boot screen.
struct SegmentBar: View {
    @Environment(\.sats) private var t
    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array([t.rouille, t.braise, t.encre, t.creme, t.grid].enumerated()), id: \.offset) { _, color in
                Rectangle().fill(color)
            }
        }
        .frame(height: 10)
    }
}

/// `▮▮▮▮▮▮▮▮▮▮....` progress bar
struct SegmentProgress: View {
    @Environment(\.sats) private var t
    var progress: Double
    var segments = 28

    var body: some View {
        GeometryReader { proxy in
            let filled = Int((Double(segments) * min(max(progress, 0), 1)).rounded(.down))
            HStack(spacing: 2) {
                ForEach(0..<segments, id: \.self) { index in
                    Rectangle()
                        .fill(index < filled ? t.encre : t.grid)
                }
            }
            .padding(3)
            .frame(width: proxy.size.width, height: proxy.size.height)
            .overlay(Rectangle().stroke(t.encre, lineWidth: 2))
        }
        .frame(height: 18)
    }
}

/// `~/desktop / send.exe                ESC ✕`
struct PathBar: View {
    @Environment(\.sats) private var t
    var path: String
    var onClose: () -> Void

    var body: some View {
        HStack {
            Text("~/desktop")
                .foregroundStyle(t.dim)
            + Text(" / ")
                .foregroundStyle(t.dim)
            + Text(path)
                .foregroundStyle(t.encre)
            Spacer()
            Button {
                Chiptune.shared.play(.click)
                Haptics.tap()
                onClose()
            } label: {
                Text("ESC ✕ 戻る")
                    .foregroundStyle(t.dim)
                    .padding(.vertical, 6)
                    .padding(.leading, 12)
            }
            .buttonStyle(.plain)
        }
        .font(PixelFont.body(13))
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .overlay(alignment: .bottom) {
            Rectangle().fill(t.line).frame(height: 2)
        }
    }
}

/// Section heading in system.cfg style: `[ display ]`
struct SectionHeader: View {
    @Environment(\.sats) private var t
    var title: String
    var subtitle: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("[ \(title) ]")
                .font(PixelFont.ui(15, bold: true))
                .foregroundStyle(t.encre)
            if let subtitle {
                Text(subtitle)
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.dim)
            }
            Spacer()
        }
    }
}

/// Big blackletter title with the website's hard text shadow.
struct BlackletterTitle: View {
    @Environment(\.sats) private var t
    var text: String
    var size: CGFloat = 54
    var color: Color?

    var body: some View {
        Text(text)
            .font(PixelFont.head(size))
            .foregroundStyle(color ?? t.creme)
            .shadow(color: t.rouille, radius: 0, x: 4, y: 4)
            .lineLimit(1)
            .minimumScaleFactor(0.5)
    }
}

// MARK: - Inputs

struct PixelFieldModifier: ViewModifier {
    @Environment(\.sats) private var t
    func body(content: Content) -> some View {
        content
            .font(.system(size: 15, design: .monospaced))
            .foregroundStyle(t.creme)
            .tint(t.encre)
            .padding(10)
            .background(t.bgLo)
            .overlay(Rectangle().stroke(t.encre, lineWidth: 2))
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
    }
}

extension View {
    func pixelField() -> some View { modifier(PixelFieldModifier()) }
}

// MARK: - Toast

struct ToastView: View {
    @Environment(\.sats) private var t
    var toast: WalletToast

    var body: some View {
        HStack(spacing: 10) {
            Text(icon)
                .font(PixelFont.ui(20, bold: true))
                .foregroundStyle(accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(toast.title)
                    .font(PixelFont.ui(15, bold: true))
                    .foregroundStyle(accent)
                Text(toast.message)
                    .font(PixelFont.body(13))
                    .foregroundStyle(t.creme)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(t.papier)
        .overlay(Rectangle().stroke(accent, lineWidth: 3))
        .background(Rectangle().fill(t.braise).offset(x: 5, y: 5))
        .padding(.horizontal, 16)
    }

    private var icon: String {
        switch toast.style {
        case .incoming: return "₿"
        case .outgoing: return "⇢"
        case .info: return "i"
        case .error: return "!!"
        }
    }

    private var accent: Color {
        switch toast.style {
        case .incoming: return t.encre
        case .outgoing: return t.creme
        case .info: return t.encre
        case .error: return t.braise
        }
    }
}

// MARK: - Celebration

/// Pixel coins raining down when sats arrive or a payment completes.
struct CoinBurst: View {
    @Environment(\.sats) private var t
    var trigger: Int

    @State private var start: Date?
    @State private var coins: [Coin] = (0..<60).map { _ in Coin() }

    struct Coin {
        let x = Double.random(in: 0...1)
        let delay = Double.random(in: 0...0.6)
        let speed = Double.random(in: 0.7...1.3)
        let size = Double.random(in: 6...12).rounded()
        let colorIndex = Int.random(in: 0...2)
    }

    var body: some View {
        TimelineView(.animation(paused: start == nil)) { context in
            Canvas { gc, size in
                guard let start else { return }
                let elapsed = context.date.timeIntervalSince(start)
                let palette = [t.encre, t.creme, t.braise]
                for coin in coins {
                    let local = elapsed - coin.delay
                    guard local > 0 else { continue }
                    let y = -20 + local * local * 900 * coin.speed
                    guard y < size.height + 20 else { continue }
                    let wobble = sin(local * 9 + coin.x * 20) * 6
                    let x = coin.x * size.width + wobble
                    // snap to a 2pt grid so motion looks stepped / pixel-ish
                    let rect = CGRect(x: (x / 2).rounded() * 2, y: (y / 2).rounded() * 2, width: coin.size, height: coin.size)
                    gc.fill(Path(rect), with: .color(palette[coin.colorIndex]))
                    if coin.size >= 10 {
                        gc.fill(Path(rect.insetBy(dx: 3, dy: 3)), with: .color(t.rouille))
                    }
                }
            }
        }
        .allowsHitTesting(false)
        .onChange(of: trigger) { _, _ in
            start = Date()
            Task {
                try? await Task.sleep(nanoseconds: 2_200_000_000)
                start = nil
            }
        }
    }
}
