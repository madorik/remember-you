import "server-only";
import { personRows } from "@/components/PeopleList";
import { aiConfigured } from "@/lib/ai";
import { folderViews, listFolders, listPeople, requireSession, todayFor } from "@/lib/data";
import { recentIds } from "@/lib/recent-people";
import { makeT } from "@/lib/t";
import type { PeopleData } from "./people.data";
import type { PageInput } from "./routes";

/** 내 사람들: 사람 줄·폴더 칸(이름은 화면 언어로) */
export async function loadPeople({ searchParams: sp }: PageInput): Promise<PeopleData> {
  const s = await requireSession();
  const t = makeT(s.profile.locale);
  const [people, folders] = await Promise.all([listPeople(s), s.tx((q) => listFolders(q, s.user.id))]);
  const views = folderViews(folders, people, t);
  const rows = personRows(people, todayFor(s.profile), s.profile.locale, t, views);
  return {
    locale: s.profile.locale,
    rows,
    recent: recentIds(people),
    folders: views,
    meAvatar: s.profile.avatar,
    initialPick: sp.pick === "1",
    initial: (sp.with ?? "").split(",").filter(Boolean),
    initialMe: sp.me !== "0",
    initialGift: sp.to === "gift",
    initialXmas: sp.xmas === "1",
    ai: aiConfigured(),
  };
}
