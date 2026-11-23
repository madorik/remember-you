"use client";

import { translate, type Locale } from "@readme/core";
import { useSyncExternalStore } from "react";
import { Mascot } from "./Mascot";

// 오류 화면(app/error.tsx, app/(app)/error.tsx, app/global-error.tsx가 같이 쓴다).
// 오류 경계는 서버 전용 코드를 못 쓰고 화면 언어를 모를 수 있어서, 언어는 <html lang>·브라우저에서 읽는다

const noop = () => () => {};

function readLocale(): Locale {
  const lang = (document.documentElement.lang || navigator.language || "").toLowerCase();
  return lang.startsWith("en") ? "en" : "ko";
}

/** 지금 화면 언어. 서버에서 그릴 때는 한국어로 시작하고 브라우저에서 맞춘다 */
export function useUiLocale(): Locale {
  return useSyncExternalStore(noop, readLocale, () => "ko");
}

/**
 * 짧은 제목 + 다시 해 보기 + 처음으로. 처음으로는 일반 링크(전체를 새로 불러와 망가진 상태에서 벗어난다).
 * wrap: 화면 틀(<main class="screen">)이 없는 곳(앱 밖 화면·global-error)에서
 */
export function ErrorScreen({ retry, locale, wrap = false }: { retry: () => void; locale?: Locale; wrap?: boolean }) {
  const detected = useUiLocale();
  const t = (key: "error.title" | "error.retry" | "error.home") => translate(locale ?? detected, key);
  const body = (
    <div role="alert" className="page-end flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <Mascot pose={9} size={108} />
      <h1 className="headline text-[24px]">{t("error.title")}</h1>
      <div className="flex w-full max-w-[320px] flex-col gap-2.5 pt-1">
        <button type="button" onClick={retry} className="btn-primary w-full">
          {t("error.retry")}
        </button>
        {/* 일부러 일반 링크: 전체를 새로 불러와야 망가진 상태에서 벗어난다 */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="btn-outline w-full">
          {t("error.home")}
        </a>
      </div>
    </div>
  );
  return wrap ? <main className="screen">{body}</main> : body;
}
