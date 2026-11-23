// 이 브라우저에서 알림 받기(웹 푸시)의 브라우저 쪽 일: 설정의 스위치와 물어보기 링크를 만든 뒤 '답장 오면 알려 드릴까요?'가 같은 길을 쓴다.
// 서버에는 /api/push로 구독을 저장·삭제한다(로그인한 사람 것만).

export type WebPushState = "unsupported" | "install" | "off" | "on" | "blocked";

/** 브라우저 공개 키(base64url)를 구독에 넘길 바이트로 */
export function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: JSON.stringify(sub.toJSON()), platform: "web" }) }).catch(() => null);
  return !!res?.ok;
}

/**
 * 지금 이 브라우저의 알림 상태. 이미 구독돼 있으면 서버에도 다시 저장해 둔다(알림 받기를 껐다 켠 사이에 지워졌을 수 있다).
 * 아이폰·아이패드의 사파리는 홈 화면에 추가한 웹앱에서만 웹 푸시를 준다(iOS 16.4부터): 설치 전에는 PushManager가 없다
 */
export async function readWebPushState(): Promise<WebPushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios ? "install" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub) void saveSubscription(sub);
  return sub ? "on" : "off";
}

/** 켜기: 알림 권한을 묻고 구독을 서버에 저장한다. 결과 상태를 돌려주고, 저장에 실패하면 던진다 */
export async function enableWebPush(publicKey: string): Promise<WebPushState> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "blocked" : "off";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  if (!(await saveSubscription(sub))) {
    await sub.unsubscribe().catch(() => {});
    throw new Error("save");
  }
  return "on";
}

/** 끄기: 서버의 구독을 지우고 브라우저 구독도 푼다 */
export async function disableWebPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: JSON.stringify(sub.toJSON()), platform: "web" }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
