// This app replaced a SwiftUI app under the same bundle ID. iOS keeps that app's
// scene session, and the session remembers SwiftUI's scene delegate, so after an
// update our SceneDelegate is never asked to create the window: the app shows
// nothing and crashes when SwiftUI tries to save state for a scene it does not own.
// Fresh installs are unaffected. This plugin makes the app delegate take such a
// scene over when it connects. Reproduced and verified in the simulator by
// installing the SwiftUI build first and this app over it.
const { withAppDelegate } = require("expo/config-plugins");

const MARKER = "BCW_SCENE_ADOPTION";

const PROPERTY = `  var reactNativeFactory: RCTReactNativeFactory?
  private var adoptedSceneDelegate: SceneDelegate?
`;

const HOOK = `    // ${MARKER}: adopt a scene session left behind by the SwiftUI app this one replaced.
    NotificationCenter.default.addObserver(forName: UIScene.willConnectNotification, object: nil, queue: .main) { [weak self] note in
      guard let self, let scene = note.object as? UIWindowScene, !(scene.delegate is SceneDelegate),
        let factory = self.reactNativeFactory else { return }
      let adopted = SceneDelegate()
      self.adoptedSceneDelegate = adopted
      scene.delegate = adopted
      let window = UIWindow(windowScene: scene)
      adopted.window = window
      self.window = window
      factory.startReactNative(withModuleName: self.reactNativeFactoryModuleName, in: window, initialProperties: nil, launchOptions: nil)
    }

`;

module.exports = function withAdoptLegacyScene(config) {
  return withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;
    const property = "  var reactNativeFactory: RCTReactNativeFactory?\n";
    const launchReturn = "    return super.application(application, didFinishLaunchingWithOptions: launchOptions)";
    // Fail the build rather than ship an app that cannot start after an update.
    if (!src.includes(property) || !src.includes(launchReturn)) {
      throw new Error("withAdoptLegacyScene: the AppDelegate template changed; update plugins/withAdoptLegacyScene.js");
    }
    src = src.replace(property, PROPERTY).replace(launchReturn, HOOK + launchReturn);
    cfg.modResults.contents = src;
    return cfg;
  });
};
