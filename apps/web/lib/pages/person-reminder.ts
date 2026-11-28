import "server-only";
import { eventTitle, nextDay, type DateSpec } from "@readme/core";
import { notFound } from "next/navigation";
import { parseSkip } from "@/components/GiftPicksView";
import { displayName, listPeople, requireSession, todayFor, unreadAnswers } from "@/lib/data";
import { giftPicksOn } from "@/lib/gifts";
import { makeT } from "@/lib/t";
import type { GiftPicksData } from "./gift-picks.data";
import { loadGiftPicks } from "./gift-picks";
import type { PersonReminderData } from "./person-reminder.data";
import type { PageInput } from "./routes";

/**
 * 선물 힌트(웹 페이지): 선물 고르기(picks)는 기다리지 않고 Promise로 둔다. 화면을 먼저 그리고 고르는 동안 빈 자리를 보이다가 채운다
 * (처음엔 AI·쿠팡을 부르느라 몇 초 걸린다)
 */
export async function startPersonReminder({ params, searchParams: sp }: PageInput): Promise<Omit<PersonReminderData, "picks"> & { picks: Promise<GiftPicksData | null> | null }> {
  const { id } = params;
  const s = await requireSession();
  const { locale } = s.profile;
  const t = makeT(locale);
  const people = await listPeople(s);
  const p = people.find((x) => x.contactId === id);
  if (!p) notFound();
  const name = displayName(p);
  const today = todayFor(s.profile);
  const dates = p.card.dates;
  // 홈 연말 카드에서 왔다(?xmas=1): 그 사람의 생일이 아니라 크리스마스를 위한 선물 고르기(제목·고르는 맥락이 크리스마스)
  const xmas = !!sp.xmas;
  // 챙길 날을 짚어 열었다(홈·달력·알림의 ?kind=birthday|anniversary, 또는 크리스마스). 사람 화면의 '선물 고르기'처럼 날을 정하지 않고 열면
  // 생일 선물이라고 단정하지 않으므로 화면은 날짜·'생일까지 N일' 제목 없이 '○○님에게 줄 선물'로 연다
  const eventKnown = xmas || sp.kind === "birthday" || sp.kind === "anniversary";
  const anniversary = !xmas && sp.kind === "anniversary" ? dates?.anniversaries.find((a) => a.label === sp.label) : undefined;
  const spec: DateSpec | null = xmas ? { calendar: "solar", month: 12, day: 25 } : (anniversary?.spec ?? dates?.birthday ?? null);
  const next = spec ? nextDay(spec, today, anniversary?.once === true) : null;
  const event = xmas
    ? t("reminder.xmasEvent")
    : spec && next
      ? eventTitle(locale, { kind: anniversary ? "anniversary" : "birthday", name, label: anniversary?.label, spec, date: next.date })
      : anniversary
        ? t("home.event.anniversary", { name, label: anniversary.label })
        : t("home.event.birthday", { name });
  // 이런 선물은 어때요(쿠팡 API 키가 있으면 상품, 없으면 파트너스 링크 목록에서 가격대별로)
  const picksOn = giftPicksOn();
  // 다시 고르기: 지금 주소(날 종류·이름은 그대로)에 지난번에 보인 것(skip)을 실어 보낸다
  const skip = parseSkip(sp.skip);
  const here = new URLSearchParams();
  if (sp.kind) here.set("kind", sp.kind);
  if (sp.label) here.set("label", sp.label);
  if (xmas) here.set("xmas", "1");
  const again = `/people/${p.contactId}/reminder${here.size ? `?${here.toString()}` : ""}`;
  // 크리스마스면 챙길 날 없이(생일이 가까워도 그 날이 아니라) 크리스마스·연말 선물로 고른다
  const occasion = xmas ? null : anniversary ? { kind: "anniversary" as const, label: anniversary.label } : dates?.birthday ? { kind: "birthday" as const, label: "" } : null;
  const picks = picksOn ? loadGiftPicks(s, p, { occasion, today, skip, source: "reminder" }) : null;
  // 화면이 받기 전에 실패해도 처리 안 된 거절로 남지 않게(화면은 같은 실패를 그대로 받는다)
  picks?.catch(() => {});
  return {
    locale,
    contactId: p.contactId,
    avatar: p.avatar,
    name,
    spec: eventKnown ? spec : null,
    next: eventKnown ? next : null,
    event: eventKnown ? event : "",
    eventKnown,
    picksOn,
    skip,
    again,
    answered: (await s.tx((q) => unreadAnswers(q, s.user.id, p.contactId))).length > 0,
    picks,
  };
}
