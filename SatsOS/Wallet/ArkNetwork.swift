import Bark
import Foundation

/// The Ark networks this app can talk to. Endpoints come from
/// https://second.tech/docs/connection-details
enum ArkNetwork: String, CaseIterable, Identifiable {
    case signet
    case mainnet

    var id: String { rawValue }

    var barkNetwork: Network {
        switch self {
        case .signet: return .signet
        case .mainnet: return .bitcoin
        }
    }

    var serverAddress: String {
        switch self {
        case .signet: return "https://ark.signet.2nd.dev"
        case .mainnet: return "https://ark.second.tech"
        }
    }

    var esploraAddress: String {
        switch self {
        case .signet: return "https://esplora.signet.2nd.dev"
        case .mainnet: return "https://mempool.second.tech/api"
        }
    }

    /// Short label for the menu bar.
    var label: String {
        switch self {
        case .signet: return "SIGNET"
        case .mainnet: return "MAINNET"
        }
    }

    var isRealMoney: Bool { self == .mainnet }

    /// Free test coins for signet.
    var faucetURL: URL? {
        switch self {
        case .signet: return URL(string: "https://signet.2nd.dev/")
        case .mainnet: return nil
        }
    }

    var serverHost: String {
        URL(string: serverAddress)?.host ?? serverAddress
    }

    var barkConfig: Config {
        // The Config initializer has no defaults: every argument must be passed,
        // nil keeps Bark's default for that setting.
        Config(
            serverAddress: serverAddress,
            serverAccessToken: nil,
            esploraAddress: esploraAddress,
            bitcoindAddress: nil,
            bitcoindCookiefile: nil,
            bitcoindUser: nil,
            bitcoindPass: nil,
            vtxoRefreshExpiryThreshold: nil,
            vtxoExitMargin: nil,
            htlcRecvClaimDelta: nil,
            fallbackFeeRate: nil,
            roundTxRequiredConfirmations: nil,
            daemonSyncIntervalSecs: nil,
            offboardRequiredConfirmations: nil,
            daemonManualSync: nil,
            lightningReceiveClaimRetries: nil,
            // Ark server rule: name part must be lowercase [a-z0-9-_]
            userAgent: "sats-os/\(AppInfo.version)",
            vtxoKeyGapLimit: nil
        )
    }

    /// Wallet data lives in Application Support, one folder per network.
    var datadir: URL {
        let base = (try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("bark", isDirectory: true)
            .appendingPathComponent(rawValue, isDirectory: true)
    }
}

enum AppInfo {
    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    static var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
    }

    static let barkSDKVersion = "0.27.0 (bark 0.8.1)"
}
