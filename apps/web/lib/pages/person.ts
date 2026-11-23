import "server-only";
import { notFound } from "next/navigation";
import { aiConfigured } from "@/lib/ai";
import { displayName, folderViews, listFolders, listNotes, listPeople, requireSession, todayFor, unreadAnswers } from "@/lib/data";
import { makeT } from "@/lib/t";
import type { PersonData } from "./person.data";
import type { PageInput } from "./routes";

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
  const waiting = p.asking?.state === "active" ? { inviteId: p.asking.inviteId } : null;
  return {
    locale,
    back,
    today,
    person: { contactId: p.contactId, personId: p.personId, name: p.name, nickname: p.nickname, avatar: p.avatar, card: p.card, favorite: p.favorite, askOff: p.askOff, folderIds: p.folderIds, answered: p.answered },
    name,
    notes,
    folders: folderViews(folders, people, t),
    answered: answered.length > 0,
    waiting,
    ai: aiConfigured(),
  };
}
