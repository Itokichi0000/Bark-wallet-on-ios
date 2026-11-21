import SwiftUI

// MARK: - Ink fish

/// How one fish is painted.
struct FishLook {
    var body: Color = Color(hex: 0xFF9A2E)
    var line: Color = Color(hex: 0xC25F00)
    /// A lighter belly patch.
    var spot: Color? = Color(hex: 0xFFD08A)
    var dashed = false
    var opacity: Double = 1

    static let fresh = FishLook()
    static let aging = FishLook(body: Color(hex: 0xFFC84A), line: Color(hex: 0xB98200), spot: Color(hex: 0xFFE6A3))
    static let tired = FishLook(body: Color(hex: 0xF2A9BF), line: Color(hex: 0xC24A72), spot: nil)
    static let busy = FishLook(body: Color(hex: 0xC9BEFF), line: Color(hex: 0x6B4EFF), spot: nil, dashed: true)
    static let expired = FishLook(body: Color(hex: 0xC9C7D6), line: Color(hex: 0x7C7896), spot: nil, opacity: 0.85)

    static func of(_ fish: Fish) -> FishLook {
        if fish.isBusy { return busy }
        switch fish.health {
        case .fresh: return fresh
        case .aging: return aging
        case .refreshNow: return tired
        case .expired: return expired
        }
    }
}

/// A round, friendly fish facing right, centred on the origin, `length` long.
enum InkFish {
    static func outline(_ length: CGFloat, tail: CGFloat = 0) -> Path {
        let l = length
        let h = l * 0.21
        var path = Path()
        path.move(to: CGPoint(x: 0.5 * l, y: 0))
        path.addCurve(to: CGPoint(x: -0.3 * l, y: 0),
                      control1: CGPoint(x: 0.36 * l, y: -h * 1.3),
                      control2: CGPoint(x: -0.12 * l, y: -h * 1.1))
        // the tail flicks up and down a little while it swims
        path.addLine(to: CGPoint(x: -0.5 * l, y: (-0.2 + tail) * l))
        path.addQuadCurve(to: CGPoint(x: -0.5 * l, y: (0.2 + tail) * l),
                          control: CGPoint(x: -0.4 * l, y: tail * l))
        path.addLine(to: CGPoint(x: -0.3 * l, y: 0))
        path.addCurve(to: CGPoint(x: 0.5 * l, y: 0),
                      control1: CGPoint(x: -0.12 * l, y: h * 1.1),
                      control2: CGPoint(x: 0.36 * l, y: h * 1.3))
        path.closeSubpath()
        return path
    }

    /// Draws a fish into `gc`.
    /// - Parameters:
    ///   - facing: 1 swims right, -1 left; values in between squeeze it while it turns.
    ///   - belly: true floats belly-up (expired).
    static func draw(in gc: GraphicsContext, at point: CGPoint, length: CGFloat, facing: CGFloat,
                     tilt: Angle = .zero, tail: CGFloat = 0, belly: Bool = false, look: FishLook) {
        var g = gc
        g.opacity = look.opacity
        g.translateBy(x: point.x, y: point.y)
        g.rotate(by: tilt)
        g.scaleBy(x: facing, y: belly ? -1 : 1)
        let l = length
        let body = outline(l, tail: tail)
        g.fill(body, with: .color(look.body))
        if let spot = look.spot {
            let patch = Path(ellipseIn: CGRect(x: -0.2 * l, y: 0.04 * l, width: 0.6 * l, height: 0.3 * l))
            var clipped = g
            clipped.clip(to: body)
            clipped.fill(patch, with: .color(spot))
        }
        let width = max(1.4, l * 0.035)
        g.stroke(body, with: .color(look.line),
                 style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round,
                                    dash: look.dashed ? [width * 2, width * 1.6] : []))
        // gill, fin and a few scales
        var marks = Path()
        marks.move(to: CGPoint(x: 0.27 * l, y: -0.13 * l))
        marks.addQuadCurve(to: CGPoint(x: 0.27 * l, y: 0.13 * l), control: CGPoint(x: 0.2 * l, y: 0))
        marks.move(to: CGPoint(x: 0.02 * l, y: 0.06 * l))
        marks.addQuadCurve(to: CGPoint(x: -0.1 * l, y: 0.15 * l), control: CGPoint(x: -0.02 * l, y: 0.15 * l))
        for (x, y) in [(-0.02, -0.02), (0.08, 0.04), (-0.13, 0.03)] where l > 34 {
            marks.move(to: CGPoint(x: (x + 0.04) * l, y: (y - 0.03) * l))
            marks.addQuadCurve(to: CGPoint(x: (x + 0.04) * l, y: (y + 0.03) * l),
                               control: CGPoint(x: x * l, y: y * l))
        }
        g.stroke(marks, with: .color(look.line.opacity(0.7)),
                 style: StrokeStyle(lineWidth: width * 0.7, lineCap: .round))
        // eye: a cross when it has expired
        let eye = CGPoint(x: 0.34 * l, y: -0.05 * l)
        let r = max(1.4, l * 0.04)
        if !belly {
            g.fill(Path(ellipseIn: CGRect(x: eye.x - r * 1.9, y: eye.y - r * 1.9, width: r * 3.8, height: r * 3.8)),
                   with: .color(.white))
        }
        if belly {
            var cross = Path()
            cross.move(to: CGPoint(x: eye.x - r, y: eye.y - r)); cross.addLine(to: CGPoint(x: eye.x + r, y: eye.y + r))
            cross.move(to: CGPoint(x: eye.x + r, y: eye.y - r)); cross.addLine(to: CGPoint(x: eye.x - r, y: eye.y + r))
            g.stroke(cross, with: .color(look.line), lineWidth: width * 0.8)
        } else {
            g.fill(Path(ellipseIn: CGRect(x: eye.x - r, y: eye.y - r, width: r * 2, height: r * 2)),
                   with: .color(Color(hex: 0x1F1B3D)))
        }
    }
}

/// A still fish for rows and the detail sheet.
struct FishGlyph: View {
    var fish: Fish
    var size: CGFloat = 40
    var swim = false

    var body: some View {
        TimelineView(.animation(paused: !swim)) { context in
            let t = swim ? context.date.timeIntervalSinceReferenceDate : 0
            Canvas { gc, canvas in
                InkFish.draw(
                    in: gc,
                    at: CGPoint(x: canvas.width / 2, y: canvas.height / 2 + sin(t * 1.6) * canvas.height * 0.04),
                    length: canvas.width * 0.9,
                    facing: 1,
                    tilt: .degrees(sin(t * 1.1) * 3),
                    tail: sin(t * 7) * 0.03,
                    belly: fish.health == .expired,
                    look: FishLook.of(fish)
                )
            }
        }
        .frame(width: size, height: size * 0.6)
        .accessibilityHidden(true)
    }
}

// MARK: - The tank

/// The water, the weeds, the bubbles and every fish, painted in one Canvas.
/// Tapping picks the fish under the finger.
struct FishTank: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var school: [Fish]
    /// Fish that just left; they swim out to the right.
    var ghosts: [FishGhost] = []
    /// Fish that just came; they swim in from the left.
    var arrivals: [String: Date] = [:]
    /// 0 = clear water, 1 = murky (fish need a refresh).
    var murk: Double = 0
    var onTap: (Fish) -> Void = { _ in }

    /// Only this many fish swim; the list below has the rest.
    static let maxShown = 36
    let surface: Double = 34
    let floor: Double = 30

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation(paused: reduceMotion)) { context in
                let t = clock(context.date)
                Canvas { gc, size in
                    drawWater(gc, size, t)
                    let shown = Array(school.prefix(Self.maxShown))
                    for (index, fish) in shown.enumerated() {
                        drawFish(gc, fish, index: index, count: shown.count, size: size, t: t, now: context.date)
                    }
                    for ghost in ghosts {
                        drawGhost(gc, ghost, size: size, now: context.date)
                    }
                    drawFront(gc, size, t)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                SpatialTapGesture().onEnded { value in
                    if let fish = fishAt(value.location, size: geo.size) {
                        onTap(fish)
                    }
                }
            )
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    private var accessibilitySummary: String {
        let care = school.filter(\.needsCare).count
        var text = "すいそう。さかな \(school.count)ひき"
        if care > 0 { text += "、\(care)ひき が みずかえ時" }
        return text
    }

    private func clock(_ date: Date) -> Double {
        reduceMotion ? 0 : date.timeIntervalSinceReferenceDate
    }

    // MARK: placement

    private struct Spot {
        var point: CGPoint
        var facing: Double
        var tilt: Angle
        var tail: Double
    }

    private static func unit(_ seed: UInt64, _ shift: UInt64) -> Double {
        Double((seed >> shift) & 0xFFFF) / 65535
    }

    private func spot(for fish: Fish, index: Int, count: Int, size: CGSize, t: Double, now: Date) -> Spot {
        let seed = fish.seed
        let r1: Double = Self.unit(seed, 0)
        let r2: Double = Self.unit(seed, 16)
        let r3: Double = Self.unit(seed, 32)
        let l: Double = fish.length
        let width = Double(size.width)
        let usable: Double = max(Double(size.height) - surface - floor - 20, 40)
        let laneHeight: Double = usable / Double(max(count, 1))
        let laneCenter: Double = laneHeight * (Double(index) + 0.5)
        let laneY: Double = surface + 10 + laneCenter + (r3 - 0.5) * laneHeight * 0.6

        // caught in the net: waits near the right side
        if fish.isBusy {
            let x: Double = width - l / 2 - 26 - r1 * 30
            let y: Double = laneY + sin(t * 1.2 + r2 * 6) * 3
            return Spot(point: CGPoint(x: x, y: y),
                        facing: 1, tilt: .degrees(sin(t * 3 + r1 * 6) * 6), tail: sin(t * 9) * 0.04)
        }
        // expired: floats belly-up under the surface
        if fish.health == .expired {
            let drift: Double = 0.5 + 0.45 * sin(t * 0.05 + r2 * 6)
            let x: Double = l / 2 + 14 + (width - l - 28) * drift
            let y: Double = surface + l * 0.2 + sin(t * 0.9 + r1 * 6) * 2
            return Spot(point: CGPoint(x: x, y: y),
                        facing: 1, tilt: .degrees(sin(t * 0.7) * 4), tail: 0)
        }

        var speed: Double = (0.16 + 0.22 * r1) / (1 + l / 90)
        if fish.health == .aging { speed *= 0.75 }
        if fish.health == .refreshNow { speed *= 0.45 }
        let margin: Double = l / 2 + 10
        let range: Double = max(width - margin * 2, 1)
        let phase: Double = r2 * Double.pi * 2
        let angle: Double = speed * t + phase
        var x: Double = margin + range * (0.5 + 0.5 * sin(angle))
        let c: Double = cos(angle)
        let turn: Double = min(1, max(0.25, abs(c) * 4))
        var facing: Double = (c >= 0 ? 1 : -1) * turn
        let y: Double = laneY + sin(t * (1.1 + r1) + phase * 2) * 5

        if let came = arrivals[fish.id] {
            let p: Double = min(max(now.timeIntervalSince(came) / 2.4, 0), 1)
            if p < 1 {
                let eased: Double = 1 - pow(1 - p, 3)
                x = -l + (x + l) * eased
                facing = 1
            }
        }
        return Spot(point: CGPoint(x: x, y: y), facing: facing,
                    tilt: .degrees(sin(t * 1.4 + phase) * 4), tail: sin(t * (6 + r3 * 3)) * 0.035)
    }

    private func fishAt(_ location: CGPoint, size: CGSize) -> Fish? {
        let t = clock(Date())
        let shown = Array(school.prefix(Self.maxShown))
        var best: (Fish, Double)?
        for (index, fish) in shown.enumerated() {
            let s = spot(for: fish, index: index, count: shown.count, size: size, t: t, now: Date())
            let distance = Double(hypot(s.point.x - location.x, s.point.y - location.y))
            let reach: Double = max(fish.length * 0.6, 26)
            if distance < reach, distance < (best?.1 ?? .infinity) {
                best = (fish, distance)
            }
        }
        return best?.0
    }

    // MARK: drawing

    private static let waterTop = Color(light: 0xBFEFFF, dark: 0x123A5C)
    private static let waterBottom = Color(light: 0x5CC4F0, dark: 0x0A2440)
    private static let sand = Color(light: 0xFFE2A8, dark: 0x5A4526)
    private static let weed = Color(light: 0x2DBE8C, dark: 0x1E8F6B)

    private func drawWater(_ gc: GraphicsContext, _ size: CGSize, _ t: Double) {
        let w = Double(size.width), h = Double(size.height)
        // the sky above the water
        gc.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Ink.paper))
        // the surface: a rolling wave, water below it
        func wave(_ offset: Double, _ speed: Double, _ height: Double) -> Path {
            var path = Path()
            path.move(to: CGPoint(x: 0, y: h))
            path.addLine(to: CGPoint(x: 0, y: surface))
            for x in stride(from: 0.0, through: w + 6, by: 6) {
                let y: Double = surface + offset + sin(x / 34 + t * speed) * height + sin(x / 13 + t * speed * 1.7) * height * 0.3
                path.addLine(to: CGPoint(x: x, y: y))
            }
            path.addLine(to: CGPoint(x: w, y: h))
            path.closeSubpath()
            return path
        }
        gc.fill(wave(-4, -0.9, 3.5), with: .color(Self.waterTop.opacity(0.6)))
        gc.fill(wave(0, 1.3, 3), with: .linearGradient(
            Gradient(colors: [Self.waterTop, Self.waterBottom]),
            startPoint: CGPoint(x: 0, y: surface), endPoint: CGPoint(x: 0, y: h)))
        // shafts of light swaying down from the surface
        for i in 0..<4 {
            let x: Double = w * (0.15 + 0.24 * Double(i)) + sin(t * 0.4 + Double(i) * 1.9) * 16
            var ray = Path()
            ray.move(to: CGPoint(x: x - 10, y: surface + 4))
            ray.addLine(to: CGPoint(x: x + 14, y: surface + 4))
            ray.addLine(to: CGPoint(x: x + 60, y: h))
            ray.addLine(to: CGPoint(x: x - 4, y: h))
            ray.closeSubpath()
            gc.fill(ray, with: .linearGradient(
                Gradient(colors: [Color.white.opacity(0.22), Color.white.opacity(0)]),
                startPoint: CGPoint(x: x, y: surface), endPoint: CGPoint(x: x + 30, y: h * 0.85)))
        }
        if murk > 0 {
            gc.fill(wave(0, 1.3, 3), with: .color(Color(hex: 0x8A6B4A, opacity: 0.3 * murk)))
            // drifting silt
            for i in 0..<Int(10 * murk) + 2 {
                let fx: Double = Self.unit(Fish.seed("silt\(i)"), 0)
                let fy: Double = Self.unit(Fish.seed("silt\(i)"), 16)
                let x: Double = (fx * w + t * 4 * (0.5 + fy)).truncatingRemainder(dividingBy: max(w, 1))
                let depth: Double = h - surface - floor - 24
                let y: Double = surface + 16 + fy * depth + sin(t + fx * 6) * 4
                gc.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 3, height: 3)),
                        with: .color(Color(hex: 0x6B4A2A, opacity: 0.4 * murk)))
            }
        }
        // bubbles
        for i in 0..<10 {
            let seed = Fish.seed("bubble\(i)")
            let fx: Double = Self.unit(seed, 0)
            let speed: Double = 0.05 + 0.06 * Self.unit(seed, 16)
            let r: Double = 2 + 3 * Self.unit(seed, 32)
            let rise: Double = (t * speed + Self.unit(seed, 48)).truncatingRemainder(dividingBy: 1)
            let y: Double = h - floor - rise * (h - floor - surface - 6)
            let x: Double = fx * w + sin(t * 2 + Double(i)) * 4
            let circle = Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
            gc.fill(circle, with: .color(Color.white.opacity(0.25 * (1 - rise * 0.5))))
            gc.stroke(circle, with: .color(Color.white.opacity(0.7 * (1 - rise * 0.5))), lineWidth: 1.2)
        }
    }

    /// Weeds and sand in front of the fish.
    private func drawFront(_ gc: GraphicsContext, _ size: CGSize, _ t: Double) {
        let w = Double(size.width), h = Double(size.height)
        let bottom: Double = h - floor + 6
        for (i, fx) in [0.07, 0.15, 0.82, 0.92].enumerated() {
            let x: Double = fx * w
            let height: Double = 44 + Double(i % 2) * 30
            let sway: Double = sin(t * 0.9 + Double(i) * 1.7) * 9
            var weed = Path()
            weed.move(to: CGPoint(x: x, y: bottom + 6))
            weed.addQuadCurve(to: CGPoint(x: x + sway, y: bottom - height),
                              control: CGPoint(x: x - 12 + sway * 0.3, y: bottom - height * 0.55))
            gc.stroke(weed, with: .color(Self.weed.opacity(i % 2 == 0 ? 0.95 : 0.7)),
                      style: StrokeStyle(lineWidth: 6, lineCap: .round))
        }
        var sand = Path()
        sand.move(to: CGPoint(x: 0, y: h))
        sand.addLine(to: CGPoint(x: 0, y: bottom))
        for x in stride(from: 0.0, through: w + 10, by: 10) {
            let y: Double = bottom + sin(x / 37) * 4
            sand.addLine(to: CGPoint(x: x, y: y))
        }
        sand.addLine(to: CGPoint(x: w, y: h))
        sand.closeSubpath()
        gc.fill(sand, with: .color(Self.sand))
        for i in 0..<9 {
            let seed = Fish.seed("pebble\(i)")
            let x: Double = 18 + Self.unit(seed, 0) * (w - 44)
            let pebble: Double = 5 + Self.unit(seed, 16) * 6
            let y: Double = bottom + 7 + Self.unit(seed, 32) * max(floor - 22, 2)
            gc.fill(Path(ellipseIn: CGRect(x: x, y: y, width: pebble, height: pebble * 0.6)),
                    with: .color(Color(light: 0xE9C27E, dark: 0x7A6037)))
        }
    }

    private func drawFish(_ gc: GraphicsContext, _ fish: Fish, index: Int, count: Int, size: CGSize, t: Double, now: Date) {
        let s = spot(for: fish, index: index, count: count, size: size, t: t, now: now)
        let l: Double = fish.length
        if fish.isBusy {
            // a little net, hanging from the surface
            let r: Double = l * 0.62
            let net = Path(ellipseIn: CGRect(x: s.point.x - r, y: s.point.y - r * 0.8, width: r * 2, height: r * 1.6))
            gc.fill(net, with: .color(Color.white.opacity(0.25)))
            gc.stroke(net, with: .color(Color.white.opacity(0.9)),
                      style: StrokeStyle(lineWidth: 1.6, dash: [3, 3]))
            var handle = Path()
            handle.move(to: CGPoint(x: s.point.x, y: s.point.y - r * 0.8))
            handle.addLine(to: CGPoint(x: s.point.x + 6, y: 0))
            gc.stroke(handle, with: .color(Color.white.opacity(0.9)), lineWidth: 2)
        }
        InkFish.draw(in: gc, at: s.point, length: l, facing: s.facing, tilt: s.tilt, tail: s.tail,
                     belly: fish.health == .expired, look: FishLook.of(fish))
        if fish.needsCare, !fish.isBusy {
            // "!" over the fish that wants fresh water
            let bob: Double = sin(t * 3 + Double(index)) * 3
            let center = CGPoint(x: Double(s.point.x), y: Double(s.point.y) - l * 0.32 - 14 + bob)
            let bubble = Path(ellipseIn: CGRect(x: center.x - 10, y: center.y - 10, width: 20, height: 20))
            gc.fill(bubble, with: .color(Ink.alert))
            gc.stroke(bubble, with: .color(.white), lineWidth: 2)
            gc.draw(Text("!").font(Brush.bold(13)).foregroundColor(.white), at: center)
        }
    }

    private func drawGhost(_ gc: GraphicsContext, _ ghost: FishGhost, size: CGSize, now: Date) {
        let age: Double = now.timeIntervalSince(ghost.at)
        let duration: Double = 2.8
        guard age >= 0, age < duration else { return }
        let p: Double = age / duration
        let eased: Double = p * p
        let seed = Fish.seed(ghost.id)
        let l: Double = Fish.length(for: ghost.amount)
        let w = Double(size.width), h = Double(size.height)
        let startX: Double = w * (0.3 + 0.3 * Self.unit(seed, 0))
        let startY: Double = surface + 30 + (h - surface - floor - 60) * Self.unit(seed, 16)
        let x: Double = startX + (w + l - startX) * eased
        let y: Double = startY - 26 * eased + sin(age * 8) * 2
        var look = FishLook.busy
        look.opacity = 1 - p * 0.6
        InkFish.draw(in: gc, at: CGPoint(x: x, y: y), length: l, facing: 1,
                     tilt: .degrees(-8), tail: sin(age * 14) * 0.05, look: look)
        gc.draw(Text("-\(SatFormat.sats(ghost.amount))")
                    .font(Brush.bold(13))
                    .foregroundColor(.white),
                at: CGPoint(x: x, y: y - l * 0.3 - 10))
    }
}
