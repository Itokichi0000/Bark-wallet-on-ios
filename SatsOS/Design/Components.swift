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

/// A chunky button that sits on a darker ledge and presses down into it.
struct InkButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, quiet, danger }
    var kind: Kind = .primary
    var height: CGFloat = 56

    static let ledge: CGFloat = 4

    func makeBody(configuration: Configuration) -> some View {
        let down = configuration.isPressed
        return configuration.label
            .font(Brush.bold(16))
            .foregroundStyle(Self.text(kind))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: min(height, 52))
            .background { face }
            .offset(y: down ? Self.ledge - 1 : 0)
            .background {
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .fill(ledgeColor)
                    .offset(y: Self.ledge)
            }
            .padding(.bottom, Self.ledge)
            .scaleEffect(down ? 0.985 : 1)
            .animation(Motion.press, value: down)
    }

    static func text(_ kind: Kind) -> Color {
        switch kind {
        case .primary: return Ink.onColor
        case .secondary: return Ink.server
        case .quiet: return Ink.ink
        case .danger: return Ink.alert
        }
    }

    @ViewBuilder
    private var face: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
        switch kind {
        case .primary:
            shape.fill(LinearGradient(colors: [Ink.server, Ink.serverDeep], startPoint: .top, endPoint: .bottom))
                .overlay(alignment: .top) {
                    // a soft highlight along the top edge
                    shape.strokeBorder(Color.white.opacity(0.22), lineWidth: 1)
                        .mask(LinearGradient(colors: [.white, .clear], startPoint: .top, endPoint: .center))
                }
        case .secondary:
            shape.fill(Ink.serverSoft)
        case .quiet:
            shape.fill(Ink.paper).overlay(shape.strokeBorder(Ink.line, lineWidth: 1.5))
        case .danger:
            shape.fill(Ink.alertSoft)
        }
    }

    private var ledgeColor: Color {
        switch kind {
        case .primary: return Color(light: 0x3A22AE, dark: 0x3E2BB8)
        case .secondary: return Color(light: 0xD3CBFA, dark: 0x1D1940)
        case .quiet: return Ink.line
        case .danger: return Color(light: 0xF8C6D5, dark: 0x2A0F1A)
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
                    InkIcon(kind: icon, size: 18, lineWidth: 2.4, color: InkButtonStyle.text(kind))
                }
                Text(title)
            }
        }
        .buttonStyle(InkButtonStyle(kind: kind, height: height))
        .saturation(isEnabled ? 1 : 0.2)
        .opacity(isEnabled ? 1 : 0.45)
        .animation(Motion.glide, value: isEnabled)
    }
}

/// One choice in a segmented row; the chosen one lifts off the track.
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
                .foregroundStyle(selected ? Ink.onColor : Ink.sub)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(selected ? Ink.server : Ink.wash, in: Capsule())
                .shadow(color: Ink.server.opacity(selected ? 0.3 : 0), radius: 6, y: 3)
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
            InkIcon(kind: icon, size: 18, lineWidth: 2)
                .frame(width: 42, height: 42)
                .background(Ink.paper, in: Circle())
                .softShadow()
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
        case fish, book, play, pause
    }

    var kind: Kind
    var size: CGFloat = 22
    var lineWidth: CGFloat = 1.6
    var color: Color?

    var body: some View {
        Canvas { gc, canvasSize in
            let s = canvasSize.width / 24
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }
            var path = Path()
            switch kind {
            case .send:
                path.move(to: p(7, 17)); path.addLine(to: p(17, 7))
                path.move(to: p(9, 7)); path.addLine(to: p(17, 7)); path.addLine(to: p(17, 15))
            case .receive:
                path.move(to: p(17, 7)); path.addLine(to: p(7, 17))
                path.move(to: p(15, 17)); path.addLine(to: p(7, 17)); path.addLine(to: p(7, 9))
            case .gear:
                path.addEllipse(in: CGRect(x: 8.8 * s, y: 8.8 * s, width: 6.4 * s, height: 6.4 * s))
                for i in 0..<8 {
                    let a = Double(i) * .pi / 4
                    path.move(to: p(12 + 6.2 * cos(a), 12 + 6.2 * sin(a)))
                    path.addLine(to: p(12 + 9 * cos(a), 12 + 9 * sin(a)))
                }
            case .close:
                path.move(to: p(6, 6)); path.addLine(to: p(18, 18))
                path.move(to: p(18, 6)); path.addLine(to: p(6, 18))
            case .back:
                path.move(to: p(15, 5)); path.addLine(to: p(8, 12)); path.addLine(to: p(15, 19))
            case .home:
                path.move(to: p(4, 11)); path.addLine(to: p(12, 4)); path.addLine(to: p(20, 11))
                path.move(to: p(6, 10)); path.addLine(to: p(6, 20)); path.addLine(to: p(18, 20)); path.addLine(to: p(18, 10))
            case .record:
                path.move(to: p(6, 4)); path.addLine(to: p(16, 4)); path.addLine(to: p(19, 7))
                path.addLine(to: p(19, 20)); path.addLine(to: p(6, 20)); path.closeSubpath()
                path.move(to: p(9, 10)); path.addLine(to: p(16, 10))
                path.move(to: p(9, 14)); path.addLine(to: p(16, 14))
                path.move(to: p(9, 18)); path.addLine(to: p(13, 18))
            case .rabbit:
                path.move(to: p(9, 10)); path.addQuadCurve(to: p(8, 2), control: p(6, 5))
                path.addQuadCurve(to: p(11, 9.5), control: p(11, 5))
                path.move(to: p(13, 9.5)); path.addQuadCurve(to: p(16, 2), control: p(13, 4))
                path.addQuadCurve(to: p(15, 10), control: p(18, 6))
                path.addEllipse(in: CGRect(x: 6 * s, y: 9 * s, width: 12 * s, height: 11 * s))
            case .scan:
                for (x, y, dx, dy) in [(4.0, 4.0, 1.0, 1.0), (20.0, 4.0, -1.0, 1.0), (4.0, 20.0, 1.0, -1.0), (20.0, 20.0, -1.0, -1.0)] {
                    path.move(to: p(x, y + 5 * dy)); path.addLine(to: p(x, y)); path.addLine(to: p(x + 5 * dx, y))
                }
                path.move(to: p(7, 12)); path.addLine(to: p(17, 12))
            case .paste:
                path.addRoundedRect(in: CGRect(x: 6 * s, y: 5 * s, width: 12 * s, height: 15 * s), cornerSize: CGSize(width: 2 * s, height: 2 * s))
                path.move(to: p(9, 5)); path.addLine(to: p(9, 3.5)); path.addLine(to: p(15, 3.5)); path.addLine(to: p(15, 5))
                path.move(to: p(9, 11)); path.addLine(to: p(15, 11))
                path.move(to: p(9, 15)); path.addLine(to: p(13, 15))
            case .copy:
                path.addRoundedRect(in: CGRect(x: 8 * s, y: 8 * s, width: 11 * s, height: 12 * s), cornerSize: CGSize(width: 2 * s, height: 2 * s))
                path.move(to: p(5, 15)); path.addLine(to: p(5, 5)); path.addLine(to: p(15, 5))
            case .share:
                path.move(to: p(12, 15)); path.addLine(to: p(12, 3))
                path.move(to: p(8, 7)); path.addLine(to: p(12, 3)); path.addLine(to: p(16, 7))
                path.move(to: p(8, 11)); path.addLine(to: p(5, 11)); path.addLine(to: p(5, 20))
                path.addLine(to: p(19, 20)); path.addLine(to: p(19, 11)); path.addLine(to: p(16, 11))
            case .check:
                path.move(to: p(5, 12.5)); path.addLine(to: p(10, 17)); path.addLine(to: p(19, 7))
            case .alert:
                path.addEllipse(in: CGRect(x: 3 * s, y: 3 * s, width: 18 * s, height: 18 * s))
                path.move(to: p(12, 7.5)); path.addLine(to: p(12, 13))
                path.move(to: p(12, 16.5)); path.addLine(to: p(12, 16.6))
            case .refresh:
                path.addArc(center: p(12, 12), radius: 7 * s, startAngle: .degrees(-60), endAngle: .degrees(240), clockwise: false)
                path.move(to: p(15.5, 5.9)); path.addLine(to: p(16, 2.5))
                path.move(to: p(15.5, 5.9)); path.addLine(to: p(19, 6.5))
            case .fish:
                path.move(to: p(3.5, 12)); path.addQuadCurve(to: p(17, 12), control: p(10, 3.5))
                path.addQuadCurve(to: p(3.5, 12), control: p(10, 20.5))
                path.move(to: p(17, 12)); path.addLine(to: p(21, 8)); path.addLine(to: p(21, 16)); path.closeSubpath()
                path.move(to: p(7.6, 10.6)); path.addLine(to: p(7.7, 10.7))
            case .play:
                path.move(to: p(8, 5)); path.addLine(to: p(19, 12)); path.addLine(to: p(8, 19)); path.closeSubpath()
            case .pause:
                path.move(to: p(9, 5)); path.addLine(to: p(9, 19))
                path.move(to: p(15, 5)); path.addLine(to: p(15, 19))
            case .book:
                path.move(to: p(12, 6)); path.addQuadCurve(to: p(3, 5), control: p(7, 3.5))
                path.addLine(to: p(3, 19)); path.addQuadCurve(to: p(12, 20), control: p(7, 17.5)); path.closeSubpath()
                path.move(to: p(12, 6)); path.addQuadCurve(to: p(21, 5), control: p(17, 3.5))
                path.addLine(to: p(21, 19)); path.addQuadCurve(to: p(12, 20), control: p(17, 17.5)); path.closeSubpath()
            }
            gc.stroke(path, with: .color(color ?? Ink.ink),
                      style: StrokeStyle(lineWidth: lineWidth * s, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Cards & rows

extension View {
    /// A soft, borderless card floating a little above the page.
    func inkCard(padding: CGFloat = 18, radius: CGFloat = Radius.card, border: Color? = nil,
                 fill: Color = Ink.paper) -> some View {
        self
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(border ?? Ink.line.opacity(0.6), lineWidth: border == nil ? 1 : 2)
            )
            .softShadow()
    }

    /// The gentle violet-tinted shadow under cards and floating controls.
    func softShadow(_ strength: Double = 1) -> some View {
        shadow(color: Color(hex: 0x3A2A9E, opacity: 0.09 * strength), radius: 14, y: 6)
    }
}

// MARK: - Frames and fills

/// A hairline rounded border; stretches to any size.
struct BrushFrame: View {
    var color: Color = Ink.line.opacity(0.6)
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
    var color: Color = Ink.server

    var body: some View {
        RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            .fill(color)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// The page behind every screen: a pale wash with three big, slow blobs of
/// colour (violet, orange, teal) drifting through it.
struct PaperBackground: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme
    @State private var drift = false

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                Ink.bg
                blob(Ink.server, size: w * 1.1)
                    .position(x: drift ? w * 0.05 : w * 0.3, y: drift ? h * 0.02 : h * 0.12)
                blob(Ink.orange, size: w * 0.9)
                    .position(x: drift ? w * 1.0 : w * 0.8, y: drift ? h * 0.35 : h * 0.22)
                blob(Ink.chain, size: w * 1.0)
                    .position(x: drift ? w * 0.35 : w * 0.1, y: drift ? h * 0.85 : h * 0.98)
            }
            .onAppear {
                guard !reduceMotion, !drift else { return }
                withAnimation(.easeInOut(duration: 11).repeatForever(autoreverses: true)) { drift = true }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func blob(_ color: Color, size: CGFloat) -> some View {
        Circle()
            .fill(RadialGradient(colors: [color.opacity(scheme == .dark ? 0.2 : 0.16), color.opacity(0)],
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
            .background(
                LinearGradient(colors: [Color(hex: 0xFFB13D), Color(hex: 0xF7831A)], startPoint: .top, endPoint: .bottom),
                in: RoundedRectangle(cornerRadius: size * 0.32, style: .continuous)
            )
            .shadow(color: Ink.orange.opacity(0.35), radius: 5, y: 3)
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
            .background(color.opacity(0.14), in: Capsule())
            .fixedSize()
    }
}

/// A round tinted bubble with an icon: what kind of thing a row or card is.
struct IconBubble: View {
    var icon: InkIcon.Kind
    var color: Color = Ink.server
    var size: CGFloat = 38

    var body: some View {
        InkIcon(kind: icon, size: size * 0.5, lineWidth: 2.2, color: color)
            .frame(width: size, height: size)
            .background(color.opacity(0.15), in: Circle())
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
                .font(Brush.bold(22, relativeTo: .title2))
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
                        .fill(index <= current ? Ink.server : Ink.line)
                        .frame(height: 3)
                        .frame(maxWidth: 28)
                }
                HStack(spacing: 5) {
                    ZStack {
                        Circle().fill(index <= current ? Ink.server : Ink.wash)
                        if index < current {
                            InkIcon(kind: .check, size: 11, lineWidth: 3, color: Ink.onColor)
                                .transition(.scale)
                        } else {
                            Text("\(index + 1)")
                                .font(Brush.bold(11))
                                .foregroundStyle(index == current ? Ink.onColor : Ink.sub)
                        }
                    }
                    .frame(width: 20, height: 20)
                    .scaleEffect(index == current ? 1.15 : 1)
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
                    .foregroundStyle(movement.isFailed ? Ink.sub : (movement.isIncoming ? Ink.orange : Ink.ink))
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
            IconBubble(icon: .receive, color: Ink.orange)
        } else {
            IconBubble(icon: .send, color: Ink.server)
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
        .background(Ink.paper, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(BrushFrame())
        .softShadow(1.8)
        .padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var marker: some View {
        switch toast.style {
        case .incoming: IconBubble(icon: .receive, color: Ink.orange)
        case .outgoing: IconBubble(icon: .send, color: Ink.server)
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
