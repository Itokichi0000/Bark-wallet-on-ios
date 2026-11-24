import XCTest

/// Drives the installed app from a plain-text script: one command per line.
final class DriverUITests: XCTestCase {
  func testRun() throws {
    continueAfterFailure = true
    let env = ProcessInfo.processInfo.environment
    let scriptPath = env["SCRIPT"] ?? "/tmp/driver-script.txt"
    let out = env["OUT"] ?? "/tmp/driver-out"
    try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
    let app = XCUIApplication(bundleIdentifier: "com.itokichi0000.satsos")
    var log = ""
    func note(_ s: String) { log += s + "\n"; try? log.write(toFile: out + "/log.txt", atomically: true, encoding: .utf8) }
    func find(_ label: String) -> XCUIElement? {
      let exact = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@ OR identifier == %@", label, label))
      if exact.count > 0 { return exact.allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable }) ?? exact.firstMatch }
      let part = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", label))
      // Prefer the smallest matching element (the control, not its container).
      let all = part.allElementsBoundByIndex.filter { $0.exists }
      return all.min(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height })
    }
    let lines = try String(contentsOfFile: scriptPath, encoding: .utf8).split(separator: "\n").map(String.init)
    for raw in lines {
      let line = raw.trimmingCharacters(in: .whitespaces)
      if line.isEmpty || line.hasPrefix("#") { continue }
      let parts = line.split(separator: " ", maxSplits: 1).map(String.init)
      let cmd = parts[0], arg = parts.count > 1 ? parts[1] : ""
      switch cmd {
      case "launch":
        app.terminate()
        app.launchArguments = arg.isEmpty ? [] : ["-reviewRoute", arg]
        app.launch()
      case "wait": Thread.sleep(forTimeInterval: Double(arg) ?? 1)
      case "tap":
        if let el = find(arg), el.waitForExistence(timeout: 4) { el.tap(); note("tap ok: \(arg)") } else { note("tap MISSING: \(arg)") }
      case "tapxy":
        let p = arg.split(separator: " ").compactMap { Double($0) }
        app.coordinate(withNormalizedOffset: CGVector(dx: p[0], dy: p[1])).tap()
      case "type":
        if app.keyboards.count == 0 { note("type NOKEYBOARD: \(arg)") } else { app.typeText(arg.replacingOccurrences(of: "\\n", with: "\n")) }
      case "swipe":
        if arg == "up" { app.swipeUp() } else if arg == "down" { app.swipeDown() } else if arg == "left" { app.swipeLeft() } else { app.swipeRight() }
      case "shot":
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: out + "/" + arg + ".png"))
      case "dump":
        var s = ""
        for el in app.descendants(matching: .any).allElementsBoundByIndex where el.exists && !el.label.isEmpty {
          let f = el.frame
          s += "\(el.elementType.rawValue)\t\(Int(f.minX)),\(Int(f.minY)) \(Int(f.width))x\(Int(f.height))\t\(el.isHittable ? "H" : "-")\t\(el.label.prefix(70))\n"
        }
        try? s.write(toFile: out + "/" + (arg.isEmpty ? "dump" : arg) + ".txt", atomically: true, encoding: .utf8)
      default: note("unknown: \(line)")
      }
    }
    note("done")
  }
}
