import AVFoundation
import SwiftUI

/// QR scanner: the camera behind a soft rounded viewfinder.
struct ScannerScreen: View {
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
                    Text("QRを よみとる")
                        .font(Brush.bold(20))
                        .foregroundStyle(.white)
                    Spacer()
                    Button {
                        Chiptune.shared.play(.click)
                        onCancel()
                    } label: {
                        InkIcon(kind: .close, size: 20, color: .white)
                            .frame(width: 44, height: 44)
                            .background(.white.opacity(0.15), in: Circle())
                    }
                    .accessibilityLabel("とじる")
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)

                Spacer()

                ZStack {
                    RoundedRectangle(cornerRadius: 36, style: .continuous)
                        .stroke(.white, style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [44, 160]))
                        .phaseAnimator([false, true]) { view, breathe in
                            view.scaleEffect(breathe ? 0.97 : 1)
                        } animation: { _ in
                            .easeInOut(duration: 1.1)
                        }
                    if denied {
                        Text("カメラが つかえません。\n設定アプリ ＞ ちょうじゅ から カメラを許可してください。")
                            .font(Brush.text(14))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .padding()
                    }
                }
                .frame(width: 250, height: 250)

                HStack(spacing: 8) {
                    CharacterView(art: .frogSit, height: 30)
                        .environment(\.colorScheme, .dark)
                    Text("QRコードを 枠にあわせてね")
                        .font(Brush.text(15))
                        .foregroundStyle(.white)
                }
                .padding(.top, 22)

                Spacer()

                Button {
                    Chiptune.shared.play(.click)
                    onCancel()
                } label: {
                    Text("やめる")
                        .font(Brush.bold(17))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.white, lineWidth: 1.5))
                }
                .padding(.horizontal, 40)
                .padding(.bottom, 30)
            }
        }
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
