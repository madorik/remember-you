// 초대 링크·코드. 토큰은 해시만 저장하고, 링크가 안 열릴 때(앱을 새로 깔았을 때 등)를 위해 짧은 코드도 같이 준다.
// Web Crypto만 써서 브라우저·Node 둘 다에서 돈다.

import { SECTIONS_BY_IMPORTANCE, isEmptySection, type PartialCard, type Section } from "./card";
import { QUESTIONS, QUESTION_SECTION, type DailyQuestion } from "./questions";

/** 물어보기 링크가 열려 있는 날수. 개인정보 처리방침에 '7일'로 적혀 있어 방침을 고치기 전까지 7일(DB 제약은 0033에서 31일까지 풀어 둠, 30으로 올리면 됨) */
export const INVITE_TTL_DAYS = 7;
/** DB 제약이 아직 8일이던 때(0033 마이그레이션 전)의 링크 기간. 새 제약이 적용되기 전에는 이 기간으로 물러난다 */
export const INVITE_TTL_FALLBACK_DAYS = 7;
/** 내 기록 공유 링크(/s/…)가 열려 있는 날수: 건강·사이즈 같은 값이 담겨 물어보기 링크보다 짧게 둔다 */
export const SHARE_TTL_DAYS = 7;
export type InviteKind = "share" | "request";

/** 물어보기에서 처음부터 골라 두는 항목 수(받는 사람이 부담 없게). 나머지는 직접 더 고를 수 있다 */
export const ASK_DEFAULT_TOPICS = 3;

/**
 * 아직 안 적힌 항목(missing) 중 중요한 것부터(생일·못 먹는 것 …) 최대 limit개. 그 사람이든 새 사람이든 같은 규칙.
 * 비어 있는 게 없으면 빈 배열(부르는 쪽이 기본 항목으로 대신한다)
 */
export function defaultAskTopics(missing: readonly Section[], limit: number = ASK_DEFAULT_TOPICS): Section[] {
  return SECTIONS_BY_IMPORTANCE.filter((s) => missing.includes(s)).slice(0, limit);
}

/** among 중 이 기록에 아직 아무것도 안 적힌 항목(카드에 없거나, 있어도 비어 있다) */
export function emptySections(card: PartialCard, among: readonly Section[]): Section[] {
  return among.filter((s) => isEmptySection(s, card[s]));
}

/**
 * 물어보기에서 처음 골라 두는 항목: 그 사람이 아직 안 적은 항목(missing)을 중요한 순서로 3개까지.
 * 비어 있는 게 3개보다 적어도 그것만 고른다(이미 아는 항목을 다시 묻지 않고, 더 묻고 싶으면 직접 더 고른다). 하나도 없을 때만 기본 항목(fallback)
 */
export function pickAskTopics(missing: readonly Section[], fallback: readonly Section[]): Section[] {
  const empty = defaultAskTopics(missing);
  return empty.length ? empty : [...fallback];
}

/** 항목마다 받는 사람이 답하는 데 드는 대략의 초 */
const ASK_SECONDS: Record<Section, number> = { dates: 10, safety: 20, taste: 20, gifts: 20, sizes: 20, favorites: 30, culture: 25, life: 20, pets: 20 };

/** 고른 항목들에 받는 사람이 답하는 데 드는 대략의 분(1분 이상) */
export function askMinutes(topics: readonly Section[]): number {
  const seconds = topics.reduce((sum, s) => sum + (ASK_SECONDS[s] ?? 20), 0);
  return Math.max(1, Math.ceil(seconds / 60));
}

/** 물어보기 링크에 담긴 질문 id(오늘의 질문 중 하나). 모르는 것·겹치는 것은 버리고 최대 max개 */
export function sanitizeQuestionIds(v: unknown, max = 1): DailyQuestion["id"][] {
  const out: DailyQuestion["id"][] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const q = QUESTIONS.find((y) => y.id === x);
    if (q && !out.includes(q.id)) out.push(q.id);
    if (out.length >= max) break;
  }
  return out;
}

/** 질문들의 답이 들어갈 항목(겹침 없이, 중요도 순) */
export function questionSections(ids: readonly DailyQuestion["id"][]): Section[] {
  return SECTIONS_BY_IMPORTANCE.filter((s) => ids.some((id) => QUESTION_SECTION[id] === s));
}

// 헷갈리는 글자(0 O 1 I L)는 뺐다
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function randomToken(bytes = 32): string {
  const b = randomBytes(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function randomCode(): string {
  // 256을 알파벳 길이로 나눈 나머지 쏠림을 없애려고 범위 밖 값은 버린다
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const x of randomBytes(CODE_LENGTH * 2)) {
      if (x < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[x % CODE_ALPHABET.length];
    }
  }
  return out;
}

/** 사용자가 친 코드를 정리한다. 소문자·공백·하이픈은 봐준다. 코드에 없는 글자가 있으면 null */
export function normalizeCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== CODE_LENGTH || [...s].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return s;
}

export type InviteStatus = "active" | "expired" | "used" | "canceled";

export function inviteStatus(
  invite: { expires_at: string; used_at: string | null; canceled_at: string | null },
  now: Date = new Date(),
): InviteStatus {
  if (invite.canceled_at) return "canceled";
  if (invite.used_at) return "used";
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return "expired";
  return "active";
}

export function daysLeft(expiresAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}
