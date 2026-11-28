import KoreanLunarCalendar from "korean-lunar-calendar";

// 날짜는 시간대 없는 연·월·일(YMD)로만 다룬다. "오늘"은 사용자의 시간대로 한 번 정하고(todayIn), 그다음 계산은 모두 YMD끼리 한다.

export type CalendarKind = "solar" | "lunar";

/** 해마다 돌아오는 날(생일·기념일). 음력이면 leap=true가 윤달 */
export interface DateSpec {
  calendar: CalendarKind;
  month: number;
  day: number;
  leap?: boolean;
  /** 태어난 해(생일)·시작한 해(기념일). 모르면 없다. 음력이면 음력 연도 */
  year?: number;
}

export const SPEC_YEAR_MIN = 1900;
export const SPEC_YEAR_MAX = 2100;

export interface YMD {
  y: number;
  m: number;
  d: number;
}

// 음력 변환 라이브러리(한국천문연구원 자료)가 다루는 범위.
// 2050년까지라서 그 뒤로는 음력 날짜가 돌아오는 날을 알 수 없다: lunarToSolar·solarToLunar는 null, 음력 occurrences는 빈 목록, nextOccurrence는 null.
// 부르는 쪽은 모두 null을 받아 그 일정을 건너뛰게 되어 있다. SPEC_YEAR_MAX(2100)는 저장해 둔 태어난 해·시작한 해의 범위라 일부러 줄이지 않았다(이미 저장된 값을 읽을 때 지우지 않으려고).
export const LUNAR_MIN_YEAR = 1000;
export const LUNAR_MAX_YEAR = 2050;

const DAY_MS = 86_400_000;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function toUTC(v: YMD): number {
  return Date.UTC(v.y, v.m - 1, v.d);
}

export function fromUTC(ms: number): YMD {
  const dt = new Date(ms);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function addDays(v: YMD, n: number): YMD {
  return fromUTC(toUTC(v) + n * DAY_MS);
}

/** b - a (일) */
export function diffDays(a: YMD, b: YMD): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

export function compareYmd(a: YMD, b: YMD): number {
  return toUTC(a) - toUTC(b);
}

export function sameYmd(a: YMD, b: YMD): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

/** 0 = 일요일 … 6 = 토요일 */
export function weekday(v: YMD): number {
  return new Date(toUTC(v)).getUTCDay();
}

export function ymdKey(v: YMD): string {
  return `${v.y}-${String(v.m).padStart(2, "0")}-${String(v.d).padStart(2, "0")}`;
}

export function parseYmd(s: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const v = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  if (v.m < 1 || v.m > 12 || v.d < 1 || v.d > daysInMonth(v.y, v.m)) return null;
  return v;
}

/** 그 시간대의 오늘 날짜 */
export function todayIn(timeZone: string, now: Date = new Date()): YMD {
  let parts: string;
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  }
  return parseYmd(parts) ?? fromUTC(now.getTime());
}

export function isValidSpec(spec: unknown): spec is DateSpec {
  if (!spec || typeof spec !== "object") return false;
  const s = spec as Record<string, unknown>;
  if (s.calendar !== "solar" && s.calendar !== "lunar") return false;
  if (!Number.isInteger(s.month) || !Number.isInteger(s.day)) return false;
  const month = s.month as number;
  const day = s.day as number;
  if (month < 1 || month > 12 || day < 1) return false;
  if (s.year !== undefined && (!Number.isInteger(s.year) || (s.year as number) < SPEC_YEAR_MIN || (s.year as number) > SPEC_YEAR_MAX)) return false;
  if (s.calendar === "solar") return day <= daysInMonth(typeof s.year === "number" ? s.year : 2024, month); // 연도를 모르면 2024(윤년)로: 2월 29일까지 받는다
  if (s.leap !== undefined && typeof s.leap !== "boolean") return false;
  return day <= 30;
}

function lunarOnce(y: number, m: number, d: number, leap: boolean): YMD | null {
  const cal = new KoreanLunarCalendar();
  if (!cal.setLunarDate(y, m, d, leap)) return null;
  const s = cal.getSolarCalendar();
  return { y: s.year, m: s.month, d: s.day };
}

/**
 * 음력 → 양력.
 * - 그 해에 윤달이 없는데 윤달로 물으면 평달로 계산한다(라이브러리는 윤달이 없어도 성공으로 답하며 평달 날짜를 준다. 평달 결과와 같으면 윤달이 없는 해다).
 * - 그 달이 29일까지만 있으면 30일은 29일로 계산한다.
 */
export function lunarToSolar(y: number, m: number, d: number, leap = false): YMD | null {
  if (y < LUNAR_MIN_YEAR || y > LUNAR_MAX_YEAR || m < 1 || m > 12 || d < 1 || d > 30) return null;
  const days = d === 30 ? [30, 29] : [d];
  for (const day of days) {
    const plain = lunarOnce(y, m, day, false);
    if (leap) {
      const intercalated = lunarOnce(y, m, day, true);
      if (intercalated && (!plain || !sameYmd(intercalated, plain))) return intercalated;
    }
    if (plain) return plain;
  }
  return null;
}

/** 그 해에 음력 m월 윤달이 있는지 */
export function hasLeapMonth(y: number, m: number): boolean {
  const a = lunarOnce(y, m, 1, true);
  const b = lunarOnce(y, m, 1, false);
  return !!a && !!b && !sameYmd(a, b);
}

export interface LunarDate extends YMD {
  leap: boolean;
}

export function solarToLunar(v: YMD): LunarDate | null {
  if (v.y < LUNAR_MIN_YEAR || v.y > LUNAR_MAX_YEAR) return null;
  const cal = new KoreanLunarCalendar();
  if (!cal.setSolarDate(v.y, v.m, v.d)) return null;
  const l = cal.getLunarCalendar();
  return { y: l.year, m: l.month, d: l.day, leap: !!l.intercalation };
}

/** 양력 날짜가 그 해에 실제로 오는 날. 2월 29일은 평년에 2월 28일 */
export function solarInYear(spec: DateSpec, year: number): YMD {
  const day = Math.min(spec.day, daysInMonth(year, spec.month));
  return { y: year, m: spec.month, d: day };
}

/** today 이후(오늘 포함) 돌아오는 날을 가까운 순서로 count개 */
export function occurrences(spec: DateSpec, today: YMD, count: number): YMD[] {
  const out: YMD[] = [];
  if (!isValidSpec(spec) || count <= 0) return out;
  // 음력 12월 생일은 양력으로 이듬해 1·2월에 오므로 한 해 앞부터 본다
  for (let year = today.y - 1; out.length < count && year <= today.y + count + 1; year++) {
    const date = spec.calendar === "solar" ? solarInYear(spec, year) : lunarToSolar(year, spec.month, spec.day, !!spec.leap);
    if (date && diffDays(today, date) >= 0) out.push(date);
  }
  return out.sort(compareYmd).slice(0, count);
}

export interface NextOccurrence {
  date: YMD;
  daysUntil: number;
}

export function nextOccurrence(spec: DateSpec, today: YMD): NextOccurrence | null {
  const [date] = occurrences(spec, today, 1);
  return date ? { date, daysUntil: diffDays(today, date) } : null;
}

// ── 한 번만 있는 날(약속·집들이·병원 예약 …) ─────────────────────────────
// 해마다 돌아오는 날이 아니라 정해진 하루(양력 연·월·일)다. 기념일 한 줄에 once 표시로 들어가고(card.ts Anniversary), 지나면 다가오는 날에서 빠진다.

/** 한 번만 있는 날의 날짜가 될 수 있나: 양력이고 연·월·일이 다 있고 실제로 있는 날 */
export function isOnceSpec(spec: unknown): spec is DateSpec & { year: number } {
  return isValidSpec(spec) && spec.calendar === "solar" && typeof spec.year === "number";
}

/** 한 번만 있는 날의 하루 */
export function onceDate(spec: DateSpec & { year: number }): YMD {
  return { y: spec.year, m: spec.month, d: spec.day };
}

/** 한 번만 있는 날의 날짜를 spec으로 */
export function onceSpec(date: YMD): DateSpec & { year: number } {
  return { calendar: "solar", month: date.m, day: date.d, year: date.y };
}

/** 한 번만 있는 날을 이렇게 멀리까지 받는다(일). 한참 뒤(몇 년)의 날은 약속이 아니라 잘못 읽은 것으로 본다 */
export const ONCE_HORIZON_DAYS = 800;

/**
 * 말한 날짜를 오늘(today, 사용자 시간대의 오늘) 기준 실제 하루로 푼다. 이미 지난 날·너무 먼 날·없는 날은 null.
 * - 연도가 있으면 그 해의 그 날(음력이면 음력 연도의 그 날을 양력으로)
 * - 연도가 없으면 오늘 이후(오늘 포함) 가장 가까운 그 날(양력·음력 모두)
 */
export function resolveOnce(spec: DateSpec, today: YMD, horizonDays = ONCE_HORIZON_DAYS): YMD | null {
  if (!isValidSpec(spec)) return null;
  let date: YMD | null;
  if (typeof spec.year === "number") date = spec.calendar === "solar" ? { y: spec.year, m: spec.month, d: spec.day } : lunarToSolar(spec.year, spec.month, spec.day, !!spec.leap);
  else date = nextOccurrence(spec, today)?.date ?? null;
  if (!date) return null;
  const left = diffDays(today, date);
  return left >= 0 && left <= horizonDays ? date : null;
}
