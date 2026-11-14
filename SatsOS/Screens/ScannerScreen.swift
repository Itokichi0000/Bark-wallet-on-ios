import AVFoundation
import SwiftUI

/// scan.exe — camera QR scanner in a Sats-OS frame.
struct ScannerScreen: View {
    @Environment(\.sats) private var t
    var onScan: (String) -> Void
    var onCancel: () -> Void

    @State private var denied = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            CameraScanner(onScan: { code in
                Chiptune.shared.play(.select)
                Haptics.success()
                onScan(code)
            }, onDenied: {
                denied = true
            })
            .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Text("~/desktop / send.exe / ")
                        .foregroundStyle(t.dim)
                    + Text("scan.exe")
                        .foregroundStyle(t.encre)
                    Spacer()
                    Button {
                        Chiptune.shared.play(.click)
                        onCancel()
                    } label: {
                        Text("ESC ✕")
                            .foregroundStyle(t.encre)
                            .padding(8)
                    }
                }
                .font(PixelFont.body(13))
                .padding(.horizontal, 16)
                .background(t.papier.opacity(0.9))

                Spacer()

                // Viewfinder with pixel corners
                ZStack {
                    ViewfinderCorners()
                        .stroke(t.encre, lineWidth: 6)
                        .keyframeAnimator(initialValue: CGFloat(1), repeating: true) { view, scale in
                            view.scaleEffect(scale)
                        } keyframes: { _ in
                            KeyframeTrack {
                                LinearKeyframe(CGFloat(1), duration: 0.6)
                                LinearKeyframe(CGFloat(0.97), duration: 0.001)
                                LinearKeyframe(CGFloat(0.97), duration: 0.6)
                                LinearKeyframe(CGFloat(1), duration: 0.001)
                            }
                        }
                    if !denied {
                        ScanBeam()
                            .padding(14)
                    }
                    if denied {
                        Text("カメラへのアクセスが許可されていません。\n設定アプリ > Sats-OS からカメラを許可してください。")
                            .font(PixelFont.body(13))
                            .foregroundStyle(t.creme)
                            .multilineTextAlignment(.center)
                            .padding()
                    }
                }
                .frame(width: 250, height: 250)

                Text("QR コードを枠に合わせてください")
                    .font(PixelFont.body(14))
                    .foregroundStyle(t.creme)
                    .padding(.top, 20)

                Spacer()

                PixelButton("Cancel", kind: .secondary) { onCancel() }
                    .padding(.horizontal, 40)
                    .padding(.bottom, 30)
            }
        }
    }
}

/// Stepped scan line sweeping the viewfinder, with a short trail.
private struct ScanBeam: View {
    @Environment(\.sats) private var t
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 20.0, paused: reduceMotion)) { context in
            Canvas { gc, size in
                let time = context.date.timeIntervalSinceReferenceDate
                // ping-pong 0→1→0 over 2.4s, snapped to 4pt rows
                let phase = (time / 1.2).truncatingRemainder(dividingBy: 2)
                let unit = phase < 1 ? phase : 2 - phase
                let y = ((unit * (size.height - 4)) / 4).rounded() * 4
                for trail in 0..<4 {
                    let offset = CGFloat(trail) * 6 * (phase < 1 ? -1 : 1)
                    let rect = CGRect(x: 0, y: y + offset, width: size.width, height: trail == 0 ? 3 : 2)
                    gc.fill(Path(rect), with: .color(t.encre.opacity(trail == 0 ? 0.9 : 0.35 / Double(trail))))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct ViewfinderCorners: Shape {
    func path(in rect: CGRect) -> Path {
        let length: CGFloat = 36
        var path = Path()
        // top-left
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + length))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX + length, y: rect.minY))
        // top-right
        path.move(to: CGPoint(x: rect.maxX - length, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + length))
        // bottom-right
        path.move(to: CGPoint(x: rect.maxX, y: rect.maxY - length))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX - length, y: rect.maxY))
        // bottom-left
        path.move(to: CGPoint(x: rect.minX + length, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - length))
        return path
    }
}

private struct CameraScanner: UIViewControllerRepresentable {
    var onScan: (String) -> Void
    var onDenied: () -> Void

    func makeUIViewController(context: Context) -> ScannerController {
        let controller = ScannerController()
        controller.onScan = onScan
        controller.onDenied = onDenied
        return controller
    }

    func updateUIViewController(_ controller: ScannerController, context: Context) {}
}

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onScan: ((String) -> Void)?
    var onDenied: (() -> Void)?

    private let session = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?
    private let queue = DispatchQueue(label: "SatsOS.scanner")
    private var delivered = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configure()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted { self?.configure() } else { self?.onDenied?() }
                }
            }
        default:
            onDenied?()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        let session = self.session
        queue.async { session.stopRunning() }
    }

    private func configure() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input)
        else {
            onDenied?()
            return
        }
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        preview = layer

        let session = self.session
        queue.async { session.startRunning() }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        guard !delivered,
              let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = object.stringValue
        else { return }
        delivered = true
        let session = self.session
        queue.async { session.stopRunning() }
        onScan?(value)
    }
}
