import "server-only";
import { notFound } from "next/navigation";
import { folderViews, listFolders, listPeople, requireSession, todayFor } from "@/lib/data";
import { makeT } from "@/lib/t";
import type { PersonProfileData } from "./person-profile.data";
import type { PageInput } from "./routes";

/** 사람 프로필: 그 사람의 얼굴과 부르는 말 */
export async function loadPersonProfile({ params }: PageInput): Promise<PersonProfileData> {
  const { id } = params;
  const s = await requireSession();
  const people = await listPeople(s);
  const p = people.find((x) => x.contactId === id);
  if (!p) notFound();
  const folders = await s.tx((q) => listFolders(q, s.user.id));
  return {
    locale: s.profile.locale,
    today: todayFor(s.profile),
    folders: folderViews(folders, people, makeT(s.profile.locale)),
    person: { contactId: p.contactId, personId: p.personId, name: p.name, nickname: p.nickname, avatar: p.avatar, folderIds: p.folderIds, birthday: p.card.dates?.birthday ?? null },
  };
}
