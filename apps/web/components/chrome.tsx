import Link from "next/link";
import { BRAND, type Locale } from "@readme/core";
import type { T } from "@/lib/i18n";
import { u } from "@/lib/ui-scale";
import { MemoIcon } from "./MemoIcon";
import { Icon } from "./marks";

/** 위쪽 줄: 뒤로(또는 닫기) · 가운데 글 · 오른쪽 자리 */
export function TopBar({ back, close, label, center, right }: { back?: string; close?: string; label: string; center?: React.ReactNode; right?: React.ReactNode }) {
  const href = back ?? close;
  return (
    <div className="flex min-h-11 items-center justify-between px-3">
      {href ? (
        <Link href={href} prefetch={false} aria-label={label} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center">
          <Icon name={back ? "back" : "close"} size={back ? 24 : 22} />
        </Link>
      ) : (
        <span className="w-11" />
      )}
      {center ?? null}
      {right ?? <span className="w-11" />}
    </div>
  );
}

/** 로고 글자: '기억해' / 'Remember' 뒤에 손그림 U(위에 점 둘). 읽어 줄 때는 이름 그대로(기억해유 / Remember You) */
const WORD = { ko: "기억해", en: "Remember" } as const;

export function Wordmark({ size = 26, locale = "ko" }: { size?: number; locale?: Locale }) {
  return (
    // 손글씨체는 같은 크기에서 작게 보여 글자 크기를 조금 키운다
    <span className="wordmark inline-flex items-center leading-[39.6px]" style={{ fontSize: Math.round(size * 1.25 * 0.9 * 10) / 10 }}>
      <span className="sr-only">{BRAND[locale].name}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        {WORD[locale]}
        <svg viewBox="0 0 26 34" aria-hidden="true" className="relative shrink-0" style={{ width: "0.78em", height: "1.03em", marginLeft: "0.06em", top: "-0.11em" }}>
          <circle cx="4.4" cy="3.6" r="2.4" fill="currentColor" />
          <circle cx="22.3" cy="3.6" r="2.4" fill="currentColor" />
          <path d="M4.2 10.6 C3.8 18.5 4.3 24 6.6 27.6 C8.6 30.6 11 31.8 13.4 31.8 C15.8 31.8 18.2 30.6 20.2 27.6 C22.5 24 22.9 18.5 22.5 10.2" fill="none" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}

/** 탭 아이콘(시안 모양): 챙길 날(달력 + 하트) · 사람들 · 나(웃는 얼굴) · 설정은 marks의 톱니 */
const TAB_ICONS = {
  home: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M12 17.6s-3-1.8-3-3.7a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.9-3 3.7-3 3.7z" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 19.5c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5" />
      <circle cx="17" cy="8" r="2.8" />
      <path d="M16.5 13.2c2.6.1 4.4 1.6 5 4.3" />
    </>
  ),
  // 나: 웃는 얼굴(가운데 단추가 메모지라 겹치지 않게)
  me: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9.3" cy="11" r=".6" fill="currentColor" />
      <circle cx="14.7" cy="11" r=".6" fill="currentColor" />
      <path d="M9.5 14.5q2.5 2 5 0" />
    </>
  ),
} as const;

/** 아래쪽 탭 막대: 종이색 막대에 가는 윗선, 지금 탭은 망고 알약. fab: 막대 바로 위 오른쪽에 떠 있는 버튼(사람들 화면의 직접 적기 등) */
/** voice: 가운데 메모 단추(메모 쓰기, /voice). AI 키가 있을 때만 화면이 aiConfigured()로 켠다(이 파일은 클라이언트에서도 불려서 서버 전용 모듈을 못 들인다).
 *  voiceTo: 사람 화면이면 그 사람의 contactId — 메모 단추가 그 사람에게 적는 메모 쓰기(/voice?to=)로 간다 */
export function TabBar({ active, t, fab, voice = false, voiceTo = null }: { active: "home" | "people" | "me" | "privacy" | null; t: T; fab?: React.ReactNode; voice?: boolean; voiceTo?: string | null }) {
  const tabs = [
    { key: "home", href: "/home", label: t("nav.home") },
    { key: "people", href: "/people", label: t("nav.people") },
    { key: "me", href: "/me", label: t("nav.me") },
    { key: "privacy", href: "/privacy", label: t("nav.privacy") },
  ] as const;
  const tab = (item: (typeof tabs)[number]) => {
    const on = item.key === active;
    return (
      <Link
        key={item.key}
        href={item.href}
        // 다른 탭 화면은 데이터까지 미리 받아 둔다(누르거나 좌우로 밀 때 빈 화면 없이 바로).
        // 지금 보고 있는 탭은 받지 않는다: 이미 떠 있는 화면을 서버가 한 번 더 그리는 낭비다(미리 받기 하나가 함수 한 번, 2026-11-21 CPU 한도)
        prefetch={!on}
        aria-current={on ? "page" : undefined}
        className={`flex flex-col items-center justify-center gap-[2.7px] whitespace-nowrap text-[10.8px] leading-[1.2] ${on ? "text-ink" : "text-muted"}`}
      >
        <span className={`flex h-8 w-[46.8px] items-center justify-center rounded-full ${on ? "bg-sky shadow-[inset_0_0_0_1px_var(--color-edge)]" : ""}`}>
          {item.key === "privacy" ? (
            <Icon name="settings" size={24} strokeWidth={1.8} />
          ) : (
            <svg aria-hidden="true" width="21.6" height="21.6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {TAB_ICONS[item.key]}
            </svg>
          )}
        </span>
        {item.label}
      </Link>
    );
  };
  return (
    <nav
      aria-label={t("nav.menu")}
      data-tabbar=""
      className="sticky bottom-0 z-30 mt-auto bg-paper px-3 pt-2 shadow-[inset_0_1px_0_rgb(31_35_64/0.12)]"
      style={{ paddingBottom: "var(--pb-tab)" }}
    >
      {fab ? <div className="absolute bottom-full right-4">{fab}</div> : null}
      <div className={`grid h-[63px] ${voice ? "grid-cols-5" : "grid-cols-4"}`}>
        {tabs.slice(0, 2).map(tab)}
        {voice ? (
          <div className="flex items-center justify-center">
            {/* 가운데 메모 단추(막대 한가운데): 누르면 메모 쓰기. 눌리는 느낌만 살짝 */}
            <Link
              href={voiceTo ? `/voice?to=${voiceTo}` : "/voice"}
              prefetch={false}
              aria-label={t("nav.memo")}
              className="flex items-center justify-center rounded-full border border-edge bg-sky-soft transition-transform active:scale-95"
              style={{ width: u(62), height: u(62) }}
            >
              <MemoIcon />
            </Link>
          </div>
        ) : null}
        {tabs.slice(2).map(tab)}
      </div>
    </nav>
  );
}

/** 시작·로그인 화면 아래 약관 · 개인정보 처리방침 */
export function LegalLinks({ locale, t }: { locale: Locale; t: T }) {
  return (
    <p className="flex justify-center gap-x-3.5 pt-1 text-[12.6px] text-muted">
      <a href={`/terms?lang=${locale}`} className="flex min-h-11 items-center underline underline-offset-2">
        {t("legal.terms")}
      </a>
      <a href={`/privacy-policy?lang=${locale}`} className="flex min-h-11 items-center underline underline-offset-2">
        {t("legal.privacy")}
      </a>
      {locale === "ko" ? (
        <Link href="/gifts" className="flex min-h-11 items-center underline underline-offset-2">
          선물 가이드
        </Link>
      ) : null}
    </p>
  );
}

export function Notice({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "red" | "ok" }) {
  const color = tone === "red" ? "text-red" : tone === "ok" ? "text-ok" : "text-muted";
  return (
    <p role={tone === "red" ? "alert" : "status"} className={`text-[12.2px] leading-[1.5] ${color}`}>
      {children}
    </p>
  );
}
