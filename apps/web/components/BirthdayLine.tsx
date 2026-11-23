import { formatMonthDay, formatSpec, nextOccurrence, solarToLunar, type DateSpec, type Locale, type YMD } from "@readme/core";
import Link from "@/components/AppLink";
import { CAKE_ART } from "@/components/SectionIcon";
import type { T } from "@/lib/t";

/** 그 날의 음력 점 표기: 음력 10.21 / Lunar 10.21(윤달은 윤10.21). 모르면(2050년 밖) 빈 글 */
export function lunarDots(l: { m: number; d: number; leap?: boolean }, locale: Locale, t: T) {
  return `${t("dates.lunar")} ${l.leap ? (locale === "ko" ? "윤" : "L") : ""}${String(l.m).padStart(2, "0")}.${String(l.d).padStart(2, "0")}`;
}

/** 생일 줄에 보일 글: 올해(다음) 양력 날짜 · 음력(음력 생일이면 적은 그대로, 양력 생일이면 그 날의 음력) */
export function birthdayParts(birthday: DateSpec, today: YMD, locale: Locale) {
  const next = nextOccurrence(birthday, today);
  const lunar = birthday.calendar === "lunar" ? { m: birthday.month, d: birthday.day, leap: birthday.leap } : next ? solarToLunar(next.date) : null;
  return { next, lunar, solar: next ? formatMonthDay(next.date, locale) : formatSpec(birthday, locale) };
}

/**
 * 프로필 고치기 화면 이름 칸 밑의 생일 줄: 케이크 · 'M월 D일' · '음력 MM.DD'. 누르면 날짜 고치기(href)로 간다.
 * 생일이 없으면 '+ 생일 적기' 글자 링크
 */
export function BirthdayLine({ birthday, today, locale, href, t }: { birthday: DateSpec | null; today: YMD; locale: Locale; href: string; t: T }) {
  const cake = (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16.2" height="16.2" fill="none" stroke="#1F2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {CAKE_ART}
    </svg>
  );
  if (!birthday)
    return (
      <Link href={href} className="relative flex min-h-8 items-center gap-1.5 text-[13.5px] text-accent before:absolute before:-inset-x-1 before:-inset-y-1.5">
        {cake}
        {t("person.addBirthday")}
      </Link>
    );
  const { lunar, solar } = birthdayParts(birthday, today, locale);
  return (
    <Link href={href} aria-label={`${t("person.birthdayEdit")}: ${solar}`} className="relative flex min-h-8 flex-wrap items-center gap-x-1.5 gap-y-0 text-[13.5px] before:absolute before:-inset-x-1 before:-inset-y-1.5">
      {cake}
      <span>{solar}</span>
      {lunar ? <span className="text-muted">· {lunarDots(lunar, locale, t)}</span> : null}
    </Link>
  );
}
