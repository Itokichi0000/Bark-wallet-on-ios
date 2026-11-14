import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI

// MARK: - ₿ particles (the website desktop's hero, in SwiftUI Canvas)

struct BitcoinParticles: View {
    @Environment(\.sats) private var t
    /// Change to make the particles burst outwards (e.g. on a new block).
    var burstTick: Int = 0
    /// Stop animating while something covers the desktop.
    var paused = false

    @State private var particles: [Particle] = BitcoinParticles.makeParticles()
    @State private var burstStart: Date?

    private static let glyph: [String] = [
        "....##..##......",
        "....##..##......",
        ".##########.....",
        ".###########....",
        "...###....####..",
        "...###.....###..",
        "...###.....###..",
        "...###....####..",
        "...##########...",
        "...###########..",
        "...###.....####.",
        "...###......###.",
        "...###......###.",
        "...###.....####.",
        ".############...",
        ".###########....",
        "....##..##......",
        "....##..##......",
    ]

    struct Particle {
        var x: Double      // target, in glyph cells (centered)
        var y: Double
        var phase: Double
        var amplitude: Double
        var speed: Double
        var size: Double
        var colorIndex: Int
        var alpha: Double
        var scatterX: Double
        var scatterY: Double
    }

    private static func makeParticles() -> [Particle] {
        let rows = glyph.count
        let cols = glyph.first?.count ?? 0
        var result: [Particle] = []
        func color() -> Int {
            let roll = Double.random(in: 0...1)
            if roll < 0.5 { return 0 }       // encre
            if roll < 0.75 { return 1 }      // braise
            if roll < 0.87 { return 2 }      // creme
            return 3                          // dim
        }
        for (row, line) in glyph.enumerated() {
            for (col, char) in line.enumerated() where char == "#" {
                for _ in 0..<5 {
                    let angle = Double.random(in: 0..<(2 * .pi))
                    result.append(Particle(
                        x: Double(col) - Double(cols) / 2 + Double.random(in: 0..<1),
                        y: Double(row) - Double(rows) / 2 + Double.random(in: 0..<1),
                        phase: Double.random(in: 0..<(2 * .pi)),
                        amplitude: Double.random(in: 0.4...2.2),
                        speed: Double.random(in: 0.4...1.4),
                        size: [1.5, 2, 2, 3].randomElement()!,
                        colorIndex: color(),
                        alpha: Double.random(in: 0.35...0.95),
                        scatterX: cos(angle) * Double.random(in: 0.3...1.2),
                        scatterY: sin(angle) * Double.random(in: 0.3...1.2)
                    ))
                }
            }
        }
        // loose dust around the glyph
        for _ in 0..<160 {
            let angle = Double.random(in: 0..<(2 * .pi))
            let radius = 9 + pow(Double.random(in: 0...1), 1.6) * 14
            result.append(Particle(
                x: cos(angle) * radius * 1.1,
                y: sin(angle) * radius * 0.8,
                phase: Double.random(in: 0..<(2 * .pi)),
                amplitude: Double.random(in: 1...4),
                speed: Double.random(in: 0.2...0.7),
                size: [1, 1.5, 2].randomElement()!,
                colorIndex: [0, 1, 3].randomElement()!,
                alpha: Double.random(in: 0.15...0.5),
                scatterX: cos(angle),
                scatterY: sin(angle)
            ))
        }
        return result
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: paused)) { context in
            Canvas { gc, size in
                let time = context.date.timeIntervalSinceReferenceDate
                let rows = Double(Self.glyph.count)
                let cols = Double(Self.glyph.first?.count ?? 1)
                let cell = min(size.width * 0.78 / cols, size.height * 0.72 / rows)
                let cx = size.width / 2
                let cy = size.height / 2
                let burst = burstAmount(at: context.date)
                let palette = [t.encre, t.braise, t.creme, t.dim]
                for p in particles {
                    let wobbleX = sin(time * p.speed + p.phase) * p.amplitude
                    let wobbleY = cos(time * p.speed * 0.8 + p.phase) * p.amplitude
                    let x = cx + p.x * cell + wobbleX + p.scatterX * burst * size.width * 0.7
                    let y = cy + p.y * cell + wobbleY + p.scatterY * burst * size.height * 0.5
                    let rect = CGRect(x: x.rounded(), y: y.rounded(), width: p.size, height: p.size)
                    gc.fill(Path(rect), with: .color(palette[p.colorIndex].opacity(p.alpha)))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: burstTick) { _, _ in
            burstStart = Date()
        }
    }

    /// 0 → 1 quickly, then slowly back to 0 (the glyph reassembles).
    private func burstAmount(at date: Date) -> Double {
        guard let burstStart else { return 0 }
        let elapsed = date.timeIntervalSince(burstStart)
        if elapsed < 0.35 { return elapsed / 0.35 }
        let back = (elapsed - 0.35) / 1.8
        if back >= 1 { return 0 }
        let eased = 1 - back
        return eased * eased
    }
}

// MARK: - bitty

/// bitty, the mascot from Zappy Bitty / the website (56×47 sprite, drawn
/// without smoothing). Hops at 12 fps so it reads as sprite animation.
struct BittyView: View {
    var scale: CGFloat = 1.5
    var hopping = true
    var hopHeight: CGFloat = 10
    var flipped = false

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 12.0, paused: !hopping)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            let hop = hopping ? abs(sin(time * 2.6)) : 0
            Image("Bitty")
                .interpolation(.none)
                .resizable()
                .frame(width: 56 * scale, height: 47 * scale)
                .scaleEffect(x: flipped ? -1 : 1, y: 1)
                .offset(y: -(hop * hopHeight).rounded())
        }
        .accessibilityLabel("bitty")
    }
}

/// bitty with a speech bubble; tap to make it talk.
struct TalkingBitty: View {
    @Environment(\.sats) private var t
    var scale: CGFloat = 1.3
    var lines: [String] = BittyLines.desktop

    @State private var index = 0
    @State private var showing = false
    @State private var hideTask: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 4) {
            if showing {
                Text(lines[index % lines.count])
                    .font(PixelFont.body(12))
                    .foregroundStyle(t.onEncre)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(t.encre)
                    .overlay(Rectangle().stroke(t.onEncre, lineWidth: 2))
                    .fixedSize()
                    .transition(.opacity)
            }
            BittyView(scale: scale)
                .onTapGesture {
                    Chiptune.shared.play(.select)
                    Haptics.tap()
                    index = Int.random(in: 0..<lines.count)
                    withAnimation(.linear(duration: 0.1)) { showing = true }
                    hideTask?.cancel()
                    hideTask = Task {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        guard !Task.isCancelled else { return }
                        withAnimation(.linear(duration: 0.1)) { showing = false }
                    }
                }
        }
    }
}

enum BittyLines {
    static let desktop = [
        "gm ☀︎",
        "don't trust, verify",
        "stay humble, stack sats",
        "HODL!",
        "Ark は速いぞ ⚡",
        "21,000,000 cap",
        "鍵はあなたのもの",
        "tick tock next block",
        "not your keys, not your coins",
    ]

    static let received = [
        "sats が届いた！",
        "stack sats ✓",
        "+1 EXP",
        "ごちそうさま₿",
        "HODL するぞ",
    ]

    static let success = [
        "やったね！",
        "+1 EXP",
        "nice tx!",
        "₿ to the moon… jk",
    ]
}

// MARK: - QR code

/// QR codes are already pixel art: render one pixel per module and scale it
/// up without smoothing. Dark brown on cream keeps scanners happy.
struct PixelQRCode: View {
    @Environment(\.sats) private var t
    var content: String
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color(hex: 0xF3E3C3)
            if let image {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .padding(14)
            } else {
                Text("generating…")
                    .font(PixelFont.body(13))
                    .foregroundStyle(Color(hex: 0x120E09))
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .overlay(Rectangle().stroke(t.encre, lineWidth: 3))
        .background(Rectangle().fill(t.braise).offset(x: 6, y: 6))
        .task(id: content) {
            image = Self.render(content)
        }
        .accessibilityLabel("QR code")
    }

    static func render(_ string: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let colored = output.applyingFilter("CIFalseColor", parameters: [
            "inputColor0": CIColor(red: 0x12 / 255.0, green: 0x0E / 255.0, blue: 0x09 / 255.0),
            "inputColor1": CIColor(red: 0xF3 / 255.0, green: 0xE3 / 255.0, blue: 0xC3 / 255.0),
        ])
        let context = CIContext()
        guard let cgImage = context.createCGImage(colored, from: colored.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
