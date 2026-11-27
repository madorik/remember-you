import UIKit
import Capacitor

/// 다른 앱의 공유 시트에서 "기억해유"로 보낸 글을 받아 두는 받은 편지함(공유 확장 ShareExtension이 담아 둔다).
/// 웹(NativeBridge)이 window.Capacitor.Plugins.ShareInbox 로 쓴다. 안드로이드의 ShareInboxPlugin.java와 이름·모양을 맞춘다.
/// - take() → { text: string | null }: 앱 그룹에 담긴 글(앞뒤 공백 뺀 것, 최대 20,000자)을 돌려주고 비운다. 하루가 지난 글은 버린다
/// - "shared" 이벤트: 앱이 kr.readme.app://share 로 열렸을 때, 그리고 앱이 다시 활성화될 때 받아 둔 글이 있으면
/// 글 내용은 주소나 로그에 싣지 않는다.
@objc(ShareInboxPlugin)
public class ShareInboxPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShareInboxPlugin"
    public let jsName = "ShareInbox"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "take", returnType: CAPPluginReturnPromise),
    ]

    // 공유 확장(ShareExtension/ShareViewController.swift)과 같은 값
    private static let appGroup = "group.kr.readme.app"
    private static let pendingKey = "pendingShare"
    private static let pendingAtKey = "pendingShareAt"
    private static let maxChars = 20_000
    /// 이 시간이 지난 글은 오래된 공유로 보고 버린다
    private static let maxAge: TimeInterval = 24 * 60 * 60

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(handleOpenURL(_:)), name: .capacitorOpenURL, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleActive), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func take(_ call: CAPPluginCall) {
        call.resolve(["text": Self.takePending() ?? NSNull()])
    }

    /// kr.readme.app://share 로 열렸다(공유 확장이 앱을 열 때)
    @objc private func handleOpenURL(_ note: Notification) {
        guard let info = note.object as? [String: Any], let url = info["url"] as? URL else { return }
        guard url.scheme == "kr.readme.app", url.host == "share" else { return }
        notifyListeners("shared", data: [:])
    }

    /// 앱이 활성화될 때 받아 둔 글이 있으면 알린다(앱을 직접 열어도 이어진다)
    @objc private func handleActive() {
        if Self.hasPending() { notifyListeners("shared", data: [:]) }
    }

    private static func hasPending() -> Bool {
        guard let text = UserDefaults(suiteName: appGroup)?.string(forKey: pendingKey) else { return false }
        return !text.isEmpty
    }

    /// 받아 둔 글을 꺼내고 비운다. 없거나 오래됐거나 비었으면 nil
    private static func takePending() -> String? {
        guard let defaults = UserDefaults(suiteName: appGroup) else { return nil }
        let raw = defaults.string(forKey: pendingKey)
        let at = defaults.double(forKey: pendingAtKey)
        defaults.removeObject(forKey: pendingKey)
        defaults.removeObject(forKey: pendingAtKey)
        guard let raw = raw else { return nil }
        if at > 0, Date().timeIntervalSince1970 - at > maxAge { return nil }
        return clean(raw)
    }

    /// 앞뒤 공백을 떼고 20,000자(UTF-16 단위)로 자른다. 비면 nil
    private static func clean(_ raw: String) -> String? {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty { return nil }
        if text.utf16.count > maxChars {
            var out = String.UnicodeScalarView()
            var units = 0
            for scalar in text.unicodeScalars {
                let n = scalar.value > 0xFFFF ? 2 : 1
                if units + n > maxChars { break }
                out.append(scalar)
                units += n
            }
            text = String(out).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return text.isEmpty ? nil : text
    }
}
