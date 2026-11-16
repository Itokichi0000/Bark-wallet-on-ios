import SwiftUI

/// なかま: the friends who came to live with the rabbit and the frog, and
/// how far the highest balance has to grow for the next one.
struct FriendsView: View {
    @EnvironmentObject private var store: WalletStore

    var body: some View {
        let friends = store.friends
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("なかま")
                        .font(Brush.bold(26, relativeTo: .title))
                        .foregroundStyle(Ink.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("ざんだかの 最高記録が のびると 新しい なかまが あそびに きます。いちど きたら ずっと いっしょ。")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 14)

                recordCard(friends)
                    .appearIn()

                if let next = friends.next {
                    nextCard(next, friends: friends)
                        .appearIn(delay: 0.05)
                }

                ForEach(Array(Friend.allCases.enumerated()), id: \.element) { index, friend in
                    friendCard(friend, friends: friends)
                        .appearIn(delay: 0.06 * Double(index + 2))
                }

                HStack(alignment: .bottom, spacing: 12) {
                    CharacterView(art: .rabbit2, height: 72)
                    CharacterView(art: .frogLetter, height: 52)
                    Text("うさぎと かえるは さいしょから いっしょ。かえるは おくるときに 手紙を とどけてくれます。")
                        .font(Brush.text(13))
                        .foregroundStyle(Ink.sub)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 8)
                .appearIn(delay: 0.45)

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

    private func recordCard(_ friends: Friends) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("これまでの 最高ざんだか")
                    .font(Brush.text(13))
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(SatFormat.sats(friends.highest))
                        .font(Brush.amount(28))
                        .contentTransition(.numericText(value: Double(friends.highest)))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("sats")
                        .font(Brush.text(14))
                }
            }
            Spacer()
            Text("なかま \(friends.arrived.count)/\(Friend.allCases.count)")
                .font(Brush.bold(15))
        }
        .foregroundStyle(Ink.paper)
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(InkBlock())
        .accessibilityElement(children: .combine)
    }

    private func nextCard(_ next: Friend, friends: Friends) -> some View {
        HStack(spacing: 14) {
            CharacterView(art: next.art, height: 64, faded: true)
                .frame(width: 76, height: 70, alignment: .bottom)
            VStack(alignment: .leading, spacing: 6) {
                Text("つぎに きそうな なかま")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                Text(friends.remainingText)
                    .font(Brush.bold(15))
                    .foregroundStyle(Ink.ink)
                    .fixedSize(horizontal: false, vertical: true)
                GrowthDots(progress: friends.progress)
            }
            Spacer(minLength: 0)
        }
        .inkCard(border: Ink.orange)
        .accessibilityElement(children: .combine)
    }

    private func friendCard(_ friend: Friend, friends: Friends) -> some View {
        let here = friends.has(friend)
        let isNext = friends.next == friend
        return HStack(spacing: 14) {
            CharacterView(art: friend.art, height: 76, faded: !here)
                .frame(width: 92, height: 86, alignment: .bottom)
                .breathing(here ? 0.025 : 0)
            VStack(alignment: .leading, spacing: 2) {
                Text(here ? "\(friend.thresholdLabel) で きた" : "\(friend.thresholdLabel) で きそう")
                    .font(Brush.text(12))
                    .foregroundStyle(Ink.sub)
                Text(friend.name)
                    .font(Brush.bold(19))
                    .foregroundStyle(here ? Ink.ink : Ink.sub)
                Text(here ? friend.blurb : "まだ 山の むこうに いるみたい")
                    .font(Brush.text(13))
                    .foregroundStyle(Ink.sub)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            if here {
                SealStamp(text: "友", size: 26)
                    .accessibilityLabel("なかま")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(here ? Ink.paper : Color.clear, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            if here {
                BrushFrame(color: Ink.ink.opacity(0.45))
            } else {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(isNext ? Ink.orange : Ink.line, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            }
        }
        .accessibilityElement(children: .combine)
    }
}
