import "server-only";
import { createHash } from "node:crypto";
import type { Locale, YMD } from "@readme/core";
import { aiConfigured } from "./ai";
import { refundAi, reserveAi } from "./ai-quota";
import { open, seal } from "./crypto";
import { displayName, folderName, listFolders, listNotes, type Person, type Session } from "./data";
import { asSystem } from "./db";
import { GIFT_CATALOG, type CatalogGift, type PriceBand } from "./gift-catalog";
import { makeT } from "./i18n";
import {
  COUPANG_SEARCH_PATH,
  IDEA_COUNT,
  bandPicks,
  basisCorpus,
  catalogBasis,
  acceptNote,
  cleanNote,
  catalogRequest,
  groupByBand,
  mergeBandAnswers,
  noteBand,
  groundBasis,
  leftOut,
  defaultBand,
  eligibleCatalog,
  freshCatalog,
  parseCatalogPicks,
  picksNote,
  ruleCatalogPicks,
  sanitizeCatalogPicks,
  openCard,
  type BandAnswer,
  type BandPicks,
  type CatalogPick,
  type GiftCard,
  coupangAuthorization,
  coupangSearchQuery,
  coupangSearchUrl,
  giftBasis,
  giftTiming,
  giftProfile,
  ideasRequest,
  normalizeKeyword,
  parseCoupangSearch,
  parseIdeas,
  ruleIdeas,
  sanitizeIdeas,
  type CoupangProduct,
  type CoupangResult,
  type GiftContext,
  type GiftIdea,
} from "./gift-core";

// 선물 추천: 사람 기록 전체 + 메모를 보고 고른다. 두 가지 방식:
// - 상품(쿠팡 API 키가 있을 때): 찾을 말 네 개(AI, 없으면 기록만으로) → 쿠팡 파트너스 상품 검색. COUPANG_ACCESS_KEY·COUPANG_SECRET_KEY, COUPANG_SUB_ID(채널), COUPANG_HOURLY_LIMIT(기본 20), COUPANG_BASE_URL(시험용 가짜 서버).
// - 목록(키가 없을 때, 파트너스 최종 승인 전): 미리 만든 파트너스 링크 목록(gift-catalog)에서 가격대마다 다섯.
// 고른 것은 사람마다 봉인해 gift_ideas에 둔다(표가 없거나 실패해도 고르는 건 된다).
// 쿠팡 API는 호출 한도를 넘으면 계정이 막힐 수 있어서: 같은 찾을 말은 하루 동안 DB에 둔 결과를 다시 쓰고, 지난 한 시간 호출이 한도에 닿으면 부르지 않고 쿠팡 검색 링크만 준다.

export type { BandPicks, CoupangProduct, GiftIdea, PriceBand };

export interface GiftPick extends GiftIdea {
  products: CoupangProduct[];
  /** 더 보기: 쿠팡 검색 화면 */
  more: string;
}

/** 쿠팡 API 키가 있으면 상품 방식 */
export function giftPicksConfigured(): boolean {
  return !!(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY);
}

/** 선물 추천을 보일지(GIFT_PICKS=off면 숨긴다). 키가 없으면 목록 방식 */
export function giftPicksOn(): boolean {
  return process.env.GIFT_PICKS !== "off";
}

const IDEAS_FRESH_DAYS = 14;
const SEARCH_FRESH_HOURS = 24;
const RETRY_MINUTES = 10;
const PRODUCTS_PER_IDEA = 6;

function hourlyLimit(): number {
  const n = Number(process.env.COUPANG_HOURLY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}

function coupangBase(): { base: string; extraHost?: string } {
  const custom = process.env.COUPANG_BASE_URL?.replace(/\/+$/, "");
  if (!custom) return { base: "https://api-gateway.coupang.com" };
  return { base: custom, extraHost: new URL(custom).host };
}

/** 이 사람을 위한 상황: 부르는 말, 든 폴더(한국어 이름), 챙길 날, 나이(태어난 해를 알면) */
export async function giftContext(s: Session, p: Person, occasion: GiftContext["occasion"], today: YMD): Promise<GiftContext> {
  const folders = await s.tx((q) => listFolders(q, s.user.id));
  const ko = makeT("ko");
  const year = p.card.dates?.birthday?.year;
  return {
    call: displayName(p),
    folders: folders.filter((f) => p.folderIds.includes(f.id)).map((f) => folderName(f, ko)),
    // 가까운 생일·기념일이면 그 날의 선물, 아니면(먼 챙길 날·없음) 11~12월에는 크리스마스·연말 선물
    ...giftTiming(occasion, today),
    age: year && year > 1900 && year <= today.y ? today.y - year : null,
  };
}

/** 이 사람 메모(최근 것부터, "날 내용") */
export async function giftNotes(s: Session, p: Person): Promise<string[]> {
  const notes = await s.tx((q) => listNotes(q, s.user.id, p.contactId));
  return notes.map((n) => (n.label ? `${n.label} ${n.body}` : n.body)).filter(Boolean);
}

async function askAI(body: unknown): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("ai_off");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`ai_http_${res.status}`);
  return res.json();
}

const model = () => process.env.OPENAI_MODEL || "gpt-6-luna";

/** askAI인데 실패하면(불러 보지도 못함) 잡아 둔 하루 한도를 돌려주고 같은 오류를 던진다 */
async function askPaidAI(s: Session, body: unknown): Promise<unknown> {
  try {
    return await askAI(body);
  } catch (e) {
    await refundAi(s.user.id, "gift");
    throw e;
  }
}

/** AI를 부르기 전 하루 한도 확인(사람마다·서비스 전체). 막히면 AI 없이 기록만으로 고른다 */
async function aiAllowed(s: Session): Promise<boolean> {
  return (await reserveAi({ id: s.user.id, demo: s.user.isAnonymous || s.profile.isDemo }, "gift")) === "ok";
}

/** 지난번에 고른 것(같은 basis, 14일 안). 표가 없거나 못 열면 null */
async function readKept(s: Session, contactId: string, basis: string): Promise<unknown | null> {
  try {
    const row = await s.tx((q) =>
      q.one<{ basis: string; payload: unknown; fresh: boolean }>(
        "select basis, payload, created_at > now() - make_interval(days => $3) as fresh from gift_ideas where user_id = $1 and contact_id = $2",
        [s.user.id, contactId, IDEAS_FRESH_DAYS],
      ),
    );
    return row && row.basis === basis && row.fresh ? open(row.payload, `gift-ideas:${s.user.id}:${contactId}`) : null;
  } catch (e) {
    console.warn("gift ideas read failed", e instanceof Error ? e.message : e);
    return null;
  }
}

async function keep(s: Session, contactId: string, basis: string, value: unknown): Promise<void> {
  try {
    await s.tx((q) =>
      q(
        `insert into gift_ideas (user_id, contact_id, basis, payload) values ($1, $2, $3, $4)
         on conflict (user_id, contact_id) do update set basis = excluded.basis, payload = excluded.payload, created_at = now()`,
        [s.user.id, contactId, basis, JSON.stringify(seal(value, `gift-ideas:${s.user.id}:${contactId}`))],
      ),
    );
  } catch (e) {
    console.warn("gift ideas write failed", e instanceof Error ? e.message : e);
  }
}

/** 찾을 말(상품 방식): 기록·메모·날이 그대로면 지난번 것(14일), 아니면 새로 고른다. AI가 없거나 실패하면 기록만으로(저장하지 않는다) */
export async function giftIdeas(s: Session, p: Person, ctx: GiftContext, locale: Locale, notes: string[] = []): Promise<GiftIdea[]> {
  const profile = giftProfile(p.card, notes);
  const basis = giftBasis(profile, ctx, locale);
  const corpus = basisCorpus(profile, ctx);
  const ground = (raw: unknown) => groundBasis(raw, corpus, profile.wishes, locale);
  const kept = sanitizeIdeas(await readKept(s, p.contactId, basis), profile.avoid, IDEA_COUNT, ground);
  if (kept.length) return kept;
  const rules = () => ruleIdeas(p.card, ctx, locale);
  if (!aiConfigured() || !(await aiAllowed(s))) return rules();
  let ideas: GiftIdea[] = [];
  try {
    ideas = parseIdeas(await askPaidAI(s, ideasRequest(profile, ctx, locale, model())), profile.avoid, ground);
  } catch (e) {
    console.warn("gift ideas failed", e instanceof Error ? e.message : e);
  }
  if (!ideas.length) return rules();
  await keep(s, p.contactId, basis, ideas);
  return ideas;
}

/**
 * 가격대마다 따로, 동시에 AI에 물어 고른 것을 모은다(한 번에 스무 개를 고르게 하면 답이 길어 10초, 가격대마다 다섯씩 네 번을 동시에 부르면 3~4초).
 * 하루 한도는 한 번만 잡고, 가격대 요청이 하나도 못 불렀을 때(전부 실패)만 돌려준다.
 * 가격대 하나가 실패하면 그 가격대만 기록으로 채워진다. complete: 모든 가격대가 고른 것을 줬는지(그럴 때만 저장한다)
 */
async function askCatalogBands(
  s: Session,
  groups: { band: PriceBand; items: CatalogGift[] }[],
  makeBody: (band: PriceBand, items: CatalogGift[]) => unknown,
  ground: (raw: unknown) => string[],
): Promise<{ answers: BandAnswer[]; complete: boolean }> {
  const settled = await Promise.allSettled(groups.map((g) => askAI(makeBody(g.band, g.items))));
  const answers: BandAnswer[] = [];
  let failed = 0;
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      answers.push({ band: groups[i]!.band, ...parseCatalogPicks(r.value, groups[i]!.items, ground) });
      return;
    }
    failed += 1;
    console.warn("gift picks failed", r.reason instanceof Error ? r.reason.message : r.reason);
  });
  if (failed === groups.length) await refundAi(s.user.id, "gift");
  return { answers, complete: !failed && answers.every((a) => a.picks.length > 0) };
}

/**
 * 목록 방식: 가격대마다 다섯(AI가 고르고, 모자라면 기록만으로 채운다)과 처음 열어 둘 가격대. skip = 다시 고르기로 넘긴, 지난번에 보인 것.
 * note: 무엇을 보고 어떻게 골랐는지 풀어 쓴 한두 문장(AI가 쓰고, 없으면 근거·빼 둔 것으로 만든다)
 */
export async function giftLinkPicks(s: Session, p: Person, ctx: GiftContext, notes: string[], skip: string[] = []): Promise<{ bands: BandPicks[]; initial: PriceBand; note: string }> {
  const { locale } = s.profile;
  const profile = giftProfile(p.card, notes);
  const eligible = freshCatalog(eligibleCatalog(GIFT_CATALOG, p.card, ctx, profile.notes), skip);
  const basis = `links:${skip.join(",")}:${giftBasis(profile, ctx, locale)}`;
  const rules = ruleCatalogPicks(p.card, ctx, locale, eligible, profile.notes);
  const corpus = basisCorpus(profile, ctx);
  const ground = (raw: unknown) => groundBasis(raw, corpus, profile.wishes, locale);
  const want = defaultBand(ctx);
  // 둔 것: { picks, note }(예전 것은 고른 것 배열만)
  const kept = (await readKept(s, p.contactId, basis)) as { picks?: unknown; note?: unknown } | unknown[] | null;
  let ai: CatalogPick[] = sanitizeCatalogPicks(Array.isArray(kept) ? kept : kept?.picks, eligible, ground);
  let aiNote = Array.isArray(kept) ? "" : cleanNote(kept?.note);
  if (!ai.length && aiConfigured() && eligible.length && (await aiAllowed(s))) {
    const groups = groupByBand(eligible);
    // 고른 생각은 처음 열어 둘 가격대 요청에서만 쓰게 한다(나머지는 답만 짧게)
    const withNote = noteBand(groups, want);
    const { answers, complete } = await askCatalogBands(s, groups, (band, items) => catalogRequest(profile, ctx, locale, model(), band, items, band === withNote), ground);
    ({ picks: ai, note: aiNote } = mergeBandAnswers(answers, eligible));
    // 일부 가격대가 실패했으면 고른 것은 보여 주되 저장하지 않는다(다음에 열 때 다시 고른다)
    if (ai.length && complete) await keep(s, p.contactId, basis, { picks: ai, note: aiNote });
  }
  const wishes = profile.wishes.map((w) => w.replace(/\s+/g, ""));
  const bands = bandPicks(ai, rules, eligible, (x) => catalogBasis(x, corpus, wishes, ctx, locale), ctx.season);
  return {
    bands,
    initial: bands.some((b) => b.band === want) ? want : (bands[0]?.band ?? want),
    // AI가 고른 게 없으면(기록만으로 고른 것) 그 생각도 기록으로
    note: (ai.length && acceptNote(aiNote, ctx, locale)) || picksNote(bands, leftOut(GIFT_CATALOG, p.card, profile.notes, locale), ctx, locale),
  };
}

function readCached(payload: unknown): CoupangResult | null {
  const r = payload as CoupangResult | null;
  return r && Array.isArray(r.products) ? r : null;
}

/** 쿠팡 상품 검색(하루 동안 다시 쓰기 + 시간당 한도). 못 받으면 지난 결과나 null */
export async function coupangSearch(raw: string): Promise<CoupangResult | null> {
  const keyword = normalizeKeyword(raw);
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  if (!keyword || !accessKey || !secretKey) return null;

  const got = await asSystem(async (q) => {
    const row = await q.one<{ payload: unknown; ok: boolean; fresh: boolean; recent: boolean }>(
      `select payload, ok, fetched_at > now() - make_interval(hours => $2) as fresh, fetched_at > now() - make_interval(mins => $3) as recent
       from coupang_searches where keyword = $1`,
      [keyword, SEARCH_FRESH_HOURS, RETRY_MINUTES],
    );
    const cached = readCached(row?.payload);
    if (row && ((row.ok && row.fresh) || (!row.ok && row.recent))) return { cached, claim: false };
    // 한도 세기는 한 번에 한 요청만(같은 순간 여러 화면이 불러도 넘지 않게). 쿠팡이 429로 막았으면 한 시간 쉰다
    await q("select pg_advisory_xact_lock(hashtext('coupang_calls'))");
    const busy = await q.one<{ n: number; limited: boolean }>(
      "select count(*)::int as n, coalesce(bool_or(limited), false) as limited from coupang_calls where at > now() - interval '1 hour'",
    );
    if (!busy || busy.limited || busy.n >= hourlyLimit()) return { cached, claim: false };
    await q("delete from coupang_calls where at < now() - interval '1 day'");
    await q("delete from coupang_searches where fetched_at < now() - interval '7 days'");
    await q("insert into coupang_calls default values");
    await q(
      `insert into coupang_searches (keyword, ok, fetched_at) values ($1, false, now())
       on conflict (keyword) do update set ok = false, fetched_at = now()`,
      [keyword],
    );
    return { cached, claim: true };
  });
  if (!got.claim) return got.cached;

  const { base, extraHost } = coupangBase();
  const query = coupangSearchQuery(keyword, PRODUCTS_PER_IDEA, process.env.COUPANG_SUB_ID || undefined);
  let result: CoupangResult | null = null;
  let limited = false;
  try {
    const res = await fetch(`${base}${COUPANG_SEARCH_PATH}?${query}`, {
      headers: { authorization: coupangAuthorization("GET", COUPANG_SEARCH_PATH, query, accessKey, secretKey, new Date()), "content-type": "application/json;charset=UTF-8" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (res.status === 429) limited = true;
    else if (res.ok) result = parseCoupangSearch(await res.json(), extraHost);
    if (!result) console.warn("coupang search failed", res.status);
  } catch (e) {
    console.warn("coupang search failed", e instanceof Error ? e.message : e);
  }
  await asSystem(async (q) => {
    if (result) await q("update coupang_searches set payload = $2, ok = true, fetched_at = now() where keyword = $1", [keyword, JSON.stringify(result)]);
    if (limited) await q("insert into coupang_calls (limited) values (true)");
  });
  return result ?? got.cached;
}

/** 찾을 말 몇 개와 그 상품들 */
export async function giftPicks(s: Session, p: Person, ctx: GiftContext, notes: string[], max = IDEA_COUNT): Promise<GiftPick[]> {
  const ideas = (await giftIdeas(s, p, ctx, s.profile.locale, notes)).slice(0, max);
  const found = await Promise.all(ideas.map((i) => coupangSearch(i.keyword).catch(() => null)));
  return ideas.map((i, n) => ({ ...i, products: found[n]?.products.slice(0, PRODUCTS_PER_IDEA) ?? [], more: found[n]?.landingUrl ?? coupangSearchUrl(i.keyword) }));
}

// 공유 카드: 서버 키(DATA_ENCRYPTION_KEY)에서 뽑은 서명 키
function cardKey(): Buffer {
  const k = process.env.DATA_ENCRYPTION_KEY;
  if (!k) throw new Error("DATA_ENCRYPTION_KEY is missing");
  return createHash("sha256").update(`gift-card\n${k}`).digest();
}

const SHORT_ID = /^[A-Za-z0-9]{8}$/;

/** 카드 주소를 연다: 짧은 id면 gift_cards에서, 아니면 서명 토큰(서명이 안 맞거나 깨졌으면 null) */
export async function readGiftCard(raw: string): Promise<GiftCard | null> {
  const token = decodeURIComponent(raw);
  if (!SHORT_ID.test(token)) return openCard(cardKey(), token);
  try {
    const row = await asSystem((q) => q.one<{ payload: { l?: unknown; n?: unknown; e?: unknown; i?: unknown } }>("select payload from gift_cards where id = $1", [token]));
    if (!row) return null;
    const p = row.payload;
    const ids = Array.isArray(p.i) ? p.i.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 40) : [];
    return { locale: p.l === "en" ? "en" : "ko", name: typeof p.n === "string" ? p.n.slice(0, 40) : "", event: typeof p.e === "string" ? p.e.slice(0, 60) : "", ids };
  } catch {
    return null;
  }
}
