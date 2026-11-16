import SwiftUI

/// "もらった！": the rabbit jumps, the frog cheers, coins fly, the amount
/// counts up and the growth card shows the step forward (or a new stage).
struct ReceivedCelebration: View {
    @EnvironmentObject private var store: WalletStore
    @EnvironmentObject private var settings: AppSettings
    var payment: IncomingPayment
    var onClose: () -> Void

    @State private var titleTick = 0
    @State private var cardShown = false
    @State private var line = RabbitLines.received.randomElement() ?? "やったね！"

    var body: some View {
        let growth = store.growth
        let leveledUp = store.levelUp
        ZStack {
            PaperBackground()
            ScrollView {
                VStack(spacing: 6) {
                    Text("\(payment.rail)で とどいたよ")
                        .font(Brush.text(15))
                        .foregroundStyle(Ink.sub)
                        .padding(.top, 48)
                    Text("もらった！")
                        .font(Brush.bold(40, relativeTo: .largeTitle))
                        .foregroundStyle(Ink.ink)
                        .pop(trigger: titleTick, from: 0.6)

                    ZStack(alignment: .bottom) {
                        sparkles
                        HStack(alignment: .bottom, spacing: 0) {
                            CharacterView(art: .frogBanzai, height: 74)
                                .jumpingForJoy(height: 14)
                                .padding(.bottom, 4)
                            CharacterView(art: .rabbitJump, height: 220)
                                .jumpingForJoy(height: 30)
                        }
                        .padding(.trailing, 40)
                    }
                    .frame(height: 290)

                    GroundLine()
                        .frame(width: 240)

                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        CountUpText(value: payment.amount, duration: 0.9) { "+" + SatFormat.sats($0) }
                            .font(Brush.amount(48))
                        Text("sats")
                            .font(Brush.text(18))
                    }
                    .foregroundStyle(Ink.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .padding(.top, 6)

                    SpeechBubble(text: line)
                        .padding(.top, 6)

                    growthCard(growth, leveledUp: leveledUp)
                        .padding(.top, 14)
                        .opacity(cardShown ? 1 : 0)
                        .offset(y: cardShown ? 0 : 12)

                    InkButton("とじる", kind: .secondary) { onClose() }
                        .padding(.top, 20)
                        .padding(.bottom, 30)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .task {
            titleTick += 1
            try? await Task.sleep(nanoseconds: 700_000_000)
            withAnimation(.spring(duration: 0.5, bounce: 0.3)) { cardShown = true }
            if store.levelUp != nil {
                Chiptune.shared.play(.boot)
                Haptics.heavy()
            }
        }
    }

    private var sparkles: some View {
        Canvas { gc, size in
            let coins: [(CGFloat, CGFloat, CGFloat)] = [
                (0.16, 0.22, 11), (0.84, 0.16, 9), (0.24, 0.6, 7), (0.8, 0.56, 12), (0.66, 0.08, 6),
            ]
            for (x, y, r) in coins {
                gc.fill(Path(ellipseIn: CGRect(x: x * size.width - r, y: y * size.height - r, width: r * 2, height: r * 2)),
                        with: .color(Ink.orange))
            }
            let crosses: [(CGFloat, CGFloat)] = [(0.08, 0.42), (0.9, 0.38), (0.3, 0.1)]
            for (x, y) in crosses {
                var path = Path()
                path.move(to: CGPoint(x: x * size.width - 5, y: y * size.height))
                path.addLine(to: CGPoint(x: x * size.width + 5, y: y * size.height))
                path.move(to: CGPoint(x: x * size.width, y: y * size.height - 5))
                path.addLine(to: CGPoint(x: x * size.width, y: y * size.height + 5))
                gc.stroke(path, with: .color(Ink.ink), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
        }
        .accessibilityHidden(true)
    }

    private func growthCard(_ growth: Growth, leveledUp: RabbitStage?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let leveledUp {
                HStack(spacing: 12) {
                    CharacterView(art: leveledUp.art, height: 64)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("せいちょうした！")
                            .font(Brush.bold(17))
                            .foregroundStyle(Ink.ink)
                        Text("Lv.\(leveledUp.rawValue) \(leveledUp.name) に なったよ")
                            .font(Brush.text(14))
                            .foregroundStyle(Ink.sub)
                    }
                }
            } else {
                HStack {
                    Text("うさぎ")
                        .font(Brush.text(14))
                        .foregroundStyle(Ink.sub)
                    Spacer()
                    Text("Lv.\(growth.stage.rawValue) \(growth.stage.name)")
                        .font(Brush.text(14))
                        .foregroundStyle(Ink.ink)
                }
            }
            HStack(spacing: 10) {
                GrowthDots(progress: growth.progress)
                Text(growth.remaining.map { "+1 ／ あと\($0)回で成長" } ?? "+1")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
            }
        }
        .inkCard(border: leveledUp == nil ? Ink.line : Ink.orange)
    }
}
