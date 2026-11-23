import "server-only";
import { randomBytes } from "node:crypto";
import { SHARE_TTL_DAYS, hashToken, sanitizeAvatar, pickSections, sanitizeSection, isSection, isEmptySection, type AvatarConfig, type PartialCard, type Section } from "@readme/core";
import { asSystem, systemOne } from "./db";
import { aad, open, seal } from "./crypto";
import { absoluteUrl } from "./site";

// 내 기록을 짧은 링크(/s/<10글자>)로 보내기. 링크에는 아무 정보도 담지 않는다: 고른 항목은 서버 키로 암호화해 record_shares에 두고(마이그레이션 0029),
// 링크를 받은 사람이 로그인한 앱에서 열어 자기 사람들에 저장한다. 주소는 해시만 저장하고, 7일 뒤 끝나며, 받을 수 있는 횟수가 정해져 있다.

export const SHARE_MAX_CLAIMS = 10;
/** 한 사람이 동시에 열어 둘 수 있는 링크 수(넘으면 가장 오래된 것부터 닫는다) */
const ACTIVE_MAX = 20;
const TOKEN_LENGTH = 10;
const TOKEN_FORMAT = /^[A-Za-z0-9]{10}$/;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 쏠림 없는 무작위 10글자(62가지 글자, 범위 밖 값은 버린다) */
function newToken(): string {
  const limit = 256 - (256 % BASE62.length);
  let out = "";
  while (out.length < TOKEN_LENGTH) {
    for (const x of randomBytes(TOKEN_LENGTH * 2)) {
      if (x < limit && out.length < TOKEN_LENGTH) out += BASE62[x % BASE62.length];
    }
  }
  return out;
}

export interface SharedRecord {
  /** 보낸 사람이 쓰는 이름 */
  name: string;
  avatar: AvatarConfig | null;
  card: PartialCard;
}

/** 링크로 받은 기록의 안전한 모양(풀린 값을 다시 정리한다) */
function cleanRecord(raw: unknown): SharedRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { name?: unknown; avatar?: unknown; card?: unknown };
  const card: PartialCard = {};
  if (r.card && typeof r.card === "object") {
    for (const [section, value] of Object.entries(r.card as Record<string, unknown>)) {
      if (!isSection(section)) continue;
      const clean = sanitizeSection(section, value);
      if (!isEmptySection(section, clean as never)) (card as Record<string, unknown>)[section] = clean;
    }
  }
  return {
    name: typeof r.name === "string" ? r.name.replace(/\s+/g, " ").trim().slice(0, 40) : "",
    avatar: r.avatar && typeof r.avatar === "object" ? sanitizeAvatar(r.avatar) : null,
    card,
  };
}

/**
 * 링크 만들기: 내 기록에서 고른 항목(적어 둔 것만)을 암호화해 두고 짧은 주소를 돌려준다. 보낼 게 없으면 null.
 * 이미 이 사람이 연 링크가 너무 많으면 가장 오래된 것부터 닫는다
 */
export async function createRecordShare(userId: string, record: SharedRecord, sections: readonly Section[]): Promise<string | null> {
  const card = pickSections(record.card, sections);
  if (!Object.keys(card).length) return null;
  const data: SharedRecord = { name: record.name.replace(/\s+/g, " ").trim().slice(0, 40), avatar: record.avatar, card };
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = newToken();
    const hash = await hashToken(token);
    const payload = seal(data, aad.share(hash));
    const ok = await asSystem(async (q) => {
      // 같은 사람이 동시에 여러 번 눌러도 한도가 지켜지게 사람별로 줄 세운다
      await q("select pg_advisory_xact_lock(hashtext($1))", [`share:${userId}`]);
      await q("delete from record_shares where user_id = $1 and expires_at <= now()", [userId]);
      await q(
        `delete from record_shares where token_hash in (
           select token_hash from record_shares where user_id = $1 order by created_at desc offset $2)`,
        [userId, ACTIVE_MAX - 1],
      );
      const row = await q.one(
        `insert into record_shares (token_hash, user_id, payload, max_claims, expires_at)
         values ($1, $2, $3, $4, now() + make_interval(days => $5)) on conflict do nothing returning token_hash`,
        [hash, userId, JSON.stringify(payload), SHARE_MAX_CLAIMS, SHARE_TTL_DAYS],
      );
      return !!row;
    });
    if (ok) return absoluteUrl(`/s/${token}`);
  }
  return null;
}

export type ShareView =
  | { state: "ok"; hash: string; fromId: string; record: SharedRecord; expiresAt: string }
  | { state: "notfound" | "expired" | "full" };

/** 주소 조각을 풀어 토큰으로(깨진 %는 그대로 = 없는 링크) */
export function shareTokenOf(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 링크 열기(로그인 없이 시스템 권한으로). 모양이 틀리거나 풀 수 없으면 없는 링크로 본다 */
export async function readRecordShare(token: string): Promise<ShareView> {
  if (!TOKEN_FORMAT.test(token)) return { state: "notfound" };
  const hash = await hashToken(token);
  try {
    const row = await systemOne<{ user_id: string; payload: unknown; claims: number; max_claims: number; expires_at: Date; expired: boolean }>(
      "select user_id, payload, claims, max_claims, expires_at, expires_at <= now() as expired from record_shares where token_hash = $1",
      [hash],
    );
    if (!row) return { state: "notfound" };
    if (row.expired) return { state: "expired" };
    if (row.claims >= row.max_claims) return { state: "full" };
    const record = cleanRecord(open(row.payload, aad.share(hash)));
    if (!record) return { state: "notfound" };
    return { state: "ok", hash, fromId: row.user_id, record, expiresAt: new Date(row.expires_at).toISOString() };
  } catch (e) {
    // 표가 아직 없는 배포 직후 같은 때: 없는 링크로
    console.warn("read record share failed", e instanceof Error ? e.message : e);
    return { state: "notfound" };
  }
}

/** 받을 횟수 하나를 먼저 잡는다(한도·기한 안일 때만). 못 잡으면 false */
export async function reserveShareClaim(hash: string): Promise<boolean> {
  const row = await systemOne("update record_shares set claims = claims + 1 where token_hash = $1 and claims < max_claims and expires_at > now() returning token_hash", [hash]);
  return !!row;
}

/** 저장이 안 됐으면 잡았던 횟수를 돌려준다 */
export async function releaseShareClaim(hash: string): Promise<void> {
  await systemOne("update record_shares set claims = greatest(claims - 1, 0) where token_hash = $1 returning token_hash", [hash]).catch(() => null);
}
