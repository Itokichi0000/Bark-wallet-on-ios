import AVFoundation
import UIKit

/// Tiny square-wave synthesizer for 8-bit style sound effects, the native
/// cousin of the website's WebAudio `sound.ts`. Nothing is loaded from disk:
/// every effect is rendered into a PCM buffer on first use.
///
/// Uses the `.ambient` session, so the ring/silent switch mutes it and it
/// mixes with music instead of stopping it.
final class Chiptune {
    enum SFX: CaseIterable {
        case tick, click, select, boot, send, coin, error, power
    }

    static let shared = Chiptune()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format: AVAudioFormat
    private var cache: [SFX: AVAudioPCMBuffer] = [:]
    private var configured = false
    private let sampleRate: Double = 44_100

    private init() {
        format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
    }

    private var enabled: Bool {
        UserDefaults.standard.bool(forKey: AppSettingsKeys.sound)
    }

    func play(_ sfx: SFX) {
        guard enabled else { return }
        DispatchQueue.main.async { [self] in
            setUpIfNeeded()
            guard configured else { return }
            if !engine.isRunning {
                do { try engine.start() } catch { return }
            }
            let buffer = cache[sfx] ?? render(sfx)
            cache[sfx] = buffer
            player.scheduleBuffer(buffer, at: nil, options: .interrupts, completionHandler: nil)
            if !player.isPlaying { player.play() }
        }
    }

    private func setUpIfNeeded() {
        guard !configured else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            return
        }
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = 0.9
        configured = true
    }

    /// (frequency Hz, duration s); 0 Hz is a rest.
    private func notes(for sfx: SFX) -> [(Double, Double)] {
        switch sfx {
        case .tick: return [(1760, 0.012)]
        case .click: return [(880, 0.03)]
        case .select: return [(660, 0.035), (990, 0.05)]
        case .boot: return [(523.25, 0.07), (659.25, 0.07), (783.99, 0.07), (1046.5, 0.16)]
        case .send: return [(392, 0.05), (523.25, 0.05), (783.99, 0.05), (1046.5, 0.05), (1567.98, 0.14)]
        case .coin: return [(783.99, 0.06), (1174.66, 0.06), (1567.98, 0.18)]
        case .error: return [(220, 0.09), (0, 0.03), (164.81, 0.18)]
        case .power: return [(130.81, 0.05), (261.63, 0.05), (523.25, 0.08)]
        }
    }

    private func render(_ sfx: SFX) -> AVAudioPCMBuffer {
        let sequence = notes(for: sfx)
        let totalSeconds = sequence.reduce(0) { $0 + $1.1 } + 0.02
        let frameCount = AVAudioFrameCount(totalSeconds * sampleRate)
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount)!
        buffer.frameLength = frameCount
        let samples = buffer.floatChannelData![0]
        var index = 0
        let volume: Float = sfx == .tick ? 0.05 : 0.12
        for (frequency, duration) in sequence {
            let count = Int(duration * sampleRate)
            for i in 0..<count where index < Int(frameCount) {
                if frequency <= 0 {
                    samples[index] = 0
                } else {
                    let t = Double(i) / sampleRate
                    let phase = (t * frequency).truncatingRemainder(dividingBy: 1)
                    let square: Float = phase < 0.5 ? 1 : -1
                    // quick attack, exponential-ish decay like the web version
                    let progress = Float(i) / Float(max(count, 1))
                    let envelope = min(1, Float(i) / 40) * powf(1 - progress, 1.6)
                    samples[index] = square * volume * envelope
                }
                index += 1
            }
        }
        while index < Int(frameCount) {
            samples[index] = 0
            index += 1
        }
        return buffer
    }
}

enum AppSettingsKeys {
    static let sound = "sound"
    static let haptics = "haptics"
}

@MainActor
enum Haptics {
    private static var enabled: Bool {
        UserDefaults.standard.bool(forKey: AppSettingsKeys.haptics)
    }

    static func tap() {
        guard enabled else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    static func heavy() {
        guard enabled else { return }
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }

    static func success() {
        guard enabled else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    static func error() {
        guard enabled else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }
}
