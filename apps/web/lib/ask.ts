import "server-only";
import { QUESTIONS, QUESTION_SECTION, applyAnswer, canAnswerOwn, hashToken, isLocale, isSection, questionSections, sanitizeAvatar, sanitizeQuestionIds, sanitizeSection, sanitizeSections, type AvatarConfig, type DailyQuestion, type PartialCard, type Section } from "@readme/core";
import { cache } from "react";
import { keepAnswered, keepAskerWishes, prefillForRecipient } from "./ask-core";
import { aad, open } from "./crypto";
import { isLockedPayload, LIMITS } from "./data-core";
import { openContactSections, openPrefill, sealContactSections, sealPrefill, type Session } from "./data";
import { asSystem, dbReason, systemOne } from "./db";
import { insertInvite } from "./invites";
import { isUuid } from "./uuid";

// 물어보기 만들기·읽기·답하기의 공통 부분. 웹·앱(서버 액션 app/actions/request.ts)이 쓴다

export function cleanCard(input: unknown, allowed: Section[]): PartialCard {
  const card: PartialCard = {};
  if (!input || typeof input !== "object") return card;
  for (const [section, value] of Object.entries(input as Record<string, unknown>)) {
    if (isSection(section) && allowed.includes(section) && value != null) (card as Record<string, unknown>)[section] = sanitizeSection(section, value);
  }
  return card;
}

/**
 * 주소록의 한 사람(to)에게, 또는 새 사람(name)을 주소록에 넣고 물어보기 링크 토큰을 만든다.
 * 내 기록에 이미 적힌 값은 미리 채워 보내서, 상대는 맞아요·고치기만 누르면 된다. 없는 사람이면 'not_found'를 던진다
 */
export async function createAsk(s: Session, input: { to?: string; name?: string; sections: Section[]; questions?: DailyQuestion["id"][]; message: string }): Promise<{ token: string; contactId: string }> {
  const { to, name = "", message } = input;
  // 질문 하나만 묻는 링크: 항목은 그 질문이 속한 항목(답이 그 칸에 들어간다)
  const questions = sanitizeQuestionIds(input.questions, 3);
  const sections = questions.length ? questionSections(questions) : input.sections;
  return s.tx(async (q) => {
    let contactId: string;
    let prefill: PartialCard = {};
    if (to) {
      // 내 주소록 칸만(RLS). 미리 채울 값은 내 기록에서 물어보는 항목만
      if (!isUuid(to)) throw new Error("not_found");
      const c = await q.one<{ id: string }>("select id from contacts where id = $1::uuid", [to]);
      if (!c) throw new Error("not_found");
      contactId = c.id;
      const r = await q.one<{ sections: unknown }>("select sections from contact_cards where contact_id = $1", [contactId]);
      const mine = openContactSections(s.user.id, contactId, r?.sections);
      // 선물 칸의 '해주고 싶은 선물'(wishlist)은 상대에게 새면 안 되니 뺀다
      // (한 질문만 묻는 링크는 칩으로 고르게 해서 미리 채우지 않는다)
      if (!questions.length) prefill = prefillForRecipient(Object.fromEntries(Object.entries(mine).filter(([k]) => sections.includes(k as Section))) as PartialCard);
    } else {
      // 새 사람도 사람 수 한도(LIMITS.people)를 지킨다
      const n = await q.one<{ n: number }>("select count(*)::int as n from contacts where user_id = $1", [s.user.id]);
      if ((n?.n ?? 0) >= LIMITS.people) throw new Error("limit");
      const c = await q.one<{ id: string }>("insert into contacts (user_id, nickname) values ($1, $2) returning id", [s.user.id, name]);
      contactId = c!.id;
      await q("insert into contact_cards (contact_id, author_id) values ($1, $2)", [contactId, s.user.id]);
    }
    const invite = await insertInvite(q, { inviter_id: s.user.id, contact_id: contactId, sections, questions: questions.length ? questions : undefined, recipient_name: name, message }, (hash) =>
      Object.keys(prefill).length ? sealPrefill(hash, prefill) : {},
    );
    return { token: invite.token, contactId };
  });
}

export type AskState = "active" | "expired" | "used" | "canceled" | "not_found";

export type AskRow = {
  state: AskState;
  inviter_id: string | null;
  inviter_name: string | null;
  contact_id: string | null;
  recipient_name: string | null;
  sections: string[] | null;
  prefill: unknown;
  message: string | null;
  /** 한 질문만 묻는 링크의 질문 id들(0033 마이그레이션 전에는 이 열이 없다) */
  questions?: string[] | null;
  /** 물어본 사람이 꾸민 얼굴(꾸미지 않았으면 빈 객체) */
  inviter_avatar?: unknown;
};

/**
 * 링크 토큰으로 물어보기 한 줄(로그인 없이 연다. 토큰 해시가 맞는 한 줄만). 미리 채운 값은 풀어서 돌려준다.
 * request_for_answer는 읽기만 하는 함수라 트랜잭션 없이 한 번에 부른다. 예전에 보낸 물어보기에 든 wishlist도 여기서 뺀다
 */
export async function readAsk(token: string): Promise<{ row: AskRow; prefill: PartialCard; questions: DailyQuestion["id"][]; inviterAvatar: AvatarConfig | null }> {
  const hash = await hashToken(token);
  // 물어본 사람의 얼굴은 같은 문장에서 함께 읽는다(함수를 고치지 않아도 돼서 마이그레이션 전에도 돈다)
  const row = ((await systemOne<AskRow>("select r.*, (select p.avatar from profiles p where p.id = r.inviter_id) as inviter_avatar from request_for_answer($1) r", [hash])) ?? { state: "not_found" }) as AskRow;
  const face = row.inviter_avatar;
  return {
    row,
    prefill: row.state === "active" ? prefillForRecipient(openPrefill(hash, row.prefill)) : {},
    questions: sanitizeQuestionIds(row.questions, 3),
    inviterAvatar: face && typeof face === "object" && Object.keys(face).length ? sanitizeAvatar(face) : null,
  };
}

/** 한 요청 안에서는 한 번만 읽는다(링크 미리보기 generateMetadata와 화면이 같이 쓴다) */
export const readAskOnce = cache(readAsk);

/** empty: 적은 것이 하나도 없다(항목을 건드리지 않고 보냈다) */
export type AnswerError = "consent" | "closed" | "self" | "empty" | "common";

/**
 * 답하기(로그인 없이도 된다). 답은 물어본 사람의 기록에 들어간다(그 뒤로는 그 사람 것이라 그 사람이 고친다).
 * 서버가 물어본 사람의 기록 범위로 암호화해서 시스템 권한 함수에 넘긴다. answererId가 있으면 물어본 사람 주소록에 그 사람 얼굴·이름이 이어진다
 */
export async function answerAsk(
  token: string,
  data: unknown,
  consent: boolean,
  answererId: string | null,
  none: readonly string[] = [],
): Promise<{ ok: true; answer: PartialCard; inviter: string; name: string; contactId: string } | { ok: false; error: AnswerError }> {
  const hash = await hashToken(token);
  try {
    return await asSystem(async (q) => {
      const row = await q.one<AskRow>("select * from request_for_answer($1)", [hash]);
      if (!row || row.state !== "active") throw new Error("closed");
      // 값이 있는 항목만(건드리지 않은 빈 항목은 저장하지 않는다). 적은 게 하나도 없으면 답으로 치지 않는다(링크도 그대로 두어 다시 답할 수 있다)
      const answer = keepAnswered(cleanCard(data, sanitizeSections(row.sections)), none);
      if (!Object.keys(answer).length) throw new Error("empty");
      if (answer.safety && !consent) throw new Error("consent_required");
      // 물어본 사람의 기록에 이미 있는 항목: 키가 다른 환경에서 못 푸는 값은 덮어쓰지 않고(진짜 기록 보호), 선물 칸은 내가 적어 둔 wishlist를 지킨다
      const mine = await q.one<{ sections: Record<string, unknown> | null }>("select sections from contact_cards where contact_id = $1 and author_id = $2", [row.contact_id, row.inviter_id]);
      for (const section of Object.keys(answer)) {
        if (isLockedPayload(mine?.sections?.[section], (p) => open(p, aad.contact(row.inviter_id!, row.contact_id!, section)))) throw new Error("undecryptable");
      }
      // 저장하는 값에만 합친다. 돌려주는 answer는 상대가 쓴 그대로(상대가 '내 리드미에도'를 고르면 그 값이 상대 기록에 들어가니, 내 wishlist가 섞이면 안 된다)
      const stored: PartialCard = { ...answer };
      if (answer.gifts) {
        const existing = openContactSections(row.inviter_id!, row.contact_id!, { gifts: mine?.sections?.gifts }).gifts;
        stored.gifts = sanitizeSection("gifts", keepAskerWishes(answer.gifts, existing));
      }
      await q("select submit_request_answer($1, $2, $3, $4)", [hash, JSON.stringify(sealContactSections(row.inviter_id!, row.contact_id!, stored)), consent, answererId]);
      return { ok: true as const, answer, inviter: row.inviter_id!, name: (row.recipient_name ?? "").trim(), contactId: row.contact_id! };
    });
  } catch (e) {
    const reason = dbReason(e);
    return { ok: false, error: reason.includes("consent") ? "consent" : reason.includes("self") ? "self" : reason.includes("empty") ? "empty" : /closed|used|expired|canceled|not_found/.test(reason) ? "closed" : "common" };
  }
}

/**
 * 한 질문 링크에 답하기(로그인 없이도 된다). 고른 보기나 적은 말을 물어본 사람 기록의 그 칸에 오늘의 질문과 똑같이 넣는다
 * (그 항목의 다른 칸은 그대로 두고 그 칸만 더하거나 바꾼다). 보기에 없는 말은 직접 적을 수 있는 질문(음료·꽃·향·음악·영화)에서만 받는다
 */
export async function answerQuestion(
  token: string,
  questionId: string,
  value: string,
  answererId: string | null,
): Promise<{ ok: true; section: Section; inviter: string; name: string; contactId: string } | { ok: false; error: AnswerError }> {
  const hash = await hashToken(token);
  const id = sanitizeQuestionIds([questionId])[0];
  const text = value.replace(/\s+/g, " ").trim().slice(0, 60);
  const question = QUESTIONS.find((x) => x.id === id);
  if (!id || !question || !text) return { ok: false, error: "empty" };
  if (!question.options.some((o) => o.value === text) && !canAnswerOwn(id)) return { ok: false, error: "common" };
  try {
    return await asSystem(async (q) => {
      const row = await q.one<AskRow>("select * from request_for_answer($1)", [hash]);
      if (!row || row.state !== "active") throw new Error("closed");
      if (!sanitizeQuestionIds(row.questions, 3).includes(id)) throw new Error("closed");
      const section = QUESTION_SECTION[id];
      if (answererId && answererId === row.inviter_id) throw new Error("self");
      const mine = await q.one<{ sections: Record<string, unknown> | null }>("select sections from contact_cards where contact_id = $1 and author_id = $2", [row.contact_id, row.inviter_id]);
      // 키가 다른 환경에서 못 푸는 값은 덮어쓰지 않는다(진짜 기록 보호)
      if (isLockedPayload(mine?.sections?.[section], (p) => open(p, aad.contact(row.inviter_id!, row.contact_id!, section)))) throw new Error("undecryptable");
      const owner = await q.one<{ locale: string | null }>("select coalesce(locale, system_locale) as locale from profiles where id = $1", [row.inviter_id]);
      const existing = openContactSections(row.inviter_id!, row.contact_id!, { [section]: mine?.sections?.[section] });
      // 오늘의 질문과 같은 규칙으로 그 칸에만 넣는다
      const next = applyAnswer(existing, id, text, isLocale(owner?.locale) ? owner.locale : "ko");
      const value = next[section];
      if (value == null) throw new Error("empty");
      await q("select submit_request_answer($1, $2, $3, $4)", [hash, JSON.stringify(sealContactSections(row.inviter_id!, row.contact_id!, { [section]: value } as PartialCard)), false, answererId]);
      return { ok: true as const, section, inviter: row.inviter_id!, name: (row.recipient_name ?? "").trim(), contactId: row.contact_id! };
    });
  } catch (e) {
    const reason = dbReason(e);
    return { ok: false, error: reason.includes("self") ? "self" : reason.includes("empty") ? "empty" : /closed|used|expired|canceled|not_found/.test(reason) ? "closed" : "common" };
  }
}
