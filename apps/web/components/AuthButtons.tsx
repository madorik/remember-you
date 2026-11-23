"use client";

import type { Locale } from "@readme/core";
import { useRef, useState } from "react";
import { prepareDemo } from "@/app/actions/auth";
import { authClient } from "@/lib/auth-client";
import { appSignIn } from "@/lib/native-auth";
import { useT } from "./editors/shared";
import { useIsNative } from "./native";

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg aria-hidden="true" width="18" height="20" viewBox="0 0 17 20" fill="currentColor">
      <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2.1-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
    </svg>
  );
}

/** 구글 · Apple · 데모. 앱에서는 구글·Apple을 시스템 브라우저로. 이미 데모 계정이면 demo={false}(익명 로그인을 다시 하면 실패한다) */
export function AuthButtons({ locale, next, google, apple, demo: showDemo = true }: { locale: Locale; next: string; google: boolean; apple: boolean; demo?: boolean }) {
  const t = useT(locale);
  const native = useIsNative();
  const [busy, setBusy] = useState<null | "google" | "apple" | "demo">(null);
  const [failed, setFailed] = useState(false);
  const demoForm = useRef<HTMLFormElement>(null);
  const emptyInput = useRef<HTMLInputElement>(null);

  const social = async (provider: "google" | "apple") => {
    setBusy(provider);
    setFailed(false);
    if (native) {
      if (!(await appSignIn(provider, next))) {
        setBusy(null);
        setFailed(true);
      }
      return;
    }
    const r = await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: `/login?next=${encodeURIComponent(next)}&failed=1` });
    if (r.error) {
      setBusy(null);
      setFailed(true);
    }
  };

  const demo = async () => {
    setBusy("demo");
    setFailed(false);
    const r = await authClient.signIn.anonymous();
    if (r.error) {
      setBusy(null);
      setFailed(true);
      return;
    }
    // 개발 서버의 E2E만: ?demo=empty 면 샘플 없이 온보딩부터(운영 서버는 무시한다)
    if (emptyInput.current) emptyInput.current.value = new URLSearchParams(window.location.search).get("demo") === "empty" ? "1" : "0";
    demoForm.current?.requestSubmit();
  };

  return (
    <div className="flex flex-col gap-2.5">
      {google ? (
        <button type="button" disabled={!!busy} onClick={() => void social("google")} className="btn-outline gap-2.5 !font-sans !text-[16px] !font-normal !tracking-normal">
          <GoogleGlyph />
          {t("start.google")}
        </button>
      ) : null}
      {apple ? (
        <button type="button" disabled={!!busy} onClick={() => void social("apple")} className="btn-outline gap-2.5 !font-sans !text-[16px] !font-normal !tracking-normal">
          <AppleGlyph />
          {t("start.apple")}
        </button>
      ) : null}
      {showDemo ? (
        <>
          <button type="button" disabled={!!busy} onClick={() => void demo()} className={google || apple ? "btn-outline !min-h-[52px] !font-sans !text-[16px] !font-normal !tracking-normal" : "btn-primary"}>
            {t("start.demo")}
          </button>
          <span className="text-center text-[12px] leading-[1.3] text-muted">{t("start.demoNote")}</span>
        </>
      ) : null}
      {failed ? (
        <p role="alert" className="text-center text-[14px] text-red">
          {t("login.failed")}
        </p>
      ) : null}
      <form ref={demoForm} action={prepareDemo} hidden>
        <input type="hidden" name="next" value={next} />
        <input ref={emptyInput} type="hidden" name="empty" defaultValue="0" />
      </form>
    </div>
  );
}
