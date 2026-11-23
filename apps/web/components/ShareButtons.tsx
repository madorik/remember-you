"use client";

import { translate, type Locale } from "@readme/core";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./marks";

type CapShare = { share: (o: { title?: string; text?: string; url?: string; dialogTitle?: string }) => Promise<unknown> };

type CapWindow = { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Share?: CapShare } } };

/** 공유창을 쓸 수 있는 곳인가(앱의 네이티브 공유, 아니면 브라우저 공유). 누르는 그 자리에서 바로 알 수 있다 */
export function canShare(): boolean {
  const w = window as unknown as CapWindow;
  return !!(w.Capacitor?.isNativePlatform?.() && w.Capacitor.Plugins?.Share) || !!navigator.share;
}

/**
 * 공유창을 연다: shared(보냈거나 사용자가 닫았다) · blocked(브라우저가 막았다: 누른 지 오래돼 NotAllowedError) · unavailable(공유창이 없다).
 * 누르는 순간 바로 불러야 브라우저가 허락한다(링크를 만든 뒤라면 늦을 수 있다)
 */
export async function shareLink(text: string, url?: string): Promise<"shared" | "blocked" | "unavailable"> {
  const w = window as unknown as CapWindow;
  try {
    if (w.Capacitor?.isNativePlatform?.() && w.Capacitor.Plugins?.Share) {
      await w.Capacitor.Plugins.Share.share({ text, url, dialogTitle: text });
      return "shared";
    }
    if (navigator.share) {
      await navigator.share({ text, url });
      return "shared";
    }
  } catch (e) {
    // 사용자가 공유창을 닫은 것도 성공으로 본다
    if (e instanceof Error && e.name === "AbortError") return "shared";
    if (e instanceof Error && e.name === "NotAllowedError") return "blocked";
  }
  return "unavailable";
}

/** 앱(Capacitor)이면 네이티브 공유, 아니면 브라우저 공유, 그것도 없으면 false */
export async function nativeShare(text: string, url?: string): Promise<boolean> {
  return (await shareLink(text, url)) === "shared";
}

/** 글을 복사한다. 클립보드가 막혀 있으면 옛 방식으로 한 번 더. 복사했으면 true */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * 아직 만들어지지 않은 글을 복사한다. 클립보드 쓰기를 누르는 순간 바로 시작해(글은 약속으로 넘긴다) 사파리처럼
 * 누른 뒤 기다린 복사를 막는 브라우저도 통과한다. 그 방식이 안 되면 글이 다 만들어진 뒤 일반 복사로 한 번 더. 복사했으면 true
 */
export async function copyTextLater(text: Promise<string>): Promise<boolean> {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
      return true;
    }
  } catch {
    /* 아래 일반 복사로 */
  }
  try {
    return await copyText(await text);
  } catch {
    return false;
  }
}

/** 잠깐(2초) 보이는 상태: 값을 넣으면 2초 뒤 null로 돌아온다 */
function useFlash<T>(): [T | null, (v: T) => void] {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = (v: T) => {
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setValue(null), 2000);
  };
  return [value, flash];
}

/** 보낼 링크(읽기 전용). 눌러서 고를 수 있다 */
export function LinkField({ url, label }: { url: string; label: string }) {
  return (
    <div className="relative">
      <Icon name="link" size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        readOnly
        value={url}
        aria-label={label}
        data-testid="invite-url"
        onFocus={(e) => e.currentTarget.select()}
        className="field !h-11 !min-h-11 truncate !rounded-xl !border-dashed !border-ink/30 !bg-transparent !pl-9 !pr-3.5 !text-[16px] text-muted"
      />
    </div>
  );
}

/** 링크 보내기: 휴대폰 공유창(카카오톡·문자·메일 등 어떤 앱이든) · 링크 복사. 공유창이 없으면 복사한다 */
export function ShareButtons({ locale, url, text, sendLabel, big = false }: { locale: Locale; url: string; text: string; sendLabel?: string; /** 아래 막대에 가득 차는 큰 단추(48px) */ big?: boolean }) {
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);
  // 복사했어요/복사하지 못했어요는 2초만 보이고 처음 글자로 돌아온다
  const [copied, flash] = useFlash<"ok" | "failed">();

  const copy = async () => flash((await copyText(`${text}\n${url}`)) ? "ok" : "failed");

  return (
    <div className={big ? "flex w-full items-center gap-2" : "flex flex-wrap items-center justify-center gap-2"}>
      <button
        type="button"
        onClick={async () => {
          if (!(await nativeShare(text, url))) await copy();
        }}
        className={big ? "inline-flex h-[48px] min-w-0 flex-[1.15] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-edge bg-sky px-3 text-[15.3px]" : "inline-flex h-11 items-center gap-1.5 rounded-full border border-edge bg-sky pl-3 pr-3.5 text-[13.5px]"}
      >
        <Icon name="share" size={17} strokeWidth={1.7} />
        {sendLabel ?? t("common.send")}
      </button>
      <button
        type="button"
        onClick={copy}
        className={big ? "inline-flex h-[48px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-edge bg-sky-soft px-3 text-[15.3px]" : "inline-flex h-11 items-center gap-1.5 rounded-full border border-edge bg-sky-soft pl-3 pr-3.5 text-[13.5px]"}
      >
        <Icon name={copied === "ok" ? "check" : "link"} size={17} strokeWidth={1.7} />
        {copied === "ok" ? t("common.copied") : copied === "failed" ? t("common.copyFailed") : t("common.copyLink")}
      </button>
      <span role="status" className="sr-only">
        {copied === "ok" ? t("common.copied") : copied === "failed" ? t("common.copyFailed") : ""}
      </span>
    </div>
  );
}

/** 글만 나누기(예: 생일 준비를 가족에게). 보냈거나 복사했으면 doneLabel, 복사도 못 했으면 failedLabel(없으면 앱 언어의 '복사하지 못했어요')을 2초 보인다 */
export function ShareTextButton({ text, label, doneLabel, failedLabel, className = "", icon }: { text: string; label: string; doneLabel: string; failedLabel?: string; className?: string; icon?: React.ReactNode }) {
  const [res, flash] = useFlash<string>();
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          // 공유창이 없으면 복사한다. 복사도 안 되면 보냈다고 하지 않는다
          if ((await nativeShare(text)) || (await copyText(text))) return flash(doneLabel);
          flash(failedLabel ?? translate(document.documentElement.lang === "en" ? "en" : "ko", "common.copyFailed"));
        }}
      >
        {icon}
        {res ?? label}
      </button>
      <span role="status" className="sr-only">
        {res ?? ""}
      </span>
    </>
  );
}
