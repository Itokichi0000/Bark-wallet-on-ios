import Bark
import Foundation

// すいそう: every VTXO is a fish.
//
// The tank is a teaching picture of Ark. A VTXO is a piece of bitcoin that
// lives off-chain and has an expiry block height; the fish shows how much it
// holds (size), how long it has left (how clear it looks), and what it is
// doing (swimming, caught in a net while a payment or round uses it).

extension Vtxo: @retroactive Identifiable {}

/// One fish in the tank, worked out from a VTXO and the chain tip.
struct Fish: Identifiable, Equatable {
    enum Health: Int, Comparable {
        /// More than a third of its lifetime left.
        case fresh
        /// Less than a third left: fine for now.
        case aging
        /// Bark wants it refreshed, or it has about a day left.
        case refreshNow
        /// Past its expiry height: the server may sweep it.
        case expired

        static func < (a: Health, b: Health) -> Bool { a.rawValue < b.rawValue }
    }

    let vtxo: Vtxo
    /// Blocks until expiry; nil while the chain tip is unknown.
    let blocksLeft: Int64?
    /// 0...1 share of its lifetime left; nil while unknown.
    let freshness: Double?
    let health: Health
    /// Picked up by the app for a refresh that is waiting for its round.
    var netted = false

    var id: String { vtxo.id }
    var amount: UInt64 { vtxo.amountSats }

    /// Caught in a net: a payment, round or exit is using it right now.
    var isBusy: Bool {
        if netted { return true }
        if case .locked = vtxo.state { return true }
        return false
    }

    var needsCare: Bool { health >= .refreshNow }

    /// Length in points: grows with the log of the amount, so a 1,000,000
    /// sat fish is big but still fits next to a 500 sat one.
    var length: Double { Fish.length(for: amount) }

    static func length(for amount: UInt64) -> Double {
        let value = Double(max(amount, 100))
        return min(26 + 12 * log10(value / 100), 84)
    }

    /// A stable number from the id, so a fish keeps its lane and its way of
    /// swimming across launches (`hashValue` changes every launch).
    var seed: UInt64 { Fish.seed(id) }

    static func seed(_ text: String) -> UInt64 {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01B3
        }
        return hash
    }

    /// One block is about ten minutes.
    static func roughTime(blocks: Int64) -> String {
        let minutes = max(blocks, 0) * 10
        if minutes < 60 { return "約\(minutes)分" }
        let hours = minutes / 60
        if hours < 48 { return "約\(hours)時間" }
        return "約\(hours / 24)日"
    }

    var blocksLeftText: String {
        guard let left = blocksLeft else { return "のこり ?" }
        if left <= 0 { return "期限切れ" }
        return "のこり \(SatFormat.sats(UInt64(left))) ブロック（\(Fish.roughTime(blocks: left))）"
    }

    var healthLabel: String {
        if isBusy { return "あみの中" }
        switch health {
        case .fresh: return "げんき"
        case .aging: return "ふつう"
        case .refreshNow: return "みずかえ時"
        case .expired: return "期限切れ"
        }
    }

    var stateText: String {
        switch vtxo.state {
        case .spendable: return "およいでいる（つかえる）"
        case .locked: return "あみの中（送金・ラウンドで使用中）"
        case .spent: return "つかわれた"
        case .exited: return "海へ出た（ひとりで脱出）"
        }
    }

    /// `Vtxo.kind` is the Rust `VtxoPolicyKind` name.
    var kindText: String {
        switch vtxo.kind {
        case "Pubkey": return "ふつうの さかな（あなたの鍵）"
        case "ServerHtlcSend": return "ライトニングで おくり中"
        case "ServerHtlcRecv": return "ライトニングで うけとり中"
        case "Checkpoint": return "チェックポイント"
        case "Expiry": return "期限つき（サーバー用）"
        default: return vtxo.kind
        }
    }

    var kindExplanation: String {
        switch vtxo.kind {
        case "ServerHtlcSend":
            return "ライトニングで はらうために、サーバーへ 条件つきで あずけている さかなです。支払いが おわると いなくなり、失敗すると もどってきます。"
        case "ServerHtlcRecv":
            return "ライトニングで うけとった お金を、サーバーが 条件つきで わたしてくれている さかなです。うけとりが 終わると ふつうの さかなに なります。"
        default:
            return "Ark サーバーと いっしょに つくった、あなただけの 鍵で つかえる ビットコインの 「引換券」です。オンチェーンには まだ のっていませんが、いざとなれば ひとりで チェーンに 出せます。"
        }
    }

    // MARK: - Building

    /// - Parameters:
    ///   - lifetime: the server's VTXO lifetime in blocks, for freshness.
    ///   - refreshIDs: the VTXOs bark itself says should be refreshed.
    ///   - netted: the VTXOs a refresh started from the app is using.
    static func school(from vtxos: [Vtxo], height: UInt64?, lifetime: UInt32?,
                       refreshIDs: Set<String>, netted: Set<String> = []) -> [Fish] {
        let tip = height.map { Int64($0) }
        let longest = tip.map { tip in vtxos.map { Int64($0.expiryHeight) - tip }.max() ?? 0 } ?? 0
        let span = Double(max(Int64(lifetime ?? 0), longest, 1))
        return vtxos
            .filter { vtxo in
                switch vtxo.state {
                case .spendable, .locked: return true
                case .spent, .exited: return false
                }
            }
            .map { vtxo in
                let left = tip.map { Int64(vtxo.expiryHeight) - $0 }
                let fresh = left.map { min(max(Double($0) / span, 0), 1) }
                let health: Health
                if let left, left <= 0 {
                    health = .expired
                } else if refreshIDs.contains(vtxo.id) || (left ?? .max) <= 144 {
                    health = .refreshNow
                } else if let fresh, fresh < 1.0 / 3.0 {
                    health = .aging
                } else {
                    health = .fresh
                }
                return Fish(vtxo: vtxo, blocksLeft: left, freshness: fresh, health: health,
                            netted: netted.contains(vtxo.id))
            }
            .sorted { a, b in
                // big fish first, so lanes stay put when a small one comes and goes
                a.amount != b.amount ? a.amount > b.amount : a.id < b.id
            }
    }
}

/// A fish that just left the tank (spent, sent, refreshed) and swims out.
struct FishGhost: Identifiable, Equatable {
    let id: String
    let amount: UInt64
    let at: Date
}

#if DEBUG
/// CI screenshots only: a fresh signet wallet has no VTXOs, so the
/// `aquarium` autopilot mode fills the tank with pretend ones.
enum DemoFish {
    static func make(height: UInt64?) -> [Vtxo] {
        let tip = UInt32(clamping: height ?? 250_000)
        let samples: [(UInt64, Int64, VtxoState)] = [
            (120_000, 3_900, .spendable),
            (42_000, 2_600, .spendable),
            (8_400, 1_100, .spendable),
            (2_100, 90, .spendable),
            (650, 400, .spendable),
            (15_000, 3_000, .locked(holder: nil)),
        ]
        return samples.enumerated().map { index, sample in
            Vtxo(
                id: String(repeating: "\(index + 1)f", count: 32) + ":0",
                amountSats: sample.0,
                expiryHeight: UInt32(clamping: Int64(tip) + sample.1),
                kind: "Pubkey",
                state: sample.2,
                exitDepth: UInt32(index % 3),
                exitTxWeightWu: 1_200 + UInt64(index) * 400,
                registered: true
            )
        }
    }
}
#endif
