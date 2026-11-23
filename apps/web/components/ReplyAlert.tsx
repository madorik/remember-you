"use client";

import type { Locale } from "@readme/core";
import { useEffect, useState } from "react";
import { useT } from "@/components/editors/shared";
import { Icon } from "@/components/marks";
import { askReplyAlerts, replyAlertsState, useIsNative } from "@/components/native";
import { enableWebPush, readWebPushState, type WebPushState } from "@/lib/web-push-client";

/**
 * 물어보기 링크를 만든 직후 '답장 오면 알려 드릴까요?' 한 줄: 누르면 이 브라우저의 알림 받기(웹 푸시)를 켠다(설정의 스위치와 같은 길).
 * 앱 안에서는 OS 알림 허락(푸시 등록)을 묻는다(아직 안 물어본 기기만). 브라우저가 못 받거나 막혀 있거나 이미 켜져 있으면 보이지 않는다(켠 직후에는 켰다는 표시만 남는다)
 */
export function ReplyAlert({ locale, publicKey }: { locale: Locale; publicKey: string | null }) {
  const t = useT(locale);
  const native = useIsNative();
  const [state, setState] = useState<WebPushState | "unknown">("unknown");
  const [busy, setBusy] = useState(false);
  const [justOn, setJustOn] = useState(false);

  useEffect(() => {
    let gone = false;
    if (native) {
      // 앱: 아직 OS 허락을 안 물어본 기기만 '답장 오면 알려 드릴까요?'를 보인다
      void replyAlertsState().then((s) => {
        if (!gone) setState(s === "prompt" ? "off" : "unsupported");
      });
    } else if (publicKey) {
      void readWebPushState().then((next) => {
        if (!gone) setState(next);
      });
    }
    return () => {
      gone = true;
    };
  }, [native, publicKey]);

  if (state !== "off" && !justOn) return null;

  if (justOn) {
    return (
      <p role="status" className="mx-4 mt-3.5 flex min-h-11 items-center gap-2 px-1 text-[12.6px]">
        <Icon name="check" size={16} strokeWidth={2.2} className="shrink-0 text-[#5dbb9a]" />
        {t("request.alertOn")}
      </p>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          if (native) {
            const r = await askReplyAlerts();
            if (r === "granted") setJustOn(true);
            setState("unsupported");
          } else if (publicKey) {
            const next = await enableWebPush(publicKey);
            if (next === "on") setJustOn(true);
            setState(next);
          }
        } catch {
          /* 켜지 못하면 그대로 둔다(설정에서 다시 켤 수 있다) */
        } finally {
          setBusy(false);
        }
      }}
      className="mx-4 mt-3.5 flex min-h-11 items-center gap-2 rounded-full border border-dashed border-edge bg-white px-3.5 text-left text-[12.6px] disabled:opacity-50"
    >
      <Icon name="bell" size={17} strokeWidth={1.8} className="shrink-0" />
      {t("request.alertAsk")}
    </button>
  );
}
