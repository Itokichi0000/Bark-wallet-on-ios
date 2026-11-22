import Bark
import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI

// MARK: - Buttons

/// Any tappable thing: it sinks a little under the finger and springs back.
struct PressableStyle: ButtonStyle {
    var scale: CGFloat = 0.96

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .opacity(configuration.isPressed ? 0.88 : 1)
            .animation(Motion.press, value: configuration.isPressed)
    }
}

/// A flat pill button.
struct InkButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, quiet, danger }
    var kind: Kind = .primary
    var height: CGFloat = 56

    func makeBody(configuration: Configuration) -> some View {
        let down = configuration.isPressed
        return configuration.label
            .font(Brush.bold(17))
            .foregroundStyle(Self.text(kind))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: min(height, 52))
            .background { face }
            .scaleEffect(down ? 0.97 : 1)
            .opacity(down ? 0.8 : 1)
            .animation(Motion.press, value: down)
    }

    static func text(_ kind: Kind) -> Color {
        switch kind {
        case .primary: return Ink.onTint
        case .secondary, .quiet: return Ink.ink
        case .danger: return Ink.alert
        }
    }

    @ViewBuilder
    private var face: some View {
        switch kind {
        case .primary: Capsule().fill(Ink.tint)
        case .secondary: Capsule().fill(Ink.wash)
        case .quiet: Capsule().strokeBorder(Ink.line, lineWidth: 1)
        case .danger: Capsule().fill(Ink.alertSoft)
        }
    }
}

/// Button with a soft sound and tap haptic.
struct InkButton: View {
    @Environment(\.isEnabled) private var isEnabled
    var title: String
    var icon: InkIcon.Kind?
    var kind: InkButtonStyle.Kind = .primary
    var height: CGFloat = 56
    var sound: Chiptune.SFX = .click
    var action: () -> Void

    init(_ title: String, icon: InkIcon.Kind? = nil, kind: InkButtonStyle.Kind = .primary,
         height: CGFloat = 56, sound: Chiptune.SFX = .click, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.kind = kind
        self.height = height
        self.sound = sound
        self.action = action
    }

    var body: some View {
        Button {
            Chiptune.shared.play(sound)
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 8) {
                if let icon {
                    InkIcon(kind: icon, size: 17, lineWidth: 2.4, color: InkButtonStyle.text(kind))
                }
                Text(title)
            }
        }
        .buttonStyle(InkButtonStyle(kind: kind, height: height))
        .opacity(isEnabled ? 1 : 0.4)
        .animation(Motion.glide, value: isEnabled)
    }
}

/// One choice in a segmented row; the chosen one is a white tile on the track.
struct InkChip: View {
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
                .font(Brush.bold(14))
                .foregroundStyle(selected ? Ink.onTint : Ink.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(selected ? Ink.tint : Ink.wash, in: Capsule())
                .animation(Motion.press, value: selected)
        }
        .buttonStyle(PressableStyle())
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Round icon-only button (close, settings).
struct CircleIconButton: View {
    var icon: InkIcon.Kind
    var label: String
    var action: () -> Void

    var body: some View {
        Button {
            Chiptune.shared.play(.click)
            Haptics.tap()
            action()
        } label: {
            InkIcon(kind: icon, size: 16, lineWidth: 2.4, color: Ink.sub)
                .frame(width: 36, height: 36)
                .background(Ink.wash, in: Circle())
                .contentShape(Circle())
                .frame(width: 44, height: 44)
        }
        .buttonStyle(PressableStyle(scale: 0.88))
        .accessibilityLabel(label)
    }
}

// MARK: - Icons (hand-drawn-ish strokes)

struct InkIcon: View {
    enum Kind {
        case send, receive, gear, close, back, home, record, rabbit, scan, paste, copy, share, check, alert, refresh
        case fish, book, play, pause, sound, mute
    }

    var kind: Kind
    var size: CGFloat = 22
    var lineWidth: CGFloat = 1.6
    var color: Color?

    private var symbol: String {
        switch kind {
        case .send: return "arrow.up.right"
        case .receive: return "arrow.down.left"
        case .gear: return "gearshape"
        case .close: return "xmark"
        case .back: return "chevron.left"
        case .home: return "house"
        case .record: return "list.bullet"
        case .rabbit: return "hare"
        case .scan: return "qrcode.viewfinder"
        case .paste: return "doc.on.clipboard"
        case .copy: return "doc.on.doc"
        case .share: return "square.and.arrow.up"
        case .check: return "checkmark"
        case .alert: return "exclamationmark.circle"
        case .refresh: return "arrow.clockwise"
        case .fish: return "fish"
        case .book: return "book"
        case .play: return "play.fill"
        case .pause: return "pause.fill"
        case .sound: return "speaker.wave.2.fill"
        case .mute: return "speaker.slash.fill"
        }
    }

    /// SF Symbols, sized to sit in a `size` square; `lineWidth` picks the weight.
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.82, weight: lineWidth >= 2.4 ? .semibold : (lineWidth >= 2 ? .medium : .regular)))
            .foregroundStyle(color ?? Ink.ink)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

// MARK: - Cards & rows

extension View {
    /// A flat white card; no border unless one is asked for.
    func inkCard(padding: CGFloat = 20, radius: CGFloat = Radius.card, border: Color? = nil,
                 fill: Color = Ink.paper) -> some View {
        self
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay {
                if let border {
                    RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(border, lineWidth: 1)
                }
            }
    }

    /// A frosted-glass card, for things that sit over colour.
    func glassCard(padding: CGFloat = 20, radius: CGFloat = Radius.card) -> some View {
        self
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Color.white.opacity(0.18), lineWidth: 1))
    }

    /// A barely-there shadow for things that float (toasts, the tab bar).
    func softShadow(_ strength: Double = 1) -> some View {
        shadow(color: Color.black.opacity(0.06 * strength), radius: 16, y: 6)
    }
}

// MARK: - Frames and fills

/// A hairline rounded border; stretches to any size.
struct BrushFrame: View {
    var color: Color = .clear
    var radius: CGFloat = Radius.card

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .strokeBorder(color, lineWidth: 1)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// A solid rounded block.
struct InkBlock: View {
    var color: Color = Ink.tint

    var body: some View {
        RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            .fill(color)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// The plain page colour behind every screen.
struct PaperBackground: View {
    var body: some View {
        Ink.bg
            .ignoresSafeArea()
            .accessibilityHidden(true)
    }
}

/// A soft glow of colour for glass to sit over: two blurred orbs drifting
/// very slowly.
struct Aurora: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme
    var colors: [Color] = [Color(hex: 0xFF9F0A), Color(hex: 0xFF375F), Color(hex: 0x5E5CE6)]
    @State private var drift = false

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                orb(colors[0], size: w * 0.9).position(x: drift ? w * 0.2 : w * 0.38, y: drift ? h * 0.3 : h * 0.42)
                orb(colors[1], size: w * 0.8).position(x: drift ? w * 0.85 : w * 0.68, y: drift ? h * 0.55 : h * 0.4)
                orb(colors[2], size: w * 0.7).position(x: drift ? w * 0.5 : w * 0.6, y: drift ? h * 0.85 : h * 0.72)
            }
            .onAppear {
                guard !reduceMotion, !drift else { return }
                withAnimation(.easeInOut(duration: 9).repeatForever(autoreverses: true)) { drift = true }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func orb(_ color: Color, size: CGFloat) -> some View {
        Circle()
            .fill(RadialGradient(colors: [color.opacity(scheme == .dark ? 0.5 : 0.42), color.opacity(0)],
                                 center: .center, startRadius: 0, endRadius: size / 2))
            .frame(width: size, height: size)
    }
}

/// The app's mark: an orange coin-coloured tile with one character.
struct SealStamp: View {
    var text: String
    var size: CGFloat = 24

    var body: some View {
        Text(text)
            .font(Brush.bold(size * 0.55))
            .foregroundStyle(Color.white)
            .frame(width: size, height: size)
            .background(Ink.orange, in: RoundedRectangle(cornerRadius: size * 0.26, style: .continuous))
            .accessibilityHidden(true)
    }
}

/// `MAINNET` / `テスト用` style badge: a tinted pill.
struct InkBadge: View {
    var text: String
    var color: Color = Ink.sub

    var body: some View {
        Text(text)
            .font(Brush.bold(11, relativeTo: .caption))
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(color.opacity(0.12), in: Capsule())
            .fixedSize()
    }
}

/// A round tinted bubble with an icon: what kind of thing a row or card is.
struct IconBubble: View {
    var icon: InkIcon.Kind
    var color: Color = Ink.ink
    var size: CGFloat = 38

    var body: some View {
        InkIcon(kind: icon, size: size * 0.5, lineWidth: 2.2, color: color)
            .frame(width: size, height: size)
            .background(color.opacity(0.12), in: Circle())
            .accessibilityHidden(true)
    }
}

/// Small grey label above a section.
struct SectionLabel: View {
    var text: String
    var body: some View {
        Text(text)
            .font(Brush.bold(12, relativeTo: .footnote))
            .foregroundStyle(Ink.sub)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// `label            value`
struct InfoRow: View {
    var label: String
    var value: String
    var mono = false
    var emphasized = false
    var valueColor: Color?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(label)
                .font(emphasized ? Brush.bold(15) : Brush.text(14))
                .foregroundStyle(emphasized ? Ink.ink : Ink.sub)
                .lineLimit(1)
                .layoutPriority(1)
            Spacer(minLength: 8)
            Text(value)
                .font(mono ? Brush.mono(13) : (emphasized ? Brush.bold(17) : Brush.bold(15)))
                .foregroundStyle(valueColor ?? Ink.ink)
                .lineLimit(1)
                .truncationMode(.middle)
                .contentTransition(.numericText())
        }
        .accessibilityElement(children: .combine)
    }
}

/// A hairline between rows.
struct DashedDivider: View {
    var color: Color = Ink.line

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(height: 1)
            .accessibilityHidden(true)
    }
}

/// Sheet title bar: title on the left, close on the right.
struct SheetHeader: View {
    var title: String
    var onBack: (() -> Void)? = nil
    var onClose: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            if let onBack {
                Button {
                    Chiptune.shared.play(.click)
                    Haptics.tap()
                    onBack()
                } label: {
                    InkIcon(kind: .back, size: 22, lineWidth: 2.4)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(PressableStyle(scale: 0.85))
                .accessibilityLabel("もどる")
                .transition(.scale.combined(with: .opacity))
            }
            Text(title)
                .font(Brush.bold(24, relativeTo: .title2))
                .foregroundStyle(Ink.ink)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            CircleIconButton(icon: .close, label: "とじる", action: onClose)
        }
        .padding(.horizontal, onBack == nil ? 20 : 8)
        .padding(.top, 14)
        .padding(.bottom, 6)
        .animation(Motion.glide, value: onBack == nil)
    }
}

/// `1 あて先 ─ 2 きんがく ─ 3 かくにん`: numbered steps, the path between them
/// filling in as you go.
struct StepLabels: View {
    var steps: [String]
    var current: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                if index > 0 {
                    Capsule()
                        .fill(index <= current ? Ink.tint : Ink.line)
                        .frame(height: 3)
                        .frame(maxWidth: 28)
                }
                HStack(spacing: 5) {
                    ZStack {
                        Circle().fill(index <= current ? Ink.tint : Ink.wash)
                        if index < current {
                            InkIcon(kind: .check, size: 11, lineWidth: 3, color: Ink.onTint)
                                .transition(.scale)
                        } else {
                            Text("\(index + 1)")
                                .font(Brush.bold(11))
                                .foregroundStyle(index == current ? Ink.onTint : Ink.sub)
                        }
                    }
                    .frame(width: 20, height: 20)
                    .scaleEffect(index == current ? 1.08 : 1)
                    Text(step)
                        .font(Brush.bold(13))
                        .foregroundStyle(index == current ? Ink.ink : Ink.sub)
                        .fixedSize()
                }
            }
        }
        .animation(Motion.bounce, value: current)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(current + 1) / \(steps.count): \(steps[min(current, steps.count - 1)])")
    }
}

// MARK: - Amounts

/// Big balance: `123,456 sats` or `₿0.00123456`.
struct AmountText: View {
    var sats: UInt64
    var unit: AmountUnit
    var size: CGFloat = 44
    var sign: String = ""
    var color: Color = Ink.ink

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            switch unit {
            case .sats:
                Text(sign + SatFormat.sats(sats))
                    .font(Brush.amount(size))
                Text("sats")
                    .font(Brush.bold(size * 0.4))
                    .opacity(0.7)
            case .btc:
                Text(sign + SatFormat.btc(sats))
                    .font(Brush.amount(size * 0.8))
            }
        }
        .foregroundStyle(color)
        .lineLimit(1)
        .minimumScaleFactor(0.5)
        .contentTransition(.numericText(value: Double(sats)))
        .animation(Motion.glide, value: sats)
    }
}

// MARK: - History row

struct TransactionRow: View {
    @EnvironmentObject private var settings: AppSettings
    var movement: Movement

    var body: some View {
        HStack(spacing: 12) {
            marker
            VStack(alignment: .leading, spacing: 1) {
                Text(movement.title)
                    .font(Brush.bold(15))
                    .foregroundStyle(Ink.ink)
                Text(movement.isPending ? "\(movement.railName) ・ とどけ中" : movement.railName)
                    .font(Brush.text(11, relativeTo: .caption))
                    .foregroundStyle(Ink.sub)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 1) {
                Text(amountText)
                    .font(Brush.bold(16))
                    .foregroundStyle(movement.isFailed ? Ink.sub : (movement.isIncoming ? Ink.good : Ink.ink))
                    .strikethrough(movement.isFailed)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(BarkDate.friendly(movement.createdAt))
                    .font(Brush.text(11, relativeTo: .caption))
                    .foregroundStyle(Ink.sub)
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var marker: some View {
        if movement.isPending {
            InkDots(size: 4).frame(width: 38, height: 38).background(Ink.wash, in: Circle())
        } else if movement.isFailed {
            IconBubble(icon: .alert, color: Ink.alert)
        } else if movement.isIncoming {
            IconBubble(icon: .receive, color: Ink.good)
        } else {
            IconBubble(icon: .send, color: Ink.ink)
        }
    }

    private var amountText: String {
        let value = movement.effectiveBalanceSats
        switch settings.unit {
        case .sats: return SatFormat.signed(value)
        case .btc:
            let body = SatFormat.btc(UInt64(value.magnitude))
            return value >= 0 ? "+\(body)" : "-\(body)"
        }
    }
}

// MARK: - Toast

struct ToastView: View {
    var toast: WalletToast

    var body: some View {
        HStack(spacing: 12) {
            marker
            VStack(alignment: .leading, spacing: 2) {
                Text(toast.title)
                    .font(Brush.bold(15))
                    .foregroundStyle(Ink.ink)
                Text(toast.message)
                    .font(Brush.text(13))
                    .foregroundStyle(Ink.sub)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .softShadow(2)
        .padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var marker: some View {
        switch toast.style {
        case .incoming: IconBubble(icon: .receive, color: Ink.good)
        case .outgoing: IconBubble(icon: .send, color: Ink.ink)
        case .info: IconBubble(icon: .check, color: Ink.good)
        case .error: IconBubble(icon: .alert, color: Ink.alert)
        }
    }
}

// MARK: - QR

/// Black on white so every scanner reads it, in a rounded paper frame.
struct QRCodeView: View {
    var content: String
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color.white
            if let image {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .padding(16)
            } else {
                InkDots(color: .black)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(BrushFrame())
        .task(id: content) {
            image = Self.render(content)
        }
        .accessibilityLabel("QRコード")
    }

    static func render(_ string: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let context = CIContext()
        guard let cgImage = context.createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

// MARK: - Seed

struct SeedGrid: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var words: [String]
    /// Reveal the words one by one.
    var animated = false

    @State private var shown = Int.max

    var body: some View {
        let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                HStack(spacing: 8) {
                    Text("\(index + 1)")
                        .font(Brush.text(12))
                        .foregroundStyle(Ink.sub)
                        .frame(width: 20, alignment: .trailing)
                    Text(word)
                        .font(.system(size: 15, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Ink.ink)
                        .opacity(index < shown ? 1 : 0)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
                .background(Ink.bg, in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.small, style: .continuous)
                        .strokeBorder(index == shown - 1 ? Ink.orange : Ink.line, lineWidth: index == shown - 1 ? 2 : 1)
                )
            }
        }
        .privacySensitive()
        .task(id: words) {
            guard animated, !reduceMotion, !words.isEmpty else {
                shown = Int.max
                return
            }
            shown = 0
            for index in 1...words.count {
                try? await Task.sleep(nanoseconds: 70_000_000)
                guard !Task.isCancelled else { return }
                withAnimation(.easeOut(duration: 0.15)) { shown = index }
            }
            try? await Task.sleep(nanoseconds: 200_000_000)
            shown = Int.max
        }
    }
}
