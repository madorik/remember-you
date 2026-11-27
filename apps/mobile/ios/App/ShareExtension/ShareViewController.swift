import UIKit
import UniformTypeIdentifiers
import ObjectiveC

/// 다른 앱(메모·Keep·Safari 등)의 공유 시트에서 "기억해유"를 고르면 뜨는 공유 확장.
/// 넘어온 글을 앱 그룹(group.kr.readme.app)의 "pendingShare"에 담고, 기억해유 앱을 kr.readme.app://share 로 연다.
/// 앱의 ShareInboxPlugin(웹이 take()로 가져간다)이 이어받아 메모 쓰는 화면에 채운다.
/// 글 내용은 주소나 로그에 싣지 않는다(앱 그룹 저장소에만 둔다).
@objc(ShareViewController)
class ShareViewController: UIViewController {
    private static let appGroup = "group.kr.readme.app"
    private static let pendingKey = "pendingShare"
    private static let pendingAtKey = "pendingShareAt"
    private static let hostURL = "kr.readme.app://share"
    /// 메모 한 건의 글자 수 상한(UTF-16 단위, 웹의 글자 수와 같은 기준)
    private static let maxChars = 20_000
    /// 파일로 넘어온 글은 이만큼만 읽는다
    private static let maxFileBytes = 64 * 1024

    private var finished = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        collectText { [weak self] text in
            guard let self = self else { return }
            guard let text = text else {
                self.finish()
                return
            }
            let defaults = UserDefaults(suiteName: Self.appGroup)
            defaults?.set(text, forKey: Self.pendingKey)
            defaults?.set(Date().timeIntervalSince1970, forKey: Self.pendingAtKey)
            self.openHostApp { opened in
                if opened {
                    self.finish()
                } else {
                    // 앱을 못 열었어도 글은 담겨 있다: 앱을 직접 열면 메모에 채워진다
                    self.showSavedNotice()
                }
            }
        }
    }

    // MARK: - 글 모으기

    /// 넘어온 항목에서 글을 모은다. 순서: 글(public.plain-text → public.text) → 항목의 본문(attributedContentText, 웹 주소가 같이 오면 뒤에 붙임) → 웹 주소.
    /// 읽을 글이 없으면 nil
    private func collectText(_ completion: @escaping (String?) -> Void) {
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        var providers: [NSItemProvider] = []
        var attributed: [String] = []
        for item in items {
            providers.append(contentsOf: item.attachments ?? [])
            if let s = item.attributedContentText?.string.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
                attributed.append(s)
            }
        }
        // 제공자마다 자리를 정해 두고 채운다(읽는 순서가 달라도 넘어온 순서를 지킨다)
        var texts = [String?](repeating: nil, count: providers.count)
        var urls = [String?](repeating: nil, count: providers.count)
        let lock = NSLock()
        let group = DispatchGroup()
        for (i, provider) in providers.enumerated() {
            let kind: String?
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                kind = UTType.plainText.identifier
            } else if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
                kind = UTType.text.identifier
            } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                kind = UTType.url.identifier
            } else {
                kind = nil
            }
            guard let typeId = kind else { continue }
            group.enter()
            provider.loadItem(forTypeIdentifier: typeId, options: nil) { item, _ in
                defer { group.leave() }
                let isURLKind = typeId == UTType.url.identifier
                let value = Self.string(from: item, allowRemoteURL: isURLKind)
                guard let value = value, !value.isEmpty else { return }
                lock.lock()
                if isURLKind { urls[i] = value } else { texts[i] = value }
                lock.unlock()
            }
        }
        group.notify(queue: .main) {
            let textParts = texts.compactMap { $0 }
            let urlParts = urls.compactMap { $0 }
            var parts: [String]
            if !textParts.isEmpty {
                parts = textParts
            } else if !attributed.isEmpty {
                parts = attributed
                // 제목 같은 본문과 웹 주소가 같이 오면(Safari 등) 주소를 뒤에 붙인다
                for u in urlParts where !parts.contains(where: { $0.contains(u) }) { parts.append(u) }
            } else {
                parts = urlParts
            }
            completion(Self.clean(parts.joined(separator: "\n\n")))
        }
    }

    /// loadItem이 돌려준 값(글·글 데이터·파일 주소·웹 주소)을 글로 바꾼다
    private static func string(from item: NSSecureCoding?, allowRemoteURL: Bool) -> String? {
        switch item {
        case let s as String:
            return s
        case let a as NSAttributedString:
            return a.string
        case let url as URL:
            if url.isFileURL { return readTextFile(url) }
            return allowRemoteURL ? url.absoluteString : nil
        case let data as Data:
            return decode(data)
        default:
            return nil
        }
    }

    /// 글 파일을 최대 64KB까지 읽는다
    private static func readTextFile(_ url: URL) -> String? {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? handle.close() }
        guard let data = try? handle.read(upToCount: maxFileBytes) else { return nil }
        return decode(data)
    }

    /// UTF-8(BOM이 있으면 UTF-16도) 글로 읽는다. 글이 아닌 것(0 바이트가 섞이거나 RTF)은 버린다
    private static func decode(_ data: Data) -> String? {
        var body = data
        var encoding = String.Encoding.utf8
        if body.starts(with: [0xEF, 0xBB, 0xBF]) {
            body = body.dropFirst(3)
        } else if body.starts(with: [0xFF, 0xFE]) {
            body = body.dropFirst(2)
            encoding = .utf16LittleEndian
        } else if body.starts(with: [0xFE, 0xFF]) {
            body = body.dropFirst(2)
            encoding = .utf16BigEndian
        } else if body.contains(0) {
            return nil
        }
        guard var s = String(data: body, encoding: encoding) else {
            // 64KB에서 글자 한가운데가 잘렸을 수 있다: 끝을 조금씩 덜어 다시 읽는다
            var cut = body
            for _ in 0..<3 {
                cut = cut.dropLast()
                if let s = String(data: cut, encoding: encoding) { return s.hasPrefix("{\\rtf") ? nil : s }
            }
            return nil
        }
        if s.hasPrefix("{\\rtf") { return nil }
        s = s.replacingOccurrences(of: "\u{FEFF}", with: "")
        return s
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

    // MARK: - 앱 열기

    /// 기억해유 앱을 연다. 공유 확장의 extensionContext.open은 막혀 있어서, 응답자 연결을 따라 올라가 UIApplication을 찾아
    /// openURL:options:completionHandler:를 직접 부른다(옛 openURL:는 iOS 18부터 동작하지 않는다).
    /// 열리지 않으면 completion(false)
    private func openHostApp(_ completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: Self.hostURL) else {
            completion(false)
            return
        }
        var done = false
        let once: (Bool) -> Void = { ok in
            DispatchQueue.main.async {
                if done { return }
                done = true
                completion(ok)
            }
        }
        // 앱이 응답하지 않을 때 공유 시트가 멈추지 않게
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { once(false) }

        var responder: UIResponder? = self
        while let current = responder {
            if current is UIApplication {
                let selector = NSSelectorFromString("openURL:options:completionHandler:")
                guard let method = class_getInstanceMethod(UIApplication.self, selector) else { break }
                typealias OpenFunction = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, (@convention(block) (Bool) -> Void)?) -> Void
                let open = unsafeBitCast(method_getImplementation(method), to: OpenFunction.self)
                open(current, selector, url as NSURL, [:] as NSDictionary, { ok in once(ok) })
                return
            }
            responder = current.next
        }
        once(false)
    }

    // MARK: - 마무리

    private func finish() {
        if finished { return }
        finished = true
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func showSavedNotice() {
        let korean = Locale.preferredLanguages.first?.hasPrefix("ko") ?? false
        let alert = UIAlertController(
            title: korean ? "기억해유에 담았어요" : "Saved to Remember You",
            message: korean ? "앱을 열면 메모에 채워져요." : "Open the app and it will be filled into your memo.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: korean ? "확인" : "OK", style: .default) { [weak self] _ in self?.finish() })
        present(alert, animated: true)
    }
}
