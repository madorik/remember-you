import type { AvatarConfig, DateSpec, Locale, YMD } from "@readme/core";

// 월별 달력 데이터(lib/pages/calendar.ts가 읽고 components/pages/CalendarView가 그린다). 타입만 둔다.
// 달력은 화면에서 달을 옮기므로(좌우로 밀기) 사람 기록 전체가 아니라 생일·기념일 날짜만 보낸다(알레르기·사이즈 같은 건 화면에 가지 않는다)

export interface Month {
  y: number;
  m: number;
}

export interface CalPerson {
  contactId: string;
  /** 부를 이름 */
  name: string;
  avatar: AvatarConfig | null;
  birthday: DateSpec | null;
  /** once: 한 번만 있는 날(약속·집들이 …) */
  anniversaries: { label: string; spec: DateSpec; once?: true }[];
}

export interface CalendarData {
  locale: Locale;
  today: YMD;
  /** 처음 보이는 달(?m=2026-12, 없거나 이상하면 이번 달) */
  cur: Month;
  people: CalPerson[];
  ai: boolean;
}
