import { addDays, eventPath, holidayReminders, reminderBody, translate, type Locale, type ReminderOffset, type UpcomingEvent, type YMD } from "@readme/core";
import type { LocalReminder } from "@/components/native";
import { makeT } from "./i18n";
import { eventName } from "./events";

/** 문자열을 겹치기 어려운 양의 정수로(로컬 알림 id) */
function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 2_000_000_000;
}

/** 앞으로 알릴 것들(앱이 기기에 예약한다) */
export function localReminders(events: UpcomingEvent[], offsets: readonly ReminderOffset[], locale: Locale, horizonDays = 60): LocalReminder[] {
  const t = makeT(locale);
  const out: LocalReminder[] = [];
  for (const e of events) {
    if (e.daysUntil > horizonDays + 14) continue;
    for (const offset of offsets) {
      const day: YMD = addDays(e.date, -offset);
      const event = eventName(e, t, locale);
      out.push({
        id: hashId(`${e.contactId}:${e.kind}:${e.label ?? ""}:${e.date.y}-${e.date.m}-${e.date.d}:${offset}`),
        title: offset === 0 ? translate(locale, "notif.today", { event }) : translate(locale, "notif.left", { event, n: offset }),
        body: reminderBody(locale, e, offset),
        y: day.y,
        m: day.m,
        d: day.d,
        path: eventPath(e),
      });
    }
  }
  return out;
}

/** 명절·챙기는 날(설날·추석·크리스마스·어버이날 …) 알림: 눌러서 열면 사람을 골라 선물 고르기로 간다 */
const HOLIDAY_PATH = "/people?pick=1&to=gift";

export function holidayLocalReminders(today: YMD, offsets: readonly ReminderOffset[], locale: Locale, horizonDays = 60): LocalReminder[] {
  return holidayReminders(today, offsets, locale, horizonDays).map((r) => ({
    id: hashId(r.key),
    title: r.title,
    body: translate(locale, "notif.holidayBody"),
    y: r.day.y,
    m: r.day.m,
    d: r.day.d,
    path: HOLIDAY_PATH,
  }));
}

