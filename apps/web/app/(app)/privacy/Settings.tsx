"use client";

import type { Locale, ReminderOffset } from "@readme/core";
import { useEffect, useOptimistic, useState } from "react";
import { useFormStatus } from "react-dom";
import { setPreference } from "@/app/actions/account";
import { saveOffsets } from "@/app/actions/card";
import { ReminderPicker } from "@/components/editors/ReminderPicker";
import { useT } from "@/components/editors/shared";
import { SwitchLook } from "@/components/marks";
import { useIsNative } from "@/components/native";

/** 서버 액션이 도는 동안 흐리게 하고 누르지 못하게 하는 단추(폼 안에서). 움직임 줄이기를 켜면 깜빡이지 않는다 */
export function PendingButton({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className={`${className} disabled:opacity-50 motion-safe:disabled:animate-pulse`}>
      {children}
    </button>
  );
}

/** 켜고 끄는 스위치 줄: 누르는 즉시 켠 모습(useOptimistic)으로 바꾸고, 저장이 실패하면 원래대로 돌리면서 오류를 보여 준다 */
function SwitchRow({ locale, prefKey, enabled, label, note, disabled = false }: { locale: Locale; prefKey: string; enabled: boolean; label: string; note?: React.ReactNode; disabled?: boolean }) {
  const t = useT(locale);
  const [on, setOn] = useOptimistic(enabled);
  const [failed, setFailed] = useState(false);
  return (
    <form
      action={async (fd) => {
        setFailed(false);
        setOn(!enabled);
        try {
          await setPreference(fd);
        } catch {
          setFailed(true);
        }
      }}
      className="flex min-h-12 flex-col justify-center border-t-[1.5px] border-dashed border-rule"
    >
      <input type="hidden" name="key" value={prefKey} />
      <input type="hidden" name="value" value={enabled ? "0" : "1"} />
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col gap-0.5 pl-1">
          <span className="text-[19px]">{label}</span>
          {note}
        </div>
        <SwitchButton label={label} on={on} disabled={disabled} />
      </div>
      {failed ? (
        <p role="alert" className="pb-2 pl-1 text-[16px] text-red">
          {t("common.error")}
        </p>
      ) : null}
    </form>
  );
}

function SwitchButton({ label, on, disabled }: { label: string; on: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={disabled || pending} aria-label={label} aria-pressed={on} aria-busy={pending} className={`flex h-11 w-16 shrink-0 items-center justify-end disabled:opacity-40 ${pending ? "motion-safe:animate-pulse" : ""}`}>
      <SwitchLook on={on} />
    </button>
  );
}

export function AppLockSetting({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const t = useT(locale);
  const native = useIsNative();
  return (
    <SwitchRow
      locale={locale}
      prefKey="app_lock"
      enabled={enabled}
      label={t("privacy.lock")}
      note={native ? null : <span className="text-[15px] text-muted">{t("privacy.lockUnavailable")}</span>}
      disabled={!native && !enabled}
    />
  );
}

/** 알림 받기: 끄면 푸시와 기기 로컬 알림(생일·기념일, 요청 답장, 공유 수락)을 모두 멈춘다 */
export function PushSetting({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const t = useT(locale);
  return <SwitchRow locale={locale} prefKey="push_enabled" enabled={enabled} label={t("privacy.push")} />;
}

/** 명절·챙기는 날 알림(설날·추석·크리스마스·어버이날 …): 알림 받기가 켜져 있을 때만 보인다. 언제 알릴지는 아래 알림 시점을 같이 쓴다 */
export function HolidaySetting({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const t = useT(locale);
  return <SwitchRow locale={locale} prefKey="holiday_reminders" enabled={enabled} label={t("privacy.holidayReminders")} />;
}

export function ReminderSetting({ locale, offsets }: { locale: Locale; offsets: ReminderOffset[] }) {
  const t = useT(locale);
  const [value, setValue] = useState(offsets);
  const [failed, setFailed] = useState(false);
  const dirty = value.join() !== offsets.join();
  return (
    <form
      action={async (fd) => {
        setFailed(false);
        try {
          await saveOffsets(fd);
        } catch {
          setFailed(true);
        }
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="offsets" value={JSON.stringify(value)} />
      <ReminderPicker value={value} onChange={setValue} locale={locale} compact />
      {failed ? (
        <p role="alert" className="text-[16px] text-red">
          {t("common.error")}
        </p>
      ) : null}
      {dirty ? <PendingButton className="btn-primary !h-11 !text-[18px]">{t("common.save")}</PendingButton> : null}
    </form>
  );
}

/** 브라우저 공개 키(base64url)를 구독에 넘길 바이트로 */
function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: JSON.stringify(sub.toJSON()), platform: "web" }) }).catch(() => null);
  return !!res?.ok;
}

/**
 * 이 브라우저에서 알림 받기(웹 푸시): 앱이 아니고, 브라우저가 지원하고, 서버에 푸시 키가 있을 때만 보인다.
 * 켜면 알림 권한을 묻고 구독을 서버에 저장한다(생일·기념일, 물어보기 답장). 끄면 구독을 지운다.
 * 이미 구독돼 있으면 열 때 서버에도 다시 저장해 둔다(알림 받기를 껐다 켠 사이에 지워졌을 수 있다)
 */
export function WebPushSetting({ locale, publicKey }: { locale: Locale; publicKey: string }) {
  const t = useT(locale);
  const native = useIsNative();
  const [state, setState] = useState<"unknown" | "unsupported" | "install" | "off" | "on" | "blocked">("unknown");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (native) return;
    let gone = false;
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // 아이폰·아이패드의 사파리는 홈 화면에 추가한 웹앱에서만 웹 푸시를 준다(iOS 16.4부터): 설치 전에는 PushManager가 없다
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        return void (!gone && setState(ios ? "install" : "unsupported"));
      }
      if (Notification.permission === "denied") return void (!gone && setState("blocked"));
      const reg = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => undefined);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      if (sub) void saveSubscription(sub);
      if (!gone) setState(sub ? "on" : "off");
    })();
    return () => {
      gone = true;
    };
  }, [native]);

  if (native || state === "unknown" || state === "unsupported") return null;
  const on = state === "on";

  async function turnOn() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "off");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    if (!(await saveSubscription(sub))) {
      await sub.unsubscribe().catch(() => {});
      throw new Error("save");
    }
    setState("on");
  }

  async function turnOff() {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: JSON.stringify(sub.toJSON()), platform: "web" }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
  }

  const label = t("privacy.webPush");
  return (
    <div className="flex min-h-12 flex-col justify-center border-t-[1.5px] border-dashed border-rule">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col gap-0.5 pl-1">
          <span className="text-[19px]">{label}</span>
          {state === "blocked" ? <span className="text-[15px] text-muted">{t("privacy.webPushBlocked")}</span> : null}
          {state === "install" ? <span className="text-[15px] text-muted">{t("privacy.webPushInstall")}</span> : null}
        </div>
        <button
          type="button"
          disabled={busy || state === "blocked" || state === "install"}
          aria-label={label}
          aria-pressed={on}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            try {
              await (on ? turnOff() : turnOn());
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
          className={`flex h-11 w-16 shrink-0 items-center justify-end disabled:opacity-40 ${busy ? "motion-safe:animate-pulse" : ""}`}
        >
          <SwitchLook on={on} />
        </button>
      </div>
      {failed ? (
        <p role="alert" className="pb-2 pl-1 text-[16px] text-red">
          {t("common.error")}
        </p>
      ) : null}
    </div>
  );
}
