import Bark
import Foundation

/// The rabbit grows with every send or receive that went through.
enum RabbitStage: Int, CaseIterable, Identifiable, Comparable {
    case kousagi = 1, waka, otona, choju

    var id: Int { rawValue }

    static func < (lhs: RabbitStage, rhs: RabbitStage) -> Bool { lhs.rawValue < rhs.rawValue }

    var name: String {
        switch self {
        case .kousagi: return "こうさぎ"
        case .waka: return "わかうさぎ"
        case .otona: return "おとなうさぎ"
        case .choju: return "ちょうじゅうさぎ"
        }
    }

    var blurb: String {
        switch self {
        case .kousagi: return "うまれたて。まだ ぴょんと跳べない"
        case .waka: return "元気いっぱい"
        case .otona: return "オレンジの えりまきが 似合う"
        case .choju: return "長生きの ものしり。杖をついて ゆったり"
        }
    }

    /// Trades needed to reach this stage.
    var minTrades: Int {
        switch self {
        case .kousagi: return 0
        case .waka: return 10
        case .otona: return 30
        case .choju: return 100
        }
    }

    var next: RabbitStage? { RabbitStage(rawValue: rawValue + 1) }

    var rangeLabel: String {
        if let next { return "\(minTrades)〜\(next.minTrades - 1)回" }
        return "\(minTrades)回〜"
    }

    var art: CharacterArt {
        switch self {
        case .kousagi: return .rabbit1
        case .waka: return .rabbit2
        case .otona: return .rabbit3
        case .choju: return .rabbit4
        }
    }

    static func stage(for trades: Int) -> RabbitStage {
        allCases.last { trades >= $0.minTrades } ?? .kousagi
    }
}

struct Growth: Equatable {
    let trades: Int

    var stage: RabbitStage { .stage(for: trades) }

    /// Trades left until the next stage, nil at the last one.
    var remaining: Int? {
        guard let next = stage.next else { return nil }
        return next.minTrades - trades
    }

    /// 0...1 within the current stage.
    var progress: Double {
        guard let next = stage.next else { return 1 }
        let span = Double(next.minTrades - stage.minTrades)
        return min(max(Double(trades - stage.minTrades) / span, 0), 1)
    }

    var remainingText: String {
        guard let remaining else { return "いちばん 大きくなったよ" }
        return "つぎの成長まで あと\(remaining)回"
    }
}

extension Movement {
    /// Sends and receives that went through make the rabbit grow;
    /// refreshes, boards and exits don't.
    var countsForGrowth: Bool {
        guard isSuccessful else { return false }
        switch kind {
        case .arkSend, .arkReceive, .lightningSend, .lightningReceive, .onchainSend: return true
        default: return false
        }
    }

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
