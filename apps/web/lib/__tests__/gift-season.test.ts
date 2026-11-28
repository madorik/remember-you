import assert from "node:assert/strict";
import { test } from "node:test";
import type { PartialCard } from "@readme/core";
import { CHRISTMAS_IDS, GIFT_CATALOG, PRICE_BANDS } from "../gift-catalog";
import {
  NEAR_OCCASION_DAYS,
  PICKS_PER_BAND,
  SEASON_MIN,
  bandPicks,
  catalogRequest,
  eligibleCatalog,
  giftBasis,
  giftProfile,
  giftSeason,
  giftTiming,
  ideasRequest,
  picksNote,
  pitch,
  ruleCatalogPicks,
  ruleIdeas,
  type GiftContext,
} from "../gift-core";
import { GUIDES, guidePicks } from "../guides";

const base: GiftContext = { call: "아빠", folders: ["가족"], occasion: null, season: null, age: 62 };
const xmas: GiftContext = { ...base, season: "christmas" };
const byId = new Map(GIFT_CATALOG.map((x) => [x.id, x]));

const hiking: PartialCard = {
  life: { hobbies: ["등산"], seasons: [], travel: "" },
  safety: { allergens: [], allergyNote: "", dislikes: [], diets: [] },
};

test("철: 11월과 12월(지금 달이나 다음 달이 크리스마스)만 크리스마스·연말", () => {
  const at = (m: number, d: number) => giftSeason({ y: 2026, m, d });
  assert.equal(at(10, 31), null);
  assert.equal(at(11, 1), "christmas");
  assert.equal(at(11, 21), "christmas");
  assert.equal(at(12, 31), "christmas");
  assert.equal(at(1, 1), null);
  assert.equal(at(6, 15), null);
});

test("챙길 날과 철: 가까운 생일·기념일(30일 안, 또는 그 날을 짚어 연 것)은 그 날의 선물, 아니면 철", () => {
  const bday = (daysUntil?: number) => ({ kind: "birthday" as const, label: "", ...(daysUntil == null ? {} : { daysUntil }) });
  const nov = { y: 2026, m: 11, d: 21 };
  const mar = { y: 2026, m: 3, d: 10 };
  // 가까운 생일(12/1, 10일 뒤)은 11월이어도 생일 선물(철은 비운다)
  assert.deepEqual(giftTiming(bday(10), nov), { occasion: { kind: "birthday", label: "" }, season: null });
  assert.deepEqual(giftTiming(bday(NEAR_OCCASION_DAYS), nov), { occasion: { kind: "birthday", label: "" }, season: null });
  // 먼 생일(100일 뒤)은 11월이면 크리스마스·연말 선물, 철이 아니면 그냥 선물(챙길 날 없음)
  assert.deepEqual(giftTiming(bday(NEAR_OCCASION_DAYS + 1), nov), { occasion: null, season: "christmas" });
  assert.deepEqual(giftTiming(bday(100), mar), { occasion: null, season: null });
  assert.deepEqual(giftTiming(null, nov), { occasion: null, season: "christmas" });
  assert.deepEqual(giftTiming(null, mar), { occasion: null, season: null });
  // 알림에서 그 날을 짚어 열었으면(daysUntil 없음) 멀어도 그 날의 선물
  assert.deepEqual(giftTiming(bday(), { y: 2026, m: 12, d: 20 }), { occasion: { kind: "birthday", label: "" }, season: null });
  // 날마다 달라지는 daysUntil은 결과에 남지 않는다: 고른 것을 다시 쓰는 열쇠가 날마다 바뀌지 않게
  const a = giftTiming(bday(10), nov);
  const b = giftTiming(bday(11), nov);
  assert.equal(giftBasis(giftProfile({}), { ...base, ...a }, "ko"), giftBasis(giftProfile({}), { ...base, ...b }, "ko"));
});

test("제철 선물 목록: 표시한 것은 모두 있고, 제철 전용은 파트너스 링크·사진·상품명이 있고, 가격대마다 제철 선물이 충분하다", () => {
  for (const id of CHRISTMAS_IDS) assert.ok(byId.has(id) && byId.get(id)!.seasons.includes("christmas") && !byId.get(id)!.seasonOnly, id);
  const only = GIFT_CATALOG.filter((x) => x.seasonOnly);
  assert.ok(only.length >= 15);
  for (const x of only) {
    assert.deepEqual(x.seasons, ["christmas"], x.id);
    assert.match(x.url, /^https:\/\/link\.coupang\.com\/a\/[A-Za-z0-9]+$/, x.id);
    assert.match(x.image, /^https:\/\/[a-z0-9]+\.coupangcdn\.com\/thumbnails\//, x.id);
    assert.ok(x.name.length >= 6, x.id);
  }
  for (const b of PRICE_BANDS) assert.ok(GIFT_CATALOG.filter((x) => x.band === b && x.seasons.includes("christmas")).length >= 2 * SEASON_MIN, `제철 선물 ${b}`);
});

test("목록 고르기: 제철 전용은 철에만 나오고, 알레르기·술은 제철 전용에도 적용된다", () => {
  const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
  assert.ok(!ids(eligibleCatalog(GIFT_CATALOG, {}, { ...base, age: null })).has("xmas-cake"));
  const e = ids(eligibleCatalog(GIFT_CATALOG, {}, { ...xmas, age: null }));
  assert.ok(e.has("xmas-cake") && e.has("mini-tree") && e.has("wine-decanter-set"));
  // 우유 알레르기: 케이크·핫초코·쿠키는 뺀다. 술을 안 마시면 와인도 뺀다
  const milk = ids(eligibleCatalog(GIFT_CATALOG, { safety: { allergens: ["milk"], allergyNote: "", dislikes: [], diets: [] }, taste: { likes: [], spicy: null, dessert: "", drinks: "", alcohol: { level: "none", kinds: [] } } }, { ...xmas, age: null }));
  assert.ok(!milk.has("xmas-cake") && !milk.has("hot-cocoa") && !milk.has("xmas-cookie"));
  assert.ok(!milk.has("wine-decanter-set") && !milk.has("premium-decanter"));
  assert.ok(milk.has("mini-tree"));
  // 철이 아닌 때는 제철 표시가 있는 일반 선물도 그냥 일반 선물로 고른다(없어지지 않는다)
  assert.ok(ids(eligibleCatalog(GIFT_CATALOG, {}, { ...base, age: null })).has("hand-cream"));
});

test("기록만으로 고르기(제철): 가격대마다 제철 선물이 둘 이상, 취향에 크게 맞는 것은 그대로 앞에", () => {
  const eligible = eligibleCatalog(GIFT_CATALOG, hiking, xmas);
  const picks = ruleCatalogPicks(hiking, xmas, "ko", eligible);
  assert.equal(picks.length, PRICE_BANDS.length * PICKS_PER_BAND);
  for (const b of PRICE_BANDS) {
    const inBand = picks.filter((p) => byId.get(p.id)!.band === b);
    assert.equal(inBand.length, PICKS_PER_BAND, b);
    assert.ok(inBand.filter((p) => byId.get(p.id)!.seasons.includes("christmas")).length >= SEASON_MIN, `가격대 ${b}의 제철 선물`);
  }
  // 크리스마스 소품·케이크 같은 제철 전용은 가격대마다 하나 이상 보인다
  for (const b of PRICE_BANDS) {
    const only = picks.filter((p) => byId.get(p.id)!.band === b && byId.get(p.id)!.seasonOnly).length;
    assert.ok(only >= 1, `가격대 ${b}의 제철 전용 ${only}개`);
  }
  // 등산 취향이 맞는 것(등산 양말·스틱·모자 …)은 여전히 들어 있다
  assert.ok(picks.some((p) => byId.get(p.id)!.tags.includes("등산")));
  // 제철 선물의 이유는 철을, 취향이 맞는 것의 이유는 취향을 말한다
  const seasonal = picks.find((p) => byId.get(p.id)!.seasonOnly)!;
  assert.equal(seasonal.reason, "크리스마스·연말에 마음을 전하기 좋은 선물이에요");
  assert.ok(picks.some((p) => /^등산을 좋아하니/.test(p.reason)));
  // 철이 아니면 제철 전용은 하나도 없다
  const plain = ruleCatalogPicks(hiking, base, "ko", eligibleCatalog(GIFT_CATALOG, hiking, base));
  assert.ok(plain.every((p) => !byId.get(p.id)!.seasonOnly));
});

test("AI가 제철 선물을 못 넣어도 가격대마다 제철 선물을 채운다(앞의 잘 맞는 것은 그대로)", () => {
  const eligible = eligibleCatalog(GIFT_CATALOG, hiking, xmas);
  const rules = ruleCatalogPicks(hiking, xmas, "ko", eligible);
  // AI가 5만원대에서 제철이 아닌 다섯을 골랐다
  const five = eligible.filter((x) => x.band === "5" && !x.seasons.length).slice(0, 5).map((x) => ({ id: x.id, reason: "AI", basis: [] }));
  const withSeason = bandPicks(five, rules, eligible, () => [], "christmas").find((b) => b.band === "5")!;
  assert.equal(withSeason.items.length, PICKS_PER_BAND);
  assert.ok(withSeason.items.filter((i) => i.seasons.includes("christmas")).length >= SEASON_MIN);
  assert.deepEqual(withSeason.items.slice(0, PICKS_PER_BAND - SEASON_MIN).map((i) => i.id), five.slice(0, PICKS_PER_BAND - SEASON_MIN).map((p) => p.id), "앞쪽은 AI가 고른 그대로");
  // 철이 아니면 그대로(제철을 억지로 넣지 않는다)
  const without = bandPicks(five, rules, eligible, () => [], null).find((b) => b.band === "5")!;
  assert.deepEqual(without.items.map((i) => i.id), five.map((p) => p.id));
});

test("AI 요청: 제철이면 SEASON 줄과 SEASON:christmas 표시, 아니면 none", () => {
  const eligible = eligibleCatalog(GIFT_CATALOG, hiking, xmas);
  const req = catalogRequest(giftProfile(hiking), xmas, "ko", "m", "3", eligible.filter((x) => x.band === "3"));
  assert.match(req.input, /^SEASON: christmas/m);
  assert.match(req.input, /OCCASION: none/);
  assert.match(req.input, /xmas-cake \| 크리스마스 케이크 \| 3 \| 20-60 \| .*SEASON:christmas/);
  assert.match(req.instructions, new RegExp(`at least ${SEASON_MIN} of the ${PICKS_PER_BAND} picks must be items tagged SEASON:christmas`));
  const none = catalogRequest(giftProfile(hiking), base, "ko", "m", "3", eligibleCatalog(GIFT_CATALOG, hiking, base).filter((x) => x.band === "3"));
  assert.match(none.input, /^SEASON: none/m);
  assert.ok(!none.input.includes("xmas-cake"));
  assert.match(ideasRequest(giftProfile(hiking), xmas, "ko", "m").input, /^SEASON: christmas/m);
});

test("이유·찾을 말·한 줄 설명: 철이면 크리스마스·연말, 챙길 날도 철도 없으면 그냥 마음", () => {
  assert.equal(pitch("season", xmas, "ko"), "크리스마스·연말에 마음을 전하기 좋은 선물이에요");
  assert.equal(pitch("season", xmas, "en"), "A cozy gift for Christmas and the year-end");
  // 챙길 날이 없는데 '생일'이라고 하지 않는다
  assert.equal(pitch("occasion", base, "ko"), "마음을 전하기 좋은 선물이에요");
  assert.equal(pitch("occasion", base, "en"), "A thoughtful way to show you care");
  assert.equal(pitch("occasion", { ...base, occasion: { kind: "birthday", label: "" } }, "ko"), "생일에 마음을 전하기 좋은 선물이에요");
  const ideas = ruleIdeas({}, xmas, "ko").map((i) => i.keyword);
  assert.deepEqual(ideas, ["크리스마스 선물세트", "연말 선물", "아빠 크리스마스 선물"]);
  assert.deepEqual(ruleIdeas({}, base, "ko").map((i) => i.keyword), ["아빠 선물"]);
  assert.match(picksNote([{ items: [{ basis: ["등산"] }] }], [], xmas, "ko"), /^크리스마스·연말를 맞아|^크리스마스·연말을 맞아/);
  assert.equal(picksNote([{ items: [{ basis: ["등산"] }] }], [], xmas, "en"), "Picked for Christmas and year-end, with 등산 in mind.");
});

test("공개 가이드(/gifts)에는 제철 전용을 싣지 않는다", () => {
  for (const g of GUIDES) for (const b of guidePicks(g)) for (const x of b.items) assert.ok(!x.seasonOnly, `${g.slug}: ${x.id}`);
});
