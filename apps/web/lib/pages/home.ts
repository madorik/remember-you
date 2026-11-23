import "server-only";
import { isAdminAccount } from "@/lib/admin";
import { aiConfigured } from "@/lib/ai";
import { isCloseEnough, isRecentlyAdded, questionForPeople, questionsLeft, questionsUsedToday, ymdKey } from "@readme/core";
import { listPeople, requireSession, todayFor, unreadAnswers } from "@/lib/data";
import { readQuestionLog } from "@/lib/question-log";
import type { HomeData } from "./home.data";
import type { PageInput } from "./routes";

/** 홈: 사람들·오늘의 질문(가까운 사람의 빈 칸 하나, 하루 두 번까지)·아직 안 본 답장 */
export async function loadHome({ searchParams }: PageInput): Promise<HomeData> {
  const s = await requireSession();
  const today = todayFor(s.profile);
  const [people, answers] = await Promise.all([listPeople(s), s.tx((q) => unreadAnswers(q, s.user.id))]);
  // 오늘 두 번 처리했으면 더 묻지 않는다. 묻는 사람도 가까운 사람뿐: 가족 폴더, 즐겨찾기, 사람 화면을 여러 날 열어 본 사람, 방금(14일 안에) 더한 사람(다시 묻지 않기로 한 사람은 뺀다)
  const used = questionsUsedToday(s.profile, today);
  let asked: ReturnType<typeof questionForPeople> = null;
  if (questionsLeft(used) > 0 && people.length) {
    const close = new Set(
      (await s.tx((q) => q<{ id: string }>("select distinct m.contact_id::text as id from contact_group_members m join contact_groups g on g.id = m.group_id where m.user_id = $1 and g.builtin = 'family'", [s.user.id]))).map((r) => r.id),
    );
    // 사람들 줄과 같은 순서(즐겨찾기 먼저)로 늘어놓고 날짜마다 돌려 가며 고른다. 오늘 이미 처리한 만큼 더 옮긴다(같은 질문이 또 나오지 않게)
    const ordered = people
      .filter((p) => isCloseEnough({ askOff: p.askOff, favorite: p.favorite, closeFolder: close.has(p.contactId), viewDays: p.viewDays, recent: isRecentlyAdded(p.createdAt) }))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite));
    asked = questionForPeople(today, ordered, used);
  }
  return {
    locale: s.profile.locale,
    avatar: s.profile.avatar,
    today,
    people,
    question: asked ? { contactId: asked.contactId, q: asked.question } : null,
    questionsUsed: used,
    questionLog: used > 0 ? await readQuestionLog(ymdKey(today)) : [],
    answers,
    answered: !!searchParams.answered,
    muted: !!searchParams.muted,
    ai: aiConfigured(),
    isAdmin: isAdminAccount(s.user),
  };
}
