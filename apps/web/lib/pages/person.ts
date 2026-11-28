import "server-only";
import { describeEffect, revertEffects, todayIn, type EffectLine, type Locale, type PartialCard } from "@readme/core";
import { notFound } from "next/navigation";
import { aiConfigured } from "@/lib/ai";
import { displayName, folderViews, listFolders, listNotes, listPeople, requireSession, todayFor, unreadAnswers, type Note } from "@/lib/data";
import { parseBookTab } from "@/lib/person-tab";
import { makeT } from "@/lib/t";
import type { PersonData } from "./person.data";
import type { PageInput } from "./routes";

/**
 * 이 메모를 지울 때 '같이 지우기'로 지금 실제로 되돌려지는 것(화면의 '이 메모로 더해진 것'). 지금 기록에 그대로 남아 있고 다른 남는 메모가 뒷받침하지 않는 것만 —
 * 되돌려질 게 없으면 빈 목록(메모만 지우는 단추 하나만 보인다)
 */
function addedBy(note: Note, all: Note[], card: PartialCard, locale: Locale): EffectLine[] {
  if (!note.effects.length) return [];
  const others = all.filter((o) => o.id !== note.id).flatMap((o) => o.effects);
  return revertEffects(card, note.effects, others)
    .undone.map((e) => describeEffect(e, locale))
    .filter((l): l is EffectLine => !!l);
}

/** 사람 하나: 기록·메모·든 폴더·안 본 답·기다리는 물어보기 */
export async function loadPerson({ params, searchParams: sp }: PageInput): Promise<PersonData> {
  const { id } = params;
  // 고르기 중이나 폴더에서 들어왔으면 뒤로 갈 때 거기로(/people?pick=1&with=…, /people/folder/…). 사람들 화면 주소만 받는다
  const backParam = sp.back ?? "";
  const back = /^\/people(\/folder\/[0-9a-f-]{36})?(\?[\w=&,%.-]*)?$/.test(backParam) ? backParam : "/people";
  const s = await requireSession();
  const { locale } = s.profile;
  const t = makeT(locale);
  const people = await listPeople(s);
  const p = people.find((x) => x.contactId === id);
  if (!p) notFound();
  const name = displayName(p);
  const today = todayFor(s.profile);
  const [notes, folders, answered] = await Promise.all([
    s.tx((q) => listNotes(q, s.user.id, p.contactId)),
    s.tx((q) => listFolders(q, s.user.id)),
    s.tx((q) => unreadAnswers(q, s.user.id, p.contactId)),
  ]);
  // 답을 기다린 날수: 보낸 날이 1일째
  const waiting = p.asking?.state === "active" ? { inviteId: p.asking.inviteId, days: Math.max(1, Math.floor((Date.now() - new Date(p.asking.createdAt).getTime()) / 86_400_000) + 1) } : null;
  return {
    locale,
    back,
    today,
    person: { contactId: p.contactId, personId: p.personId, name: p.name, nickname: p.nickname, avatar: p.avatar, card: p.card, favorite: p.favorite, askOff: p.askOff, folderIds: p.folderIds, answered: p.answered },
    name,
    notes: notes.map((n) => ({ id: n.id, label: n.label, body: n.body, createdAt: n.createdAt, date: todayIn(s.profile.timeZone, new Date(n.createdAt)), adds: addedBy(n, notes, p.card, locale), fx: n.effects.length })),
    tab: parseBookTab(sp.tab),
    folders: folderViews(folders, people, t),
    answered: answered.length > 0,
    waiting,
    ai: aiConfigured(),
  };
}
