import SwiftUI

/// A friend in the home room who gets up to little things on its own:
/// the monkey fidgets and looks around, the fox sniffs and pounces, the cat
/// stretches, washes and naps, the deer wanders the hill and grazes, the
/// pheasant pecks and struts. Tapping plays its signature move.
struct FriendActor: View {
    var friend: Friend
    var height: CGFloat
    /// How far (pt) it may wander either way from its spot.
    var range: ClosedRange<CGFloat>
    /// Bumped on tap: interrupt whatever it is doing and play the signature move.
    var poke: Int
    /// Bumped when sats arrive: everyone hops, one after another.
    var cheer: Int
    var cheerDelay: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dx: CGFloat
    @State private var dy: CGFloat = 0
    @State private var angle: Double = 0
    @State private var sx: CGFloat = 1
    @State private var sy: CGFloat = 1
    /// 1 = as drawn (facing right), -1 = turned around.
    @State private var facing: CGFloat
    @State private var napping = false
    @State private var action: Task<Void, Never>?
    @State private var actionID = 0
    private let enterFrom: CGFloat?

    /// `enterFrom`: walk in from this far to the side (a friend who just arrived).
    init(friend: Friend, height: CGFloat, range: ClosedRange<CGFloat>, poke: Int, cheer: Int,
         cheerDelay: Double, enterFrom: CGFloat? = nil) {
        self.friend = friend
        self.height = height
        self.range = range
        self.poke = poke
        self.cheer = cheer
        self.cheerDelay = cheerDelay
        self.enterFrom = enterFrom
        _dx = State(initialValue: enterFrom ?? 0)
        _facing = State(initialValue: (enterFrom ?? 0) > 0 ? -1 : 1)
    }

    var body: some View {
        CharacterView(art: friend.art, height: height)
            .scaleEffect(x: sx * facing, y: sy, anchor: .bottom)
            .rotationEffect(.degrees(angle * Double(facing)), anchor: .bottom)
            .breathing(napping ? 0.05 : 0.03, period: napping ? 2.6 : 1.7)
            .overlay(alignment: .topTrailing) {
                if napping {
                    Zzz()
                        .offset(x: 12, y: -4)
                        .transition(.opacity)
                }
            }
            .offset(x: dx, y: dy)
            .onChange(of: poke) { _, _ in
                guard !reduceMotion else { return }
                perform(interrupting: true) { await signature() }
            }
            .onChange(of: cheer) { _, _ in
                guard !reduceMotion else { return }
                perform(interrupting: true) {
                    await pause(cheerDelay)
                    await jump(14)
                }
            }
            .task { await life() }
    }

    // MARK: life

    private func life() async {
        guard !reduceMotion else {
            dx = 0
            facing = 1
            return
        }
        if enterFrom != nil {
            perform {
                await walk(to: 0)
                await turn(to: 1)
                await jump(10)
            }
        }
        await pause(Double.random(in: 1.5...5))
        while !Task.isCancelled {
            if action == nil {
                perform { await idle() }
            }
            await pause(Double.random(in: 4...9))
        }
        action?.cancel()
    }

    /// Runs one action at a time; a new one can cut the current one short.
    private func perform(interrupting: Bool = false, _ work: @escaping @MainActor () async -> Void) {
        if action != nil {
            guard interrupting else { return }
            action?.cancel()
            withAnimation(.easeOut(duration: 0.15)) {
                dy = 0
                angle = 0
                sx = 1
                sy = 1
                napping = false
            }
        }
        actionID += 1
        let id = actionID
        action = Task { @MainActor in
            await work()
            if actionID == id { action = nil }
        }
    }

    private func idle() async {
        switch friend {
        case .monkey:
            if Bool.random() { await fidget() } else { await lookAround() }
        case .fox:
            switch Int.random(in: 0..<3) {
            case 0: await sniff()
            case 1: await lookAround()
            default: await pounce()
            }
        case .cat:
            switch Int.random(in: 0..<3) {
            case 0: await stretch()
            case 1: await wash()
            default: await nap()
            }
        case .deer:
            if Bool.random() { await wander() } else { await graze() }
        case .pheasant:
            if Bool.random() { await peck() } else { await wander() }
        }
    }

    private func signature() async {
        switch friend {
        case .monkey:
            await fidget()
            await jump(16)
        case .fox:
            await pounce()
        case .cat:
            await stretch()
        case .deer:
            await jump(18)
        case .pheasant:
            await peck()
            await move(0.1) { sy = 1.1 }
            await jump(12)
        }
    }

    // MARK: moves

    private func jump(_ height: CGFloat) async {
        await move(0.1) { sy = 0.9; sx = 1.06 }
        await move(0.2, .easeOut(duration: 0.2)) { sy = 1.05; sx = 0.97; dy = -height }
        await move(0.22, .easeIn(duration: 0.22)) { dy = 0; sy = 0.92; sx = 1.05 }
        await move(0.14) { sy = 1; sx = 1 }
    }

    /// Little steps with a bob, turning to face the way it goes.
    private func walk(to target: CGFloat) async {
        let distance = target - dx
        guard abs(distance) > 1 else { return }
        await turn(to: distance < 0 ? -1 : 1)
        let steps = max(2, Int(abs(distance) / 7))
        let stride = distance / CGFloat(steps)
        for _ in 0..<steps {
            guard !Task.isCancelled else { return }
            await move(0.13, .easeOut(duration: 0.13)) { dx += stride; dy = -3; angle = 2 }
            await move(0.13, .easeIn(duration: 0.13)) { dy = 0; angle = 0 }
        }
    }

    private func turn(to direction: CGFloat) async {
        guard facing != direction else { return }
        await move(0.18) { facing = direction }
    }

    private func wander() async {
        await walk(to: CGFloat.random(in: range))
        await pause(0.6)
        if friend == .deer, Bool.random() { await graze() }
    }

    private func lookAround() async {
        await move(0.2) { facing = -facing }
        await pause(Double.random(in: 0.9...1.6))
        await move(0.2) { facing = -facing }
    }

    private func fidget() async {
        for _ in 0..<4 {
            await move(0.07) { angle = -5 }
            await move(0.07) { angle = 5 }
        }
        await move(0.1) { angle = 0 }
    }

    private func sniff() async {
        await move(0.3) { angle = 7 }
        for _ in 0..<3 {
            await move(0.08) { angle = 9 }
            await move(0.08) { angle = 6 }
        }
        await pause(0.3)
        await move(0.3) { angle = 0 }
    }

    private func pounce() async {
        await move(0.25) { sy = 0.88; sx = 1.08; angle = 4 }
        await pause(0.3)
        await move(0.22, .easeOut(duration: 0.22)) { dx += 14 * facing; dy = -12; sy = 1.05; sx = 0.97; angle = -3 }
        await move(0.2, .easeIn(duration: 0.2)) { dy = 0; sy = 0.92; angle = 0 }
        await move(0.12) { sy = 1; sx = 1 }
        await pause(0.7)
        await walk(to: 0)
        await turn(to: 1)
    }

    private func stretch() async {
        await move(0.5) { sx = 1.14; sy = 0.86 }
        await pause(0.7)
        await move(0.35) { sx = 1; sy = 1.04 }
        await move(0.2) { sy = 1 }
    }

    private func wash() async {
        for _ in 0..<3 {
            await move(0.12) { angle = -4 }
            await move(0.12) { angle = 2 }
        }
        await move(0.1) { angle = 0 }
    }

    private func nap() async {
        await move(0.6) { sy = 0.93; sx = 1.05; napping = true }
        await pause(Double.random(in: 5...8))
        await move(0.4) { sy = 1; sx = 1; napping = false }
    }

    private func graze() async {
        await move(0.5) { angle = 10 }
        for _ in 0..<Int.random(in: 2...4) {
            await move(0.18) { angle = 12 }
            await move(0.18) { angle = 10 }
        }
        await pause(0.4)
        await move(0.45) { angle = 0 }
    }

    private func peck() async {
        for _ in 0..<Int.random(in: 2...3) {
            await move(0.09, .easeIn(duration: 0.09)) { angle = 22 }
            await move(0.14, .easeOut(duration: 0.14)) { angle = 0 }
            await pause(0.12)
        }
    }

    // MARK: helpers

    /// Animates a change and waits for it; does nothing once interrupted.
    private func move(_ seconds: Double, _ curve: Animation? = nil, _ change: () -> Void) async {
        guard !Task.isCancelled else { return }
        withAnimation(curve ?? .easeInOut(duration: seconds)) { change() }
        await pause(seconds)
    }

    private func pause(_ seconds: Double) async {
        try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }
}

/// "z Z" drifting up from a napping cat.
private struct Zzz: View {
    var body: some View {
        HStack(alignment: .bottom, spacing: 1) {
            letter("z", size: 10, delay: 0)
            letter("Z", size: 13, delay: 0.6)
        }
        .accessibilityHidden(true)
    }

    private func letter(_ text: String, size: CGFloat, delay: Double) -> some View {
        Text(text)
            .font(Brush.bold(size))
            .foregroundStyle(Ink.sub)
            .phaseAnimator([0.0, 1.0, 2.0]) { content, phase in
                content
                    .offset(x: phase * 3, y: phase * -8)
                    .opacity(phase == 1 ? 1 : 0)
            } animation: { phase in
                switch phase {
                case 1: return .easeOut(duration: 0.8).delay(delay)
                case 2: return .easeIn(duration: 0.8)
                default: return nil
                }
            }
    }
}
