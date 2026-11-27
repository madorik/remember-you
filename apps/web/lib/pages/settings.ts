import "server-only";
import { SECTIONS, defaultAskTopics, sanitizeQuestionIds, type Section } from "@readme/core";
import { displayName, listOpenInvites, listPeople, requireSession, todayFor } from "@/lib/data";
import { makeT } from "@/lib/t";
import { personHint } from "@/lib/summary";
import { webPushPublicKey } from "@/lib/webpush";
import type { PageInput } from "./routes";
import type { PrivacyData, RequestData, VoiceData } from "./types";

/** 설정 */
export async function loadPrivacy(): Promise<PrivacyData> {
  const s = await requireSession();
  const invites = await s.tx((q) => listOpenInvites(q));
  return {
    locale: s.profile.locale,
    isAnonymous: s.user.isAnonymous,
    invites: invites.map((i) => ({ id: i.id, recipientName: i.recipientName })),
    localeChoice: s.profile.localeChoice,
    appLock: s.profile.appLock,
    pushEnabled: s.profile.pushEnabled,
    holidayReminders: s.profile.holidayReminders,
    reminderOffsets: s.profile.reminderOffsets,
    webPushKey: webPushPublicKey(),
  };
}

/**
 * 물어보기: 주소록 사람에게(찾아서 고르거나 사람 화면에서 to로), 또는 새 사람(이름을 적어 새로)에게.
 * 아는 사람이면 아직 안 적힌 항목을 먼저 고르고, 받은 답은 그 사람 기록에 들어간다
 */
export async function loadRequest({ searchParams }: PageInput): Promise<RequestData> {
  const s = await requireSession();
  // 홈의 크리스마스 물어보기(?xmas=1)에서 왔으면 선물 쪽을 먼저 묻는다
  const xmas = !!searchParams.xmas;
  // 반려동물은 키우는 사람만 해당돼서 처음부터 고르지 않는다(직접 고를 수 있다)
  const askable = SECTIONS.filter((x) => x !== "pets");
  // 기본으로 골라 두는 항목은 누구에게든 같은 규칙: 아직 안 적힌 것 중 중요한 것부터 3개(새 사람은 전부 안 적힌 셈)
  const defaults: Section[] = xmas ? ["taste", "gifts", "favorites"] : defaultAskTopics(askable);
  // 찾기에 쓸 사람들(즐겨찾기 먼저). 사람마다 아직 안 적힌 항목
  const people = [...(await listPeople(s))]
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
    .map((p) => ({
      id: p.contactId,
      name: p.name || displayName(p),
      tag: p.nickname && p.nickname !== (p.name || displayName(p)) ? p.nickname : "",
      label: displayName(p),
      avatar: p.avatar,
      missing: askable.filter((x) => !p.card[x]),
    }));
  const fixed = searchParams.to ? (people.find((p) => p.id === searchParams.to) ?? null) : null;
  const focus = SECTIONS.find((x) => x === searchParams.topic) ?? null;
  const question = sanitizeQuestionIds([searchParams.q])[0] ?? null;
  return {
    locale: s.profile.locale,
    people,
    fixed,
    initialName: (searchParams.name ?? "").slice(0, 40),
    defaults,
    xmas,
    focus,
    question,
    webPushKey: s.profile.pushEnabled ? webPushPublicKey() : null,
  };
}

/** 메모 쓰기: 적은 글은 그대로 메모로 저장되고(AI가 꺼져 있어도 열린다), AI는 저장 뒤에 그 사람의 항목으로 정리할 때만 쓴다 */
export async function loadVoice({ searchParams }: PageInput): Promise<VoiceData> {
  const s = await requireSession();
  // @로 부를 사람: 이름과 내가 붙인 태그(부르는 말), 즐겨찾기가 먼저. hint는 이름이 같은 사람을 가려 볼 때 곁에 붙이는 기록 요약
  const t = makeT(s.profile.locale);
  const people = [...(await listPeople(s))]
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
    .map((p) => ({ id: p.contactId, name: p.name, tag: p.nickname && p.nickname !== p.name ? p.nickname : "", avatar: p.avatar, hint: personHint(p.card, s.profile.locale, t) }));
  // 사람 화면의 구슬에서 왔으면(?to=) 그 사람에게 고정(내 사람이 아니면 무시)
  const fixed = searchParams.to ? (people.find((p) => p.id === searchParams.to) ?? null) : null;
  return { locale: s.profile.locale, today: todayFor(s.profile), people, fixed, shared: searchParams.shared === "1" };
}
