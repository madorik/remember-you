"use client";

import type { Locale } from "@readme/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Wordmark } from "./chrome";
import { Icon } from "./marks";

// 앱(Capacitor) 안에서만 하는 일: 푸시 토큰 등록, 기기 로컬 생일 알림, Face ID·지문 앱 잠금, 링크로 앱 열기.
// 웹 브라우저에서는 아무것도 하지 않는다. (낱말 사전을 끌어오지 않게 잠금 화면 문구는 서버가 번역해 prop으로 준다)

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
}

const noop = () => () => {};

/** Firebase 설정을 넣고 빌드한 첫 안드로이드 판(versionCode). 이보다 낮은 앱은 푸시를 등록하지 않는다 */
const PUSH_MIN_ANDROID_BUILD = 8;
/**
 * 푸시 알림 기능(Xcode의 Push Notifications capability → aps-environment)을 넣고 빌드한 첫 iOS 판(빌드 번호, CURRENT_PROJECT_VERSION).
 * 그 전 판(1.0.2의 12까지)은 푸시를 받을 수 없어서 알림 권한을 묻지도 않는다. 푸시 판을 올릴 때 실제 빌드 번호로 맞춘다
 */
const PUSH_MIN_IOS_BUILD = 13;

/** 앱 안인지(서버 렌더링과 어긋나지 않게 처음엔 false) */
export function useIsNative(): boolean {
  return useSyncExternalStore(noop, isNativeApp, () => false);
}

export interface LocalReminder {
  /** 겹치지 않는 숫자 id(같은 알림을 다시 예약할 때 덮어쓴다) */
  id: number;
  title: string;
  body: string;
  /** 알릴 날짜(기기 시간 오전 9시) */
  y: number;
  m: number;
  d: number;
  path: string;
}

export interface LockLabels {
  title: string;
  appName: string;
  unlock: string;
}

const LOCK_AFTER_MS = 60_000;
/** iOS는 예약 알림을 64개까지만 받는다 */
const MAX_LOCAL = 60;

/** 앱 안 주소만(//로 시작하는 바깥 주소는 막는다) */
function appPath(p: unknown): p is string {
  return typeof p === "string" && /^\/(?!\/)/.test(p);
}

// ── 푸시 알림 ─────────────────────────────────────────────────────
// 서버가 알려 준 플랫폼별 사용 가능 여부(NativeBridge가 채운다)
let pushCfg = { android: false, ios: false };
let registrationListener = false;

/** 이 기기에서 푸시를 쓸 수 있는 플랫폼(앱이고, 서버 키가 있고, 푸시를 넣고 빌드한 판일 때만) */
async function pushPlatform(): Promise<"android" | "ios" | null> {
  if (!isNativeApp()) return null;
  const { Capacitor } = await import("@capacitor/core");
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") return null;
  if (!pushCfg[platform]) return null;
  const { App } = await import("@capacitor/app");
  const build = Number((await App.getInfo()).build);
  return build >= (platform === "android" ? PUSH_MIN_ANDROID_BUILD : PUSH_MIN_IOS_BUILD) ? platform : null;
}

/** 기기가 받은 토큰을 서버에 보낸다(안드로이드·Firebase를 붙인 iOS는 FCM 토큰, iOS 기본은 APNs 기기 토큰. 서버가 글 모양으로 가린다) */
async function registerPush(): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  const { PushNotifications } = await import("@capacitor/push-notifications");
  if (!registrationListener) {
    registrationListener = true;
    await PushNotifications.addListener("registration", (token) => {
      void fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
      });
    });
  }
  await PushNotifications.register();
}

export type ReplyAlertsState = "granted" | "prompt" | "denied" | "unsupported";

/** 답장 알림(푸시)의 지금 상태. 묻지 않고 본다 */
export async function replyAlertsState(): Promise<ReplyAlertsState> {
  try {
    if (!(await pushPlatform())) return "unsupported";
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const r = (await PushNotifications.checkPermissions()).receive;
    return r === "granted" ? "granted" : r === "denied" ? "denied" : "prompt";
  } catch {
    return "unsupported";
  }
}

/**
 * 답장 알림 허락을 묻고(OS 창) 허락하면 이 기기를 푸시에 등록한다.
 * 앱을 켜자마자가 아니라, 사람이 답장을 기다릴 만한 순간(첫 물어보기 링크를 만들거나 공유한 직후, 또는 '답장 알림' 단추를 눌렀을 때)에 부른다.
 * 앱 열 때는 이미 허락한 기기만 NativeBridge가 다시 등록한다. 앱이 아니거나 이 판이 푸시를 못 받으면 "unsupported"
 */
export async function askReplyAlerts(): Promise<"granted" | "denied" | "unsupported"> {
  try {
    if (!(await pushPlatform())) return "unsupported";
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = (await PushNotifications.checkPermissions()).receive;
    if (perm !== "granted" && perm !== "denied") perm = (await PushNotifications.requestPermissions()).receive;
    if (perm !== "granted") return "denied";
    await registerPush();
    return "granted";
  } catch {
    return "unsupported";
  }
}

/**
 * 답장 알림을 켜는 작은 단추: 앱 안이고 푸시를 쓸 수 있고 아직 허락을 안 물어봤을 때만 보인다(웹·이미 허락·거절한 뒤에는 없다).
 * 누르면 OS 허락 창이 뜬다. 답장을 기다리는 화면에 놓는다
 */
export function ReplyAlertsPrompt({ label, className = "" }: { label: string; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let gone = false;
    void replyAlertsState().then((s) => {
      if (!gone && s === "prompt") setShow(true);
    });
    return () => {
      gone = true;
    };
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setShow(false);
        void askReplyAlerts();
      }}
      className={`relative flex h-[27px] items-center gap-1 whitespace-nowrap rounded-full border border-edge bg-sky-soft pl-2 pr-[9.9px] text-[11.7px] before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] ${className}`}
    >
      <Icon name="bell" size={14} strokeWidth={1.8} />
      {label}
    </button>
  );
}

export function NativeBridge({
  locale,
  appLock,
  reminders,
  pushEnabled,
  iosPushEnabled = false,
  labels,
  nativeUa = false,
}: {
  locale: Locale;
  appLock: boolean;
  reminders: LocalReminder[];
  /** 서버에 FCM 키가 있고 이 사람이 알림을 켰다(안드로이드 푸시) */
  pushEnabled: boolean;
  /** 서버에 APNs 키가 있고 이 사람이 알림을 켰다(iOS 푸시) */
  iosPushEnabled?: boolean;
  labels: LockLabels;
  /** 서버가 요청 UA로 앱인 줄 안 경우: 잠금 화면을 처음부터 그려서 하이드레이션 전에 내용이 비치지 않게 */
  nativeUa?: boolean;
}) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });
  const native = useIsNative() || nativeUa;
  const [unlocked, setUnlocked] = useState(false);
  // 앱 전환 화면(최근 앱 목록)에 내용이 비치지 않게 백그라운드에서는 가린다
  const [covered, setCovered] = useState(false);
  const locked = native && appLock && !unlocked;
  const hiddenAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    try {
      const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
      const ok = await NativeBiometric.isAvailable({ useFallback: true });
      if (!ok.isAvailable) {
        setUnlocked(true);
        return;
      }
      await NativeBiometric.verifyIdentity({ reason: labels.title, title: labels.appName, useFallback: true });
      setUnlocked(true);
    } catch {
      // 실패·취소하면 잠긴 채로 둔다
    }
  }, [labels.title, labels.appName]);

  // 앱 잠금: 처음 열 때와, 1분 넘게 다른 앱에 있다가 돌아올 때
  useEffect(() => {
    if (!native || !appLock) return;
    let remove: (() => void) | undefined;
    let gone = false;
    void (async () => {
      const { App } = await import("@capacitor/app");
      void unlock();
      const h = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          hiddenAt.current = Date.now();
          setCovered(true);
          return;
        }
        setCovered(false);
        if (hiddenAt.current && Date.now() - hiddenAt.current > LOCK_AFTER_MS) {
          setUnlocked(false);
          void unlock();
        }
      });
      if (gone) void h.remove();
      else remove = () => void h.remove();
    })();
    return () => {
      gone = true;
      remove?.();
    };
  }, [native, appLock, unlock]);

  // 링크(유니버설 링크·앱 링크)로 열리면 그 화면으로
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let gone = false;
    void (async () => {
      const { App } = await import("@capacitor/app");
      const h = await App.addListener("appUrlOpen", ({ url }) => {
        if (url.startsWith("kr.readme.app://auth")) return;
        try {
          const u = new URL(url);
          const path = u.protocol.startsWith("http") ? u.pathname + u.search : `/${u.host}${u.pathname}${u.search}`;
          if (appPath(path)) routerRef.current.push(path);
        } catch {
          /* 모르는 주소는 무시 */
        }
      });
      if (gone) void h.remove();
      else remove = () => void h.remove();
    })();
    return () => {
      gone = true;
      remove?.();
    };
  }, []);

  // 바깥 링크(쿠팡 파트너스·지도·적어 둔 링크)는 앱 웹뷰 안에서 열지 않고 휴대폰에 넘긴다: 웹뷰가 앱 밖 주소로 가려 하면
  // Capacitor가 막고 휴대폰에 넘긴다(iOS UIApplication.open, Android ACTION_VIEW). 쿠팡 앱이 링크를 받으면 쿠팡 앱이, 아니면 기본 브라우저가 연다.
  // (인앱 브라우저는 기본 브라우저의 탭이라 쿠팡 앱으로 넘어가지 않는다.) 앱 주소·http 아닌 링크(tel: 등)는 그대로
  useEffect(() => {
    if (!isNativeApp()) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol) || url.origin === window.location.origin) return;
      e.preventDefault();
      window.location.href = url.toString();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // 어느 플랫폼에서 푸시를 쓸 수 있는지(서버가 알려 준 값). 알림 허락을 묻는 askReplyAlerts·ReplyAlertsPrompt가 읽는다
  useLayoutEffect(() => {
    pushCfg = { android: pushEnabled, ios: iosPushEnabled };
  }, [pushEnabled, iosPushEnabled]);

  // 푸시: 앱을 열 때는 허락을 묻지 않는다. 이미 허락해 둔 기기만 토큰을 다시 등록하고(토큰은 바뀔 수 있다), 알림을 눌러 열기를 달아 둔다.
  // 허락을 묻는 건 답장을 기다릴 만한 때(첫 물어보기 링크를 만들고 나서)에 askReplyAlerts()로
  useEffect(() => {
    if (!isNativeApp() || (!pushEnabled && !iosPushEnabled)) return;
    let gone = false;
    const handles: { remove: () => Promise<void> }[] = [];
    void (async () => {
      try {
        if (!(await pushPlatform())) return;
        const { PushNotifications } = await import("@capacitor/push-notifications");
        handles.push(
          await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
            const path = (a.notification.data as { path?: string } | undefined)?.path;
            if (appPath(path)) routerRef.current.push(path);
          }),
        );
        if (gone) return;
        if ((await PushNotifications.checkPermissions()).receive === "granted") await registerPush();
      } catch {
        /* 푸시 설정이 없는 빌드(Firebase·푸시 capability 없음)면 조용히 넘어간다 */
      }
    })();
    return () => {
      gone = true;
      for (const h of handles) void h.remove();
    };
  }, [pushEnabled, iosPushEnabled]);

  // 기기 로컬 알림: 서버 푸시가 없어도 생일 알림이 오게. 다가오는 것만 다시 예약한다.
  // reminders는 화면을 새로 받을 때마다 새 배열이라, 내용이 같으면 다시 예약하지 않게 문자열 키로 본다
  const remindersKey = JSON.stringify(reminders);
  useEffect(() => {
    if (!isNativeApp()) return;
    let gone = false;
    void (async () => {
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const now = Date.now();
        // 가까운 날짜부터 64개 상한 안에 담는다(먼 날의 이른 알림이 가까운 날 알림을 밀어내지 않게)
        const list = (JSON.parse(remindersKey) as LocalReminder[])
          .map((r) => ({ ...r, at: new Date(r.y, r.m - 1, r.d, 9, 0, 0) }))
          .filter((r) => r.at.getTime() > now)
          .sort((a, b) => a.at.getTime() - b.at.getTime())
          .slice(0, MAX_LOCAL)
          // 생일 아침 알림은 몇 분 늦어도 괜찮다. 정확한 알람을 바라면 안드로이드가 '알람 및 리마인더' 설정 화면을 띄우므로 끈다
          .map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true }, isExactNotification: false, extra: { path: r.path } }));
        const pending = await LocalNotifications.getPending();
        if (gone) return;
        if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
        // 알릴 날이 하나라도 생긴 뒤에야 알림 권한을 묻는다(앱을 켜자마자 묻지 않는다)
        if (!list.length || gone) return;
        let perm = await LocalNotifications.checkPermissions();
        if (perm.display === "prompt" || perm.display === "prompt-with-rationale") perm = await LocalNotifications.requestPermissions();
        if (perm.display !== "granted" || gone) return;
        await LocalNotifications.schedule({ notifications: list });
      } catch {
        /* 권한이 없거나 웹이면 넘어간다 */
      }
    })();
    return () => {
      gone = true;
    };
  }, [remindersKey]);

  // 알림을 눌러 열기: 한 번만 달고(예약을 다시 해도 겹쳐 달지 않는다) 화면을 나가면 뗀다
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let gone = false;
    void (async () => {
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const h = await LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
          const path = (a.notification.extra as { path?: string } | undefined)?.path;
          if (appPath(path)) routerRef.current.push(path);
        });
        if (gone) void h.remove();
        else remove = () => void h.remove();
      } catch {
        /* 웹이면 넘어간다 */
      }
    })();
    return () => {
      gone = true;
      remove?.();
    };
  }, []);

  if (!(locked || (native && appLock && covered))) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={labels.title} lang={locale} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white px-6">
      <Wordmark locale={locale} />
      <Icon name="lock" size={40} />
      <p className="text-[16.2px]">{labels.title}</p>
      <button type="button" onClick={() => void unlock()} className="btn-primary w-full max-w-[288px]">
        {labels.unlock}
      </button>
    </div>
  );
}
