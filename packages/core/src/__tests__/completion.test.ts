import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAnswer, NONE, QUESTIONS, recordCompletion, SECTIONS_BY_IMPORTANCE, type PartialCard } from "../index";

/** 질문 칸을 하나씩 답한 카드(실제 답하기와 같은 applyAnswer) */
function answered(ids: string[], value: (id: string) => string = () => NONE): PartialCard {
  let card: PartialCard = {};
  for (const q of QUESTIONS.filter((x) => ids.includes(x.id))) card = { ...card, ...applyAnswer(card, q.id, value(q.id)) };
  return card;
}

test("작성률: 빈 카드는 0%이고 질문이 묻는 항목 전부가 남았다고 나온다(중요한 순서)", () => {
  const r = recordCompletion({});
  assert.deepEqual({ pct: r.pct, filled: r.filled, total: r.total }, { pct: 0, filled: 0, total: QUESTIONS.length });
  assert.deepEqual(r.missing, ["taste", "gifts", "favorites", "culture", "life"]);
  assert.deepEqual(r.missing, SECTIONS_BY_IMPORTANCE.filter((s) => r.missing.includes(s)));
});

test("작성률: 일부만 채우면 채운 칸 / 전체 칸을 반올림하고, 칸이 다 찬 항목은 남은 항목에서 빠진다", () => {
  // 입맛(음료·매운맛) 두 칸과 선물(상품권) 한 칸 → 3 / 11 = 27%
  const card = answered(["drinks", "spicy", "giftCard"], (id) => (id === "drinks" ? "라떼" : id === "spicy" ? "2" : "yes"));
  const r = recordCompletion(card);
  assert.equal(r.filled, 3);
  assert.equal(r.pct, Math.round((3 / QUESTIONS.length) * 100));
  assert.deepEqual(r.missing, ["favorites", "culture", "life"]);
  // 취향은 향·꽃·무늬·액세서리·옷 스타일 다섯 칸이라 하나만 비어도 남는다
  const almost = recordCompletion({ ...card, ...answered(["scent", "flowers", "pattern", "metal"], (id) => (id === "pattern" ? "stripe" : id === "metal" ? "silver" : "우디")) });
  assert.ok(almost.missing.includes("favorites"));
  const none = recordCompletion({ ...card, ...answered(["scent", "flowers", "pattern", "metal", "style"], (id) => (id === "pattern" ? "stripe" : id === "metal" ? "silver" : id === "style" ? "minimal" : "우디")) });
  assert.ok(!none.missing.includes("favorites"));
});

test("작성률: '없어요'(없음)로 답한 칸도 채운 칸으로 센다", () => {
  const r = recordCompletion(answered(QUESTIONS.map((q) => q.id).filter((id) => id !== "spicy" && id !== "giftCard")));
  // 글 칸은 '없음', 고르는 칸은 코드 none 한 개로 저장되어 있어도 채운 것
  assert.equal(r.filled, QUESTIONS.length - 2);
  assert.deepEqual(r.missing, ["taste", "gifts"]);
  const zero = recordCompletion({ taste: { likes: [], spicy: 0, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } }, gifts: { giftCard: "no", wishlist: [], skip: [], brands: [] } });
  assert.equal(zero.filled, 2, "매운 건 못 먹어요(0)·상품권 별로예요도 답이다");
});

test("작성률: 칸을 다 채우면 100%이고 남은 항목이 없다(하나라도 남으면 100%가 되지 않는다)", () => {
  const all = QUESTIONS.map((q) => q.id);
  const full = answered(all, (id) => (id === "spicy" ? "3" : id === "giftCard" ? "yes" : id === "pattern" ? "stripe" : id === "metal" ? "silver" : id === "style" ? "minimal" : id === "season" ? "autumn" : id === "musicGenre" ? "indie" : id === "movieGenre" ? "comedy" : "라떼"));
  assert.deepEqual(recordCompletion(full), { pct: 100, filled: QUESTIONS.length, total: QUESTIONS.length, missing: [] });
  const one = recordCompletion({ ...full, taste: { ...full.taste!, drinks: "" } });
  assert.equal(one.pct, 91);
  assert.deepEqual(one.missing, ["taste"]);
  assert.ok(recordCompletion(answered(all.slice(1))).pct < 100);
});

test("작성률: 직접 적은 노래·인생 영화도 음악·영화 칸의 답이다(오늘의 질문과 같은 기준)", () => {
  const r = recordCompletion({ culture: { movieGenres: [], movie: "인터스텔라", drama: "", shows: "", musicGenres: [], song: "봄날", book: "" } });
  assert.equal(r.filled, 2);
  assert.ok(!r.missing.includes("culture"));
});
