"use client";

import {
  SPEC_YEAR_MIN,
  yearsAt,
  zodiacOf,
  addDays,
  daysInMonth,
  formatDateLong,
  formatDayFull,
  isOnceSpec,
  occurrences,
  onceSpec,
  parseYmd,
  solarToLunar,
  todayIn,
  weekday,
  weekdayNames,
  diffDays,
  ymdKey,
  type DateSpec,
  type DatesData,
  type Locale,
  type YMD,
} from "@readme/core";
import { useMemo, useState } from "react";
import { Icon, MarkerCircle } from "../marks";
import { useLatest, useUndoToast } from "../UndoToast";
import { SectionHeading, UNDERLINE_INPUT, useT } from "./shared";

// 설정·온보딩이 예전 자리에서 가져오던 ReminderPicker는 자기 파일로 옮겼다(그대로 쓸 수 있게 다시 내보낸다)
export { ReminderPicker } from "./ReminderPicker";

/** 아직 월·일을 다 고르지 않은 날짜(둘 다 골라야 값이 된다) */
type Draft = Partial<DateSpec>;

export function useToday(): YMD {
  // 시간대는 기기 기준(서버와 하루 차이 날 수 있는 자정 근처도 사용자가 보는 날짜로 맞춘다)
  return useMemo(() => todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul"), []);
}

/**
 * 날짜 하나를 고르는 상태: 월·일을 둘 다 골라야 onChange(날짜)가 불린다(없던 1월 1일을 만들지 않는다).
 * 값이 없는 동안 고르고 있는 것(월만 고른 상태 등)은 draft에 두고, 다 고른 값이 불완전해지면 onChange(null)
 */
export function useSpecDraft(value: DateSpec | null, onChange: (v: DateSpec | null) => void) {
  const [draft, setDraft] = useState<Draft>({});
  const spec: Draft = value ?? draft;
  const capOf = (s: Draft) => (s.calendar === "lunar" ? 30 : s.month ? daysInMonth(s.year ?? 2024, s.month) : 31);
  const maxDay = capOf(spec);
  const set = (patch: Draft) => {
    const next: Draft = { ...spec, ...patch };
    if (next.year === undefined) delete next.year;
    if (next.calendar === "solar") delete next.leap;
    if (next.day !== undefined) next.day = Math.min(next.day, capOf(next));
    if (next.month !== undefined && next.day !== undefined) {
      setDraft({});
      const done: DateSpec = { calendar: next.calendar ?? "solar", month: next.month, day: next.day };
      if (next.leap) done.leap = true;
      if (next.year !== undefined) done.year = next.year;
      onChange(done);
      return;
    }
    setDraft(next);
    if (value) onChange(null);
  };
  return { spec, set, maxDay };
}

/**
 * 양력/음력 + (연도) + 월·일 + 윤달. 음력이면 올해·내년 양력 날짜를 바로 보여 준다.
 * year를 주면 연도 칸(몰라도 됨)을 보여 준다: birth = 태어난 해(만 나이·띠), since = 시작한 해(N주년)
 * value가 null이면 '–'로 비어 있고, 월과 일을 둘 다 골라야 onChange(날짜)가 불린다(없던 1월 1일을 만들지 않는다).
 * 다 고른 값이 불완전해지면(예: 부모가 비우면) onChange(null)
 */
export function DateSpecPicker({
  value,
  onChange,
  locale,
  preview = true,
  year,
}: {
  value: DateSpec | null;
  onChange: (v: DateSpec | null) => void;
  locale: Locale;
  preview?: boolean;
  year?: "birth" | "since";
}) {
  const t = useT(locale);
  const { spec, set, maxDay } = useSpecDraft(value, onChange);
  const today = useToday();
  const yearLabel = year === "birth" ? t("dates.birthYear") : year === "since" ? t("dates.sinceYear") : "";
  const years = Array.from({ length: today.y - SPEC_YEAR_MIN + 1 }, (_, i) => today.y - i);
  const list = value ? occurrences(value, today, 3) : [];
  const first = list[0];
  const left = first ? diffDays(today, first) : null;
  const leftText = left == null ? "" : left === 0 ? (locale === "ko" ? "오늘이에요" : "today") : locale === "ko" ? `${left}일 남았어요` : `in ${left} days`;
  const selectClass = "num h-14 w-full appearance-none rounded-xl bg-transparent text-center text-[34.9px] outline-none";

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={`${t("dates.solar")} / ${t("dates.lunar")}`} className="flex w-40 gap-0.5 rounded-xl border border-edge bg-white p-[2.7px]">
        {(["solar", "lunar"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={spec.calendar === c}
            onClick={() => set({ calendar: c })}
            className={`h-[30.6px] flex-1 whitespace-nowrap rounded-[8.1px] text-[12.6px] ${spec.calendar === c ? "bg-sky" : ""}`}
          >
            {t(c === "solar" ? "dates.solar" : "dates.lunar")}
          </button>
        ))}
      </div>

      {yearLabel ? (
        <label className="flex items-center gap-2.5">
          <span className="shrink-0 text-[11.7px] text-muted">{yearLabel}</span>
          <span className="relative flex">
            <select
              aria-label={yearLabel}
              value={spec.year ?? ""}
              onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : undefined })}
              className="num h-[30.6px] appearance-none rounded-[9px] border border-edge bg-white pl-2.5 pr-7 text-[16px] outline-none"
            >
              <option value="">{t("dates.yearUnknown")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={14} strokeWidth={2} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-90" />
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex items-baseline gap-1">
          <span className="w-[63px] rounded-xl border border-edge bg-white">
            <select aria-label={t("dates.month")} value={spec.month ?? ""} onChange={(e) => e.target.value && set({ month: Number(e.target.value) })} className={selectClass}>
              {spec.month === undefined ? <option value="">–</option> : null}
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </span>
          <span className="text-[12.6px]">{locale === "ko" ? "월" : "/"}</span>
        </label>
        <label className="flex items-baseline gap-1">
          <span className="w-[63px] rounded-xl border border-edge bg-white">
            <select aria-label={t("dates.day")} value={spec.day ?? ""} onChange={(e) => e.target.value && set({ day: Number(e.target.value) })} className={selectClass}>
              {spec.day === undefined ? <option value="">–</option> : null}
              {Array.from({ length: maxDay }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </span>
          {locale === "ko" ? <span className="text-[12.6px]">일</span> : null}
        </label>
        {spec.calendar === "lunar" ? (
          <label className="flex min-h-11 items-center gap-1.5 whitespace-nowrap text-[11.7px]">
            <input type="checkbox" checked={!!spec.leap} onChange={(e) => set({ leap: e.target.checked })} className="h-[16.2px] w-[16.2px] accent-[var(--color-ink)]" />
            {t("dates.leap")}
          </label>
        ) : null}
      </div>
      {value?.leap ? <p className="text-[11.7px] leading-[1.5] text-muted">{t("dates.leapNote", { m: value.month, d: value.day })}</p> : null}

      {preview && value && first ? (
        <div className="flex flex-col">
          {value.calendar === "lunar" ? <WeekOf day={first} locale={locale} /> : null}
          <p className="mb-1.5 mt-2 -rotate-[0.6deg] rounded-[3.2px_3.2px_11.3px_3.2px] border border-edge bg-[#FFF3B0] px-3 py-[8.1px] text-[12.6px] leading-[1.45]">
            {value.calendar === "lunar"
              ? t("dates.thisYearLunar", { date: formatDayFull(first, locale), left: leftText })
              : t("dates.nextSolar", { date: formatDateLong(first, locale), left: leftText })}
          </p>
          {yearLabel && value.year ? (
            <p className="-mt-0.5 mb-1.5 text-[11.7px] text-muted">
              {[
                (() => {
                  const n = yearsAt(value, first);
                  return n != null && n > 0 ? (year === "birth" ? t("dates.turns", { n }) : t("dates.years", { n })) : "";
                })(),
                year === "birth" && zodiacOf(value) ? t("dates.zodiac", { animal: zodiacOf(value)![locale] }) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {list.slice(1).map((d) => (
            <div key={`${d.y}`} className="flex min-h-[34.2px] items-center justify-between border-t border-dashed border-ink/30 text-[12.6px]">
              <span className="num text-[13.6px] text-muted">{d.y}</span>
              <span>{formatDayFull(d, locale)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 그 날이 든 한 주, 그 날에 빨간 동그라미 */
function WeekOf({ day, locale }: { day: YMD; locale: Locale }) {
  const start = addDays(day, -weekday(day));
  const names = weekdayNames(locale);
  return (
    <div aria-hidden="true">
      <div className="grid grid-cols-7 pb-1 text-center text-[10.8px]">
        {names.map((n, i) => (
          <span key={n} className={i === 0 ? "text-red" : i === 6 ? "text-sat" : "text-muted"}>
            {n}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 border-y border-dashed border-ink/30 text-center">
        {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d, i) => {
          const on = d.m === day.m && d.d === day.d;
          const lunar = solarToLunar(d);
          return (
            <div key={i} className="flex flex-col items-center gap-1 pb-2 pt-1.5">
              <span className={`num relative text-[18.7px] ${on ? "text-accent" : i === 0 ? "text-red" : i === 6 ? "text-sat" : ""}`}>
                {d.d}
                {on ? <MarkerCircle pad={[12, 7]} width={2.6} /> : null}
              </span>
              <span className={`text-[10.8px] ${on ? "text-accent" : "text-muted"}`}>{lunar ? `${lunar.m}.${lunar.d}` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Anniversary = DatesData["anniversaries"][number];

/** 생일 + 기념일(내 리드미 편집용) */
export function DatesEditor({ value, onChange, locale }: { value: DatesData; onChange: (v: DatesData) => void; locale: Locale }) {
  const t = useT(locale);
  const [open, setOpen] = useState<number | null>(null);
  // 새 기념일은 날짜를 다 고를 때까지 목록(과 저장) 밖에 둔다
  const [pending, setPending] = useState<{ label: string; spec: DateSpec | null } | null>(null);
  const latest = useLatest({ value, onChange });
  const undo = useUndoToast(locale);
  const list = value.anniversaries;
  const rows: { label: string; spec: DateSpec | null; once?: true }[] = pending ? [...list, pending] : list;

  const setLabel = (i: number, label: string) => {
    if (i < list.length) onChange({ ...value, anniversaries: list.map((x, j) => (j === i ? { ...x, label } : x)) });
    else setPending((p) => (p ? { ...p, label } : p));
  };
  const setSpec = (i: number, spec: DateSpec | null) => {
    if (!spec) return;
    if (i < list.length) {
      onChange({ ...value, anniversaries: list.map((x, j) => (j === i ? { ...x, spec } : x)) });
      return;
    }
    if (!pending) return;
    // 날짜가 정해졌으니 이제 목록에 들어가 저장된다
    onChange({ ...value, anniversaries: [...list, { label: pending.label, spec }] });
    setPending(null);
    setOpen(i);
  };
  const remove = (i: number) => {
    if (i >= list.length) {
      setPending(null);
      return;
    }
    const gone: Anniversary = list[i]!;
    setOpen((o) => (o === i ? null : o != null && o > i ? o - 1 : o));
    onChange({ ...value, anniversaries: list.filter((_, j) => j !== i) });
    // 되돌리기: 그사이 고친 것은 두고 지운 것만 제자리에 다시 넣는다
    undo.show({
      onUndo: () => {
        const cur = latest.current.value;
        const at = Math.min(i, cur.anniversaries.length);
        latest.current.onChange({ ...cur, anniversaries: [...cur.anniversaries.slice(0, at), gone, ...cur.anniversaries.slice(at)] });
      },
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 pb-3.5 pt-3">
        <SectionHeading>{t("dates.birthday")}</SectionHeading>
        <DateSpecPicker value={value.birthday} onChange={(birthday) => onChange({ ...value, birthday })} locale={locale} year="birth" />
      </div>
      <div className="flex flex-col gap-2 border-t border-dashed border-ink/30 pb-1.5 pt-3">
        {/* 기념일 제목 줄 오른쪽에 추가 버튼 */}
        <div className="flex min-h-9 items-center justify-between">
          <SectionHeading>{t("dates.anniversaries")}</SectionHeading>
          {list.filter((a) => !a.once).length < 10 && !pending ? (
            <button
              type="button"
              onClick={() => {
                setPending({ label: "", spec: null });
                setOpen(null);
              }}
              className="relative flex h-[27px] items-center gap-[4.5px] rounded-full border border-edge bg-sky-soft pl-2.5 pr-3.5 text-[10.8px] before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']"
            >
              <Icon name="plus" size={14} strokeWidth={1.8} />
              {t("dates.addAnniversary")}
            </button>
          ) : null}
        </div>
        {rows.map((a, i) => {
          const isNew = i >= list.length;
          return (
            <div key={i} className="flex flex-col gap-2 pt-1">
              <div className="flex items-end gap-2.5">
                <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[10.8px] text-muted">{t("dates.anniversaryLabel")}</span>
                  <input value={a.label} onChange={(e) => setLabel(i, e.target.value)} placeholder={t("dates.anniversaryPlaceholder")} className={`${UNDERLINE_INPUT} h-10 text-[22.5px]`} />
                </label>
                {!isNew && a.once && isOnceSpec(a.spec) ? (
                  // 한 번만 있는 날(약속): 연·월·일을 직접 고친다
                  <input
                    type="date"
                    value={ymdKey({ y: a.spec.year, m: a.spec.month, d: a.spec.day })}
                    aria-label={`${a.label} ${t("common.edit")}`}
                    onChange={(e) => {
                      const v = parseYmd(e.target.value);
                      if (v) onChange({ ...value, anniversaries: list.map((x, j) => (j === i ? { ...x, spec: onceSpec(v) } : x)) });
                    }}
                    className="hand h-10 shrink-0 bg-transparent text-[17px] leading-none"
                  />
                ) : !isNew && open !== i ? (
                  <button
                    type="button"
                    onClick={() => setOpen(i)}
                    aria-label={`${a.spec!.calendar === "lunar" ? `${t("dates.lunar")} ` : ""}${a.spec!.month}.${a.spec!.day} ${t("common.edit")}`}
                    className="hand flex h-10 shrink-0 items-center whitespace-nowrap text-[19.4px] leading-none"
                  >
                    {a.spec!.calendar === "lunar" ? `${t("dates.lunar")} ` : ""}
                    {locale === "ko" ? `${a.spec!.month}월 ${a.spec!.day}일` : `${a.spec!.month}/${a.spec!.day}`}
                  </button>
                ) : null}
                <button type="button" aria-label={t("common.delete")} onClick={() => remove(i)} className="flex h-10 w-8 shrink-0 items-center justify-center text-muted">
                  <Icon name="close" size={18} strokeWidth={1.8} />
                </button>
              </div>
              {isNew || open === i ? <DateSpecPicker value={a.spec} onChange={(spec) => setSpec(i, spec)} locale={locale} preview={false} year="since" /> : null}
            </div>
          );
        })}
      </div>
      {undo.toast}
    </div>
  );
}
