import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import type { PartialCard } from "@readme/core";
import { BAND_RANGE, GIFT_CATALOG, PRICE_BANDS } from "../gift-catalog";
import { PICKS_PER_BAND } from "../gift-core";
import {
  ageWord,
  bandPicks,
  badgeItems,
  basisCorpus,
  basisSummary,
  catalogBasis,
  catalogRequest,
  groupByBand,
  mergeBandAnswers,
  noteBand,
  fallbackBasis,
  groundBasis,
  acceptNote,
  leftOut,
  parseCatalogPicks,
  picksNote,
  defaultBand,
  eligibleCatalog,
  freshCatalog,
  openCard,
  sealCard,
  headWord,
  ruleCatalogPicks,
  sanitizeCatalogPicks,
  coupangAuthorization,
  coupangSearchQuery,
  coupangSignedDate,
  coupangUrl,
  giftBasis,
  giftProfile,
  ideasRequest,
  parseCoupangSearch,
  parseIdeas,
  ruleIdeas,
  sanitizeIdeas,
  type GiftContext,
} from "../gift-core";

const card: PartialCard = {
  life: { hobbies: ["캠핑", "등산"], seasons: [], travel: "" },
  gifts: { giftCard: "no", wishlist: [{ title: "블루투스 스피커", url: "" }], skip: ["텀블러"], brands: ["이솝"] },
  favorites: { scent: "우디, 너무 달지 않은 향", flowers: "튤립", colors: ["green"], patterns: [], styles: [], metals: [], vibes: [], places: [], idol: "", character: "", team: "", animal: "" },
  taste: { likes: [], spicy: null, dessert: "마카롱", drinks: "", alcohol: { level: "none", kinds: ["wine"] } },
  safety: { allergens: ["peanut"], allergyNote: "", dislikes: [], diets: [] },
  sizes: { top: "95", bottom: "", shoe: 260, ring: null },
};
const ctx: GiftContext = { call: "아빠", folders: ["가족"], occasion: { kind: "birthday", label: "" }, age: 62 };

test("쿠팡 서명: yyMMddTHHmmssZ(UTC) + HMAC-SHA256(날짜·방법·경로·쿼리)", () => {
  const now = new Date(Date.UTC(2026, 10, 16, 3, 4, 5));
  assert.equal(coupangSignedDate(now), "261116T030405Z");
  const path = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";
  const query = coupangSearchQuery("캠핑 머그컵", 6);
  assert.equal(query, "keyword=%EC%BA%A0%ED%95%91%20%EB%A8%B8%EA%B7%B8%EC%BB%B5&limit=6&imageSize=300x300");
  const sig = createHmac("sha256", "secret").update(`261116T030405ZGET${path}${query}`).digest("hex");
  assert.equal(coupangAuthorization("GET", path, query, "access", "secret", now), `CEA algorithm=HmacSHA256, access-key=access, signed-date=261116T030405Z, signature=${sig}`);
  assert.match(coupangSearchQuery("a", 3, "remember you"), /&subId=remember%20you$/);
});

test("쿠팡 응답: 쿠팡 주소인 상품만, 값이 이상하면 뺀다", () => {
  const body = {
    rCode: "0",
    data: {
      landingUrl: "https://link.coupang.com/re/AFFSRP?lptag=AF1&q=x",
      productData: [
        { productId: 1, productName: " 캠핑  머그컵 ", productPrice: 12900.4, productImage: "https://thumbnail6.coupangcdn.com/a.jpg", productUrl: "https://link.coupang.com/re/AFFSDP?itemId=1", isRocket: true },
        { productId: 2, productName: "가짜", productPrice: 1000, productImage: "https://evil.example/a.jpg", productUrl: "https://link.coupang.com/x" },
        { productId: 3, productName: "http", productPrice: 1000, productImage: "http://thumbnail6.coupangcdn.com/a.jpg", productUrl: "https://link.coupang.com/x" },
        { productId: 4, productName: "값 없음", productPrice: 0, productImage: "https://thumbnail6.coupangcdn.com/a.jpg", productUrl: "https://link.coupang.com/x" },
      ],
    },
  };
  const r = parseCoupangSearch(body);
  assert.deepEqual(r, {
    landingUrl: "https://link.coupang.com/re/AFFSRP?lptag=AF1&q=x",
    products: [{ id: "1", name: "캠핑 머그컵", price: 12900, image: "https://thumbnail6.coupangcdn.com/a.jpg", url: "https://link.coupang.com/re/AFFSDP?itemId=1", rocket: true }],
  });
  assert.equal(parseCoupangSearch({ rCode: "400", rMessage: "bad" }), null);
  assert.equal(parseCoupangSearch(null), null);
  assert.equal(coupangUrl("https://notcoupang.com/a"), null);
  assert.equal(coupangUrl("http://127.0.0.1:3299/img.png", "127.0.0.1:3299"), "http://127.0.0.1:3299/img.png");
});

test("선물 힌트: 기록 전체(사이즈 포함)와 메모, 사양·알레르기·안 마시는 술은 피할 것으로", () => {
  const p = giftProfile(card, ["11월 3일 작년 생일에 지갑 선물함", "  "]);
  assert.ok(p.hints.includes("취미: 캠핑, 등산"));
  assert.ok(p.hints.includes("좋아하는 브랜드: 이솝"));
  assert.ok(p.hints.some((h) => h.startsWith("좋아하는 향: 우디")));
  assert.ok(!p.hints.some((h) => h.includes("와인")), "안 마시면 술 종류는 넣지 않는다");
  assert.ok(p.hints.includes("사이즈(체형 참고): 상의 95, 신발 260mm"));
  assert.deepEqual(p.notes, ["11월 3일 작년 생일에 지갑 선물함"]);
  assert.deepEqual(p.wishes, ["블루투스 스피커"]);
  assert.ok(p.avoid.includes("텀블러") && p.avoid.includes("술") && p.avoid.some((a) => a.includes("알레르기")));
  assert.equal(p.giftCard, "no");
  assert.equal(giftBasis(p, ctx, "ko"), giftBasis(giftProfile(card, ["11월 3일 작년 생일에 지갑 선물함"]), ctx, "ko"));
  assert.notEqual(giftBasis(p, ctx, "ko"), giftBasis(giftProfile(card), ctx, "ko"), "메모가 바뀌면 다시 고른다");
  assert.notEqual(giftBasis(p, ctx, "ko"), giftBasis(p, { ...ctx, occasion: { kind: "anniversary", label: "결혼기념일" } }, "ko"));
});

test("AI 요청 몸: 구조화 출력, 부르는 말·날·힌트·피할 것", () => {
  const body = ideasRequest(giftProfile(card, ["허리가 아프대"]), ctx, "ko", "m");
  assert.match(body.input, /NOTES:\n- 허리가 아프대/);
  assert.equal(body.text.format.type, "json_schema");
  assert.match(body.input, /CALL: 아빠/);
  assert.match(body.input, /OCCASION: 생일/);
  assert.match(body.input, /AVOID: 텀블러/);
  assert.match(body.input, /GIFT_CARD: no/);
});

test("AI 답 풀기: 겹치거나 빈 것, 피할 것이 든 것은 빼고 네 개까지", () => {
  const ideas = [
    { keyword: "캠핑 머그컵", reason: "캠핑 좋아해서" },
    { keyword: "캠핑  머그컵", reason: "또" },
    { keyword: "보온 텀블러", reason: "텀블러" },
    { keyword: "", reason: "빈칸" },
    { keyword: "튤립 꽃다발", reason: "튤립 좋아해서" },
    { keyword: "이솝 핸드크림", reason: "이솝 좋아해서" },
    { keyword: "등산 양말", reason: "등산 좋아해서" },
    { keyword: "마카롱 세트", reason: "마카롱 좋아해서" },
  ];
  const body = { output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify({ ideas }) }] }] };
  assert.deepEqual(
    parseIdeas(body, ["텀블러"]).map((i) => i.keyword),
    ["캠핑 머그컵", "튤립 꽃다발", "이솝 핸드크림", "등산 양말"],
  );
  assert.deepEqual(parseIdeas({ output: [] }), []);
  assert.deepEqual(sanitizeIdeas("x"), []);
});

test("기록만으로 고르기: 해주고 싶은 선물이 먼저, 취미·향·꽃 순, 없으면 챙길 날 선물", () => {
  const ideas = ruleIdeas(card, ctx, "ko");
  assert.deepEqual(ideas.slice(0, 4), [
    { keyword: "블루투스 스피커", reason: "해 주고 싶다고 적어 둔 바로 그 선물이에요", basis: ["적어 둔 선물"] },
    { keyword: "캠핑 용품", reason: "캠핑을 좋아하니 반길 만한 선물이에요", basis: ["캠핑"] },
    { keyword: "등산 용품", reason: "등산을 좋아하니 반길 만한 선물이에요", basis: ["등산"] },
    { keyword: "우디 향수", reason: "우디 향을 좋아하니 반길 만한 선물이에요", basis: ["우디 향"] },
  ]);
  assert.deepEqual(ruleIdeas({}, ctx, "ko"), [{ keyword: "아빠 생일 선물", reason: "생일에 마음을 전하기 좋은 선물이에요", basis: ["60대 아빠"] }]);
  assert.deepEqual(ruleIdeas({}, { ...ctx, call: "아내", age: null, occasion: { kind: "anniversary", label: "결혼기념일" } }, "en"), [{ keyword: "아내 결혼기념일 선물", reason: "A warm way to mark your anniversary", basis: ["아내"] }]);
  assert.ok(!ruleIdeas({ gifts: { giftCard: null, wishlist: [{ title: "보온 텀블러", url: "" }], skip: ["텀블러"], brands: [] } }, ctx, "ko").some((i) => i.keyword.includes("텀블러")));
});

test("선물 목록: 링크·id·가격대가 바르다", () => {
  assert.ok(GIFT_CATALOG.length >= 80);
  assert.equal(new Set(GIFT_CATALOG.map((x) => x.id)).size, GIFT_CATALOG.length);
  assert.equal(new Set(GIFT_CATALOG.map((x) => x.url)).size, GIFT_CATALOG.length);
  for (const x of GIFT_CATALOG) {
    assert.match(x.url, /^https:\/\/link\.coupang\.com\/a\/[A-Za-z0-9]+$/, x.id);
    assert.ok(x.ages[0] >= 20 && x.ages[1] <= 80 && x.ages[0] < x.ages[1], x.id);
  }
  for (const b of PRICE_BANDS) assert.ok(GIFT_CATALOG.filter((x) => x.band === b).length >= 15, b);
  assert.ok(GIFT_CATALOG.some((x) => x.ages[1] >= 80 && x.ages[0] >= 60), "70·80대 선물도 있다");
});

test("선물 목록: 칸마다 상품 하나, 그 값이 칸의 가격대 안에 든다", () => {
  for (const x of GIFT_CATALOG) {
    const [lo, hi] = BAND_RANGE[x.band];
    assert.ok(Number.isInteger(x.price) && x.price >= lo && x.price <= hi, `${x.id}: ${x.band}만원대 칸인데 상품 값이 ${x.price}원`);
    assert.ok(x.name.trim().length > 0, `${x.id}: 상품명이 없다`);
    assert.ok(x.image.length > 0, `${x.id}: 사진이 없다`);
  }
  // 같은 상품(사진)을 두 칸이 쓰지 않는다
  const photo = (u: string) => (u.match(/\/image\/.*$/) ?? [u])[0].split("?")[0];
  assert.equal(new Set(GIFT_CATALOG.map((x) => photo(x.image))).size, GIFT_CATALOG.length);
});

test("목록 고르기: 알레르기·나이·사양·안 마시는 술·메모에 이미 준 것은 뺀다", () => {
  assert.equal(headWord("가죽 지갑"), "지갑");
  assert.equal(headWord("핸드크림 선물세트"), "핸드크림");
  assert.equal(headWord("14K 귀걸이"), "귀걸이");
  const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
  const all = ids(eligibleCatalog(GIFT_CATALOG, {}, { ...ctx, age: null }));
  // 철이 아니면 제철 전용(크리스마스 소품 등)은 빠진다
  assert.equal(all.size, GIFT_CATALOG.filter((x) => !x.seasonOnly).length);
  const e = ids(eligibleCatalog(GIFT_CATALOG, { ...card, safety: { allergens: ["milk"], allergyNote: "", dislikes: [], diets: [] }, gifts: { giftCard: null, wishlist: [], skip: ["머그컵"], brands: [] } }, { ...ctx, age: 30 }, ["작년 생일에 지갑 선물함", "지갑 얘기는 그냥 메모"]));
  assert.ok(!e.has("cookie") && !e.has("chocolate"), "우유 알레르기");
  assert.ok(!e.has("radio") && !e.has("walking-shoes"), "30살에 효도 선물은 빼고");
  assert.ok(!e.has("camping-mug"), "사양하는 머그컵");
  assert.ok(!e.has("beer-glass") && !e.has("wine-glass") && !e.has("liquor"), "술 안 마심");
  assert.ok(!e.has("wallet"), "작년에 준 지갑");
  assert.ok(e.has("card-wallet") && e.has("bouquet"));
  const old = ids(eligibleCatalog(GIFT_CATALOG, {}, { ...ctx, age: 78 }));
  assert.ok(old.has("radio") && old.has("walking-shoes") && !old.has("instant-camera") && !old.has("earbuds"));
});

test("목록 고르기: 처음 가격대는 관계로, 기록만으로는 맞는 취미부터 가격대마다 둘", () => {
  assert.equal(defaultBand({ ...ctx, call: "김 과장", folders: ["회사"] }), "1");
  assert.equal(defaultBand({ ...ctx, call: "아내", folders: [] }), "5");
  assert.equal(defaultBand({ ...ctx, call: "엄마", folders: [] }), "5");
  assert.equal(defaultBand({ ...ctx, call: "민지", folders: ["친구들"] }), "3");
  const eligible = eligibleCatalog(GIFT_CATALOG, card, ctx);
  const picks = ruleCatalogPicks(card, ctx, "ko", eligible);
  assert.equal(picks.length, PRICE_BANDS.length * PICKS_PER_BAND);
  const byId = new Map(GIFT_CATALOG.map((x) => [x.id, x]));
  for (const b of PRICE_BANDS) assert.equal(picks.filter((p) => byId.get(p.id)!.band === b).length, PICKS_PER_BAND);
  assert.ok(picks.some((p) => /^(등산|캠핑)을 좋아하니/.test(p.reason)));
  assert.ok(picks.every((p) => !p.reason.includes("아빠")), "이유에 부르는 말을 넣지 않는다");
  // AI가 고른 게 모자라면 채우고, 고를 수 없는 것·겹친 것·한 가격대에 다섯 넘는 것은 버린다
  const five = eligible.filter((x) => x.band === "5").slice(0, 6).map((x) => ({ id: x.id, reason: x.q }));
  const ai = sanitizeCatalogPicks([{ id: "no-such", reason: "x" }, ...five, five[0]], eligible);
  assert.deepEqual(ai.map((p) => p.id), five.slice(0, PICKS_PER_BAND).map((p) => p.id));
  const bands = bandPicks(ai.slice(0, 2), picks, eligible);
  assert.equal(bands.length, 4);
  for (const b of bands) assert.equal(b.items.length, PICKS_PER_BAND);
  assert.deepEqual(bands.find((b) => b.band === "5")!.items.slice(0, 2).map((i) => i.id), ai.slice(0, 2).map((p) => p.id));
  const three = eligible.filter((x) => x.band === "5").slice(0, 3);
  const req = catalogRequest(giftProfile(card), ctx, "ko", "m", "5", three);
  assert.deepEqual(req.text.format.schema.properties.picks.items.properties.id.enum, three.map((x) => x.id));
  assert.match(req.input, /CATALOG:\n/);
});

test("가격대 하나씩 고르는 AI 요청: 그 가격대 것만, 다섯 개, 생각 없이(effort none), 고른 생각은 부탁한 요청에만", () => {
  const eligible = eligibleCatalog(GIFT_CATALOG, card, ctx);
  const items = eligible.filter((x) => x.band === "3");
  assert.ok(items.length > PICKS_PER_BAND);
  const plain = catalogRequest(giftProfile(card), ctx, "ko", "m", "3", items);
  assert.deepEqual(plain.reasoning, { effort: "none" });
  assert.equal(plain.model, "m");
  // id는 이 가격대 것만, 목록 줄에도 이 가격대 것만
  const ids = plain.text.format.schema.properties.picks.items.properties.id.enum;
  assert.deepEqual(ids, items.map((x) => x.id));
  const lines = plain.input.split("CATALOG:\n")[1]!.split("\n");
  assert.equal(lines.length, items.length);
  for (const line of lines) assert.ok(ids.includes(line.split(" | ")[0]!), line);
  assert.ok(lines.every((l) => l.split(" | ")[2] === "3"));
  // 안내: 가격대 하나, 정확히 다섯, 가격대마다라는 말은 없다
  assert.match(plain.instructions, /holds a single price band: 3 = about ₩30,000s/);
  assert.match(plain.instructions, new RegExp(`Pick exactly ${PICKS_PER_BAND} items from the CATALOG, best first`));
  assert.doesNotMatch(plain.instructions, /from each band|in each band/);
  // PITCH·BASIS는 그대로, 길이·형식 줄을 영어로 덧붙이지 않는다(일본어로 나온 적이 있다)
  assert.match(plain.instructions, /reason: a short, warm pitch in LANGUAGE/);
  assert.match(plain.instructions, /basis: 1 or 2 very short labels/);
  assert.match(plain.instructions, /For parents and elders/);
  // 생각(note): 부탁하지 않으면 안내에도 틀에도 없다
  assert.doesNotMatch(plain.instructions, /note: one short sentence/);
  assert.deepEqual(plain.text.format.schema.required, ["picks"]);
  assert.deepEqual(Object.keys(plain.text.format.schema.properties), ["picks"]);
  const noted = catalogRequest(giftProfile(card), ctx, "ko", "m", "3", items, true);
  assert.match(noted.instructions, /note: one short sentence/);
  assert.deepEqual(noted.text.format.schema.required, ["note", "picks"]);
  assert.deepEqual(Object.keys(noted.text.format.schema.properties), ["note", "picks"]);
  assert.equal(noted.text.format.strict, true);
  // 고를 게 다섯도 안 되는 가격대는 있는 만큼만
  const few = catalogRequest(giftProfile(card), ctx, "ko", "m", "3", items.slice(0, 2));
  assert.match(few.instructions, /Pick exactly 2 items from the CATALOG/);
});

test("가격대로 나누기·생각 맡을 가격대·답 합치기", () => {
  const eligible = eligibleCatalog(GIFT_CATALOG, card, ctx);
  // 가격대 순서로, 빈 가격대는 뺀다
  const groups = groupByBand(eligible);
  assert.deepEqual(groups.map((g) => g.band), PRICE_BANDS.filter((b) => eligible.some((x) => x.band === b)));
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), eligible.length);
  for (const g of groups) assert.ok(g.items.every((x) => x.band === g.band));
  assert.deepEqual(groupByBand(eligible.filter((x) => x.band === "5" || x.band === "1")).map((g) => g.band), ["1", "5"]);
  assert.deepEqual(groupByBand([]), []);
  // 생각은 처음 열어 둘 가격대에서, 그 가격대가 없으면 첫 가격대
  assert.equal(noteBand(groups, "5"), "5");
  assert.equal(noteBand([{ band: "1" }, { band: "3" }], "5"), "1");
  assert.equal(noteBand([], "5"), undefined);
  // 합치기: 가격대 순서로 이어 붙이고, 겹침·다른 가격대 것·고를 수 없는 것은 버리고, 가격대마다 다섯까지, 생각은 있는 것 하나
  const of = (b: "1" | "3" | "5" | "10", n: number) => eligible.filter((x) => x.band === b).slice(0, n).map((x) => ({ id: x.id, reason: `r-${x.id}`, basis: ["등산"] }));
  const five = of("5", 7);
  const merged = mergeBandAnswers(
    [
      { band: "5", picks: five, note: "등산을 보고 골랐어요" },
      { band: "1", picks: [...of("1", 2), { id: "no-such", reason: "x", basis: [] }], note: "" },
      { band: "3", picks: [...of("3", 1), ...of("3", 1)], note: "" },
    ],
    eligible,
  );
  assert.deepEqual(merged.picks.map((p) => p.id), [...of("1", 2), ...of("3", 1), ...five.slice(0, PICKS_PER_BAND)].map((p) => p.id));
  assert.equal(merged.note, "등산을 보고 골랐어요");
  assert.deepEqual(merged.picks[0]!.basis, ["등산"]);
  assert.deepEqual(mergeBandAnswers([], eligible), { picks: [], note: "" });
  assert.deepEqual(mergeBandAnswers([{ band: "3", picks: [], note: "" }], eligible), { picks: [], note: "" });
  // 합친 것은 bandPicks에 그대로 들어가고, 못 받은 가격대는 기록으로 채워진다
  const rules = ruleCatalogPicks(card, ctx, "ko", eligible);
  const bands = bandPicks(merged.picks, rules, eligible);
  assert.equal(bands.length, PRICE_BANDS.length);
  assert.deepEqual(bands.find((b) => b.band === "5")!.items.slice(0, PICKS_PER_BAND).map((i) => i.id), five.slice(0, PICKS_PER_BAND).map((p) => p.id));
  for (const b of bands) assert.equal(b.items.length, PICKS_PER_BAND);
});

test("다시 고르기: 지난번에 보인 것을 빼고, 가격대에 둘도 안 남으면 그 가격대는 처음부터", () => {
  const eligible = eligibleCatalog(GIFT_CATALOG, {}, { ...ctx, age: null });
  const ones = eligible.filter((x) => x.band === "1").map((x) => x.id);
  const fresh = freshCatalog(eligible, ones.slice(0, 2));
  assert.ok(!fresh.some((x) => ones.slice(0, 2).includes(x.id)));
  assert.equal(freshCatalog(eligible, []).length, eligible.length);
  const fewLeft = freshCatalog(eligible, ones.slice(PICKS_PER_BAND - 1));
  assert.equal(fewLeft.filter((x) => x.band === "1").length, ones.length, "다섯도 안 남으면 그 가격대는 다시 전부");
  assert.ok(GIFT_CATALOG.filter((x) => x.image).length >= GIFT_CATALOG.length - 5);
  for (const x of GIFT_CATALOG) if (x.image) assert.match(x.image, /^https:\/\/[a-z0-9]+\.coupangcdn\.com\/thumbnails\//, x.id);
});

test("공유 카드 토큰: 서명이 맞아야 열리고, 고친 토큰·다른 키는 안 열린다", () => {
  const key = Buffer.alloc(32, 7);
  const card = { locale: "ko" as const, name: "아빠", event: "아빠 생일 12월 14일 월요일", ids: ["drip-bag", "radio", "BAD ID", "hanwoo"] };
  const token = sealCard(key, card);
  assert.ok(token.length < 300, `짧게: ${token.length}`);
  assert.deepEqual(openCard(key, token), { ...card, ids: ["drip-bag", "radio", "hanwoo"] });
  assert.equal(openCard(Buffer.alloc(32, 8), token), null);
  const [body, sig] = token.split(".");
  assert.equal(openCard(key, `${body}x.${sig}`), null);
  assert.equal(openCard(key, body!), null);
  assert.equal(openCard(key, "garbage"), null);
});

test("고른 근거: 기록에 있는 말만 남기고(지어낸 골프는 버린다), 없으면 나이대와 부르는 말", () => {
  const notes = ["요즘 허리가 아프대", "작년 생일에 지갑 선물함"];
  const profile = giftProfile(card, notes);
  const corpus = basisCorpus(profile, ctx);
  assert.equal(ageWord(ctx), "60대");
  assert.equal(ageWord({ ...ctx, age: null }), "");
  // 기록·메모·나이대·부르는 말에 있으면 남고(조사 한 글자는 떼고 견준다), 없는 것·너무 긴 것은 버린다. 두 개까지
  const w = profile.wishes;
  assert.deepEqual(groundBasis(["허리가", "골프"], corpus, w), ["허리가"]);
  assert.deepEqual(groundBasis(["60대 아빠", "등산", "캠핑"], corpus, w), ["60대 아빠", "등산"]);
  assert.deepEqual(groundBasis(["골프", "파크골프", "아주 길고 길게 늘어놓은 근거입니다"], corpus, w), []);
  assert.deepEqual(groundBasis(["적어 둔 선물"], corpus, w), ["적어 둔 선물"]);
  assert.deepEqual(groundBasis(["적어 둔 선물"], corpus, []), []);
  assert.deepEqual(groundBasis("등산", corpus, w), []);
  // 해주고 싶은 선물 이름 그대로(상품 이름과 겹치는 꼬리표)는 '적어 둔 선물'로, 겹치면 하나만
  assert.deepEqual(groundBasis(["블루투스 스피커", "적어 둔 선물", "캠핑"], corpus, w), ["적어 둔 선물", "캠핑"]);
  assert.deepEqual(groundBasis(["블루투스 스피커"], corpus, w, "en"), ["On your list"]);
  // 기록만으로: 해주고 싶은 선물 → 맞는 취향 → 나이대와 부르는 말
  const wishes = profile.wishes.map((w) => w.replace(/\s+/g, ""));
  const byId = new Map(GIFT_CATALOG.map((x) => [x.id, x]));
  const hiking = GIFT_CATALOG.find((x) => x.tags.includes("등산"))!;
  assert.ok(catalogBasis(hiking, corpus, wishes, ctx, "ko").includes("등산"));
  const plain = GIFT_CATALOG.find((x) => !x.tags.some((tag) => corpus.includes(tag)) && !wishes.some((w) => w.includes(headWord(x.q))))!;
  assert.deepEqual(catalogBasis(plain, corpus, wishes, ctx, "ko"), ["60대 아빠"]);
  assert.deepEqual(fallbackBasis({ ...ctx, age: null, call: "" }, "ko"), ["생일"]);
  // 선물마다 근거가 있고(AI가 지어낸 근거만 댄 것은 기록으로 채운다), 위에는 취향 근거가 먼저
  const eligible = eligibleCatalog(GIFT_CATALOG, card, ctx, notes);
  const rules = ruleCatalogPicks(card, ctx, "ko", eligible, notes);
  assert.ok(rules.every((p) => p.basis.length >= 1));
  const aiPick = eligible.find((x) => x.band === "1")!;
  const ai = sanitizeCatalogPicks([{ id: aiPick.id, reason: "좋아요", basis: ["골프"] }], eligible, (raw) => groundBasis(raw, corpus, w));
  assert.deepEqual(ai[0]!.basis, []);
  const bands = bandPicks(ai, rules, eligible, (x) => catalogBasis(x, corpus, wishes, ctx, "ko"));
  assert.ok(bands.every((b) => b.items.every((i) => i.basis.length >= 1)));
  assert.deepEqual(bands[0]!.items[0]!.basis, catalogBasis(byId.get(aiPick.id)!, corpus, wishes, ctx, "ko"));
  const seen = basisSummary([{ items: [{ basis: ["60대 아빠"] }, { basis: ["60대 아빠", "생일"] }, { basis: ["생일", "가족", "등산"] }] }], ctx);
  assert.deepEqual(seen, ["등산", "60대 아빠", "생일", "가족"]);
  assert.deepEqual(basisSummary([{ items: [{ basis: ["62세 아빠"] }, { basis: ["62세 아빠", "트로트"] }] }], ctx), ["트로트", "62세 아빠"]);
  // 빼고 고른 것: 이미 준 지갑, 사양하는 텀블러, 안 마시는 술, 땅콩 알레르기
  assert.deepEqual(leftOut(GIFT_CATALOG, card, notes, "ko"), ["지갑", "텀블러", "술", "땅콩"]);
  // AI에 근거를 달라고 한다
  const req = catalogRequest(profile, ctx, "ko", "m", "1", eligible.filter((x) => x.band === "1").slice(0, 2), true);
  assert.deepEqual(req.text.format.schema.properties.picks.items.required, ["id", "reason", "basis"]);
  assert.match(req.instructions, /basis: 1 or 2 very short labels/);
  assert.deepEqual(req.text.format.schema.required, ["note", "picks"]);
  // AI 답: 고른 것과 고른 생각
  const answer = { output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ note: "  주말마다 산에 오르시는 아빠라\n가벼운 것들로 골랐어요.  ", picks: [{ id: aiPick.id, reason: "좋아요", basis: ["등산"] }] }) }] }] };
  const parsed = parseCatalogPicks(answer, eligible, (raw) => groundBasis(raw, corpus, w));
  assert.equal(parsed.note, "주말마다 산에 오르시는 아빠라 가벼운 것들로 골랐어요.");
  assert.deepEqual(parsed.picks.map((p) => p.basis), [["등산"]]);
  assert.deepEqual(parseCatalogPicks({ output: [] }, eligible), { picks: [], note: "" });
});

test("고른 생각: 한 줄로 짧게, 부르는 말 없이(AI 문장이 길거나 엄마·아빠가 들면 기록으로 만든 문장)", () => {
  const b = (...basis: string[][]) => [{ items: basis.map((x) => ({ basis: x })) }];
  assert.equal(picksNote(b(["등산", "60대 아빠"], ["등산"], ["허리 통증"], ["적어 둔 선물"], ["가족"]), ["지갑", "술", "땅콩"], ctx, "ko"), "적어 둔 선물과 등산을 보고, 지갑과 술은 빼고 골랐어요");
  assert.equal(picksNote(b(["트로트"], ["수국"], ["트로트"]), [], ctx, "ko"), "트로트와 수국을 보고 골랐어요");
  assert.equal(picksNote(b(["60대 아빠"], ["생일"]), ["스카프"], ctx, "ko"), "60대에 무난한 것들로, 스카프는 빼고 골랐어요");
  assert.equal(picksNote(b(["아빠"]), [], { ...ctx, age: null }, "ko"), "무난한 것들로 골랐어요");
  assert.equal(picksNote(b(["hiking"], ["golf"]), ["Wallet"], { ...ctx, call: "Dad" }, "en"), "Picked with hiking and golf in mind, leaving out Wallet.");
  for (const note of [picksNote(b(["등산"]), ["지갑"], ctx, "ko"), picksNote(b(["60대 아빠"]), [], ctx, "ko")]) assert.ok(!note.includes("아빠"), note);
  // AI 문장은 짧고 부르는 말이 없을 때만
  assert.equal(acceptNote("걷기와 트로트를 보고, 작년에 드린 홍삼은 빼고 골랐어요", { ...ctx, call: "엄마" }, "ko"), "걷기와 트로트를 보고, 작년에 드린 홍삼은 빼고 골랐어요");
  assert.equal(acceptNote("걷기를 즐기시는 엄마께 골랐어요", { ...ctx, call: "엄마" }, "ko"), "");
  assert.equal(acceptNote("등산을 좋아하시는 아버님께 골랐어요", ctx, "ko"), "");
  assert.equal(acceptNote("안마 쿠션을 적어 두셨고, 걷기와 트로트를 좋아하시니 편안한 휴식과 즐거움을 더할 선물을 먼저 골랐어요", ctx, "ko"), "");
});

test("반려동물: 키우는 아이와 좋아하는 간식이 힌트에 들고, 기록만으로 골라도 강아지 간식이 근거와 함께 나온다", () => {
  const withPet: PartialCard = { ...card, pets: { pets: [{ name: "콩이", kind: "dog", breed: "말티즈", treats: ["닭가슴살 육포"], note: "" }], none: false } };
  const p = giftProfile(withPet);
  assert.ok(p.hints.includes("키우는 반려동물: 콩이(강아지 말티즈)"));
  assert.ok(p.hints.includes("반려동물이 좋아하는 간식·장난감: 콩이: 닭가슴살 육포"));
  // 다른 취향 없이 반려동물만 적힌 사람
  const onlyPet: PartialCard = { pets: withPet.pets };
  const eligible = eligibleCatalog(GIFT_CATALOG, onlyPet, ctx);
  const picks = ruleCatalogPicks(onlyPet, ctx, "ko", eligible);
  const dog = picks.find((x) => GIFT_CATALOG.find((g) => g.id === x.id)?.tags.includes("강아지"));
  assert.ok(dog, "강아지 간식이 골라진다");
  assert.ok(dog!.basis.includes("강아지"));
});

test("고른 선물 라벨: 가격대마다 추천 하나, 5만·10만원대는 강력추천도 하나(첫 번째가 강력추천)", () => {
  const five = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(badgeItems("1", five).map((x) => (x as { badge?: string }).badge), ["pick", undefined, undefined]);
  assert.deepEqual(badgeItems("3", five).map((x) => (x as { badge?: string }).badge), ["pick", undefined, undefined]);
  assert.deepEqual(badgeItems("5", five).map((x) => (x as { badge?: string }).badge), ["top", "pick", undefined]);
  assert.deepEqual(badgeItems("10", five).map((x) => (x as { badge?: string }).badge), ["top", "pick", undefined]);
  // 하나뿐이면 5만·10만원대는 강력추천만, 비어 있으면 그대로
  assert.deepEqual(badgeItems("5", [{ id: "a" }]).map((x) => (x as { badge?: string }).badge), ["top"]);
  assert.deepEqual(badgeItems("10", []), []);
  // 원래 값은 바꾸지 않는다
  assert.equal("badge" in five[0]!, false);
});

test("bandPicks: 모든 가격대에 라벨이 붙고 라벨은 맨 위 둘에만", () => {
  const eligible = eligibleCatalog(GIFT_CATALOG, { name: "x" } as PartialCard, { call: "친구", folders: [], occasion: null, age: 30 });
  const rules = ruleCatalogPicks({ name: "x" } as PartialCard, { call: "친구", folders: [], occasion: null, age: 30 }, "ko", eligible);
  const bands = bandPicks([], rules, eligible);
  assert.equal(bands.length, PRICE_BANDS.length);
  for (const b of bands) {
    const badges = b.items.map((i) => i.badge);
    const top = b.band === "5" || b.band === "10";
    assert.equal(badges.filter((x) => x === "pick").length, 1, `${b.band}: 추천 하나`);
    assert.equal(badges.filter((x) => x === "top").length, top ? 1 : 0, `${b.band}: 강력추천 ${top ? "하나" : "없음"}`);
    assert.equal(badges[0], top ? "top" : "pick");
    if (top) assert.equal(badges[1], "pick");
    assert.ok(badges.slice(2).every((x) => x === undefined));
  }
});
