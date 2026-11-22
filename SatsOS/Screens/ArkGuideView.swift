import Bark
import SwiftUI

/// しくみ: the tab. Animated diagrams first, then the words and the rules.
struct LearnView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("しくみ")
                        .font(Brush.bold(30, relativeTo: .title))
                        .foregroundStyle(Ink.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("まずは 1分の どうがを 見てみよう")
                        .font(Brush.text(14))
                        .foregroundStyle(Ink.sub)
                }
                .padding(.top, 14)
                ArkLearnContent()
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(PaperBackground())
    }
}

/// しくみ図鑑 as a sheet (from the aquarium and a fish's detail).
struct ArkGuideView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "しくみ図鑑", onClose: { dismiss() })
            ScrollView {
                ArkLearnContent()
                    .padding(.horizontal, 16)
                    .padding(.bottom, 30)
                    .frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
            }
        }
        .background(PaperBackground())
    }
}

/// The diagrams, the glossary (each word twice: the aquarium picture and
/// what really happens), the live server rules and a little quiz.
struct ArkLearnContent: View {
    @EnvironmentObject private var store: WalletStore

    @State private var scene: ArkScene = Autopilot.learnScene ?? .arkoor
    @State private var open: Set<String> = ["vtxo"]
    @State private var sections: Set<String> = []
    @Namespace private var pickerSpace

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // the whole idea first, as one short film
            ArkStoryPlayer(autoStart: Autopilot.storyChapter)
                .inkCard(padding: 16)

            Text("もっと 知りたく なったら")
                .font(Brush.bold(17))
                .foregroundStyle(Ink.ink)
                .padding(.top, 8)

            section("scenes", icon: .play, color: Ink.server, title: "うごきを 1つずつ 見る",
                    detail: "ボード・送金・ラウンドなど 7つの 図") {
                VStack(alignment: .leading, spacing: 12) {
                    scenePicker
                    VStack(alignment: .leading, spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(scene.title)
                                .font(Brush.bold(20))
                                .foregroundStyle(Ink.ink)
                            Text(scene.summary)
                                .font(Brush.text(13))
                                .foregroundStyle(Ink.sub)
                        }
                        ArkScenePlayer(scene: scene)
                    }
                    .id(scene)
                    .transition(.asymmetric(insertion: .scale(scale: 0.94).combined(with: .opacity), removal: .opacity))
                    legend
                }
            }

            section("words", icon: .book, color: Ink.orange, title: "ことば図鑑",
                    detail: "VTXO・ラウンド・Refresh… \(GuideEntry.all.count)この ことば") {
                VStack(spacing: 8) {
                    ForEach(GuideEntry.all) { entry in
                        GuideCard(entry: entry, expanded: open.contains(entry.id)) {
                            Chiptune.shared.play(.click)
                            Haptics.tap()
                            withAnimation(Motion.glide) {
                                if open.contains(entry.id) {
                                    open.remove(entry.id)
                                } else {
                                    open.insert(entry.id)
                                }
                            }
                        }
                    }
                }
            }

            section("rules", icon: .record, color: Ink.chain, title: "この サーバーの きまり",
                    detail: "ラウンドの 間隔や 期限の 長さ（じっさいの 数字）") {
                rules
            }

            section("quiz", icon: .check, color: Ink.good, title: "クイズで たしかめる",
                    detail: "\(ArkQuiz.count)もん。どうがを 見たあとに どうぞ") {
                ArkQuiz()
            }
        }
        .animation(Motion.glide, value: scene)
    }

    /// One fold-away part of the page: closed, it is a single tidy row.
    private func section<Content: View>(_ id: String, icon: InkIcon.Kind, color: Color, title: String, detail: String,
                                        @ViewBuilder content: () -> Content) -> some View {
        let expanded = sections.contains(id)
        return VStack(alignment: .leading, spacing: 14) {
            Button {
                Chiptune.shared.play(.click)
                Haptics.tap()
                withAnimation(Motion.glide) {
                    if expanded {
                        sections.remove(id)
                    } else {
                        sections.insert(id)
                    }
                }
            } label: {
                HStack(spacing: 12) {
                    IconBubble(icon: icon, color: color, size: 42)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title)
                            .font(Brush.bold(16))
                            .foregroundStyle(Ink.ink)
                        Text(detail)
                            .font(Brush.text(12))
                            .foregroundStyle(Ink.sub)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 0)
                    InkIcon(kind: .back, size: 12, lineWidth: 2.6, color: color)
                        .rotationEffect(.degrees(expanded ? 90 : -90))
                        .frame(width: 30, height: 30)
                        .background(color.opacity(0.14), in: Circle())
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle(scale: 0.98))
            .accessibilityAddTraits(expanded ? .isSelected : [])

            if expanded {
                content()
                    .transition(.opacity.combined(with: .scale(scale: 0.97, anchor: .top)))
            }
        }
        .inkCard(padding: 14)
    }

    private var scenePicker: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(ArkScene.allCases.enumerated()), id: \.element.id) { index, item in
                        let selected = item == scene
                        Button {
                            Chiptune.shared.play(.select)
                            Haptics.tap()
                            withAnimation(Motion.glide) {
                                scene = item
                                proxy.scrollTo(item.id, anchor: .center)
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Text("\(index + 1)")
                                    .font(Brush.bold(11))
                                    .foregroundStyle(selected ? Ink.server : Ink.sub)
                                    .frame(width: 20, height: 20)
                                    .background(selected ? Color.white : Ink.wash, in: Circle())
                                Text(item.title)
                                    .font(Brush.bold(14))
                                    .foregroundStyle(selected ? Ink.onColor : Ink.ink)
                            }
                            .padding(.leading, 8)
                            .padding(.trailing, 14)
                            .frame(height: 38)
                            .background {
                                if selected {
                                    Capsule().fill(Ink.server)
                                        .matchedGeometryEffect(id: "scene", in: pickerSpace)
                                        .shadow(color: Ink.server.opacity(0.35), radius: 8, y: 4)
                                } else {
                                    Capsule().fill(Ink.paper)
                                }
                            }
                        }
                        .buttonStyle(PressableStyle(scale: 0.92))
                        .id(item.id)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
            .padding(.horizontal, -14)
        }
    }

    /// How to read the diagrams.
    private var legend: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("図の 見かた")
                .font(Brush.bold(14))
                .foregroundStyle(Ink.ink)
            legendRow(Canvas { gc, size in
                ArkDraw.coin(gc, CGPoint(x: size.width / 2, y: size.height / 2), r: 7, life: 0.7)
            }, "VTXO。まわりの リングは 期限までの のこり")
            legendRow(Canvas { gc, size in
                ArkDraw.tx(gc, CGPoint(x: size.width / 2, y: size.height / 2), color: Ink.orange)
            }, "取引（トランザクション）")
            legendRow(Canvas { gc, size in
                let rect = CGRect(x: size.width / 2 - 8, y: size.height / 2 - 8, width: 16, height: 16)
                gc.fill(Path(roundedRect: rect, cornerRadius: 5), with: .color(Ink.chain))
            }, "ビットコインの ブロック。下の 段が チェーン、上が Ark")
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.wash.opacity(0.6), in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
    }

    private func legendRow<Glyph: View>(_ glyph: Glyph, _ text: String) -> some View {
        HStack(spacing: 10) {
            glyph.frame(width: 32, height: 28)
            Text(text)
                .font(Brush.text(13))
                .foregroundStyle(Ink.sub)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    /// The numbers behind the pictures, straight from the server.
    private var rules: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(store.network.serverHost)
                .font(Brush.mono(12))
                .foregroundStyle(Ink.sub)
            if let info = store.arkInfo {
                InfoRow(label: "ラウンド", value: "\(RoundTime.text(info.roundIntervalSecs))ごと")
                InfoRow(label: "VTXO の いのち",
                        value: "\(SatFormat.sats(UInt64(info.vtxoLifetime))) ブロック（\(Fish.roughTime(blocks: Int64(info.vtxoLifetime)))）")
                InfoRow(label: "ひとりで出るときの 待ち",
                        value: "\(info.vtxoExitDelta) ブロック（\(Fish.roughTime(blocks: Int64(info.vtxoExitDelta)))）")
                InfoRow(label: "てわたしの 上限", value: "\(info.maxVtxoExitDepth) 回")
                InfoRow(label: "ボードの 最小額", value: "\(SatFormat.sats(info.minBoardAmountSats)) sats")
                if let height = store.blockHeight {
                    InfoRow(label: "いまの ブロック", value: "#\(SatFormat.sats(height))")
                }
            } else {
                Text("サーバーに つながると 表示されます")
                    .font(Brush.text(13))
                    .foregroundStyle(Ink.sub)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Entries

struct GuideEntry: Identifiable {
    let id: String
    let word: String
    /// The aquarium picture.
    let picture: String
    /// What really happens.
    let real: String

    static let all: [GuideEntry] = [
        GuideEntry(
            id: "vtxo",
            word: "VTXO（さかな）",
            picture: "すいそうの 1ぴき 1ぴきが VTXO。大きいほど たくさんの sats を もっています。",
            real: "Virtual UTXO。オンチェーンの 1つの 取引を みんなで 分けあった 「引換券」で、あなたの 鍵が ないと つかえません。チェーンには まだ のっていないので 安く・すぐ うごかせます。"
        ),
        GuideEntry(
            id: "server",
            word: "Ark サーバー（すいそうの 管理人）",
            picture: "管理人は みずかえを 手つだったり、さかなを となりの すいそうへ はこんだり します。でも さかなを 勝手に つれていく ことは できません。",
            real: "ASP（Ark Service Provider）。署名に 参加して 送金を まとめますが、お金を うごかすには あなたの 署名が 必要です。サーバーが 止まっても 下の 「ひとりで脱出」で とりだせます。"
        ),
        GuideEntry(
            id: "expiry",
            word: "期限（みずの にごり）",
            picture: "期限が ちかい さかなが いると みずが にごり、「!」が でます。",
            real: "VTXO には 期限の ブロック高が あります。すぎると サーバーが 元の オンチェーン資金を 回収できる ように なるので、その前に Refresh します。"
        ),
        GuideEntry(
            id: "refresh",
            word: "Refresh（みずかえ）",
            picture: "古い さかなを あみで すくって、新しい 元気な さかなと とりかえます。",
            real: "古い VTXO を 次の ラウンドに 出して、新しい 期限の VTXO と こうかんします。期限が ちかいほど 手数料は 安く、てわたしの 鎖も リセットされます。"
        ),
        GuideEntry(
            id: "round",
            word: "ラウンド（いっせい こうかん）",
            picture: "決まった 時間ごとに 管理人が みんなの みずかえを いっぺんに やります。",
            real: "サーバーが 参加者の こうかんを 1つの オンチェーン取引に まとめます。1回の 取引で 大勢ぶんを 処理するので 1人あたりの 手数料が 小さく なります。"
        ),
        GuideEntry(
            id: "arkoor",
            word: "てわたし（Arkoor 送金）",
            picture: "Ark アドレスへ おくると、さかなは すぐ 相手の すいそうへ 泳いでいきます。おつりは 新しい さかなに。",
            real: "ラウンドを またず サーバーと 共同署名して すぐ 届く 送金（out-of-round）。VTXO は 一度 つかうと なくなり、相手の ぶんと おつりの 新しい VTXO が うまれます。くりかえすと 鎖が 長くなります。"
        ),
        GuideEntry(
            id: "lightning",
            word: "ライトニング（となりの 川）",
            picture: "サーバーが 川への 水門に なって、ライトニングの 世界とも やりとり できます。",
            real: "サーバーが ゲートウェイになり、VTXO を 条件つき（HTLC）で あずけて ライトニング請求書を 支払ったり、うけとったり します。"
        ),
        GuideEntry(
            id: "exit",
            word: "ひとりで脱出（Unilateral exit）",
            picture: "管理人が いなくなっても、さかなは 自分で 海（ブロックチェーン）へ 泳いで いけます。",
            real: "あらかじめ 署名ずみの 取引を チェーンに 出して、サーバーの 協力なしに お金を とりだせます。時間（待ちブロック）と オンチェーン手数料が かかる 最後の 手段です。"
        ),
        GuideEntry(
            id: "board",
            word: "ボード / オフボード（海と すいそうの 出入り）",
            picture: "海の 魚を すいそうに 入れるのが ボード、すいそうから 海へ もどすのが オフボード。",
            real: "オンチェーンの ビットコインを Ark の VTXO に するのが ボード、VTXO を ふつうの オンチェーン出力に もどすのが オフボード です。"
        ),
        GuideEntry(
            id: "block",
            word: "ブロック（すいそうの とけい）",
            picture: "とけいの 針が ひとつ 進むたびに、どの さかなも 期限へ 1歩 ちかづきます。",
            real: "ビットコインの ブロックは 約10分に 1つ。Ark の 期限や 待ち時間は 時刻ではなく ブロックの 高さで 決まります。"
        ),
    ]
}

private struct GuideCard: View {
    var entry: GuideEntry
    var expanded: Bool
    var toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: toggle) {
                HStack {
                    Text(entry.word)
                        .font(Brush.bold(15))
                        .foregroundStyle(Ink.ink)
                        .multilineTextAlignment(.leading)
                    Spacer()
                    InkIcon(kind: .back, size: 12, lineWidth: 2.6, color: Ink.server)
                        .rotationEffect(.degrees(expanded ? 90 : -90))
                        .frame(width: 28, height: 28)
                        .background(Ink.serverSoft, in: Circle())
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .accessibilityAddTraits(expanded ? .isSelected : [])

            if expanded {
                VStack(alignment: .leading, spacing: 10) {
                    labeled("たとえると", entry.picture, color: Ink.orange)
                    labeled("ほんとうは", entry.real, color: Ink.server)
                }
                .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .top)))
            }
        }
        .padding(12)
        .background(Ink.wash.opacity(0.6), in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
    }

    private func labeled(_ label: String, _ text: String, color: Color) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label)
                .font(Brush.bold(11))
                .foregroundStyle(Ink.onColor)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(color, in: Capsule())
                .fixedSize()
            Text(text)
                .font(Brush.text(13))
                .foregroundStyle(Ink.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Quiz

private struct QuizQuestion {
    let question: String
    let choices: [String]
    let answer: Int
    let why: String

    static let all: [QuizQuestion] = [
        QuizQuestion(question: "VTXO の 期限が すぎると どうなる？",
                     choices: ["なにも おきない", "サーバーが 回収できる ように なる", "自動で 2倍に なる"],
                     answer: 1,
                     why: "だから 期限の まえに Refresh（みずかえ）します。"),
        QuizQuestion(question: "期限を のばすには？",
                     choices: ["Refresh（みずかえ）する", "アプリを 再起動する", "金額を ふやす"],
                     answer: 0,
                     why: "ラウンドで 新しい 期限の VTXO と こうかんします。"),
        QuizQuestion(question: "Ark サーバーが 止まったら お金は？",
                     choices: ["消えてしまう", "ひとりで脱出して チェーンに 出せる", "サーバーが もどるまで ぜったい 動かせない"],
                     answer: 1,
                     why: "署名ずみの 取引で、サーバーの 協力なしに とりだせます。"),
        QuizQuestion(question: "すいそうの さかなの 大きさは 何を あらわす？",
                     choices: ["期限の 長さ", "金額", "つかった 回数"],
                     answer: 1,
                     why: "大きい さかなほど たくさんの sats を もっています。"),
        QuizQuestion(question: "1ブロックは だいたい 何分？",
                     choices: ["1分", "10分", "1時間"],
                     answer: 1,
                     why: "Ark の 期限は ブロックの 高さで 数えます。"),
    ]
}

private struct ArkQuiz: View {
    static var count: Int { QuizQuestion.all.count }

    @State private var index = 0
    @State private var picked: Int?
    @State private var score = 0
    @State private var shake = 0
    @State private var finished = false

    private var question: QuizQuestion { QuizQuestion.all[index] }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Spacer()
                Text(finished ? "\(score) / \(QuizQuestion.all.count)" : "\(index + 1) / \(QuizQuestion.all.count)")
                    .font(Brush.text(13))
                    .foregroundStyle(Ink.sub)
                    .contentTransition(.numericText())
            }
            if finished {
                result
            } else {
                Text(question.question)
                    .font(Brush.bold(15))
                    .foregroundStyle(Ink.ink)
                    .fixedSize(horizontal: false, vertical: true)
                VStack(spacing: 8) {
                    ForEach(Array(question.choices.enumerated()), id: \.offset) { choice, text in
                        choiceButton(choice, text)
                    }
                }
                .shake(trigger: shake)
                if let picked {
                    Text((picked == question.answer ? "せいかい！ " : "ざんねん… ") + question.why)
                        .font(Brush.text(13))
                        .foregroundStyle(picked == question.answer ? Ink.good : Ink.alert)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.opacity)
                    InkButton(index + 1 < QuizQuestion.all.count ? "つぎへ" : "けっか を 見る", kind: .secondary, height: 46) {
                        next()
                    }
                }
            }
        }
        .animation(Motion.bounce, value: picked)
        .animation(Motion.glide, value: index)
    }

    private func choiceButton(_ choice: Int, _ text: String) -> some View {
        let isAnswer = choice == question.answer
        let chosen = picked == choice
        let reveal = picked != nil
        return Button {
            guard picked == nil else { return }
            picked = choice
            if isAnswer {
                score += 1
                Chiptune.shared.play(.coin)
                Haptics.success()
            } else {
                shake += 1
                Chiptune.shared.play(.error)
                Haptics.error()
            }
        } label: {
            HStack {
                Text(text)
                    .font(Brush.text(14))
                    .multilineTextAlignment(.leading)
                Spacer()
                if reveal, isAnswer {
                    InkIcon(kind: .check, size: 16, lineWidth: 3, color: Ink.good)
                        .transition(.scale)
                }
            }
            .foregroundStyle(reveal && chosen && !isAnswer ? Ink.alert : Ink.ink)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(reveal && isAnswer ? Ink.good.opacity(0.16) : (chosen ? Ink.alertSoft : Ink.wash),
                        in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .strokeBorder(reveal && isAnswer ? Ink.good : (chosen ? Ink.alert : Color.clear), lineWidth: 2)
            )
            .scaleEffect(reveal && isAnswer ? 1.02 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .disabled(reveal)
    }

    private var result: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(score == QuizQuestion.all.count ? "ぜんもん せいかい！ Ark はかせ だね" : "\(score)もん せいかい。図鑑を 読んで もう一度 どうぞ")
                .font(Brush.bold(15))
                .foregroundStyle(Ink.ink)
            InkButton("もう一度", icon: .refresh, kind: .secondary, height: 46) {
                index = 0
                score = 0
                picked = nil
                finished = false
            }
        }
    }

    private func next() {
        if index + 1 < QuizQuestion.all.count {
            index += 1
            picked = nil
        } else {
            finished = true
            if score == QuizQuestion.all.count {
                Chiptune.shared.play(.boot)
                Haptics.success()
            }
        }
    }
}
