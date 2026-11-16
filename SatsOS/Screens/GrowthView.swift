import SwiftUI

/// うさぎ: how the rabbit grows with every send and receive.
struct GrowthView: View {
    @EnvironmentObject private var store: WalletStore

    var body: some View {
        let growth = store.growth
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("うさぎの成長")
                        .font(Brush.bold(26, relativeTo: .title))
                        .foregroundStyle(Ink.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("おくったり もらったりするたびに 少しずつ育ちます")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                }
                .padding(.top, 14)

                HStack(alignment: .firstTextBaseline) {
                    Text("これまでの取引")
                        .font(Brush.text(14))
                    Spacer()
                    Text("\(growth.trades)")
                        .font(Brush.amount(28))
                        .contentTransition(.numericText(value: Double(growth.trades)))
                    Text("回")
                        .font(Brush.text(14))
                }
                .foregroundStyle(Ink.paper)
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .background(Ink.ink, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .appearIn()

                ForEach(Array(RabbitStage.allCases.enumerated()), id: \.element) { index, stage in
                    stageCard(stage, growth: growth)
                        .appearIn(delay: 0.06 * Double(index + 1))
                }

                HStack(alignment: .bottom, spacing: 12) {
                    CharacterView(art: .frogLetter, height: 64)
                    Text("かえるは あいぼう。おくるときに 手紙を とどけてくれます。")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                }
                .padding(.top, 8)
                .appearIn(delay: 0.35)

                SceneView(name: "strip")
                    .frame(height: 90)
                    .padding(.horizontal, -18)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(PaperBackground())
    }

    private func stageCard(_ stage: RabbitStage, growth: Growth) -> some View {
        let reached = growth.trades >= stage.minTrades
        let current = growth.stage == stage
        return HStack(spacing: 14) {
            CharacterView(art: stage.art, height: current ? 90 : 76, faded: !reached)
                .frame(width: 84, height: 96, alignment: .bottom)
                .breathing(current ? 0.025 : 0)
            VStack(alignment: .leading, spacing: 2) {
                Text("Lv.\(stage.rawValue) ・ \(stage.rangeLabel)")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                Text(stage.name)
                    .font(Brush.bold(19))
                    .foregroundStyle(Ink.ink)
                Text(current ? currentBlurb(stage, growth: growth) : stage.blurb)
                    .font(Brush.text(13))
                    .foregroundStyle(Ink.sub)
                    .fixedSize(horizontal: false, vertical: true)
                if current, stage.next != nil {
                    GrowthDots(progress: growth.progress)
                        .padding(.top, 4)
                }
            }
            Spacer(minLength: 0)
            if reached && !current {
                InkIcon(kind: .check, size: 20, lineWidth: 2.2)
                    .accessibilityLabel("たっせい")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(reached ? Ink.paper : Color.clear, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(current ? Ink.ink : Ink.line, style: StrokeStyle(lineWidth: current ? 2 : 1.5, dash: reached ? [] : [5, 4]))
        )
        .overlay(alignment: .topTrailing) {
            if current {
                Text("いまここ")
                    .font(Brush.bold(12))
                    .foregroundStyle(Color(hex: 0x151515))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 2)
                    .background(Ink.orange, in: Capsule())
                    .offset(x: -14, y: -10)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func currentBlurb(_ stage: RabbitStage, growth: Growth) -> String {
        if let remaining = growth.remaining {
            return "\(stage.blurb)。あと\(remaining)回で つぎへ"
        }
        return stage.blurb
    }
}
