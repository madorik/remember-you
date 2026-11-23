"use server";

import { track } from "@/lib/track";
import { isSection, sanitizeQuestionIds, sanitizeSections, translate } from "@readme/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { answerAsk, answerQuestion, createAsk } from "@/lib/ask";
import { getSession, requireSession, writeSection } from "@/lib/data";
import { notifyUserT } from "@/lib/push";
import { absoluteUrl } from "@/lib/site";
import { isUuid } from "@/lib/uuid";
import type { Locale } from "@readme/core";

function json(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v ?? "null"));
  } catch {
    return null;
  }
}

export interface InviteState {
  url: string | null;
  text: string;
  error: "pickOne" | "common" | null;
}

/** 보낼 말 첫 줄: 한 질문만 묻는 링크는 그 말에 맞게 */
function askText(s: { profile: { displayName: string; locale: Locale } }, single: boolean): string {
  const from = s.profile.displayName || translate(s.profile.locale, "app.name");
  return translate(s.profile.locale, single ? "request.textOne" : "request.text", { from });
}

/**
 * 물어보기: 주소록의 한 사람(to)에게, 또는 새 사람(name)을 주소록에 넣고 링크를 만든다.
 * 내 기록에 이미 적힌 값은 미리 채워 보내서, 상대는 맞아요·고치기만 누르면 된다
 */
export async function createRequest(_: InviteState, form: FormData): Promise<InviteState> {
  const s = await requireSession();
  const to = String(form.get("to") ?? "");
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const sections = sanitizeSections(json(form.get("sections")));
  // 한 질문만 묻는 링크(?q=): 오늘의 질문 id. 항목은 그 질문이 속한 항목으로 서버가 정한다
  const questions = sanitizeQuestionIds(json(form.get("questions")));
  const message = String(form.get("message") ?? "").trim().slice(0, 300);
  if (!to && !name) return { url: null, text: "", error: "common" };
  if (!sections.length && !questions.length) return { url: null, text: "", error: "pickOne" };
  try {
    const invite = await createAsk(s, { to: to || undefined, name, sections, questions, message });
    revalidatePath("/people", "layout");
    revalidatePath("/home");
    revalidatePath("/privacy");
    track("ask_create", { userId: s.user.id, source: to ? "person" : "new" });
    return { url: absoluteUrl(`/r/${invite.token}`), text: askText(s, questions.length > 0), error: null };
  } catch {
    // 새 사람이면 사람과 링크가 한 트랜잭션이라 실패하면 빈 사람이 남지 않는다
    return { url: null, text: "", error: "common" };
  }
}

/**
 * 답을 기다리는 사람에게 다시 보내기: 같은 사람·같은 항목(질문)·같은 말로 새 링크를 만든다.
 * 이전 링크는 그대로 열어 둔다(받는 사람이 이미 받은 메시지의 링크도 계속 열린다). 보낼 말(링크 포함)까지 돌려준다
 */
export async function resendRequest(contactId: string): Promise<InviteState> {
  const s = await requireSession();
  if (!isUuid(contactId)) return { url: null, text: "", error: "common" };
  try {
    // questions 열은 0033 마이그레이션 전에는 없어서 행 전체를 json으로 읽는다
    const prev = await s.tx((q) => q.one<{ j: Record<string, unknown> }>("select to_jsonb(i) as j from invites i where i.contact_id = $1::uuid order by i.created_at desc limit 1", [contactId]));
    if (!prev) return { url: null, text: "", error: "common" };
    const questions = sanitizeQuestionIds(prev.j.questions, 3);
    const sections = sanitizeSections(prev.j.sections);
    const message = String(prev.j.message ?? "").trim().slice(0, 300);
    const invite = await createAsk(s, { to: contactId, name: String(prev.j.recipient_name ?? ""), sections, questions, message });
    revalidatePath("/people", "layout");
    revalidatePath("/privacy");
    track("ask_create", { userId: s.user.id, source: "resend" });
    const base = askText(s, questions.length > 0);
    return { url: absoluteUrl(`/r/${invite.token}`), text: message ? `${base}\n${message}` : base, error: null };
  } catch {
    return { url: null, text: "", error: "common" };
  }
}

/** 아직 아무도 안 연 물어보기 링크 취소(사람 기록은 그대로) */
export async function cancelInvite(form: FormData): Promise<void> {
  const s = await requireSession();
  const id = String(form.get("id"));
  const back = String(form.get("back") ?? "");
  // uuid 모양이 아니면 DB를 부르지 않는다(::uuid가 터져 500이 되지 않게)
  if (isUuid(id)) {
    await s.tx(async (q) => {
      await q("select cancel_invite($1::uuid)", [id]);
      // 사람 화면에서 취소하면 그 사람에게 다시 보내 열려 있던 다른 링크도 함께 닫는다(보이지 않는 열린 링크가 남지 않게)
      if (/^\/people\//.test(back)) {
        await q(
          "select cancel_invite(i.id) from invites i where i.used_at is null and i.canceled_at is null and i.contact_id = (select contact_id from invites where id = $1::uuid)",
          [id],
        );
      }
    });
  }
  revalidatePath("/privacy");
  revalidatePath("/people", "layout");
  redirect(/^\/(privacy|people\/[0-9a-f-]{36})$/.test(back) ? back : "/privacy");
}

export interface AnswerState {
  sent: boolean;
  /** 로그인하고 답한 사람이 '내 리드미에도 저장'을 골랐으면 */
  savedMine: boolean;
  error: "consent" | "closed" | "self" | "empty" | "common" | null;
}

/** 물어본 사람에게 알리는 푸시는 응답을 보낸 뒤에(FCM이 느려도 답한 사람을 붙잡지 않게). 실패는 조용히 넘긴다 */
function notifyAnswered(notify: { to: string; name: string; contactId: string }): void {
  const sendNotify = () =>
    notifyUserT(notify.to, (locale) => ({
      title: notify.name ? translate(locale, "notif.answered", { name: notify.name }) : translate(locale, "notif.answeredAnon"),
      body: translate(locale, "notif.open"),
      path: `/people/${notify.contactId}`,
    })).catch(() => {});
  try {
    after(sendNotify);
  } catch {
    void sendNotify();
  }
}

/**
 * 답하기(로그인 없이도 된다). 답은 물어본 사람의 기록에 들어간다(그 뒤로는 그 사람 것이라 그 사람이 고친다).
 * 서버가 물어본 사람의 기록 범위로 암호화해서 시스템 권한 함수에 넘긴다
 */
export async function submitAnswer(_: AnswerState, form: FormData): Promise<AnswerState> {
  const token = String(form.get("token") ?? "");
  const consent = form.get("consent") === "1";
  const session = await getSession();
  const saveMine = !!session && form.get("saveMine") === "1";
  // 사람이 '없어요'를 눌러 직접 비운 항목들(그 밖의 빈 항목은 저장하지 않는다)
  const rawNone = json(form.get("none"));
  const none = (Array.isArray(rawNone) ? rawNone : []).filter((x): x is string => typeof x === "string").slice(0, 12);
  const r = await answerAsk(token, json(form.get("data")), consent, session?.user.id ?? null, none);
  if (!r.ok) return { sent: false, savedMine: false, error: r.error };
  const answer = r.answer;
  const notify = { to: r.inviter, name: r.name, contactId: r.contactId };
  // 내 리드미에도. revalidatePath는 부르지 않는다: 부르면 지금 화면(답한 링크)을 다시 그려 '이미 답한 링크'로 바뀐다(/me는 요청마다 새로 그린다)
  // 링크는 이미 쓰였으니(답이 물어본 사람 기록에 들어갔다) 내 리드미에 못 넣어도 답한 것 자체는 성공으로 돌려준다
  let savedMine = false;
  if (saveMine && session) {
    try {
      await session.tx(async (q) => {
        for (const [section, value] of Object.entries(answer)) if (isSection(section)) await writeSection(q, session.user.id, section, value);
      });
      savedMine = true;
    } catch (e) {
      console.warn("save answer to my card failed", e instanceof Error ? e.message : e);
    }
  }
  notifyAnswered(notify);
  track("ask_answer", { userId: session?.user.id ?? null, source: session ? "signed_in" : "guest" });
  return { sent: true, savedMine, error: null };
}

/** 한 질문 링크에 답하기(로그인 없이도 된다): 고른 보기나 적은 말이 물어본 사람 기록의 그 칸에 들어간다 */
export async function submitQuestionAnswer(_: AnswerState, form: FormData): Promise<AnswerState> {
  const session = await getSession();
  const r = await answerQuestion(String(form.get("token") ?? ""), String(form.get("question") ?? ""), String(form.get("value") ?? ""), session?.user.id ?? null);
  if (!r.ok) return { sent: false, savedMine: false, error: r.error };
  notifyAnswered({ to: r.inviter, name: r.name, contactId: r.contactId });
  track("ask_answer", { userId: session?.user.id ?? null, source: session ? "signed_in" : "guest" });
  return { sent: true, savedMine: false, error: null };
}
