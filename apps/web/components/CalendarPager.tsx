"use client";

import {
  addDays,
  calendarDays,
  daysInMonth,
  daysOn,
  diffDays,
  formatDotted,
  formatSpec,
  holidayRuns,
  monthName,
  sameYmd,
  solarToLunar,
  upcomingEvents,
  weekday,
  weekdayNames,
  ymdKey,
  type HolidayId,
  type Locale,
  type UpcomingEvent,
  type YMD,
} from "@readme/core";
import Link from "@/components/AppLink";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Avatar } from "@/components/Avatar";
import { HolidayArt } from "@/components/HolidayArt";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { Chev } from "@/components/planner";
import { eventName } from "@/lib/events";
import type { CalendarData, CalPerson, Month } from "@/lib/pages/calendar.data";
import { makeT, type T } from "@/lib/t";

const monthKey = (v: Month) => `${v.y}-${String(v.m).padStart(2, "0")}`;
const shift = (v: Month, n: number): Month => {
  const i = v.y * 12 + (v.m - 1) + n;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
};
const MIN_YEAR = 1901;
const MAX_YEAR = 2099;
const inRange = (v: Month) => v.y >= MIN_YEAR && v.y <= MAX_YEAR;

/** 그 날의 선물 힌트 화면(홈 '선물 힌트 보기'와 같은 곳) */
const hintHref = (e: UpcomingEvent) => `/people/${e.contactId}/reminder?kind=${e.kind}${e.label ? `&label=${encodeURIComponent(e.label)}` : ""}`;

/** 선물을 챙기는 날(명절·크리스마스·어버이날 같은 홈의 '챙기는 날', 손그림이 있는 날): 누르면 사람을 골라 선물 고르기로 */
const GIFT_DAYS = new Set(["seollal", "chuseok", "christmas", "childrensDay", "parentsDay", "teachersDay", "valentine", "whiteDay", "pepero"]);
const GIFT_HREF = "/people?pick=1&to=gift";

/** 이만큼 가로로 움직이면 '밀기'로 본다(그 전에 세로로 움직이면 스크롤) */
const LOCK = 10;
/** 화면 너비의 이만큼 넘게 밀었거나 */
const COMMIT_RATIO = 0.22;
/** 이만큼 빠르게 튕기면(px/ms) 옮긴다 */
const FLING = 0.4;
/** 화면 양 끝은 비워 둔다(휴대폰의 뒤로 가기 몸짓) */
const EDGE = 24;
const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)";

const stillMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * 월별 달력: 좌우로 밀면 앞·뒤 달로 넘어가고(손가락을 따라 이웃 달이 보인다), 위 화살표로도 옮긴다.
 * 달은 화면에서 바로 계산한다(서버를 다시 부르지 않는다): 사람마다 생일·기념일 날짜만 받아 그 달의 챙길 날을 구하고,
 * 공휴일·연휴는 core의 한국 공휴일 계산(대체공휴일 포함)을 쓴다. 보이는 달은 주소(?m=)에 적어 둔다
 */
export function CalendarPager({ locale, today, cur: initial, people }: CalendarData) {
  const t = useMemo(() => makeT(locale), [locale]);
  const [cur, setCur] = useState<Month>(initial);
  // 이웃 달을 그리는 중(미는 동안과 옮기는 움직임 동안만. 평소에는 이번 달 하나만 그린다)
  const [neighbors, setNeighbors] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const curRef = useRef(cur);
  const busy = useRef(false);
  useLayoutEffect(() => {
    curRef.current = cur;
  });

  // 보이는 달을 주소에 적어 둔다(새로 고침·공유해도 그 달)
  useEffect(() => {
    const q = cur.y === today.y && cur.m === today.m ? "" : `?m=${monthKey(cur)}`;
    if (window.location.search !== q) window.history.replaceState(window.history.state, "", `/calendar${q}`);
  }, [cur, today.y, today.m]);

  /** 한 달 옮기기: from px 자리에서 출발해 옆 달이 들어오는 움직임(dir 0이면 제자리로 돌아간다) */
  const slide = useCallback(async (dir: -1 | 0 | 1, from: number) => {
    const el = track.current;
    const w = box.current?.clientWidth ?? 0;
    if (dir !== 0 && !inRange(shift(curRef.current, dir))) dir = 0;
    if (!el || !w || stillMotion()) {
      flushSync(() => {
        if (dir) setCur(shift(curRef.current, dir));
        setNeighbors(false);
      });
      busy.current = false;
      return;
    }
    const to = dir === 0 ? 0 : -dir * w;
    const anim = el.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], { duration: Math.max(140, Math.min(260, (Math.abs(to - from) / w) * 280)), easing: EASE, fill: "forwards" });
    await anim.finished.catch(() => undefined);
    flushSync(() => {
      if (dir) setCur(shift(curRef.current, dir));
      setNeighbors(false);
    });
    el.style.transform = "";
    anim.cancel();
    busy.current = false;
  }, []);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (busy.current || !inRange(shift(curRef.current, dir))) return;
      busy.current = true;
      // 이웃 달을 먼저 그린 뒤(다음 화면에) 움직인다
      flushSync(() => setNeighbors(true));
      void slide(dir, 0);
    },
    [slide],
  );

  const jumpTo = useCallback((m: Month) => {
    if (busy.current) return;
    setCur(m);
  }, []);

  // 밀기: 가로로 움직이면 손가락을 따라가고(끝 달에서는 고무줄처럼), 충분히 밀거나 빠르게 튕기면 옆 달로
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let g: { x: number; y: number; lastX: number; lastT: number; v: number; mode: "wait" | "drag" | "scroll"; width: number } | null = null;
    let dx = 0;
    let raf = 0;
    const onStart = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (busy.current || e.touches.length !== 1 || !t0 || t0.clientX < EDGE || t0.clientX > window.innerWidth - EDGE) {
        g = null;
        return;
      }
      g = { x: t0.clientX, y: t0.clientY, lastX: t0.clientX, lastT: e.timeStamp, v: 0, mode: "wait", width: el.clientWidth };
    };
    const onMove = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!g || !t0 || g.mode === "scroll") return;
      const mx = t0.clientX - g.x;
      const my = t0.clientY - g.y;
      if (g.mode === "wait") {
        if (Math.abs(my) > LOCK && Math.abs(my) >= Math.abs(mx)) {
          g.mode = "scroll";
          return;
        }
        if (Math.abs(mx) < LOCK || Math.abs(mx) < Math.abs(my) * 1.2) return;
        g.mode = "drag";
        flushSync(() => setNeighbors(true));
      }
      e.preventDefault();
      const dt = e.timeStamp - g.lastT;
      if (dt > 0) g.v = 0.7 * ((t0.clientX - g.lastX) / dt) + 0.3 * g.v;
      g.lastX = t0.clientX;
      g.lastT = e.timeStamp;
      // 갈 수 없는 달(범위 밖) 쪽은 고무줄처럼 덜 따라온다
      const can = inRange(shift(curRef.current, mx < 0 ? 1 : -1));
      dx = can ? mx : mx * 0.25;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (g?.mode === "drag" && track.current) track.current.style.transform = `translateX(${dx}px)`;
        });
      }
    };
    const onEnd = () => {
      const s = g;
      g = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (!s || s.mode !== "drag") return;
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      const go = Math.abs(dx) > s.width * COMMIT_RATIO || (Math.abs(dx) > 36 && Math.abs(s.v) > FLING && Math.sign(s.v) === Math.sign(dx));
      const from = dx;
      dx = 0;
      busy.current = true;
      void slide(go ? dir : 0, from);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [slide]);

  // 키보드: ← → 로 달 옮기기(입력 칸에 있을 때는 빼고)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const title = locale === "ko" ? `${cur.y}년 ${cur.m}월` : `${monthName(cur.m, locale, true)} ${cur.y}`;
  const pane = (m: Month) => <MonthPane y={m.y} m={m.m} locale={locale} today={today} people={people} t={t} />;

  return (
    <>
      {/* 머리 한 줄: 뒤로 · ‹ 2026년 11월 › · 오늘 */}
      <header className="grid h-[52px] shrink-0 grid-cols-[64px_1fr_64px] items-center pl-1.5 pr-3">
        <Link href="/home" aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="flex items-center justify-center gap-0.5">
          <button type="button" onClick={() => go(-1)} disabled={!inRange(shift(cur, -1))} aria-label={t("cal.prev")} className="flex h-11 w-9 items-center justify-center disabled:opacity-40">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#5B5F78" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 aria-live="polite" aria-label={title} className="hand scribble mx-1 whitespace-nowrap text-[34px] leading-none">
            <span aria-hidden="true" className="mr-[5px] text-[13px] tracking-normal text-muted" style={{ fontFamily: "var(--font-sans)", fontWeight: 400 }}>
              {locale === "ko" ? `${cur.y}년` : cur.y}
            </span>
            <span aria-hidden="true">{locale === "ko" ? `${cur.m}월` : monthName(cur.m, locale, true)}</span>
          </h1>
          <button type="button" onClick={() => go(1)} disabled={!inRange(shift(cur, 1))} aria-label={t("cal.next")} className="flex h-11 w-9 items-center justify-center disabled:opacity-40">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#5B5F78" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={() => jumpTo({ y: today.y, m: today.m })} aria-label={t("cal.thisMonth")} className="relative h-[30px] rounded-full border-[1.5px] border-ink bg-white px-[11px] text-[13px] before:absolute before:-inset-y-2 before:inset-x-0">
            {t("start.today")}
          </button>
        </div>
      </header>

      {/* 달 칸: 미는 동안만 이웃 달(앞·뒤)을 양옆에 같이 그린다. 높이는 지금 달 기준 */}
      <div ref={box} className="relative flex flex-1 flex-col overflow-clip">
        <div ref={track} className="relative flex flex-1 flex-col">
          {neighbors && inRange(shift(cur, -1)) ? (
            <div className="absolute left-0 top-0 w-full -translate-x-full" aria-hidden="true" inert>
              {pane(shift(cur, -1))}
            </div>
          ) : null}
          {pane(cur)}
          {neighbors && inRange(shift(cur, 1)) ? (
            <div className="absolute left-0 top-0 w-full translate-x-full" aria-hidden="true" inert>
              {pane(shift(cur, 1))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

const DASH = { borderColor: "rgba(31,35,64,.10)" } as const;
const DASH_ROW = { borderColor: "rgba(31,35,64,.16)" } as const;

/** 한 줄: 다가오는 날(사람 기념일 또는 공휴일·챙기는 날) */
interface UpRow {
  key: string;
  date: YMD;
  name: string;
  sub: string;
  /** 사람이면 얼굴, 공휴일이면 그림 */
  face: { avatar: CalPerson["avatar"]; label: string } | { art: string | null };
  href: string | null;
  /** 쉬는 날(요일을 빨갛게) */
  off: boolean;
}

/** 한 달: 달력(위가 고리로 묶인 탁상 플래너) + 이 달과 다음 달의 다가오는 날(사람들의 챙길 날 + 공휴일·챙기는 날) */
const MonthPane = memo(function MonthPane({ y, m, locale, today, people, t }: { y: number; m: number; locale: Locale; today: YMD; people: CalPerson[]; t: T }) {
  const first: YMD = { y, m, d: 1 };
  const dim = daysInMonth(y, m);
  const who = (e: UpcomingEvent): CalPerson | null => people.find((p) => p.contactId === e.contactId) ?? null;
  const dates = people.map((p) => ({ contactId: p.contactId, name: p.name, birthday: p.birthday, anniversaries: p.anniversaries }));
  // 그 달 1일부터 말일까지 돌아오는 생일·기념일(사람마다 그 달의 것)
  const events = upcomingEvents(dates, first, dim - 1);

  const start = addDays(first, -weekday(first));
  const weeks = Math.ceil((weekday(first) + dim) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const names = weekdayNames(locale);
  const title = locale === "ko" ? `${y}년 ${m}월` : `${monthName(m, locale, true)} ${y}`;

  // 다가오는 날: 이 달(이번 달이면 오늘부터)과 다음 달. 지난 달을 보면 그 달과 다음 달 전부(지난 것은 흐리게)
  const nextMonthEnd: YMD = { y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: daysInMonth(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1) };
  const from = diffDays(today, first) > 0 ? first : today.y === y && today.m === m ? today : first;
  const span = Math.max(0, diffDays(from, nextMonthEnd));
  const upEvents = upcomingEvents(dates, from, span).filter((e) => diffDays(e.date, nextMonthEnd) >= 0);
  const runs = holidayRuns(from, nextMonthEnd);
  const inRun = (d: YMD) => runs.find((r) => diffDays(r.start, d) >= 0 && diffDays(d, r.end) >= 0) ?? null;
  const specials = [...calendarDays(from.y), ...(nextMonthEnd.y !== from.y ? calendarDays(nextMonthEnd.y) : [])].filter(
    (d) => diffDays(from, d.date) >= 0 && diffDays(d.date, nextMonthEnd) >= 0 && !d.id.endsWith("Around") && (d.off || GIFT_DAYS.has(d.id)),
  );
  const rows: UpRow[] = [
    ...upEvents.map((e): UpRow => {
      const p = who(e);
      const name = eventName(e, t, locale);
      return {
        key: `e-${e.contactId}-${e.kind}-${e.label ?? ""}`,
        date: e.date,
        name,
        sub: e.spec.calendar === "lunar" ? formatSpec(e.spec, locale) : "",
        face: { avatar: p?.avatar ?? null, label: name },
        href: hintHref(e),
        off: false,
      };
    }),
    ...specials.map((d): UpRow => {
      const run = inRun(d.date);
      return {
        key: `d-${d.id}-${ymdKey(d.date)}`,
        date: d.date,
        name: d.name[locale].replace(/\s*\(.*\)$/, ""),
        sub: d.off ? (run ? `${t("cal.dayOff")} · ${t("cal.runDays", { n: run.days })}` : t("cal.dayOff")) : "",
        face: { art: GIFT_DAYS.has(d.id) ? d.id : null },
        href: GIFT_DAYS.has(d.id) && diffDays(today, d.date) >= 0 ? GIFT_HREF : null,
        off: d.off,
      };
    }),
  ].sort((a, b) => diffDays(b.date, a.date));
  const firstUp = rows.findIndex((r) => diffDays(today, r.date) >= 0);

  return (
    <>
      <div className="min-h-4 flex-[0.6_1_0]" />
      <section aria-label={title} className="card relative mx-4 shrink-0 px-1.5 pb-1 pt-[22px]">
        {/* 위에서 묶은 고리 일곱 개(구멍 + 남색 고리) */}
        {[10, 23.3, 36.6, 50, 63.3, 76.6, 90].map((left) => (
          <span key={left} aria-hidden="true">
            <span className="absolute -top-2.5 -ml-[3.5px] h-5 w-[7px] rounded-[4px] bg-ink" style={{ left: `${left}%` }} />
            <span className="absolute top-[5px] -ml-[4.5px] box-border h-[9px] w-[9px] rounded-full border-[1.5px] border-ink bg-paper" style={{ left: `${left}%` }} />
          </span>
        ))}
        <div className="grid h-[22px] grid-cols-[repeat(7,minmax(0,1fr))] items-center text-center text-[11px] font-bold">
          {names.map((n, i) => (
            <span key={n} className={i === 0 ? "text-red" : i === 6 ? "text-sat" : "text-muted"}>
              {n}
            </span>
          ))}
        </div>
        <ol className="grid grid-cols-[repeat(7,minmax(0,1fr))]">
          {cells.map((day) => {
            const inMonth = day.m === m;
            const wd = weekday(day);
            const isToday = sameYmd(day, today);
            const dayEvents = inMonth ? events.filter((e) => sameYmd(e.date, day)) : [];
            const lunar = solarToLunar(day);
            // 공휴일·챙기는 날(쉬는 날이 먼저)
            const marks = daysOn(day);
            const mark = marks[0] ?? null;
            const off = marks.some((x) => x.off);
            const ev = dayEvents[0];
            const evName = ev ? eventName(ev, t, locale) : "";
            // 스티커 글: '엄마 칠순' → '칠순'(이름 뒤의 말만)
            const short = ev ? (ev.name && evName.startsWith(ev.name) ? evName.slice(ev.name.length).trim() || evName : evName) : "";
            return (
              <li key={`${day.m}-${day.d}`} aria-current={isToday ? "date" : undefined} className={`box-border flex h-[52px] flex-col items-center gap-px border-t-[1.5px] border-dashed pt-[3px] ${wd ? "border-l-[1.5px]" : ""} ${inMonth ? "" : "opacity-40"}`} style={DASH}>
                <span
                  className={`hand flex h-[26px] w-[26px] items-center justify-center leading-none ${isToday ? "box-border rounded-full border-[1.5px] border-ink bg-sky text-[20px]" : "text-[22px]"} ${isToday ? "" : wd === 0 || off ? "text-red" : wd === 6 ? "text-sat" : ""}`}
                >
                  {day.d}
                </span>
                {ev ? (
                  <span className="flex max-w-full items-center gap-0.5 rounded-[3px] bg-[#F9CBD5] py-px pl-px pr-[3px]" style={{ transform: "rotate(-3deg)" }}>
                    <span aria-hidden="true" className="shrink-0">
                      <Avatar config={who(ev)?.avatar ?? null} size={14} label={evName} decorative />
                    </span>
                    <span className="sr-only">{evName}</span>
                    <span aria-hidden="true" className="truncate text-[10px] font-bold leading-[1.2]">
                      {short}
                      {dayEvents.length > 1 ? ` +${dayEvents.length - 1}` : ""}
                    </span>
                  </span>
                ) : mark ? (
                  <span className={`max-w-full truncate whitespace-nowrap px-px text-[9.5px] leading-[1.2] ${mark.off ? "text-red" : "text-muted"}`}>{mark.short[locale]}</span>
                ) : isToday && lunar ? (
                  <span className="whitespace-nowrap text-[9.5px] leading-[1.2] text-muted">{locale === "ko" ? `음 ${lunar.leap ? "윤" : ""}${lunar.m}.${lunar.d}` : `L ${lunar.m}.${lunar.d}`}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="min-h-[38px] flex-[1.2_1_0]" />
      <section aria-labelledby={`up-${y}-${m}`} className="card relative mx-4 flex shrink-0 flex-col px-3.5 pb-0.5 pt-2">
        <span className="pointer-events-none absolute right-[18px] -top-[33px]">
          <Mascot pose={12} size={40.7} />
        </span>
        <div className="flex h-[34px] items-center">
          <h2 id={`up-${y}-${m}`} className="hand scribble whitespace-nowrap text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
            {t("home.upcoming")}
          </h2>
        </div>
        {rows.length ? (
          <ul className="mt-1">
            {rows.map((r, i) => {
              const left = diffDays(today, r.date);
              const badge = left === 0 ? t("start.today") : left > 0 ? `D-${left}` : t("cal.passed");
              const lead = i === firstUp;
              const body = (
                <>
                  <span className={`flex w-[38px] shrink-0 flex-col items-center leading-none ${left < 0 ? "opacity-55" : ""}`}>
                    <span className="hand text-[22px]">{formatDotted(r.date)}</span>
                    <span className={`mt-0.5 text-[10px] ${weekday(r.date) === 0 || r.off ? "text-red" : "text-muted"}`}>{names[weekday(r.date)]}</span>
                  </span>
                  {"avatar" in r.face ? (
                    <span className={`flex shrink-0 ${left < 0 ? "opacity-55" : ""}`}>
                      <Avatar config={r.face.avatar} size={30} label={r.face.label} decorative />
                    </span>
                  ) : (
                    <span aria-hidden="true" className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-[#E3F4EC] ${left < 0 ? "opacity-55" : ""}`}>
                      {r.face.art ? <HolidayArt id={r.face.art as HolidayId} size={22} /> : <Icon name="calendar" size={16} strokeWidth={1.8} />}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`hand-written truncate text-[24px] leading-none ${left < 0 ? "text-muted" : ""}`}>{r.name}</span>
                    {r.sub ? <span className="truncate text-[11px] text-muted">{r.sub}</span> : null}
                  </span>
                  <span className={`hand inline-flex h-[26px] shrink-0 items-center rounded-full border-[1.5px] border-ink px-[9px] leading-none ${left < 0 ? "bg-[#ece7d8] text-[16px] text-muted" : lead ? "bg-sky text-[20px]" : "bg-white text-[18px]"}`}>{badge}</span>
                </>
              );
              const row = "flex h-[46px] items-center gap-2.5";
              return (
                <li key={r.key} className={i ? "border-t-[1.5px] border-dashed" : ""} style={i ? DASH_ROW : undefined}>
                  {r.href ? (
                    <Link href={r.href} className={row}>
                      {body}
                    </Link>
                  ) : (
                    <div className={row}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col gap-0.5 pb-2 pt-1">
            <span className="text-[15px]">{t("cal.upcomingEmpty")}</span>
            <Link href="/request" className="flex min-h-11 items-center gap-0.5 self-start text-[15px] text-accent">
              {t("home.askDates")}
              <Chev size={14} color="currentColor" />
            </Link>
          </div>
        )}
      </section>
      <div className="min-h-2 flex-1" />
    </>
  );
});
