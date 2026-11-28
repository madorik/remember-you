"use client";

import type { Locale } from "@readme/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { classifyClipboard, type ClipboardProbe, type ClipboardRead } from "@/lib/clipboard-paste";
import { APPLE_NOTES, APPLE_NOTES_URL, installedNotesApps, type NotesApp } from "@/lib/notes-apps";
import { Wordmark } from "./chrome";
import { Icon } from "./marks";

// 앱(Capacitor) 안에서만 하는 일: 푸시 토큰 등록, 기기 로컬 생일 알림, Face ID·지문 앱 잠금, 링크로 앱 열기, 다른 앱에서 공유 받은 글 넘기기.
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

// ── 다른 앱에서 공유 받은 글 ──────────────────────────────────────
// 삼성 노트·Google Keep·메모 앱 등의 "공유 → 기억해유"로 온 글은 앱 안쪽(ShareInbox 플러그인: 안드로이드 ShareInboxPlugin.java, iOS 공유 확장 + ShareInboxPlugin.swift)에 쌓인다.
// take()로 꺼내(꺼내면 비워진다) 메모 쓰는 화면이 읽는 sessionStorage에 두고 /voice?shared=1 로 연다. 글은 주소·서버로 보내지 않고 로그에도 남기지 않는다.
const SHARED_MEMO_KEY = "rm_shared_memo";

interface ShareInboxPlugin {
  take(): Promise<{ text: string | null }>;
  addListener(event: "shared", listener: () => void): Promise<{ remove: () => Promise<void> }>;
  /** (안드로이드, 메모 앱 열기를 넣은 빌드부터) 설치된 메모 앱: ShareInboxPlugin.NOTES_APPS 중 깔린 것 */
  notesApps(): Promise<{ apps: { id: string }[] }>;
  /** (클립보드 읽기를 넣은 빌드부터) 클립보드에 글이 있나·바뀔 때마다 달라지는 값. 내용은 읽지 않는다(안드로이드 ClipboardManager 설명, iOS hasStrings·changeCount) */
  hasClipboardText(): Promise<{ has: boolean; stamp?: number }>;
  /** (같은 빌드부터) 클립보드의 글. 사람이 '복사한 글 붙여 넣기'를 누른 때만 부른다 */
  readClipboard(): Promise<{ text: string | null }>;
  /** (안드로이드, 같은 빌드부터) 그 메모 앱을 연다 */
  openApp(options: { id: string }): Promise<{ opened: boolean }>;
}

let shareInbox: Promise<{ plugin: ShareInboxPlugin } | null> | null = null;
/** 등록이 끝난 플러그인(눌린 그 자리에서 곧바로 불러야 하는 클립보드 읽기가 기다림 없이 쓴다) */
let shareInboxNow: ShareInboxPlugin | null = null;

/**
 * 공유 받은 편지함 플러그인(공유 받기를 넣기 전에 만든 앱 빌드에는 없어서 null). 한 번만 등록한다.
 * 플러그인(registerPlugin)은 어떤 이름을 물어도 함수를 돌려주는 프록시라 then까지 함수로 보이는데, 그대로 프로미스가 돌려주면
 * (async 함수의 return·await) 프로미스가 then을 불러 보고 끝나지 않는다. 그래서 한 겹 감싸서 돌려준다
 */
function loadShareInbox(): Promise<{ plugin: ShareInboxPlugin } | null> {
  shareInbox ??= (async () => {
    try {
      const { Capacitor, registerPlugin } = await import("@capacitor/core");
      if (!Capacitor.isPluginAvailable("ShareInbox")) return null;
      shareInboxNow = registerPlugin<ShareInboxPlugin>("ShareInbox");
      return { plugin: shareInboxNow };
    } catch {
      return null;
    }
  })();
  return shareInbox;
}

/**
 * 앱 안쪽 플러그인이 이 메서드를 갖고 있나. 플러그인 프록시는 없는 메서드도 함수처럼 보이게 해서(불러야 UNIMPLEMENTED로 거절된다)
 * 오래된 앱 빌드를 가리려면 앱이 알려 준 PluginHeaders를 본다
 */
function pluginHasMethod(plugin: string, method: string): boolean {
  const w = window as unknown as { Capacitor?: { PluginHeaders?: { name: string; methods?: { name: string }[] }[] } };
  return !!w.Capacitor?.PluginHeaders?.find((h) => h.name === plugin)?.methods?.some((m) => m.name === method);
}

/**
 * 메모 쓰기 화면 '메모 앱에서'가 열 수 있는 이 휴대폰의 메모 앱들. 웹 브라우저·메모 앱 열기를 넣기 전 앱 빌드는 빈 목록.
 * iOS는 기본 메모 앱 하나(새 앱 코드 없이 웹뷰의 mobilenotes:// 이동을 Capacitor가 UIApplication.open에 넘긴다), 안드로이드는 설치된 앱만
 */
export async function loadNotesApps(): Promise<NotesApp[]> {
  if (!isNativeApp()) return [];
  try {
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    if (platform === "ios") return [APPLE_NOTES];
    if (platform !== "android") return [];
    const inbox = await loadShareInbox();
    if (!inbox || !pluginHasMethod("ShareInbox", "notesApps") || !pluginHasMethod("ShareInbox", "openApp")) return [];
    const r = await inbox.plugin.notesApps();
    return installedNotesApps((r?.apps ?? []).map((a) => a?.id));
  } catch {
    return [];
  }
}

/**
 * 그 메모 앱을 연다. 돌아오는 길은 따로 없다: 사람이 그 앱에서 글을 골라 "공유 → 기억해유"를 누르면 위 받은 편지함이 메모 쓰는 화면으로 가져오고,
 * 글을 복사하고 직접 돌아오면 메모 쓰는 화면의 '복사한 글 붙여 넣기'(아래 clipboard 함수들)가 받는다
 */
export async function openNotesApp(app: NotesApp): Promise<boolean> {
  try {
    if (app.id === APPLE_NOTES.id) {
      window.location.href = APPLE_NOTES_URL;
      return true;
    }
    const inbox = await loadShareInbox();
    if (!inbox) return false;
    return !!(await inbox.plugin.openApp({ id: app.id }))?.opened;
  } catch {
    return false;
  }
}

// ── 복사한 글 붙여 넣기 ───────────────────────────────────────────
// 메모 앱에서 글을 복사하고 돌아와 '복사한 글 붙여 넣기'를 누르면 클립보드의 글이 본문 뒤에 붙는다(메모 쓰기 화면 PastePill). 글은 본문 칸에만 들어간다

/** 클립보드에 글이 있나 읽지 않고 본다. 볼 방법이 없으면(웹 브라우저·클립보드 확인을 넣기 전 앱 빌드) null */
export async function clipboardHasText(): Promise<ClipboardProbe | null> {
  if (!isNativeApp()) return null;
  try {
    const inbox = await loadShareInbox();
    if (!inbox || !pluginHasMethod("ShareInbox", "hasClipboardText")) return null;
    const r = await inbox.plugin.hasClipboardText();
    return { has: !!r?.has, stamp: typeof r?.stamp === "number" ? r.stamp : 0 };
  } catch {
    return null;
  }
}

/**
 * 이 기기에서 '복사한 글 붙여 넣기'가 클립보드를 읽을 수 있나. 안드로이드 앱의 웹뷰는 navigator.clipboard.readText를 늘 막아서(NotAllowedError, 에뮬레이터 확인)
 * 앱 안쪽 읽기(readClipboard)를 넣은 빌드에서만 된다. 그 전 안드로이드 빌드에서는 눌러 봐야 실패할 알약을 아예 보이지 않는다.
 * 웹 브라우저·iOS 웹뷰는 누른 직후의 readText로 읽는다
 */
export function canReadClipboard(): boolean {
  if (!isNativeApp()) return true;
  if (pluginHasMethod("ShareInbox", "readClipboard")) return true;
  const w = window as unknown as { Capacitor?: { getPlatform?: () => string } };
  return w.Capacitor?.getPlatform?.() !== "android";
}

/**
 * 클립보드의 글을 읽는다. 사람이 단추를 누른 그 자리에서 부른다:
 * 웹 브라우저·iOS 웹뷰의 navigator.clipboard.readText는 누른 직후에만 읽히니, 읽기 전에 기다리는 일(await)을 끼우지 않는다.
 * 앱 안쪽 플러그인이 클립보드 읽기를 갖고 있으면(새 앱 빌드) 그것으로, 아니면 웹의 readText로(예전 앱 빌드·웹 브라우저)
 */
export function readClipboardText(): Promise<ClipboardRead> {
  const failed: ClipboardRead = { status: "failed" };
  const plugin = shareInboxNow;
  try {
    if (plugin && isNativeApp() && pluginHasMethod("ShareInbox", "readClipboard")) {
      return plugin.readClipboard().then((r) => classifyClipboard(r?.text), () => failed);
    }
    if (!navigator.clipboard?.readText) return Promise.resolve(failed);
    return navigator.clipboard.readText().then(classifyClipboard, () => failed);
  } catch {
    return Promise.resolve(failed);
  }
}

/**
 * 이 화면을 떠났다(앱을 내리거나 다른 앱으로 갔다, 탭을 바꿨다)·돌아왔다를 알린다. 웹은 visibilitychange, 앱은 Capacitor의 appStateChange도 같이(둘 다 올 수 있다).
 * 돌려주는 함수를 부르면 걷는다
 */
export function watchAppReturn(h: { onLeave: () => void; onReturn: () => void }): () => void {
  const onVisibility = () => (document.visibilityState === "hidden" ? h.onLeave() : h.onReturn());
  document.addEventListener("visibilitychange", onVisibility);
  let gone = false;
  let remove: (() => void) | undefined;
  if (isNativeApp()) {
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const l = await App.addListener("appStateChange", ({ isActive }) => (isActive ? h.onReturn() : h.onLeave()));
        if (gone) void l.remove();
        else remove = () => void l.remove();
      } catch {
        /* 앱 상태를 못 보면 웹 이벤트만 쓴다 */
      }
    })();
  }
  return () => {
    gone = true;
    document.removeEventListener("visibilitychange", onVisibility);
    remove?.();
  };
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
        // auth는 로그인 되돌아오기, share는 공유 받은 글(아래 effect가 받는다): 둘 다 화면 주소가 아니다
        if (url.startsWith("kr.readme.app://auth") || url.startsWith("kr.readme.app://share")) return;
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

  // 다른 앱에서 공유 받은 글: 앱이 켜질 때, 앱 안쪽의 "shared" 알림이 올 때, 앱으로 돌아올 때, kr.readme.app://share 로 열릴 때
  // 받은 편지함에서 꺼내(없으면 아무 일도 없다) 메모 쓰는 화면으로 넘긴다. 같은 공유로 여러 번 불려도 꺼내는 건 한 번뿐이다
  useEffect(() => {
    if (!isNativeApp()) return;
    let gone = false;
    const handles: { remove: () => Promise<void> }[] = [];
    const take = async (plugin: ShareInboxPlugin) => {
      try {
        const { text } = await plugin.take();
        if (typeof text !== "string" || !text.trim()) return;
        try {
          sessionStorage.setItem(SHARED_MEMO_KEY, text);
        } catch {
          /* 저장소를 못 쓰면 빈 채로 연다 */
        }
        // 메모 쓰는 화면이 이미 열려 있으면(메모 앱에서 가져오러 나갔다 돌아온 경우) 그 주소의 ?to=… 같은 값을 지켜 shared=1만 더한다:
        // 쓰던 글·고른 사람이 그대로고 받은 글이 뒤에 붙는다
        const q = new URLSearchParams(window.location.pathname === "/voice" ? window.location.search : "");
        q.set("shared", "1");
        routerRef.current.push(`/voice?${q}`);
      } catch {
        /* 꺼내지 못하면 넘어간다 */
      }
    };
    void (async () => {
      try {
        const inbox = await loadShareInbox();
        if (!inbox || gone) return;
        const plugin = inbox.plugin;
        const { App } = await import("@capacitor/app");
        const added = await Promise.all([
          plugin.addListener("shared", () => void take(plugin)),
          App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) void take(plugin);
          }),
          App.addListener("appUrlOpen", ({ url }) => {
            if (url.startsWith("kr.readme.app://share")) void take(plugin);
          }),
        ]);
        if (gone) {
          for (const h of added) void h.remove();
          return;
        }
        handles.push(...added);
        // 알림을 달아 둔 뒤에 한 번 꺼낸다(앱이 공유로 켜졌으면 글이 이미 들어와 있다)
        void take(plugin);
      } catch {
        /* 공유 받기가 없는 앱이면 넘어간다 */
      }
    })();
    return () => {
      gone = true;
      for (const h of handles) void h.remove();
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
