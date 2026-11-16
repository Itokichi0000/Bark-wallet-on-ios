import Bark
import Foundation

/// Friends who come to live with the rabbit and the frog. Each one arrives
/// the first time the wallet has held a little more, and stays for good:
/// what counts is the highest balance ever, so spending never sends anyone away.
enum Friend: String, CaseIterable, Identifiable {
    case monkey, fox, cat, deer, pheasant

    var id: String { rawValue }

    /// Highest balance (sats) at which this friend arrives.
    var threshold: UInt64 {
        switch self {
        case .monkey: return 1_000
        case .fox: return 10_000
        case .cat: return 50_000
        case .deer: return 100_000
        case .pheasant: return 500_000
        }
    }

    var name: String {
        switch self {
        case .monkey: return "さる"
        case .fox: return "きつね"
        case .cat: return "ねこ"
        case .deer: return "しか"
        case .pheasant: return "きじ"
        }
    }

    var blurb: String {
        switch self {
        case .monkey: return "お坊さんの まねが とくい。ちょっと いたずらずき"
        case .fox: return "しっぽの 先に あかりを ともして 夜みちを てらす"
        case .cat: return "ひなたぼっこが だいすき。いつのまにか ひざの上"
        case .deer: return "やさしい力もち。うさぎを せなかに のせてくれる"
        case .pheasant: return "長い しっぽの おしゃれさん。山の たよりを はこぶ"
        }
    }

    /// What the rabbit says when this friend shows up.
    var arrivalLine: String {
        switch self {
        case .monkey: return "さるが あそびに きたよ！"
        case .fox: return "きつねが きてくれた！"
        case .cat: return "ねこが すみついたみたい"
        case .deer: return "しかが 山から おりてきた！"
        case .pheasant: return "きじも きて みんな そろった"
        }
    }

    /// Said when tapped at home.
    var voice: String {
        switch self {
        case .monkey: return "さる「キキッ」"
        case .fox: return "きつね「コン」"
        case .cat: return "ねこ「にゃあ」"
        case .deer: return "しか「ピャッ」"
        case .pheasant: return "きじ「ケーン」"
        }
    }

    var art: CharacterArt {
        switch self {
        case .monkey: return .monkey
        case .fox: return .fox
        case .cat: return .cat
        case .deer: return .deer
        case .pheasant: return .pheasant
        }
    }

    var thresholdLabel: String { "\(SatFormat.sats(threshold)) sats" }

    static func arrived(for highest: UInt64) -> [Friend] {
        allCases.filter { highest >= $0.threshold }
    }
}

struct Friends: Equatable {
    /// Highest balance the wallet has ever held, in sats.
    let highest: UInt64

    var arrived: [Friend] { Friend.arrived(for: highest) }

    func has(_ friend: Friend) -> Bool { highest >= friend.threshold }

    var next: Friend? { Friend.allCases.first { highest < $0.threshold } }

    /// Sats still missing from the highest balance before the next friend comes.
    var remaining: UInt64? { next.map { $0.threshold - highest } }

    /// 0...1 between the previous friend and the next one.
    var progress: Double {
        guard let next else { return 1 }
        let previous = Friend.allCases.last { highest >= $0.threshold }?.threshold ?? 0
        let span = Double(next.threshold - previous)
        return min(max(Double(highest - previous) / span, 0), 1)
    }

    var remainingText: String {
        guard let next, let remaining else { return "みんな そろったよ" }
        return "あと \(SatFormat.sats(remaining)) sats で \(next.name)が きそう"
    }
}

/// Friends who just came, kept for a little while so both the home room
/// and the "もらった！" screen can greet them.
struct FriendArrival: Equatable, Identifiable {
    let id = UUID()
    let friends: [Friend]
    let date = Date()

    /// Still worth a fanfare.
    var isRecent: Bool { Date().timeIntervalSince(date) < 90 }
}

extension Movement {
    var isIncoming: Bool { effectiveBalanceSats > 0 }

    /// もらった / おくった / …
    var title: String {
        switch kind {
        case .arkReceive, .lightningReceive: return "もらった"
        case .arkSend, .lightningSend, .onchainSend: return "おくった"
        case .board: return "入金"
        case .offboard: return "出金"
        case .exit: return "緊急出金"
        case .refresh: return "こうしん"
        case .other: return effectiveBalanceSats >= 0 ? "もらった" : "おくった"
        }
    }

    /// Ark / ライトニング / オンチェーン
    var railName: String {
        switch kind {
        case .arkSend, .arkReceive: return "Ark"
        case .lightningSend, .lightningReceive: return "ライトニング"
        case .onchainSend, .board, .offboard, .exit: return "オンチェーン"
        case .refresh: return "Ark"
        case .other: return subsystemName.replacingOccurrences(of: "bark.", with: "")
        }
    }

    var statusText: String {
        switch status {
        case "successful": return "とどいた"
        case "pending": return "とどけ中"
        case "failed": return "しっぱい"
        case "canceled": return "とりけし"
        default: return status
        }
    }
}
