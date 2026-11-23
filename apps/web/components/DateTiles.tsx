import { ageLine, formatDayFull, formatSpec, milestoneOf, monthName, nextOccurrence, weekdayLong, yearsAt, type DatesData, type Locale, type YMD } from "@readme/core";
import type { T } from "@/lib/i18n";

/** 한 장 뜯어 쓰는 작은 달력(시안 Q-Person 46×54): 위 망고 띠에 달, 아래 큰 날, 위에 고리 두 개. 한 달 안이면 띠가 망고 */
export function CalendarLeaf({ m, d, soon, locale }: { m: number; d: number; soon: boolean; locale: Locale }) {
  return (
    <span aria-hidden="true" className="relative block h-[48.6px] w-[41.4px] shrink-0">
      <span className="absolute left-0 top-[2.7px] flex h-[45.9px] w-[41.4px] flex-col overflow-hidden rounded-[8.1px] border border-edge bg-white">
        <span className={`flex h-[14.4px] shrink-0 items-center justify-center border-b-[1.35px] border-ink text-[9.9px] leading-none ${soon ? "bg-sky" : "bg-fill"}`}>{monthName(m, locale)}</span>
        <span className="hand flex flex-1 items-center justify-center text-[25.2px] leading-none">{d}</span>
      </span>
      <span className="absolute left-[7.2px] top-0 h-[8.1px] w-[3.6px] rounded-[2.7px] bg-ink" />
      <span className="absolute left-[30.6px] top-0 h-[8.1px] w-[3.6px] rounded-[2.7px] bg-ink" />
    </span>
  );
}

/** 생일·기념일: 날마다 한 칸(작은 달력 + 이름 + 요일·음력 + 나이·주년 + D-day 알약). 한 달 안이면 칸이 연노랑, 아니면 흰 칸 + 선 */
export function DateTiles({ dates, today, locale, t }: { dates: DatesData | undefined; today: YMD; locale: Locale; t: T }) {
  const items = [
    ...(dates?.birthday ? [{ label: t("dates.birthday"), spec: dates.birthday, birth: true }] : []),
    ...(dates?.anniversaries ?? []).map((a) => ({ label: a.label, spec: a.spec, birth: false })),
  ].slice(0, 4);
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-[7.2px]">
      {items.map((item, i) => {
        const next = nextOccurrence(item.spec, today);
        const soon = !!next && next.daysUntil <= 30;
        // 생일은 칠순·돌 같은 뜻 있는 해에 '칠순 생일'처럼
        const milestone = item.birth && next ? milestoneOf(yearsAt(item.spec, next.date)) : null;
        const label = milestone ? (locale === "ko" ? `${milestone.ko} ${t("dates.birthday")}` : milestone.en) : item.label;
        const when = next
          ? [item.spec.calendar === "lunar" ? formatSpec(item.spec, locale) : null, weekdayLong(next.date, locale)].filter(Boolean).join(" · ")
          : formatSpec(item.spec, locale);
        const years = !item.spec.year
          ? null
          : item.birth
            ? ageLine(item.spec, today, locale)
            : (() => {
                const n = next ? yearsAt(item.spec, next.date) : null;
                return n != null && n > 0 ? `${item.spec.year} · ${t("dates.years", { n })}` : String(item.spec.year);
              })();
        return (
          <li key={i} className={`flex items-center gap-[10.8px] rounded-[10.8px] px-[10.8px] py-[9px] ${soon ? "bg-sky-soft" : "border border-edge bg-white"}`}>
            <CalendarLeaf m={next ? next.date.m : item.spec.month} d={next ? next.date.d : item.spec.day} soon={soon} locale={locale} />
            <div className="flex min-w-0 flex-1 flex-col gap-[2.7px]">
              <span className="hand line-clamp-2 text-[20.7px] leading-[1.1]">{label}</span>
              {next ? <span className="sr-only">{formatDayFull(next.date, locale)}</span> : null}
              <span className="truncate text-[10.8px] text-muted">{when}</span>
              {years ? <span className="truncate text-[10.8px] text-muted">{years}</span> : null}
            </div>
            {next ? (
              <span className={`hand inline-flex h-[23.4px] shrink-0 items-center rounded-full border border-edge px-[8.1px] text-[15.3px] leading-none ${soon ? "bg-sky" : "bg-white"}`}>
                {next.daysUntil === 0 ? t("start.today") : `D-${next.daysUntil}`}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
