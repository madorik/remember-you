"use client";

import {
  addDays,
  calendarDays,
  daysInMonth,
  daysOn,
  diffDays,
  formatDayFull,
  formatMonthDay,
  formatSpec,
  holidayRuns,
  monthName,
  sameYmd,
  solarToLunar,
  upcomingEvents,
  weekday,
  weekdayNames,
  ymdKey,
  type Locale,
  type UpcomingEvent,
  type YMD,
} from "@readme/core";
import Link from "@/components/AppLink";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Avatar } from "@/components/Avatar";
import { HandCircle, Heart, Sparkle, SKY_STAR, Squiggle, Star, Tape } from "@/components/diary";
import { FaceStack } from "@/components/FaceStack";
import { Icon } from "@/components/marks";
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

/** 선물을 챙기는 날(명절·크리스마스·어버이날 같은 홈의 '챙기는 날'): 누르면 사람을 골라 선물 고르기로 */
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
  const isThisMonth = cur.y === today.y && cur.m === today.m;

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

  const first: YMD = { y: cur.y, m: cur.m, d: 1 };
  const last: YMD = { y: cur.y, m: cur.m, d: daysInMonth(cur.y, cur.m) };
  const title = locale === "ko" ? `${cur.y}년 ${cur.m}월` : `${monthName(cur.m, locale, true)} ${cur.y}`;
  const lf = solarToLunar(first);
  const ll = solarToLunar(last);
  const lunarRange = lf && ll ? (lf.m === ll.m ? `${lf.m}` : `${lf.m}–${ll.m}`) : "";
  const pane = (m: Month) => <MonthPane y={m.y} m={m.m} locale={locale} today={today} people={people} t={t} />;

  return (
    <>
      <div className="flex min-h-11 items-center justify-between px-3">
        <Link href="/home" aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center">
          <Icon name="back" size={24} />
        </Link>
        {isThisMonth ? (
          <span className="w-11" />
        ) : (
          <button type="button" onClick={() => jumpTo({ y: today.y, m: today.m })} className="pill relative !h-9 !px-3.5 text-[15px] before:absolute before:-inset-y-1 before:inset-x-0">
            {t("cal.thisMonth")}
          </button>
        )}
      </div>

      <div className="relative flex items-center justify-between px-3 pt-1">
        <button type="button" onClick={() => go(-1)} disabled={!inRange(shift(cur, -1))} aria-label={t("cal.prev")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_var(--color-edge)] disabled:opacity-40">
          <Icon name="back" size={20} strokeWidth={2} />
        </button>
        <div className="flex flex-col items-center gap-0.5" aria-live="polite">
          <h1 className="hl px-1 text-[31px] leading-[1.15]">{title}</h1>
          {lunarRange ? <span className="text-[15px] text-muted">{t("cal.lunar", { m: lunarRange })}</span> : null}
        </div>
        <button type="button" onClick={() => go(1)} disabled={!inRange(shift(cur, 1))} aria-label={t("cal.next")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_var(--color-edge)] disabled:opacity-40">
          <Icon name="chevron" size={20} strokeWidth={2} />
        </button>
        <Star size={20} rotate={-14} className="left-[76px] top-0.5" />
      </div>

      {/* 달 칸: 미는 동안만 이웃 달(앞·뒤)을 양옆에 같이 그린다. 높이는 지금 달 기준 */}
      <div ref={box} className="relative mt-5 overflow-clip">
        <div ref={track} className="relative">
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

      <div className="h-6" />
    </>
  );
}

/** 한 달: 달력 + 이 달의 공휴일·챙기는 날 + 이 달의 챙길 날(사람들) */
const MonthPane = memo(function MonthPane({ y, m, locale, today, people, t }: { y: number; m: number; locale: Locale; today: YMD; people: CalPerson[]; t: T }) {
  const first: YMD = { y, m, d: 1 };
  const dim = daysInMonth(y, m);
  const last: YMD = { y, m, d: dim };
  const who = (e: UpcomingEvent): CalPerson | null => people.find((p) => p.contactId === e.contactId) ?? null;
  // 그 달 1일부터 말일까지 돌아오는 생일·기념일(사람마다 그 달의 것)
  const events = upcomingEvents(people.map((p) => ({ contactId: p.contactId, name: p.name, birthday: p.birthday, anniversaries: p.anniversaries })), first, dim - 1);

  const start = addDays(first, -weekday(first));
  const weeks = Math.ceil((weekday(first) + dim) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const names = weekdayNames(locale);
  const title = locale === "ko" ? `${y}년 ${m}월` : `${monthName(m, locale, true)} ${y}`;

  // 연휴(사흘 이상 쉬는 덩이): 달력 칸에 옅은 바탕을 깔고, 아래 목록에 한 줄로
  const runs = holidayRuns(cells[0]!, cells[cells.length - 1]!);
  const runDays = new Set(runs.flatMap((r) => Array.from({ length: r.days }, (_, k) => ymdKey(addDays(r.start, k)))));
  const monthRuns = runs.filter((r) => diffDays(r.end, first) <= 0 && diffDays(r.start, last) >= 0);
  // 이 달의 공휴일·챙기는 날(연휴 앞뒤 날은 연휴 줄로 갈음하고 낱낱이 적지 않는다)
  const specials = calendarDays(y).filter((d) => d.date.m === m && !d.id.endsWith("Around"));

  return (
    <div>
      <section aria-label={title} className="card relative mx-4 px-2 pb-2 pt-4">
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] pb-1.5 text-center text-[16px]">
          {names.map((n, i) => (
            <span key={n} className={i === 0 ? "text-red" : i === 6 ? "text-sat" : "text-muted"}>
              {n}
            </span>
          ))}
        </div>
        <ol className="grid grid-cols-[repeat(7,minmax(0,1fr))]">
          {cells.map((day, i) => {
            const inMonth = day.m === m;
            const wd = weekday(day);
            const isToday = sameYmd(day, today);
            const dayEvents = inMonth ? events.filter((e) => sameYmd(e.date, day)) : [];
            const past = diffDays(today, day) < 0;
            const lunar = solarToLunar(day);
            // 공휴일·챙기는 날(쉬는 날이 먼저)
            const marks = daysOn(day);
            const mark = marks[0] ?? null;
            const off = marks.some((x) => x.off);
            const rest = runDays.has(ymdKey(day));
            return (
              <li key={`${day.m}-${day.d}`} className={`flex h-[76px] flex-col items-center gap-px border-dashed border-rule pt-[5px] ${i >= 7 ? "border-t" : ""} ${wd ? "border-l" : ""} ${inMonth ? "" : "opacity-40"} ${rest ? "bg-red-soft/60" : ""}`}>
                <span
                  className={`num relative flex h-[30px] w-[34px] items-center justify-center rounded-full text-[20px] ${
                    isToday ? "" : dayEvents.length ? (past ? "bg-postit/60" : "bg-postit") : ""
                  } ${(wd === 0 || off) && !isToday ? "text-red" : wd === 6 && !isToday ? "text-sat" : ""}`}
                >
                  {isToday ? <HandCircle w={40} h={36} className="-left-[3px] -top-[3px]" /> : null}
                  {day.d}
                </span>
                {mark ? (
                  <span className={`max-w-full truncate whitespace-nowrap px-px text-[11px] leading-[14px] tracking-[-0.04em] ${mark.off ? "text-red" : "text-ink-2"}`}>{mark.short[locale]}</span>
                ) : (
                  <span className={`num whitespace-nowrap text-[12px] leading-[14px] text-muted ${lunar?.leap ? "tracking-[-0.05em]" : ""}`}>{lunar ? `${lunar.leap ? "윤" : ""}${lunar.m}.${lunar.d}` : ""}</span>
                )}
                <span className={`relative flex h-[26px] items-center justify-center ${past ? "opacity-50" : ""}`}>
                  <FaceStack faces={dayEvents.map((e) => ({ key: `${e.contactId}-${e.kind}-${e.label ?? ""}`, avatar: who(e)?.avatar ?? null, label: eventName(e, t, locale) }))} size={25} />
                  {dayEvents.length ? <Heart size={13} rotate={14} className="-top-[5px] right-0.5" /> : null}
                </span>
              </li>
            );
          })}
        </ol>
        <Tape color="pink" className="-left-2.5 -top-1.5" />
        <Tape color="mint" className="-bottom-1 -right-2.5" />
        <Heart size={24} rotate={16} className="-right-2 top-10" />
        <Squiggle w={54} width={2.4} className="-bottom-2 left-[70px]" />
        <Sparkle size={18} className="-left-1.5 bottom-[120px]" />
      </section>

      {monthRuns.length || specials.length ? (
        <section aria-label={t("cal.holidays")} className="relative mx-4 mt-[26px]">
          <div className="flex items-center gap-2.5 pb-2.5 pl-1.5">
            <h2 className="text-[22px]">{t("cal.holidays")}</h2>
          </div>
          <div className="card relative px-3.5 py-1">
            <ul className="flex flex-col">
              {monthRuns.map((r) => (
                <li key={`run-${ymdKey(r.start)}`} className="flex min-h-[56px] items-center gap-3 border-t border-dashed border-rule first-of-type:border-t-0">
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[19px] leading-[1.25]">{r.title[locale]}</span>
                    <span className="truncate text-[15px] text-muted">
                      {formatMonthDay(r.start, locale)} – {formatMonthDay(r.end, locale)}
                    </span>
                  </span>
                  <span className="num shrink-0 rounded-full bg-red-soft px-3 pb-1 pt-[3px] text-[15px] text-red shadow-[inset_0_0_0_1.5px_var(--color-red)]">{t("cal.runDays", { n: r.days })}</span>
                </li>
              ))}
              {specials.map((d) => {
                const left = diffDays(today, d.date);
                const badge = left === 0 ? t("start.today") : left > 0 ? `D-${left}` : t("cal.passed");
                const gift = GIFT_DAYS.has(d.id);
                const body = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className={`truncate text-[19px] leading-[1.25] ${left < 0 ? "text-muted" : ""}`}>{d.name[locale]}</span>
                      <span className="truncate text-[15px] text-muted">{formatDayFull(d.date, locale)}</span>
                    </span>
                    {d.off ? <span className="shrink-0 rounded-full bg-red-soft px-2.5 pb-px text-[14px] text-red">{t("cal.dayOff")}</span> : null}
                    <span className={`num shrink-0 rounded-full px-3 pb-1 pt-[3px] text-[15px] shadow-[inset_0_0_0_1.5px_var(--color-ink)] ${left < 0 ? "bg-[#ece7d8]" : "bg-[#ffe4a3]"}`}>{badge}</span>
                  </>
                );
                const row = "flex min-h-[56px] items-center gap-3";
                return (
                  <li key={`${d.id}-${ymdKey(d.date)}`} className="border-t border-dashed border-rule first-of-type:border-t-0">
                    {gift && left >= 0 ? (
                      <Link href={GIFT_HREF} className={row}>
                        {body}
                      </Link>
                    ) : (
                      <div className={row}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-label={t("cal.events")} className="relative mx-4 mt-[26px]">
        <div className="flex items-center gap-2.5 pb-2.5 pl-1.5">
          <h2 className="text-[22px]">{t("cal.events")}</h2>
          <span className="num -rotate-3 rounded-full bg-[#fff0c9] px-[11px] pb-[3px] pt-0.5 text-[16px] shadow-[inset_0_0_0_1.5px_var(--color-ink)]">{events.length}</span>
        </div>
        {events.length ? (
          <div className="card relative px-3.5 py-1">
            <Tape color="mango" w={84} h={22} rotate={4} alpha={0.62} className="-top-[11px] right-[34px]" />
            <ul className="flex flex-col">
              {(() => {
                const firstUp = events.findIndex((e) => diffDays(today, e.date) >= 0);
                return events.map((e, i) => {
                  const p = who(e);
                  const name = eventName(e, t, locale);
                  const left = diffDays(today, e.date);
                  const badge = left === 0 ? t("start.today") : left > 0 ? `D-${left}` : t("cal.passed");
                  return (
                    <li key={`${e.contactId}-${e.kind}-${e.label ?? ""}`} className="border-t border-dashed border-rule first-of-type:border-t-0">
                      <Link href={hintHref(e)} className="flex min-h-[70px] items-center gap-3">
                        <span className={`flex shrink-0 ${left < 0 ? "opacity-55" : ""}`}>
                          <Avatar config={p?.avatar ?? null} size={46} label={name} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                          <span className="truncate text-[20px] leading-[1.25]">{name}</span>
                          <span className="truncate text-[15px] text-muted">
                            {e.spec.calendar === "lunar" ? `${formatSpec(e.spec, locale)}${t("common.and")}` : ""}
                            {formatDayFull(e.date, locale)}
                          </span>
                        </span>
                        <span
                          className={`num shrink-0 rounded-full px-3 pb-1 pt-[3px] text-[16px] shadow-[inset_0_0_0_1.5px_var(--color-ink)] ${left < 0 ? "bg-[#ece7d8]" : i === firstUp ? "bg-sky" : "bg-[#ffe4a3]"}`}
                          style={left >= 0 ? { transform: `rotate(${i === firstUp ? -4 : 3}deg)` } : undefined}
                        >
                          {badge}
                        </span>
                      </Link>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        ) : (
          <div className="card flex flex-col gap-1 px-5 py-5">
            <span className="text-[18px]">{t("cal.empty")}</span>
            <Link href="/request" className="flex min-h-11 items-center gap-0.5 self-start text-[17px] text-accent">
              {t("home.askDates")}
              <Icon name="chevron" size={16} strokeWidth={2.2} />
            </Link>
          </div>
        )}
        {events.length ? <Star size={22} rotate={12} color={SKY_STAR} className="-right-[5px] top-[30px]" /> : null}
      </section>
    </div>
  );
});
