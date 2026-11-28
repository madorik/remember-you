import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAnswer, emptySection, NONE, QUESTIONS, recordCompletion, SECTIONS_BY_IMPORTANCE, type PartialCard } from "../index";

/** 질문이 묻는 칸 11개 + 질문이 묻지 않는 항목 4칸(생일·알레르기·사이즈·반려동물) */
const TOTAL = QUESTIONS.length + 4;
const EXTRAS: PartialCard = {
  dates: { birthday: { calendar: "solar", month: 3, day: 14 }, anniversaries: [] },
  safety: { ...emptySection("safety"), allergens: [NONE] },
  sizes: { ...emptySection("sizes"), shoe: 245 },
  pets: { pets: [], none: true },
};

/** 질문 칸을 하나씩 답한 카드(실제 답하기와 같은 applyAnswer) */
function answered(ids: string[], value: (id: string) => string = () => NONE): PartialCard {
  let card: PartialCard = {};
  for (const q of QUESTIONS.filter((x) => ids.includes(x.id))) card = { ...card, ...applyAnswer(card, q.id, value(q.id)) };
  return card;
}

test("작성률: 빈 카드는 0%이고 모든 항목이 남았다고 나온다(중요한 순서)", () => {
  const r = recordCompletion({});
  assert.deepEqual({ pct: r.pct, filled: r.filled, total: r.total }, { pct: 0, filled: 0, total: TOTAL });
  assert.deepEqual(r.missing, ["dates", "safety", "taste", "gifts", "sizes", "favorites", "culture", "life", "pets"]);
  assert.deepEqual(r.missing, SECTIONS_BY_IMPORTANCE.filter((s) => r.missing.includes(s)));
});

test("작성률: 일부만 채우면 채운 칸 / 전체 칸을 반올림하고, 칸이 다 찬 항목은 남은 항목에서 빠진다", () => {
  // 입맛(음료·매운맛) 두 칸과 선물(상품권) 한 칸 → 3 / 15 = 20%
  const card = answered(["drinks", "spicy", "giftCard"], (id) => (id === "drinks" ? "라떼" : id === "spicy" ? "2" : "yes"));
  const r = recordCompletion(card);
  assert.equal(r.filled, 3);
  assert.equal(r.pct, Math.round((3 / TOTAL) * 100));
  assert.deepEqual(r.missing, ["dates", "safety", "sizes", "favorites", "culture", "life", "pets"]);
  // 취향은 향·꽃·무늬·액세서리·옷 스타일 다섯 칸이라 하나만 비어도 남는다
  const almost = recordCompletion({ ...card, ...answered(["scent", "flowers", "pattern", "metal"], (id) => (id === "pattern" ? "stripe" : id === "metal" ? "silver" : "우디")) });
  assert.ok(almost.missing.includes("favorites"));
  const none = recordCompletion({ ...card, ...answered(["scent", "flowers", "pattern", "metal", "style"], (id) => (id === "pattern" ? "stripe" : id === "metal" ? "silver" : id === "style" ? "minimal" : "우디")) });
  assert.ok(!none.missing.includes("favorites"));
});

test("작성률: '없어요'(없음)로 답한 칸도 채운 칸으로 센다", () => {
  const r = recordCompletion(answered(QUESTIONS.map((q) => q.id).filter((id) => id !== "spicy" && id !== "giftCard")));
  // 글 칸은 '없음', 고르는 칸은 코드 none 한 개로 저장되어 있어도 채운 것(질문 밖 네 칸은 아직 비어 있다)
  assert.equal(r.filled, QUESTIONS.length - 2);
  assert.deepEqual(r.missing, ["dates", "safety", "taste", "gifts", "sizes", "pets"]);
  const zero = recordCompletion({ taste: { likes: [], spicy: 0, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } }, gifts: { giftCard: "no", wishlist: [], skip: [], brands: [] } });
  assert.equal(zero.filled, 2, "매운 건 못 먹어요(0)·상품권 별로예요도 답이다");
});

test("작성률: 칸을 다 채우면 100%이고 남은 항목이 없다(하나라도 남으면 100%가 되지 않는다)", () => {
  const all = QUESTIONS.map((q) => q.id);
  const asked = answered(all, (id) => (id === "spicy" ? "3" : id === "giftCard" ? "yes" : id === "pattern" ? "stripe" : id === "metal" ? "silver" : id === "style" ? "minimal" : id === "season" ? "autumn" : id === "musicGenre" ? "indie" : id === "movieGenre" ? "comedy" : "라떼"));
  // 질문 칸만 다 채워서는 100이 아니다(생일·알레르기·사이즈·반려동물이 남는다)
  assert.deepEqual(recordCompletion(asked), { pct: 73, filled: QUESTIONS.length, total: TOTAL, missing: ["dates", "safety", "sizes", "pets"] });
  const full = { ...asked, ...EXTRAS };
  assert.deepEqual(recordCompletion(full), { pct: 100, filled: TOTAL, total: TOTAL, missing: [] });
  const one = recordCompletion({ ...full, taste: { ...full.taste!, drinks: "" } });
  assert.equal(one.pct, 93);
  assert.deepEqual(one.missing, ["taste"]);
  assert.ok(recordCompletion(answered(all.slice(1))).pct < 100);
});

test("작성률: 사이즈·생일·알레르기·반려동물을 적어 두면 질문에 답하지 않아도 오른다(기억해 둔 것에 보이는 만큼)", () => {
  // 사이즈(신발)·생일·반려동물 → 3 / 15 = 20%, 남은 건 알레르기 + 질문 항목들
  const r = recordCompletion({ dates: EXTRAS.dates, sizes: EXTRAS.sizes, pets: { pets: [{ name: "콩이", kind: "dog", breed: "", treats: [], note: "" }], none: false } });
  assert.equal(r.filled, 3);
  assert.equal(r.pct, 20);
  assert.deepEqual(r.missing, ["safety", "taste", "gifts", "favorites", "culture", "life"]);
  // 항목마다 한 칸: 사이즈는 신발만이어도, 윗옷만이어도 채운 칸이고 둘 다 있다고 두 칸이 되지 않는다
  assert.equal(recordCompletion({ sizes: { ...emptySection("sizes"), top: "M" } }).filled, 1);
  assert.equal(recordCompletion({ sizes: { ...emptySection("sizes"), top: "M", shoe: 250 } }).filled, 1);
});

test("작성률: 생일은 생일을 알 때만 채운 칸이고(기념일만으로는 아직 빈 칸), 알레르기·반려동물의 '없음'은 답이다", () => {
  const anniversary = { label: "결혼기념일", spec: { calendar: "solar" as const, month: 5, day: 1 } };
  assert.equal(recordCompletion({ dates: { birthday: null, anniversaries: [anniversary] } }).filled, 0);
  assert.ok(recordCompletion({ dates: { birthday: null, anniversaries: [anniversary] } }).missing.includes("dates"));
  assert.equal(recordCompletion({ dates: { birthday: { calendar: "lunar", month: 8, day: 15 }, anniversaries: [] } }).filled, 1);
  // 알레르기 '없음'(코드 none)·못 먹는 것만 적은 것·메모만 있는 것도 알레르기 칸이 찬 것
  assert.equal(recordCompletion({ safety: { ...emptySection("safety"), allergens: [NONE] } }).filled, 1);
  assert.equal(recordCompletion({ safety: { ...emptySection("safety"), dislikes: ["cucumber"] } }).filled, 1);
  assert.equal(recordCompletion({ safety: { ...emptySection("safety"), allergyNote: "복숭아 가루도 안 돼요" } }).filled, 1);
  assert.equal(recordCompletion({ safety: emptySection("safety") }).filled, 0);
  // 반려동물: 키우지 않는다고 답했거나 한 마리라도 있으면 채운 칸
  assert.equal(recordCompletion({ pets: { pets: [], none: true } }).filled, 1);
  assert.equal(recordCompletion({ pets: { pets: [], none: false } }).filled, 0);
});

test("작성률: 직접 적은 노래·인생 영화도 음악·영화 칸의 답이다(오늘의 질문과 같은 기준)", () => {
  const r = recordCompletion({ culture: { movieGenres: [], movie: "인터스텔라", drama: "", shows: "", musicGenres: [], song: "봄날", book: "" } });
  assert.equal(r.filled, 2);
  assert.ok(!r.missing.includes("culture"));
});
