import SwiftUI

/// Bush-clover leaves drifting down across a strip of scenery, swaying as
/// they fall. Holds still (and draws nothing) under Reduce Motion.
struct FallingLeaves: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    private struct Leaf { let x, speed, sway, phase, size: Double }

    private let leaves = [
        Leaf(x: 0.12, speed: 14, sway: 12, phase: 0, size: 10),
        Leaf(x: 0.36, speed: 10, sway: 16, phase: 1.7, size: 8),
        Leaf(x: 0.58, speed: 16, sway: 10, phase: 3.1, size: 11),
        Leaf(x: 0.8, speed: 12, sway: 14, phase: 0.9, size: 9),
        Leaf(x: 0.94, speed: 9, sway: 8, phase: 2.4, size: 7),
    ]

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = context.date.timeIntervalSince(start)
            Canvas { gc, size in
                guard !reduceMotion else { return }
                let fall = size.height + 30
                for leaf in leaves {
                    let travelled = (t * leaf.speed + leaf.phase * 40).truncatingRemainder(dividingBy: fall)
                    let y = travelled - 15
                    let x = leaf.x * size.width + sin(t * 1.1 + leaf.phase) * leaf.sway
                    var g = gc
                    g.translateBy(x: x, y: y)
                    g.rotate(by: .degrees(sin(t * 1.4 + leaf.phase) * 40 + 20))
                    g.fill(Path(ellipseIn: CGRect(x: -leaf.size / 2, y: -leaf.size / 4.5,
                                                  width: leaf.size, height: leaf.size / 2.2)),
                           with: .color(Ink.ink.opacity(0.4)))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
