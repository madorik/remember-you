"use client";

import { SPEC_YEAR_MIN, daysInMonth, diffDays, formatDateLong, formatDayFull, occurrences, type DateSpec, type DatesData, type Locale } from "@readme/core";
import { useState } from "react";
import { CuteTopicIcon } from "@/components/CuteTopicIcon";
import { useSpecDraft, useToday } from "@/components/editors/DatesEditor";
import { useT } from "@/components/editors/shared";
import { Icon } from "@/components/marks";

// 받는 사람 화면의 생일·기념일 칸(시안 '답하기 · 생일'): 책상 달력 잎사귀 두 장(월·일)에 큰 손글씨 숫자 + 올해 생일 결과 줄 + 기념일 더하기.
// 잎사귀는 겉모양이고, 그 위에 진짜 <select>를 투명하게 덮어 둔다(눌러서 휴대폰 기본 선택창이 뜨고, 스크린리더·e2e는 select로 읽는다)

type Cal = "solar" | "lunar";
type Row = { label: string; calendar: Cal; month?: number; day?: number; leap?: boolean; year?: number };

const COUNT_MAX = 10;

function rowsOf(list: DatesData["anniversaries"]): Row[] {
  return list.map((a) => ({ label: a.label, calendar: a.spec.calendar, month: a.spec.month, day: a.spec.day, leap: a.spec.leap, year: a.spec.year }));
}

/** 이름과 월·일을 다 적은 줄만 값이 된다(적다 만 줄은 화면에만 있다) */
function savedOf(rows: Row[]): DatesData["anniversaries"] {
  return rows.flatMap((r) => {
    const label = r.label.trim();
    if (!label || r.month === undefined || r.day === undefined) return [];
    const spec: DateSpec = { calendar: r.calendar, month: r.month, day: r.day };
    if (r.calendar === "lunar" && r.leap) spec.leap = true;
    if (r.year !== undefined) spec.year = r.year;
    return [{ label, spec }];
  });
}

const dayCap = (cal: Cal, month: number | undefined) => (cal === "lunar" ? 30 : month ? daysInMonth(2024, month) : 31);

/** 양력/음력 알약(고르는 칸). 기본은 양력 */
function CalendarPill({ value, onChange, locale, small = false }: { value: Cal; onChange: (c: Cal) => void; locale: Locale; small?: boolean }) {
  const t = useT(locale);
  return (
    <div role="radiogroup" aria-label={`${t("dates.solar")} / ${t("dates.lunar")}`} className="inline-flex shrink-0 rounded-full border border-edge bg-white p-[2.7px]">
      {(["solar", "lunar"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={`rounded-full whitespace-nowrap ${small ? "h-[24.3px] px-2.5 text-[11.7px]" : "h-[27px] px-3.5 text-[12.6px]"} ${value === c ? "bg-sky" : ""}`}
        >
          {t(c === "solar" ? "dates.solar" : "dates.lunar")}
        </button>
      ))}
    </div>
  );
}

/** 알약 모양 고르기: 글자와 화살표는 겉모양, 진짜 select가 위를 덮는다 */
function PillSelect({ label, shown, value, onPick, children }: { label: string; shown: string; value: string; onPick: (v: string) => void; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex h-[30.6px] shrink-0 items-center gap-1 rounded-[9px] border border-edge bg-white pl-[10.8px] pr-[9px] text-[13.5px] has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-ink">
      <span aria-hidden="true">{shown}</span>
      <Icon name="chevron" size={14} strokeWidth={2} className="shrink-0 rotate-90 text-muted" />
      <select aria-label={label} value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer appearance-none text-[16px] opacity-0">
        {children}
      </select>
    </span>
  );
}

/** 책상 달력 한 장: 망고 윗띠(월/일)와 고리 둘, 흰 바탕에 큰 손글씨 숫자. 비어 있으면 흐린 '?' */
function Leaf({ head, label, value, max, suffix, onPick }: { head: string; label: string; value: number | undefined; max: number; suffix: string; onPick: (n: number) => void }) {
  return (
    <div className="relative flex-1 rounded-[12.6px] has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-ink">
      <div aria-hidden="true" className="flex flex-col rounded-[12.6px] border border-edge bg-white shadow-[0_5.4px_10.8px_-9px_rgba(31,35,64,0.5)]">
        <span className="flex h-[23.4px] items-center justify-center rounded-t-[11.7px] border-b-[1.35px] border-ink bg-sky text-[11.7px]">{head}</span>
        <span className="flex h-[70.2px] items-center justify-center gap-1">
          <span className={`num text-[45px] ${value === undefined ? "text-muted" : ""}`}>{value ?? "?"}</span>
          <Icon name="chevron" size={16} strokeWidth={2} className="mt-3 shrink-0 rotate-90 text-muted" />
        </span>
      </div>
      <span aria-hidden="true" className="absolute -top-[6.3px] left-[28%] h-[12.6px] w-[4.5px] rounded-[2.7px] bg-ink" />
      <span aria-hidden="true" className="absolute -top-[6.3px] left-[68%] h-[12.6px] w-[4.5px] rounded-[2.7px] bg-ink" />
      <select aria-label={label} value={value ?? ""} onChange={(e) => e.target.value && onPick(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[12.6px] text-[16px] opacity-0">
        {value === undefined ? <option value="">–</option> : null}
        {Array.from({ length: max }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
            {suffix}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 생일(양력/음력 + 월·일 달력 잎사귀 + 태어난 해) + 올해 생일 결과 + 기념일 더하기 */
export function AnswerDates({ value, onChange, locale }: { value: DatesData; onChange: (v: DatesData) => void; locale: Locale }) {
  const t = useT(locale);
  const today = useToday();
  const ko = locale === "ko";
  const { spec, set, maxDay } = useSpecDraft(value.birthday, (birthday) => onChange({ birthday, anniversaries: value.anniversaries }));
  const cal: Cal = spec.calendar ?? "solar";

  // 기념일: 이름과 월·일을 다 적어야 값이 된다. 위에서 값이 바뀌어 오면(되살린 임시 답) 그 값으로 다시 맞춘다
  const [rows, setRows] = useState<Row[]>(() => rowsOf(value.anniversaries));
  const annKey = JSON.stringify(value.anniversaries);
  const [seen, setSeen] = useState(annKey);
  if (seen !== annKey) {
    setSeen(annKey);
    if (JSON.stringify(savedOf(rows)) !== annKey) setRows(rowsOf(value.anniversaries));
  }
  const setAll = (next: Row[]) => {
    setRows(next);
    onChange({ birthday: value.birthday, anniversaries: savedOf(next) });
  };
  const patchRow = (i: number, patch: Partial<Row>) =>
    setAll(
      rows.map((r, j) => {
        if (j !== i) return r;
        const n = { ...r, ...patch };
        if (n.day !== undefined) n.day = Math.min(n.day, dayCap(n.calendar, n.month));
        if (n.calendar === "solar") delete n.leap;
        return n;
      }),
    );

  const years = Array.from({ length: today.y - SPEC_YEAR_MIN + 1 }, (_, i) => today.y - i);
  const first = value.birthday ? occurrences(value.birthday, today, 1)[0] : undefined;
  const left = first ? diffDays(today, first) : null;
  const thisYear = !!first && first.y === today.y;
  const monthSuffix = ko ? "월" : "";
  const daySuffix = ko ? "일" : "";

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <span className="hand text-[18.9px] leading-none">{t("dates.birthday")}</span>
        <div className="flex items-center gap-2">
          {cal === "lunar" ? (
            <button
              type="button"
              aria-pressed={!!spec.leap}
              onClick={() => set({ leap: !spec.leap })}
              className={`relative inline-flex h-[27px] items-center rounded-full border border-edge px-3 text-[12.6px] before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] ${spec.leap ? "bg-sky" : "bg-white"}`}
            >
              {t("dates.leap")}
            </button>
          ) : null}
          <CalendarPill value={cal} onChange={(c) => set({ calendar: c })} locale={locale} />
        </div>
      </div>

      {/* 태어난 해 → 월 → 일 순서(날짜 읽는 순서대로) */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[12.6px] text-muted">{t("dates.birthYear")}</span>
        <PillSelect label={t("dates.birthYear")} shown={spec.year ? (ko ? `${spec.year}년` : String(spec.year)) : t("dates.yearUnsure")} value={spec.year ? String(spec.year) : ""} onPick={(v) => set({ year: v ? Number(v) : undefined })}>
          <option value="">{t("dates.yearUnsure")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {ko ? `${y}년` : y}
            </option>
          ))}
        </PillSelect>
      </div>

      <div className="mt-4 flex gap-3">
        <Leaf head={t("dates.month")} label={t("dates.month")} value={spec.month} max={12} suffix={monthSuffix} onPick={(month) => set({ month })} />
        <Leaf head={t("dates.day")} label={t("dates.day")} value={spec.day} max={maxDay} suffix={daySuffix} onPick={(day) => set({ day })} />
      </div>

      {first && left !== null ? (
        <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-sky-soft px-3 py-2.5">
          <CuteTopicIcon section="dates" size={24} />
          <span className="min-w-0 flex-1 text-[13px] leading-[1.4]">
            {t(thisYear ? "dates.thisYearIs" : "dates.nextIs")} <b className="hand text-[17.1px] font-normal">{thisYear ? formatDayFull(first, locale) : formatDateLong(first, locale)}</b>
          </span>
          <span className="num inline-flex h-[23.4px] shrink-0 items-center rounded-full border border-edge bg-sky px-2 text-[14.4px]">{left === 0 ? t("start.today") : `D-${left}`}</span>
        </div>
      ) : null}

      {rows.map((r, i) => (
        <div key={i} className="mt-3.5 flex flex-col gap-2.5 border-t border-dashed border-ink/30 pt-3.5">
          <div className="flex items-center gap-1">
            <input
              aria-label={t("dates.anniversaryLabel")}
              value={r.label}
              maxLength={40}
              onChange={(e) => patchRow(i, { label: e.target.value })}
              placeholder={t("dates.anniversaryPlaceholder")}
              className="hand-written h-10 min-w-0 flex-1 border-b border-dashed border-ink/30 bg-transparent text-[19.8px] outline-none placeholder:text-muted/70"
            />
            <button type="button" aria-label={t("dates.removeAnniversary")} onClick={() => setAll(rows.filter((_, j) => j !== i))} className="flex h-10 w-9 shrink-0 items-center justify-center text-muted">
              <Icon name="close" size={18} strokeWidth={1.8} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarPill value={r.calendar} onChange={(c) => patchRow(i, { calendar: c })} locale={locale} small />
            <PillSelect label={t("dates.month")} shown={r.month ? `${r.month}${monthSuffix}` : t("dates.month")} value={r.month ? String(r.month) : ""} onPick={(v) => patchRow(i, { month: v ? Number(v) : undefined })}>
              {r.month === undefined ? <option value="">–</option> : null}
              {Array.from({ length: 12 }, (_, k) => (
                <option key={k + 1} value={k + 1}>
                  {k + 1}
                  {monthSuffix}
                </option>
              ))}
            </PillSelect>
            <PillSelect label={t("dates.day")} shown={r.day ? `${r.day}${daySuffix}` : t("dates.day")} value={r.day ? String(r.day) : ""} onPick={(v) => patchRow(i, { day: v ? Number(v) : undefined })}>
              {r.day === undefined ? <option value="">–</option> : null}
              {Array.from({ length: dayCap(r.calendar, r.month) }, (_, k) => (
                <option key={k + 1} value={k + 1}>
                  {k + 1}
                  {daySuffix}
                </option>
              ))}
            </PillSelect>
          </div>
        </div>
      ))}

      {rows.length < COUNT_MAX ? (
        <button
          type="button"
          onClick={() => setRows([...rows, { label: "", calendar: "solar" }])}
          className="mt-3.5 flex h-[39.6px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink/35 text-[13.1px]"
        >
          <Icon name="plus" size={16} strokeWidth={1.8} />
          {t("dates.askAnniversary")}
        </button>
      ) : null}
    </div>
  );
}
