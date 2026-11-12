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
