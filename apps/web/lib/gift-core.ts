// 선물 추천 중 서버 키와 상관없는 것: 기록 전체 + 메모 → 힌트 줄, AI 요청 몸·응답 풀기, 기록만으로 고르기(AI가 없거나 실패할 때), 쿠팡 파트너스 서명·응답 풀기,
// 쿠팡 API 키가 없을 때 쓰는 찾을 말 목록(gift-catalog)에서 고르기(가격대마다 다섯).
// 서버 전용 표시가 없어 시험에서 바로 불러 쓴다. 쿠팡은 한국 쇼핑몰이라 찾을 말·힌트는 늘 한국어로, 이유(reason)만 화면 언어로.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { ALCOHOL_KINDS, ALLERGENS, COLORS, DIETS, DISLIKES, METALS, MOVIE_GENRES, MUSIC_GENRES, PATTERNS, PET_KINDS, SEASONS, STYLES, VIBES, josa, isLocale, labelOf, realCodes, type Locale, type PartialCard, type YMD } from "@readme/core";
import { PRICE_BANDS, type CatalogGift, type PriceBand, type SeasonId } from "./gift-catalog";

export interface GiftIdea {
  /** 쿠팡 찾을 말(한국어). 예: 캠핑 머그컵 */
  keyword: string;
  /** 주고 싶어지게 포장한 한 문장(부르는 말 없이). 예: 주말마다 산에 오르시니, 가벼운 스틱이면 무릎 부담을 덜어 드려요 */
  reason: string;
  /** 이 사람 기록의 어느 부분을 보고 골랐는지 짧은 말 한두 개(등산, 허리 통증, 60대 아빠). 기록에 있는 것만 */
  basis?: string[];
}

export interface GiftContext {
  /** 내가 부르는 말(아내, 아빠) */
  call: string;
  /** 이 사람이 든 폴더 이름(가족, 회사…) */
  folders: string[];
  /** 챙길 날. daysUntil: 오늘부터 그 날까지(없으면 사람이 그 날을 짚어 연 것) */
  occasion: { kind: "birthday" | "anniversary"; label: string; daysUntil?: number } | null;
  /** 생일·기념일이 가깝지 않을 때의 지금 철(크리스마스·연말). 챙길 날이 있으면 null */
  season?: SeasonId | null;
  age: number | null;
}

/** 이 안으로 다가온 생일·기념일은 그 날의 선물로, 더 멀면 지금 철을 본다 */
export const NEAR_OCCASION_DAYS = 30;

/** 지금이 크리스마스·연말 철인가: 11월과 12월(지금 달이나 다음 달이 크리스마스). 아니면 null */
export function giftSeason(today: YMD): SeasonId | null {
  return today.m === 11 || today.m === 12 ? "christmas" : null;
}

/**
 * 챙길 날과 철 정하기. 가까운 생일·기념일(NEAR_OCCASION_DAYS 안, 또는 daysUntil 없이 그 날을 짚어 연 것)이면 그 날의 선물이고,
 * 아니면(먼 챙길 날·없음) 챙길 날은 비우고 지금 철이 있으면 그 철의 선물로 본다. daysUntil은 날마다 달라 고른 것을 다시 쓰는 열쇠(giftBasis)에 넣지 않으려고 뗀다
 */
export function giftTiming(occasion: GiftContext["occasion"], today: YMD): Pick<GiftContext, "occasion" | "season"> {
  if (occasion && (occasion.daysUntil == null || occasion.daysUntil <= NEAR_OCCASION_DAYS)) return { occasion: { kind: occasion.kind, label: occasion.label }, season: null };
  return { occasion: null, season: giftSeason(today) };
}

const SEASON_KO = "크리스마스·연말";
const SEASON_EN = "Christmas and year-end";

export interface GiftProfile {
  /** "취미: 캠핑, 등산" 같은 줄 */
  hints: string[];
  /** 해주고 싶은 선물(적어 둔 것) */
  wishes: string[];
  /** 사양하는 것·알레르기·못 먹는 것 */
  avoid: string[];
  giftCard: "yes" | "no" | null;
  /** 내 메모(최근 것부터). 예: 작년 생일에 지갑 선물함 */
  notes: string[];
}

export const IDEA_COUNT = 4;

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const ko = (list: Parameters<typeof labelOf>[0], codes: readonly string[] | undefined) => realCodes(codes).map((c) => labelOf(list, c, "ko"));

/** 사이즈 줄(상의 95, 신발 260mm …) */
function sizeLine(card: PartialCard): string {
  const z = card.sizes;
  const v = [z?.top ? `상의 ${z.top}` : "", z?.bottom ? `하의 ${z.bottom}` : "", z?.shoe ? `신발 ${z.shoe}mm` : "", z?.ring ? `반지 ${z.ring}호` : ""].filter(Boolean);
  return v.length ? `사이즈(체형 참고): ${v.join(", ")}` : "";
}

/** 기록 전체와 메모를 선물 고를 때 쓰는 줄로(메모는 최근 20개, 하나에 200자까지) */
export function giftProfile(card: PartialCard, notes: string[] = []): GiftProfile {
  const { gifts: g, favorites: f, taste: t, culture: c, life: l, safety: s, pets: p } = card;
  // 반려동물: "콩이(강아지 말티즈)"처럼, 간식·장난감은 따로 한 줄
  const pets = (p?.pets ?? []).map((x) => {
    const what = [x.kind ? labelOf(PET_KINDS, x.kind, "ko") : "", x.breed].filter(Boolean).join(" ");
    return x.name && what ? `${x.name}(${what})` : x.name || what;
  });
  const petTreats = (p?.pets ?? []).flatMap((x) => x.treats.map((tr) => (x.name ? `${x.name}: ${tr}` : tr)));
  const line = (label: string, values: (string | undefined | null)[]) => {
    const v = values.map((x) => clean(x, 80)).filter(Boolean);
    return v.length ? `${label}: ${v.join(", ")}` : "";
  };
  const noDrink = t?.alcohol?.level === "none";
  const hints = [
    line("취미", l?.hobbies ?? []),
    line("좋아하는 브랜드", g?.brands ?? []),
    line("좋아하는 향", [f?.scent]),
    line("좋아하는 꽃", [f?.flowers]),
    line("좋아하는 색", ko(COLORS, f?.colors)),
    line("좋아하는 무늬", ko(PATTERNS, f?.patterns)),
    line("옷 스타일", ko(STYLES, f?.styles)),
    line("액세서리 색", ko(METALS, f?.metals)),
    line("좋아하는 분위기", ko(VIBES, f?.vibes)),
    line("좋아하는 장소", f?.places ?? []),
    line("최애 연예인·가수", [f?.idol]),
    line("좋아하는 캐릭터", [f?.character]),
    line("응원하는 팀", [f?.team]),
    line("좋아하는 동물", [f?.animal]),
    line("키우는 반려동물", pets),
    line("반려동물이 좋아하는 간식·장난감", petTreats),
    line("좋아하는 음식", t?.likes ?? []),
    line("좋아하는 디저트·간식", [t?.dessert]),
    line("자주 마시는 음료", [t?.drinks]),
    noDrink ? "" : line("좋아하는 술", ko(ALCOHOL_KINDS, t?.alcohol?.kinds)),
    line("식단", ko(DIETS, s?.diets)),
    line("좋아하는 책·작가", [c?.book]),
    line("음악", [...ko(MUSIC_GENRES, c?.musicGenres), c?.song]),
    line("영화", [...ko(MOVIE_GENRES, c?.movieGenres), c?.movie]),
    line("드라마", [c?.drama]),
    line("즐겨 보는 것", [c?.shows]),
    line("좋아하는 계절", ko(SEASONS, l?.seasons)),
    line("가 보고 싶은 곳", [l?.travel]),
    sizeLine(card),
  ].filter(Boolean);
  const avoid = [
    ...(g?.skip ?? []).map((x) => clean(x, 60)),
    ...ko(ALLERGENS, s?.allergens).map((x) => `${x}(알레르기)`),
    ...(s?.allergyNote ? [`${clean(s.allergyNote, 60)}(알레르기)`] : []),
    ...ko(DISLIKES, s?.dislikes),
    ...(noDrink ? ["술"] : []),
  ].filter(Boolean);
  return {
    hints,
    wishes: (g?.wishlist ?? []).map((w) => clean(w.title, 60)).filter(Boolean),
    avoid,
    giftCard: g?.giftCard ?? null,
    notes: notes.map((n) => clean(n, 200)).filter(Boolean).slice(0, 20),
  };
}

/** 같은 기록·같은 날이면 같은 값: 지난번에 고른 걸 다시 쓴다(기록이 그대로 남지 않게 해시로) */
export function giftBasis(profile: GiftProfile, ctx: GiftContext, locale: Locale): string {
  // v: 고르는 지침이 바뀌면 올려서 지난번 것을 다시 고르게
  return createHash("sha256").update(JSON.stringify({ v: 12, profile, ctx, locale })).digest("hex");
}

// ── 고른 근거: 이 사람 기록의 어느 부분을 보고 골랐는지(선물마다 한두 개, 위에 모아서도) ──

/** 나이대 말(62 → 60대, 60s) */
export function ageWord(ctx: GiftContext, locale: Locale = "ko"): string {
  if (ctx.age == null || ctx.age < 10) return "";
  const d = Math.floor(ctx.age / 10) * 10;
  return locale === "ko" ? `${d}대` : `${d}s`;
}

const WISH_BASIS = /적어\s?둔|on your list/i;
const BASIS_STOP = new Set(["선물", "좋아함", "좋아하는", "좋아해요", "취향", "관심", "스타일", "사랑", "gift", "likes", "love"]);

/** 근거가 기록에 있는지 견줄 글(띄어쓰기 없이, 소문자): 기록 값·해주고 싶은 선물·메모·부르는 말·폴더·챙길 날·나이대 */
export function basisCorpus(profile: GiftProfile, ctx: GiftContext): string {
  const values = profile.hints.map((h) => h.slice(h.indexOf(": ") + 2));
  return [...values, ...profile.wishes, ...profile.notes, ctx.call, ...ctx.folders, ctx.occasion ? occasionText(ctx) : "", ctx.season ? "크리스마스 연말 christmas" : "", ageWord(ctx, "ko"), ageWord(ctx, "en")]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/**
 * AI가 댄 근거 중 기록에 실제로 나오는 것만(낱말 하나라도, 조사 한 글자는 떼고 견준다), 두 개까지. 지어낸 근거(기록에 없는 골프 등)는 버린다.
 * 해주고 싶은 선물 이름 그대로면(상품 이름과 겹친다) '적어 둔 선물'로
 */
export function groundBasis(raw: unknown, corpus: string, wishes: string[], locale: Locale = "ko"): string[] {
  const wishKeys = wishes.map((w) => w.toLowerCase().replace(/\s+/g, "")).filter((w) => w.length >= 2);
  const out: string[] = [];
  const add = (w: string) => {
    if (!out.includes(w)) out.push(w);
  };
  for (const r of Array.isArray(raw) ? raw : []) {
    const label = clean(r, 40);
    if (!label || label.length > 14) continue;
    const key = label.toLowerCase().replace(/\s+/g, "");
    if (wishKeys.length && (WISH_BASIS.test(label) || (key.length >= 2 && wishKeys.some((w) => w.includes(key) || key.includes(w))))) add(wishBasis(locale));
    else {
      const words = label.toLowerCase().split(" ").filter((w) => w.length >= 2 && !BASIS_STOP.has(w));
      if (words.some((w) => corpus.includes(w) || (w.length >= 3 && corpus.includes(w.slice(0, -1))))) add(label);
    }
    if (out.length >= 2) break;
  }
  return out;
}

/** 맞는 취향이 없을 때의 근거: 나이대와 부르는 말(60대 아빠), 그것도 없으면 챙길 날 */
export function fallbackBasis(ctx: GiftContext, locale: Locale): string[] {
  const who = [ageWord(ctx, locale), clean(ctx.call, 8)].filter(Boolean).join(" ");
  if (who) return [who];
  if (!ctx.occasion) return ctx.season ? [locale === "ko" ? SEASON_KO : "Christmas"] : [];
  return [locale === "ko" ? occasionText(ctx) : ctx.occasion.kind === "birthday" ? "Birthday" : "Anniversary"];
}

const wishBasis = (locale: Locale) => (locale === "ko" ? "적어 둔 선물" : "On your list");

/** 취향이 아닌 일반 근거인지: 낱말이 모두 나이(70세, 60대)·부르는 말·폴더·챙길 날 */
export function isGenericBasis(w: string, ctx: GiftContext): boolean {
  const plain = new Set([clean(ctx.call, 40), ...ctx.folders, ...(ctx.occasion ? [occasionText(ctx), "birthday", "anniversary"] : []), ...(ctx.season ? [SEASON_KO, "크리스마스", "연말", "christmas"] : [])].filter(Boolean).map((x) => x.toLowerCase()));
  return w.toLowerCase().split(" ").every((x) => plain.has(x) || /^\d+(세|살|대|s)$/.test(x));
}

/** 고른 것들의 근거를 많이 나온 것부터, 일반 근거(나이대·부르는 말·폴더·챙길 날)는 뒤로 */
export function basisSummary(bands: { items: { basis: string[] }[] }[], ctx: GiftContext, max = 6): string[] {
  const count = new Map<string, number>();
  for (const b of bands) for (const i of b.items) for (const w of i.basis) count.set(w, (count.get(w) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => Number(isGenericBasis(a[0], ctx)) - Number(isGenericBasis(b[0], ctx)) || b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

/** 고른 생각 한 문장(AI가 못 쓰거나 너무 길 때): 눈여겨본 것 둘까지와 빼 둔 것 둘까지. 부르는 말은 넣지 않는다 */
export function picksNote(bands: { items: { basis: string[] }[] }[], left: string[], ctx: GiftContext, locale: Locale): string {
  const ko = locale === "ko";
  const seen = basisSummary(bands, ctx, 8);
  const wish = seen.includes(wishBasis(locale));
  const facts = [...(wish ? [wishBasis(locale)] : []), ...seen.filter((w) => w !== wishBasis(locale) && !isGenericBasis(w, ctx))].slice(0, 2);
  const out = left.slice(0, 2);
  const age = ageWord(ctx, locale);
  const season = ctx.season ? (ko ? `${SEASON_KO}를 맞아` : `for ${SEASON_EN}`) : "";
  if (!ko) {
    const went = facts.length ? `Picked ${season ? `${season}, ` : ""}with ${facts.join(" and ")} in mind` : `${season ? `Picked ${season}` : "Safe picks"}${age ? ` for their ${age}` : ""}`;
    return `${went}${out.length ? `, leaving out ${out.join(" and ")}` : ""}.`;
  }
  const pair = (xs: string[], form: string) => (xs.length > 1 ? `${josa(xs[0]!, "과")} ${josa(xs[1]!, form)}` : josa(xs[0] ?? "", form));
  const parts = [...(season ? [season] : []), facts.length ? `${pair(facts, "을")} 보고` : `${age ? `${age}에 ` : ""}무난한 것들로`];
  if (out.length) parts.push(`${pair(out, "은")} 빼고`);
  return `${parts.join(", ")} 골랐어요`;
}

/** AI가 쓴 고른 생각을 쓸지: 한 줄, 짧게(한국어 50자·영어 110자), 부르는 말·관계 말이 없을 때만. 아니면 빈칸(기록으로 만든 문장을 쓴다) */
export function acceptNote(v: unknown, ctx: GiftContext, locale: Locale): string {
  const note = clean(v, 200);
  const call = clean(ctx.call, 40);
  if (!note || note.length > (locale === "ko" ? 50 : 110)) return "";
  if ((call && note.includes(call)) || CLOSE.test(note) || ELDERS.test(note) || /남편|부모님|어머님|아버님/.test(note)) return "";
  return note;
}

/** AI가 쓴 고른 생각: 한 줄로, 260자까지 */
export function cleanNote(v: unknown): string {
  return clean(v, 260);
}

const PITCH = `reason: a short, warm pitch in LANGUAGE that makes the user want to give this gift, written like a thoughtful friend's tip. Tie what you know about this person to what kind of this gift suits them and why:
- their tastes, hobbies, wishes and notes (e.g. 주말마다 산에 오른다, 요즘 허리가 아프다)
- their body from the 사이즈 line in HINTS (a big frame or tall → roomy, sturdy; petite → light, compact) and their age (older → comfortable, supportive, easy to use; younger → stylish, trendy)
- the price band when there is one (1만원대 → a light, thoughtful touch; 10만원 이상 → a well-made piece that lasts)
The link opens a search page, so it helps to say which kind to pick (e.g. 등받이가 높은, 가볍게 접히는, 넉넉한 사이즈의, 은은한).
One sentence; Korean 25 to 45 characters with a polite ending (…예요, …해요, …드려요, …골라 보세요); English up to 90 characters. Never name or address the person: no CALL words (엄마, 아빠, 아내, 남편 …) and no names. Never write sizes or numbers about their body. No quotes or emoji.
Good: "키가 커도 등까지 편히 기대는 넉넉한 캠핑 의자로 골라 보세요", "주말마다 산에 오르시니, 가벼운 스틱이면 무릎 부담을 덜어 드려요", "우디 향을 좋아하니, 은은하게 오래가는 향이 잘 어울려요", "요즘 허리가 아프다니, 등을 감싸는 안마 쿠션이면 소파에서도 편히 쉬어요", "트로트를 즐겨 들으시니, 버튼 하나로 켜지는 큰 글씨 라디오가 딱이에요".
Bad (just repeats a hint): "캠핑 좋아해서", "우디 향 좋아해서", "취미라서", "생일 선물로".
Every reason is different. Never mention allergies or things to avoid.`;

const BASIS = `basis: 1 or 2 very short labels (2 to 8 characters) naming exactly which facts about this person this gift comes from, so the user sees at a glance why it was picked. Copy the words from WISHES, HINTS, NOTES, AGE, CALL or OCCASION (e.g. 등산, 허리 통증, 우디 향, 트로트, 60대 아빠, 생일, 적어 둔 선물). Only facts written in the input, never a guess (no 골프 unless golf is in the input). For a safe pick with no matching taste, use AGE and CALL (e.g. 60대 아빠) or OCCASION. Labels are Korean when the input words are Korean. Never allergies or things to avoid.`;

const INSTRUCTIONS = `You suggest gift ideas for one person. The user will shop on Coupang (a Korean online store), so each idea is a search query.
Input:
- CALL: what the user calls this person (e.g. 아내, 아빠, or a name)
- GROUPS: the user's folders this person is in (e.g. 가족, 회사, 친구들)
- OCCASION: birthday or an anniversary name, if any
- SEASON: christmas when there is no close birthday or anniversary and it is November or December (Christmas and year-end gift season), else none
- AGE: if known
- WISHES: gifts written down for this person: either what the user wants to give or what the person said they want, so refer to them neutrally (e.g. "적어 둔 캠핑 의자"), never as "원하셨으니"
- HINTS: what the user knows about this person's tastes
- AVOID: things they don't want, allergies, foods they dislike
- GIFT_CARD: whether they like gift cards (yes, no, unknown)
- NOTES: the user's own notes about this person, newest first. Read them closely: a gift already given (e.g. "작년 생일에 지갑 선물함") must not be suggested again, not even the same kind; worries or wants in notes (e.g. "요즘 허리가 아프대", "캠핑 시작했대") are strong hints.
Return exactly ${IDEA_COUNT} ideas, each a different kind of gift, best first. When SEASON is christmas, make at least two of the ideas fit Christmas and the year-end (e.g. "크리스마스 쿠키", "연말 홈파티 장식", "겨울 머플러", "핫초코 선물세트") and build the rest from their tastes; reasons may mention the season.
keyword: a Korean Coupang search query for one concrete product sold online, 2 to 4 words (e.g. "캠핑 머그컵", "조말론 디퓨저", "튤립 꽃다발", "등산 양말"). Build it from the recorded brands, tastes and wishes. Use at most one wish: the first wish that is a thing sold online goes first; skip experiences like classes, trips or meals. No people words, names, sizes, prices, or words like 고급, 추천, 인기. Sizes are only for judging style or gender, never put them in the query. Never a vague query like "선물세트" alone.
${PITCH}
${BASIS}
Never suggest anything in AVOID or containing it, food with their allergens, alcohol if AVOID has 술, or gift cards unless GIFT_CARD is yes. Keep it modest for coworkers (회사). If HINTS are few, use CALL, AGE and OCCASION for safe, thoughtful picks.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keyword", "reason", "basis"],
        properties: { keyword: { type: "string" }, reason: { type: "string" }, basis: { type: "array", items: { type: "string" } } },
      },
    },
  },
} as const;

function occasionText(ctx: GiftContext): string {
  if (!ctx.occasion) return "none";
  return ctx.occasion.kind === "birthday" ? "생일" : ctx.occasion.label || "기념일";
}

/** OpenAI Responses API 몸 */
export function ideasRequest(profile: GiftProfile, ctx: GiftContext, locale: Locale, model: string) {
  const input = [
    `LANGUAGE: ${locale}`,
    `CALL: ${clean(ctx.call, 40) || "unknown"}`,
    `GROUPS: ${ctx.folders.map((x) => clean(x, 30)).join(", ") || "none"}`,
    `OCCASION: ${occasionText(ctx)}`,
    `SEASON: ${ctx.season ? `christmas (${SEASON_EN}; it is November or December now)` : "none"}`,
    `AGE: ${ctx.age ?? "unknown"}`,
    `WISHES: ${profile.wishes.join(" | ") || "none"}`,
    `HINTS:\n${profile.hints.map((h) => `- ${h}`).join("\n") || "none"}`,
    `AVOID: ${profile.avoid.join(", ") || "none"}`,
    `GIFT_CARD: ${profile.giftCard ?? "unknown"}`,
    `NOTES:\n${profile.notes.map((n) => `- ${n}`).join("\n") || "none"}`,
  ].join("\n");
  return {
    model,
    reasoning: { effort: "low" },
    instructions: INSTRUCTIONS,
    input,
    text: { format: { type: "json_schema", name: "gift_ideas", strict: true, schema: SCHEMA } },
  };
}

function outputText(body: unknown): string {
  const out = (body as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] })?.output ?? [];
  for (const item of out) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) if (c.type === "output_text" && typeof c.text === "string") return c.text;
  }
  return "";
}

/** 찾을 말: 띄어쓰기 하나로, 40자까지 */
export function normalizeKeyword(k: unknown): string {
  return clean(k, 40);
}

/** 근거 말 다듬기만(기록과 견주지 않을 때): 두 개까지, 14자 넘는 것은 버린다 */
export function basisList(raw: unknown): string[] {
  return [...new Set((Array.isArray(raw) ? raw : []).map((r) => clean(r, 40)).filter((w) => w && w.length <= 14))].slice(0, 2);
}

/** 겹치거나 빈 것, 사양하는 것이 든 것을 빼고 몇 개까지. ground: 근거 중 기록에 있는 것만 남기기 */
export function sanitizeIdeas(raw: unknown, avoid: string[] = [], max = IDEA_COUNT, ground: (raw: unknown) => string[] = basisList): GiftIdea[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const banned = avoid.map((a) => a.replace(/\(.*\)$/, "").replace(/\s+/g, "")).filter((a) => a.length >= 2);
  const out: GiftIdea[] = [];
  for (const r of list) {
    const keyword = normalizeKeyword((r as GiftIdea)?.keyword);
    const reason = clean((r as GiftIdea)?.reason, 120);
    const key = keyword.replace(/\s+/g, "");
    if (!keyword || !reason || seen.has(key) || banned.some((b) => key.includes(b))) continue;
    seen.add(key);
    const basis = ground((r as GiftIdea)?.basis);
    out.push(basis.length ? { keyword, reason, basis } : { keyword, reason });
    if (out.length >= max) break;
  }
  return out;
}

export function parseIdeas(body: unknown, avoid: string[] = [], ground?: (raw: unknown) => string[]): GiftIdea[] {
  try {
    return sanitizeIdeas((JSON.parse(outputText(body) || "{}") as { ideas?: unknown }).ideas, avoid, IDEA_COUNT, ground);
  } catch {
    return [];
  }
}

/** AI 없이 고를 때의 이유 문장(포장한 틀): 해주고 싶던 선물 · 좋아하는 것 · 제철 · 챙길 날(없으면 그냥 마음) */
export function pitch(kind: "wish" | "likes" | "occasion" | "season", ctx: GiftContext, locale: Locale, value = ""): string {
  const occasion = ctx.occasion?.kind === "anniversary" ? ctx.occasion.label || "기념일" : "생일";
  if (locale !== "ko") {
    if (kind === "wish") return "The very gift you noted you wanted to give";
    if (kind === "likes") return `A gift that fits their love of ${value}`;
    if (kind === "season") return "A cozy gift for Christmas and the year-end";
    if (!ctx.occasion) return "A thoughtful way to show you care";
    return ctx.occasion.kind === "anniversary" ? "A warm way to mark your anniversary" : "A warm way to say happy birthday";
  }
  // 부르는 말(엄마·아빠)은 넣지 않는다
  if (kind === "wish") return "해 주고 싶다고 적어 둔 바로 그 선물이에요";
  if (kind === "likes") return `${josa(value, "을")} 좋아하니 반길 만한 선물이에요`;
  if (kind === "season") return `${SEASON_KO}에 마음을 전하기 좋은 선물이에요`;
  if (!ctx.occasion) return "마음을 전하기 좋은 선물이에요";
  return `${occasion}에 마음을 전하기 좋은 선물이에요`;
}

/** AI 없이 기록만으로: 해주고 싶은 선물(첫 번째만) → 취미 → 향·꽃 → 좋아하는 것들 → 챙길 날 선물 */
export function ruleIdeas(card: PartialCard, ctx: GiftContext, locale: Locale): GiftIdea[] {
  const { gifts: g, favorites: f, taste: t, life: l, culture: c } = card;
  const first = (s: string | undefined) => clean((s ?? "").split(/[,，·/]/)[0], 20);
  const out: GiftIdea[] = [];
  const add = (keyword: string, reason: string, basis: string[]) => {
    if (keyword.trim()) out.push({ keyword, reason, basis });
  };
  const likes = (keyword: string, v: string, shown = v) => add(keyword, pitch("likes", ctx, locale, shown), [v]);
  const wish = g?.wishlist?.[0]?.title;
  if (wish) add(wish, pitch("wish", ctx, locale), [wishBasis(locale)]);
  for (const h of l?.hobbies ?? []) likes(`${first(h)} 용품`, first(h));
  const scent = first(f?.scent).replace(/\s*향$/, "");
  if (scent) likes(`${scent} 향수`, `${scent} 향`, locale === "ko" ? `${scent} 향` : `${scent} scents`);
  const flower = first(f?.flowers);
  if (flower) likes(`${flower} 꽃다발`, flower);
  for (const b of g?.brands ?? []) likes(first(b), first(b));
  for (const v of [f?.character, f?.idol, f?.team]) if (first(v ?? "")) likes(`${first(v ?? "")} 굿즈`, first(v ?? ""));
  const dessert = first(t?.dessert);
  if (dessert) likes(dessert, dessert);
  const book = first(c?.book);
  if (book) likes(book, book);
  // 챙길 날이 가깝지 않은 크리스마스·연말에는 철에 맞는 찾을 말을 앞세운다(취향보다 뒤, 맨 끝의 기본 한두 개 앞)
  if (ctx.season && !ctx.occasion) {
    add("크리스마스 선물세트", pitch("season", ctx, locale), fallbackBasis(ctx, locale));
    add("연말 선물", pitch("season", ctx, locale), fallbackBasis(ctx, locale));
  }
  const occasion = ctx.occasion ? (ctx.occasion.kind === "anniversary" ? ctx.occasion.label || "기념일" : "생일") : ctx.season ? "크리스마스" : "";
  add([clean(ctx.call, 12), `${occasion} 선물`.trim()].filter(Boolean).join(" "), ctx.occasion ? pitch("occasion", ctx, locale) : ctx.season ? pitch("season", ctx, locale) : pitch("occasion", ctx, locale), fallbackBasis(ctx, locale));
  return sanitizeIdeas(out, giftProfile(card).avoid);
}

// ── 찾을 말 목록에서 고르기(쿠팡 API 키가 없을 때) ──────────────────

export const PICKS_PER_BAND = 5;

/** 제철(크리스마스·연말)에는 가격대마다 제철 선물을 이만큼은 넣는다(있으면) */
export const SEASON_MIN = 2;

export interface CatalogPick {
  id: string;
  reason: string;
  /** 고른 근거(기록에 있는 말, 두 개까지) */
  basis: string[];
}

/** 고른 선물에 붙는 라벨: pick = 추천, top = 강력추천 */
export type GiftBadge = "pick" | "top";

export interface BandPicks {
  band: PriceBand;
  items: (CatalogGift & { reason: string; basis: string[]; badge?: GiftBadge })[];
}

/** 강력추천도 함께 두는 가격대(5만원·10만원대) */
export const TOP_BANDS: readonly PriceBand[] = ["5", "10"];

const GENERIC_WORDS = new Set(["선물세트", "세트", "선물", "키트"]);

/** 찾을 말의 중심 낱말(마지막 낱말): 가죽 지갑 → 지갑, 핸드크림 선물세트 → 핸드크림, 14K 귀걸이 → 귀걸이 */
export function headWord(q: string): string {
  const words = q.split(/\s+/).filter((w) => w && !GENERIC_WORDS.has(w) && !/\d/.test(w));
  return words[words.length - 1] ?? q;
}

/** 메모가 '준 선물' 이야기인지 */
const GAVE = /선물|줬|주었|드렸|드림|사\s?줌|사\s?줬|사\s?드렸|받았/;

/** 고를 수 있는 것: 제철이 아닌 때의 제철 전용·든 알레르기·나이(알면, 앞뒤 3살 여유)·사양하는 것·안 마시면 술·메모에 이미 준 것을 뺀다 */
export function eligibleCatalog(catalog: CatalogGift[], card: PartialCard, ctx: GiftContext, notes: string[] = []): CatalogGift[] {
  const allergies = new Set(realCodes(card.safety?.allergens));
  const skip = (card.gifts?.skip ?? []).map((x) => x.replace(/\s+/g, "")).filter((x) => x.length >= 2);
  const noDrink = card.taste?.alcohol?.level === "none";
  const given = notes.filter((n) => GAVE.test(n)).map((n) => n.replace(/\s+/g, ""));
  return catalog.filter((x) => {
    const q = x.q.replace(/\s+/g, "");
    const head = headWord(x.q);
    // 제철 전용(크리스마스 소품·케이크 등)은 그 철에만
    if (x.seasonOnly && !(ctx.season && x.seasons.includes(ctx.season))) return false;
    if (x.allergens.some((a) => allergies.has(a))) return false;
    if (ctx.age != null && (ctx.age < x.ages[0] - 3 || ctx.age > x.ages[1] + 3)) return false;
    if (skip.some((w) => q.includes(w) || w.includes(head))) return false;
    if (noDrink && x.tags.includes("술")) return false;
    if (given.some((n) => n.includes(head))) return false;
    return true;
  });
}

/** 다시 고르기: 지난번에 보인 것(skip)을 빼되, 가격대에 PICKS_PER_BAND개도 안 남으면 그 가격대는 처음부터 다시 */
export function freshCatalog(eligible: CatalogGift[], skip: string[]): CatalogGift[] {
  if (!skip.length) return eligible;
  const gone = new Set(skip);
  return PRICE_BANDS.flatMap((band) => {
    const all = eligible.filter((x) => x.band === band);
    const left = all.filter((x) => !gone.has(x.id));
    return left.length >= PICKS_PER_BAND ? left : all;
  });
}

const CLOSE = /아내|남편|와이프|여자\s?친구|남자\s?친구|여친|남친|애인|자기/;
const ELDERS = /엄마|아빠|어머니|아버지|어머님|아버님|부모님|할머니|할아버지|장모|장인|시어머니|시아버지/;

/** 처음 열어 둘 가격대: 회사 1만원대, 연인·배우자·부모님·가족 5만원대, 그 밖에는 3만원대 */
export function defaultBand(ctx: GiftContext): PriceBand {
  if (ctx.folders.includes("회사")) return "1";
  if (ctx.folders.includes("연인") || ctx.folders.includes("가족") || CLOSE.test(ctx.call) || ELDERS.test(ctx.call)) return "5";
  return "3";
}

const BAND_WORDS: Record<PriceBand, string> = { "1": "₩10,000s", "3": "₩30,000s", "5": "₩50,000s", "10": "₩100,000 and up" };

const NOTE = `note: one short sentence in LANGUAGE telling the user what you went by (when SEASON is christmas, say briefly that you picked for Christmas and the year-end too, e.g. "크리스마스를 맞아 …"): the 1 or 2 key facts from WISHES, HINTS or NOTES that shaped the picks, and, if any, one thing left out because NOTES say it was already given or it is in AVOID. Korean 18 to 40 characters ending with 골랐어요; English up to 80 characters. Never name or address the person: no CALL words (엄마, 아빠, 아내 …), no names, no honorific subject. Only facts in the input. No lists of three or more, quotes or emoji.
Good: "걷기와 트로트를 보고, 작년에 드린 홍삼은 빼고 골랐어요", "적어 둔 안마 쿠션과 수국 취향을 보고 골랐어요", "우디 향과 미니멀한 취향을 보고 골랐어요".`;

/**
 * 목록에서 고르기 안내(가격대 하나). 가격대마다 따로 부르면 한 번에 다 고르는 것보다 훨씬 빨라서(답이 짧아 4개를 한꺼번에 불러 4분의 1 시간) 한 요청에 가격대 하나만 담는다.
 * withNote: 고른 생각(note)도 쓰게 할지(처음 열어 둘 가격대 요청에서만: 나머지에서는 답이 길어질 뿐이다)
 */
function catalogInstructions(band: PriceBand, count: number, withNote: boolean): string {
  return `You pick gifts for one person from a fixed list (CATALOG) of Coupang searches. The CATALOG holds a single price band: ${band} = about ${BAND_WORDS[band]}.
Input:
- CALL: what the user calls this person (e.g. 아내, 아빠, or a name)
- GROUPS: the user's folders this person is in (e.g. 가족, 회사, 친구들)
- OCCASION: birthday or an anniversary name, if any
- SEASON: christmas when there is no close birthday or anniversary and it is November or December (Christmas and year-end gift season), else none
- AGE: if known
- WISHES: gifts written down for this person: either what the user wants to give or what the person said they want, so refer to them neutrally (e.g. "적어 둔 캠핑 의자"), never as "원하셨으니"
- HINTS: everything the user recorded about this person (tastes, hobbies, sizes for judging style or gender)
- AVOID: things they don't want, allergies, foods they dislike
- GIFT_CARD: whether they like gift cards
- NOTES: the user's own notes about this person, newest first. A gift already given (e.g. "작년 생일에 지갑 선물함") must not be picked again, not even the same kind. Worries or wants in notes (e.g. "요즘 허리가 아프대", "캠핑 시작했대") are strong hints.
- CATALOG: one item per line: id | search | band | ages | tags (items for the Christmas and year-end season carry the tag SEASON:christmas)
Pick exactly ${count} items from the CATALOG, best first. When SEASON is christmas, at least ${Math.min(SEASON_MIN, count)} of the ${count} picks must be items tagged SEASON:christmas (whenever the CATALOG has them), choosing the ones that fit this person best; the rest follow their tastes. Prefer items that match their wishes, hobbies, tastes and notes; fill the rest with safe picks that suit their age, the relationship (CALL, GROUPS) and the occasion. Never pick anything in AVOID or something the notes say was already given.
For parents and elders (엄마, 아빠, 부모님, 어머니, 아버님, 할머니, 할아버지 …): Korean parents most want cash (용돈 박스), clothes, travel and health foods, so favor health foods and supplements, comfort and massage items (효도), outdoor clothing, and gear for their hobbies (등산, 골프, 파크골프, 여행) unless their records point elsewhere.
${PITCH}
${BASIS}${withNote ? `\n${NOTE}` : ""}`;
}

/** 가격대별로 나눈 고를 수 있는 것(PRICE_BANDS 순서, 빈 가격대는 뺀다) */
export function groupByBand(eligible: CatalogGift[]): { band: PriceBand; items: CatalogGift[] }[] {
  return PRICE_BANDS.map((band) => ({ band, items: eligible.filter((x) => x.band === band) })).filter((g) => g.items.length);
}

/** 고른 생각(note)을 부탁할 가격대: 처음 열어 둘 가격대(want), 그 가격대가 비었으면 첫 가격대 */
export function noteBand(groups: { band: PriceBand }[], want: PriceBand): PriceBand | undefined {
  return groups.some((g) => g.band === want) ? want : groups[0]?.band;
}

/**
 * 목록에서 고르기 AI 요청 몸: 가격대 하나(items는 그 가격대 것만, id는 그 안에서만). 생각을 거치지 않고(effort none) 짧게 답하게 한다.
 * 한 가격대씩 따로 부르는 이유는 위 catalogInstructions 설명 참고. 안내 뒤에 길이·형식 줄을 영어로 덧붙이면 이유가 일본어로 나오는 일이 있어서 PITCH·BASIS·NOTE 안내만 쓴다
 */
export function catalogRequest(profile: GiftProfile, ctx: GiftContext, locale: Locale, model: string, band: PriceBand, items: CatalogGift[], withNote = false) {
  const base = ideasRequest(profile, ctx, locale, model);
  // 제철(크리스마스·연말) 선물에는 SEASON:christmas 표시를 붙여 AI가 가려내게 한다
  const lines = items.map((x) => `${x.id} | ${x.q} | ${x.band} | ${x.ages[0]}-${x.ages[1]} | ${[...x.tags, ...x.seasons.map((z) => `SEASON:${z}`)].join(",")}`);
  const picks = {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["id", "reason", "basis"],
      properties: { id: { type: "string", enum: items.map((x) => x.id) }, reason: { type: "string" }, basis: { type: "array", items: { type: "string" } } },
    },
  };
  return {
    ...base,
    reasoning: { effort: "none" },
    instructions: catalogInstructions(band, Math.min(PICKS_PER_BAND, items.length), withNote),
    input: `${base.input}\nCATALOG:\n${lines.join("\n")}`,
    text: {
      format: {
        type: "json_schema",
        name: "gift_picks",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: withNote ? ["note", "picks"] : ["picks"],
          properties: withNote ? { note: { type: "string" }, picks } : { picks },
        },
      },
    },
  };
}

/** 고를 수 있는 것 안에서, 겹치지 않게, 가격대마다 PICKS_PER_BAND개까지. ground: 근거 중 기록에 있는 것만 남기기 */
export function sanitizeCatalogPicks(raw: unknown, eligible: CatalogGift[], ground: (raw: unknown) => string[] = basisList): CatalogPick[] {
  const byId = new Map(eligible.map((x) => [x.id, x]));
  const count = new Map<PriceBand, number>();
  const out: CatalogPick[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const id = typeof (r as CatalogPick)?.id === "string" ? (r as CatalogPick).id : "";
    const reason = clean((r as CatalogPick)?.reason, 120);
    const item = byId.get(id);
    if (!item || !reason || out.some((p) => p.id === id)) continue;
    const n = count.get(item.band) ?? 0;
    if (n >= PICKS_PER_BAND) continue;
    count.set(item.band, n + 1);
    out.push({ id, reason, basis: ground((r as CatalogPick)?.basis) });
  }
  return out;
}

/** AI 답: 고른 것과 고른 생각(note) */
export function parseCatalogPicks(body: unknown, eligible: CatalogGift[], ground?: (raw: unknown) => string[]): { picks: CatalogPick[]; note: string } {
  try {
    const r = JSON.parse(outputText(body) || "{}") as { picks?: unknown; note?: unknown };
    return { picks: sanitizeCatalogPicks(r.picks, eligible, ground), note: cleanNote(r.note) };
  } catch {
    return { picks: [], note: "" };
  }
}

/** 가격대 하나에 받은 AI 답(parseCatalogPicks 결과) */
export interface BandAnswer {
  band: PriceBand;
  picks: CatalogPick[];
  note: string;
}

/**
 * 가격대마다 받은 답을 하나로: 고른 것은 가격대 순서로 이어 붙여 고를 수 있는 것 안에서 다시 걸러 담고(가격대마다 PICKS_PER_BAND개까지, 겹침 없음),
 * 고른 생각(note)은 부탁한 가격대에서 온 첫 번째 것. 이미 기록으로 거른 근거라 다시 기록과 견주지 않는다
 */
export function mergeBandAnswers(answers: BandAnswer[], eligible: CatalogGift[]): { picks: CatalogPick[]; note: string } {
  const ordered = [...answers].sort((a, b) => PRICE_BANDS.indexOf(a.band) - PRICE_BANDS.indexOf(b.band));
  return { picks: sanitizeCatalogPicks(ordered.flatMap((a) => a.picks), eligible), note: ordered.find((a) => a.note)?.note ?? "" };
}

/** 이유로 쓰지 않는 맞춤 말(취향이 아니라 상황) */
const CONTEXT_TAGS = new Set(["부모님", "회사", "출근", "실용", "장마", "손주", "정장", "집", "겨울", "건강", "휴식", "취미"]);

/** 기록만으로 댄 근거: 해주고 싶은 선물 → 기록·메모·폴더에 나온 맞춤 말(취향 먼저) → 나이대와 부르는 말 → 챙길 날 */
export function catalogBasis(x: CatalogGift, corpus: string, wishes: string[], ctx: GiftContext, locale: Locale): string[] {
  if (wishes.some((w) => w.includes(headWord(x.q)))) return [wishBasis(locale)];
  const hits = x.tags.filter((tag) => corpus.includes(tag.toLowerCase()));
  const ordered = [...hits.filter((tag) => !CONTEXT_TAGS.has(tag)), ...hits.filter((tag) => CONTEXT_TAGS.has(tag))];
  return ordered.length ? ordered.slice(0, 2) : fallbackBasis(ctx, locale);
}

/** 빼고 고른 것: 메모에 이미 준 선물(목록의 중심 낱말), 사양하는 것, 안 마시면 술, 알레르기 */
export function leftOut(catalog: CatalogGift[], card: PartialCard, notes: string[], locale: Locale, max = 5): string[] {
  const given = notes.filter((n) => GAVE.test(n)).map((n) => n.replace(/\s+/g, ""));
  const gave = [...new Set(catalog.map((x) => headWord(x.q)))].filter((h) => h.length >= 2 && given.some((n) => n.includes(h)));
  const out = [
    ...gave,
    ...(card.gifts?.skip ?? []).map((x) => clean(x, 14)),
    ...(card.taste?.alcohol?.level === "none" ? [locale === "ko" ? "술" : "Alcohol"] : []),
    ...realCodes(card.safety?.allergens).map((c) => labelOf(ALLERGENS, c, locale)),
  ];
  return [...new Set(out.filter(Boolean))].slice(0, max);
}

/**
 * 한 가격대에서 n개 고르기(sorted는 잘 맞는 순서). 제철이면 제철 선물을 SEASON_MIN개는 넣는다:
 * 모자라면 뒤쪽의 덜 맞는 것을 남은 제철 선물로 바꾼다(앞쪽 = 이 사람에게 잘 맞는 것은 그대로)
 */
function pickBand<T>(sorted: T[], n: number, o: { season: SeasonId | null | undefined; isSeason: (v: T) => boolean }): T[] {
  const top = sorted.slice(0, n);
  if (!o.season) return top;
  let have = top.filter(o.isSeason).length;
  const extra = sorted.slice(n).filter(o.isSeason);
  for (let i = top.length - 1; i >= 0 && have < SEASON_MIN && extra.length; i--) {
    if (o.isSeason(top[i]!)) continue;
    top[i] = extra.shift()!;
    have++;
  }
  return top;
}

/** 제철 선물이 개인 취향 한 가지 맞음(3점)보다는 뒤, 아무것도 안 맞는 것(0점)보다는 앞서도록. 제철 전용(크리스마스 소품 등)은 같은 점수대에서 조금 앞 */
const SEASON_SCORE = 2.5;
const SEASON_ONLY_SCORE = 2.8;

/** AI 없이: 기록·해주고 싶은 선물·메모에 든 말과 맞는 것부터(제철이면 제철 선물을 가격대마다 둘 이상), 가격대마다 PICKS_PER_BAND개 */
export function ruleCatalogPicks(card: PartialCard, ctx: GiftContext, locale: Locale, eligible: CatalogGift[], notes: string[] = []): CatalogPick[] {
  const profile = giftProfile(card, notes);
  const corpus = [...profile.hints, ...profile.wishes, ...profile.notes].join(" ").replace(/\s+/g, "");
  const shown = basisCorpus(profile, ctx);
  const wishes = profile.wishes.map((w) => w.replace(/\s+/g, ""));
  const scored = eligible.map((x, i) => {
    const wish = wishes.some((w) => w.includes(headWord(x.q)));
    const hits = x.tags.filter((tag) => corpus.includes(tag));
    const taste = hits.find((tag) => !CONTEXT_TAGS.has(tag));
    const inAge = ctx.age != null && ctx.age >= x.ages[0] && ctx.age <= x.ages[1];
    const seasonal = !!ctx.season && x.seasons.includes(ctx.season);
    const score = (wish ? 10 : 0) + hits.length * 3 + (inAge ? 1 : 0) + (seasonal ? (x.seasonOnly ? SEASON_ONLY_SCORE : SEASON_SCORE) : 0);
    const reason = wish ? pitch("wish", ctx, locale) : taste ? pitch("likes", ctx, locale, taste) : seasonal ? pitch("season", ctx, locale) : pitch("occasion", ctx, locale);
    return { x, i, score, seasonal, reason, basis: catalogBasis(x, shown, wishes, ctx, locale) };
  });
  const out: CatalogPick[] = [];
  for (const band of PRICE_BANDS) {
    const sorted = scored.filter((s) => s.x.band === band).sort((a, b) => b.score - a.score || a.i - b.i);
    pickBand(sorted, PICKS_PER_BAND, { season: ctx.season, isSeason: (s) => s.seasonal }).forEach((s) => out.push({ id: s.x.id, reason: s.reason, basis: s.basis }));
  }
  return out;
}

/**
 * AI가 고른 것에 모자란 가격대를 기록만으로 고른 것으로 채워 가격대별로 묶는다. 근거가 빈 것(기록에 없는 근거만 댄 것)은 fill로.
 * season이면 가격대마다 제철 선물을 SEASON_MIN개는 넣는다(AI가 못 넣었으면 뒤쪽을 남은 제철 선물로 바꾼다)
 */
export function bandPicks(ai: CatalogPick[], rules: CatalogPick[], eligible: CatalogGift[], fill: (x: CatalogGift) => string[] = () => [], season?: SeasonId | null): BandPicks[] {
  const byId = new Map(eligible.map((x) => [x.id, x]));
  return PRICE_BANDS.map((band) => {
    const pool: BandPicks["items"] = [];
    for (const p of [...ai, ...rules]) {
      const x = byId.get(p.id);
      if (!x || x.band !== band || pool.some((i) => i.id === x.id)) continue;
      pool.push({ ...x, reason: p.reason, basis: p.basis.length ? p.basis : fill(x) });
    }
    const items = pickBand(pool, PICKS_PER_BAND, { season, isSeason: (i) => !!season && i.seasons.includes(season) });
    return { band, items: badgeItems(band, items) };
  }).filter((b) => b.items.length);
}

/**
 * 가격대마다 추천 하나, 5만·10만원대는 강력추천도 하나. 가격대 안은 이미 이 사람에게 잘 맞는 순서(AI가 고른 것 먼저, 그다음 기록 점수순)라
 * 첫 번째가 가장 잘 맞는 것이다: 1만·3만원대는 첫 번째가 추천, 5만·10만원대는 첫 번째가 강력추천이고 두 번째가 추천(하나뿐이면 강력추천만)
 */
export function badgeItems<T extends object>(band: PriceBand, items: T[]): (T & { badge?: GiftBadge })[] {
  const top = TOP_BANDS.includes(band);
  return items.map((x, i) => {
    const badge: GiftBadge | undefined = top ? (i === 0 ? "top" : i === 1 ? "pick" : undefined) : i === 0 ? "pick" : undefined;
    return badge ? { ...x, badge } : x;
  });
}

// ── 쿠팡 파트너스 ──────────────────────────────────────────────

export const COUPANG_SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";

export interface CoupangProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  /** 파트너스 링크(link.coupang.com) */
  url: string;
  rocket: boolean;
}

export interface CoupangResult {
  /** 같은 찾을 말의 쿠팡 검색 화면(파트너스 링크) */
  landingUrl: string | null;
  products: CoupangProduct[];
}

/** yyMMdd'T'HHmmss'Z' (UTC) */
export function coupangSignedDate(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getUTCFullYear() % 100)}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
}

/** HMAC-SHA256(signed-date + method + path + query) 를 hex로. query는 '?' 없이, 실제로 보내는 그대로 */
export function coupangAuthorization(method: string, path: string, query: string, accessKey: string, secretKey: string, now: Date): string {
  const signedDate = coupangSignedDate(now);
  const signature = createHmac("sha256", secretKey).update(`${signedDate}${method}${path}${query}`).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

export function coupangSearchQuery(keyword: string, limit: number, subId?: string): string {
  const q = [`keyword=${encodeURIComponent(keyword)}`, `limit=${limit}`, "imageSize=300x300"];
  if (subId) q.push(`subId=${encodeURIComponent(subId)}`);
  return q.join("&");
}

/** 쿠팡 주소만 받는다(https, coupang.com·coupangcdn.com). 시험용 가짜 서버는 extraHost로 */
export function coupangUrl(v: unknown, extraHost?: string): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    const ours = /(^|\.)coupang\.com$|(^|\.)coupangcdn\.com$/.test(host) && u.protocol === "https:";
    return ours || (extraHost && u.host === extraHost) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** 상품 검색 응답: { rCode: "0", data: { landingUrl, productData: [...] } } */
export function parseCoupangSearch(body: unknown, extraHost?: string): CoupangResult | null {
  const b = body as { rCode?: unknown; data?: { landingUrl?: unknown; productData?: unknown } } | null;
  if (!b || String(b.rCode) !== "0" || !b.data) return null;
  const list = Array.isArray(b.data.productData) ? b.data.productData : [];
  const products: CoupangProduct[] = [];
  for (const raw of list) {
    const r = raw as Record<string, unknown>;
    const url = coupangUrl(r.productUrl, extraHost);
    const image = coupangUrl(r.productImage, extraHost);
    const name = clean(r.productName, 120);
    const price = Number(r.productPrice);
    if (!url || !image || !name || !Number.isFinite(price) || price <= 0) continue;
    products.push({ id: String(r.productId ?? url), name, price: Math.round(price), image, url, rocket: r.isRocket === true });
  }
  return { landingUrl: coupangUrl(b.data.landingUrl, extraHost), products };
}

/** API가 막혔을 때: 쿠팡 검색 화면(파트너스 링크 아님) */
export function coupangSearchUrl(keyword: string): string {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;
}

// ── 공유 카드(가족과 같이 준비) ─────────────────────────────────
// 로그인 없이 가족이 여는 카드 주소(/g/<토큰>). DB 없이 토큰에 담는다: 부르는 말·날·고른 선물 id만(이유·기록은 담지 않는다).
// 서버 키로 서명해서 남이 내용을 꾸며 넣지 못하게 하고, 링크·사진·상품명은 열 때 목록에서 찾는다.

export interface GiftCard {
  locale: Locale;
  /** 부르는 말(아빠) */
  name: string;
  /** 챙길 날 한 줄(아빠 생일 · 12월 14일 월요일) */
  event: string;
  /** 고른 선물(gift-catalog id) */
  ids: string[];
}

const sign = (key: Buffer, body: string) => createHmac("sha256", key).update(body).digest("base64url").slice(0, 22);

export function sealCard(key: Buffer, c: GiftCard): string {
  const json = JSON.stringify({ l: c.locale, n: clean(c.name, 40), e: clean(c.event, 60), i: c.ids.filter((x) => /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 40).join(" ") });
  const body = deflateRawSync(Buffer.from(json), { level: 9 }).toString("base64url");
  return `${body}.${sign(key, body)}`;
}

export function openCard(key: Buffer, token: string): GiftCard | null {
  const [body, sig, extra] = String(token).split(".");
  if (!body || !sig || extra !== undefined || body.length > 2000) return null;
  const want = Buffer.from(sign(key, body));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const raw = JSON.parse(inflateRawSync(Buffer.from(body, "base64url"), { maxOutputLength: 8192 }).toString("utf8")) as Record<string, unknown>;
    const ids = typeof raw.i === "string" ? raw.i.split(" ").filter((x) => /^[a-z0-9-]{1,40}$/.test(x)) : [];
    return { locale: isLocale(raw.l) ? raw.l : "ko", name: clean(raw.n, 40), event: clean(raw.e, 60), ids };
  } catch {
    return null;
  }
}
