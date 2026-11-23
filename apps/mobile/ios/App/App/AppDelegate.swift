import UIKit
import Capacitor
import Speech
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // 푸시 알림: 애플이 준 기기 토큰(APNs)·실패를 Capacitor 푸시 플러그인에 넘긴다(플러그인 안내대로). 서버는 이 토큰으로 애플에 직접 보낸다(APNs 키가 서버에 있을 때).
    // 앱에 Push Notifications capability(aps-environment)가 있는 빌드에서만 불린다
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - 말로 적기: 기기 음성 인식

/// 앱 화면(웹)이 쓰는 SpeechRecognition 플러그인의 iOS 쪽. 안드로이드의 @capacitor-community/speech-recognition과
/// 이름·모양을 맞춘다(웹은 window.Capacitor.Plugins.SpeechRecognition 하나로 쓴다). 그 플러그인은 SPM을 지원하지 않아 여기서 직접 만든다.
/// - requestPermissions → { speechRecognition: "granted" | "denied" | "prompt" } (음성 인식 + 마이크)
/// - start({ language }) → 듣기 시작, 들리는 대로 "partialResults" { matches: [글] }, 끝나면 "listeningState" { status: "stopped" }
/// - stop() → 마이크를 끄고 남은 소리까지 마저 알아듣고 끝낸다
@objc(SpeechRecognitionPlugin)
public class SpeechRecognitionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechRecognitionPlugin"
    public let jsName = "SpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": SFSpeechRecognizer()?.isAvailable ?? false])
    }

    private func permissionState() -> String {
        let speech = SFSpeechRecognizer.authorizationStatus()
        let mic = AVAudioSession.sharedInstance().recordPermission
        if speech == .authorized && mic == .granted { return "granted" }
        if speech == .denied || speech == .restricted || mic == .denied { return "denied" }
        return "prompt"
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["speechRecognition": permissionState()])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { _ in
            AVAudioSession.sharedInstance().requestRecordPermission { _ in
                DispatchQueue.main.async { call.resolve(["speechRecognition": self.permissionState()]) }
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        let language = call.getString("language") ?? "ko-KR"
        DispatchQueue.main.async {
            self.finish(notify: false)
            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)), recognizer.isAvailable else {
                call.reject("speech recognition is not available")
                return
            }
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.record, mode: .measurement, options: .duckOthers)
                try session.setActive(true, options: .notifyOthersOnDeactivation)
                let request = SFSpeechAudioBufferRecognitionRequest()
                request.shouldReportPartialResults = true
                self.request = request
                let input = self.engine.inputNode
                input.removeTap(onBus: 0)
                input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in
                    request.append(buffer)
                }
                self.engine.prepare()
                try self.engine.start()
                self.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                    guard let self = self else { return }
                    if let result = result {
                        self.notifyListeners("partialResults", data: ["matches": [result.bestTranscription.formattedString]])
                        if result.isFinal { DispatchQueue.main.async { self.finish(notify: true) } }
                    } else if error != nil {
                        DispatchQueue.main.async { self.finish(notify: true) }
                    }
                }
                self.notifyListeners("listeningState", data: ["status": "started"])
                call.resolve()
            } catch {
                self.finish(notify: false)
                call.reject("could not start listening: \(error.localizedDescription)")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.engine.isRunning {
                self.engine.stop()
                self.engine.inputNode.removeTap(onBus: 0)
            }
            self.request?.endAudio()
            call.resolve()
        }
    }

    private func finish(notify: Bool) {
        let wasListening = task != nil || engine.isRunning
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if notify && wasListening { notifyListeners("listeningState", data: ["status": "stopped"]) }
    }
}

/// 앱 첫 화면: Capacitor 화면에 위의 플러그인을 붙인다(Main.storyboard가 이 클래스를 쓴다)
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpeechRecognitionPlugin())
    }
}
