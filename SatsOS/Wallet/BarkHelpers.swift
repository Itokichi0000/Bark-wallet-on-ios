import Bark
import Foundation

// NOTE: `Bark` exports its own `Error` type, so inside files that import Bark
// always spell the standard protocol as `Swift.Error`.

extension Swift.Error {
    /// A human readable message. Bark wraps every failure in
    /// `Bark.Error.Inner(message:)`, whose default description is noisy.
    var barkMessage: String {
        if let barkError = self as? Bark.Error {
            switch barkError {
            case .Inner(let message):
                return message
            }
        }
        return localizedDescription
    }
}

extension Movement: @retroactive Identifiable {}

// MARK: - Amount formatting

enum SatFormat {
    private static let grouping: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = ","
        f.groupingSize = 3
        f.usesGroupingSeparator = true
        return f
    }()

    static func sats(_ value: UInt64) -> String {
        grouping.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    static func sats(_ value: Int64) -> String {
        grouping.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    /// Signed value for history rows: +2,100 / -1,000
    static func signed(_ value: Int64) -> String {
        let body = sats(UInt64(value.magnitude))
        return value >= 0 ? "+\(body)" : "-\(body)"
    }

    /// ₿0.00012345
    static func btc(_ value: UInt64) -> String {
        let whole = value / 100_000_000
        let frac = value % 100_000_000
        let fracString = String(format: "%08llu", frac)
        return "₿\(whole).\(fracString)"
    }

    static func amount(_ value: UInt64, unit: AmountUnit) -> String {
        switch unit {
        case .sats: return "\(sats(value)) sats"
        case .btc: return btc(value)
        }
    }
}

enum AmountUnit: String, CaseIterable, Identifiable {
    case sats
    case btc

    var id: String { rawValue }
    var label: String { self == .sats ? "sats" : "BTC" }
}

// MARK: - Dates

enum BarkDate {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f
    }()

    private static let shortFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "MM/dd HH:mm"
        return f
    }()

    /// Bark timestamps are RFC 3339 with up to nanosecond precision, which
    /// ISO8601DateFormatter can't read directly. Trim the fraction first.
    static func parse(_ string: String) -> Date? {
        if let date = withFraction.date(from: string) ?? plain.date(from: string) {
            return date
        }
        guard let dot = string.firstIndex(of: ".") else { return nil }
        var end = string.index(after: dot)
        while end < string.endIndex, string[end].isNumber {
            end = string.index(after: end)
        }
        let fraction = string[string.index(after: dot)..<end].prefix(3)
        let trimmed = String(string[..<dot]) + "." + String(fraction) + String(string[end...])
        return withFraction.date(from: trimmed)
    }

    static func display(_ string: String) -> String {
        guard let date = parse(string) else { return string }
        return displayFormatter.string(from: date)
    }

    static func short(_ string: String) -> String {
        guard let date = parse(string) else { return string }
        return shortFormatter.string(from: date)
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "H:mm"
        return f
    }()

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "M/d"
        return f
    }()

    /// きょう 9:30 / きのう 21:04 / 11/12
    static func friendly(_ string: String) -> String {
        guard let date = parse(string) else { return string }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "きょう " + timeFormatter.string(from: date) }
        if calendar.isDateInYesterday(date) { return "きのう " + timeFormatter.string(from: date) }
        return dayFormatter.string(from: date)
    }
}

// MARK: - Movements (history entries)

extension Movement {
    enum Kind {
        case arkSend, arkReceive, lightningSend, lightningReceive
        case board, offboard, onchainSend, exit, refresh, other
    }

    var kind: Kind {
        switch (subsystemName, subsystemKind) {
        case ("bark.arkoor", "send"): return .arkSend
        case ("bark.arkoor", "receive"): return .arkReceive
        case ("bark.lightning_send", _): return .lightningSend
        case ("bark.lightning_receive", _): return .lightningReceive
        case ("bark.board", _): return .board
        case ("bark.offboard", "send_onchain"): return .onchainSend
        case ("bark.offboard", _): return .offboard
        case ("bark.exit", _): return .exit
        case ("bark.round", _): return .refresh
        default: return .other
        }
    }

    /// Terminal style file name used in history.log
    var logName: String {
        switch kind {
        case .arkSend: return "ark.send"
        case .arkReceive: return "ark.recv"
        case .lightningSend: return "ln.send"
        case .lightningReceive: return "ln.recv"
        case .board: return "board.sys"
        case .offboard: return "offboard.sys"
        case .onchainSend: return "chain.send"
        case .exit: return "exit.sys"
        case .refresh: return "refresh.sys"
        case .other: return "\(subsystemName.replacingOccurrences(of: "bark.", with: "")).\(subsystemKind)"
        }
    }

    var kindLabel: String {
        switch kind {
        case .arkSend: return "Ark 送金"
        case .arkReceive: return "Ark 受取"
        case .lightningSend: return "Lightning 送金"
        case .lightningReceive: return "Lightning 受取"
        case .board: return "Board（入金）"
        case .offboard: return "Offboard（出金）"
        case .onchainSend: return "On-chain 送金"
        case .exit: return "Emergency exit"
        case .refresh: return "VTXO refresh"
        case .other: return subsystemKind
        }
    }

    var isLightning: Bool { kind == .lightningSend || kind == .lightningReceive }

    /// [ OK ] / [ .. ] / [ !! ] / [ -- ]
    var statusTag: String {
        switch status {
        case "successful": return "OK"
        case "pending": return ".."
        case "failed": return "!!"
        case "canceled": return "--"
        default: return "??"
        }
    }

    var isPending: Bool { status == "pending" }
    var isSuccessful: Bool { status == "successful" }
    var isFailed: Bool { status == "failed" || status == "canceled" }

    /// Destinations are serialized as `{"type":"ark","value":"tark1..."}`.
    var sentTo: [String] { sentToAddresses.map(Self.destinationValue) }
    var receivedOn: [String] { receivedOnAddresses.map(Self.destinationValue) }

    private static func destinationValue(_ raw: String) -> String {
        guard let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let value = object["value"] as? String
        else { return raw }
        if let type = object["type"] as? String {
            return "\(type): \(value)"
        }
        return value
    }
}

// MARK: - Movement labels

extension Movement {
    /// The しくみ diagram that shows how this movement worked.
    var scene: ArkScene? {
        switch kind {
        case .arkSend, .arkReceive: return .arkoor
        case .lightningSend, .lightningReceive: return .lightning
        case .board: return .board
        case .offboard, .onchainSend: return .offboard
        case .refresh: return .refresh
        case .exit: return .exit
        case .other: return nil
        }
    }
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

// MARK: - Payment methods

extension PaymentMethod {
    var value: String {
        switch self {
        case .ark(let v), .bitcoin(let v), .outputScript(let v), .invoice(let v),
             .offer(let v), .lightningAddress(let v), .lnurl(let v), .custom(let v):
            return v
        }
    }

    var typeLabel: String {
        switch self {
        case .ark: return "ARK ADDRESS"
        case .bitcoin: return "ON-CHAIN ADDRESS"
        case .outputScript: return "OUTPUT SCRIPT"
        case .invoice: return "⚡ LIGHTNING INVOICE"
        case .offer: return "⚡ BOLT12 OFFER"
        case .lightningAddress: return "⚡ LIGHTNING ADDRESS"
        case .lnurl: return "⚡ LNURL-PAY"
        case .custom: return "UNKNOWN"
        }
    }

    var rail: String {
        switch self {
        case .ark: return "ark.drv"
        case .bitcoin, .outputScript: return "chain.drv"
        case .invoice, .offer, .lightningAddress, .lnurl: return "lightning.drv"
        case .custom: return "unknown.drv"
        }
    }

    var acceptsComment: Bool {
        switch self {
        case .lightningAddress, .lnurl: return true
        default: return false
        }
    }
}

extension PaymentMethodParsingError {
    var message: String {
        switch self {
        case .networkMismatch:
            return "別のネットワーク用の宛先です / wrong network"
        case .invalidArkAddress(let reason):
            return "この Ark アドレスには送れません: \(reason)"
        case .amountMismatch(let expected, let got):
            return "金額が一致しません (invoice \(SatFormat.sats(expected)) / uri \(SatFormat.sats(got)))"
        case .invalidAmount:
            return "金額が不正です / invalid amount"
        case .unsupported:
            return "この宛先にはまだ対応していません / unsupported"
        }
    }
}

extension String {
    func truncatedMiddle(_ keep: Int = 10) -> String {
        guard count > keep * 2 + 3 else { return self }
        return "\(prefix(keep))…\(suffix(keep))"
    }
}
