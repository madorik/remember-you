import assert from "node:assert/strict";
import { test } from "node:test";
import type { DatesData, GiftsData, PartialCard } from "@readme/core";
import { keepAnswered, keepAskerPlans, keepAskerWishes, prefillForRecipient } from "../ask-core";

const gifts = (g: Partial<GiftsData>): GiftsData => ({ giftCard: null, wishlist: [], skip: [], brands: [], ...g });
const wish = (title: string, url = "") => ({ title, url });

test("상대에게 미리 채워 보낼 때 해주고 싶은 선물(wishlist)은 뺀다", () => {
  const card: PartialCard = { gifts: gifts({ giftCard: "yes", skip: ["꽃"], brands: ["무인양품"], wishlist: [wish("에어팟", "https://example.com/a")] }) };
  const out = prefillForRecipient(card);
  assert.deepEqual(out.gifts, { giftCard: "yes", wishlist: [], skip: ["꽃"], brands: ["무인양품"] });
  assert.equal(JSON.stringify(out).includes("에어팟"), false);
  assert.equal(JSON.stringify(out).includes("example.com"), false);
});

test("원본은 바꾸지 않는다", () => {
  const card: PartialCard = { gifts: gifts({ giftCard: "no", wishlist: [wish("시계")] }) };
  prefillForRecipient(card);
  assert.equal(card.gifts?.wishlist.length, 1);
});

test("wishlist만 있던 선물 칸은 칸째 뺀다(빈 칸을 '맞아요?'로 묻지 않게)", () => {
  const out = prefillForRecipient({ gifts: gifts({ wishlist: [wish("가방")] }), taste: undefined });
  assert.equal("gifts" in out, false);
});

test("선물 칸이 없거나 다른 칸은 그대로", () => {
  const card: PartialCard = { sizes: { top: "L", bottom: "", shoe: 270, ring: null } };
  assert.equal(prefillForRecipient(card), card);
  assert.deepEqual(prefillForRecipient({}), {});
  const both: PartialCard = { sizes: card.sizes, gifts: gifts({ skip: ["향수"], wishlist: [wish("x")] }) };
  const out = prefillForRecipient(both);
  assert.deepEqual(out.sizes, card.sizes);
  assert.deepEqual(out.gifts?.skip, ["향수"]);
});

test("상대가 답해 칸이 바뀌어도 내가 적어 둔 wishlist는 남고, 상대가 적은 것은 뒤에 더해진다(중복은 한 번)", () => {
  const existing = gifts({ wishlist: [wish("에어팟"), wish("시계", "https://example.com/w")] });
  const answer = gifts({ giftCard: "yes", wishlist: [wish("시계", "https://example.com/w"), wish("책")] });
  const out = keepAskerWishes(answer, existing);
  assert.deepEqual(out.wishlist.map((w) => w.title), ["에어팟", "시계", "책"]);
  assert.equal(out.giftCard, "yes");
});

test("내 wishlist가 없으면 상대 답 그대로", () => {
  const answer = gifts({ wishlist: [wish("책")] });
  assert.equal(keepAskerWishes(answer, undefined), answer);
  assert.equal(keepAskerWishes(answer, null), answer);
  assert.equal(keepAskerWishes(answer, gifts({})), answer);
});

test("답: 값이 없는 항목은 저장하지 않는다(건드리지 않고 넘긴 칸이 빈 값으로 저장되던 버그)", () => {
  const answer: PartialCard = {
    gifts: gifts({}),
    taste: { likes: [], spicy: null, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } } as never,
    sizes: { top: "L", bottom: "", shoe: null, ring: null },
  };
  const out = keepAnswered(answer);
  assert.deepEqual(Object.keys(out), ["sizes"]);
});

test("답: 사람이 '없어요'로 직접 비운 항목은 남긴다", () => {
  const out = keepAnswered({ gifts: gifts({}), sizes: { top: "", bottom: "", shoe: null, ring: null } }, ["gifts"]);
  assert.deepEqual(Object.keys(out), ["gifts"]);
});

test("답: 전부 비었으면 아무것도 남지 않는다(서버는 이걸 '답이 없다'로 거절한다)", () => {
  assert.deepEqual(keepAnswered({ gifts: gifts({}) }), {});
  assert.deepEqual(keepAnswered({}), {});
});

test("답: 받고 싶은 선물만 적어도 답이다", () => {
  const out = keepAnswered({ gifts: gifts({ wishlist: [wish("목도리")] }) });
  assert.deepEqual(Object.keys(out), ["gifts"]);
});

// ── 한 번만 있는 날(약속)은 상대에게 새지 않는다 ──

const yearly = { label: "결혼기념일", spec: { calendar: "solar" as const, month: 5, day: 3, year: 2015 } };
const once = { label: "깜짝 파티", spec: { calendar: "solar" as const, month: 12, day: 6, year: 2026 }, once: true as const };
const dates = (a: DatesData["anniversaries"], birthday: DatesData["birthday"] = null): DatesData => ({ birthday, anniversaries: a });

test("상대에게 미리 채워 보낼 때 한 번만 있는 날(약속)은 뺀다: 생일·기념일은 남긴다", () => {
  const out = prefillForRecipient({ dates: dates([yearly, once], { calendar: "solar", month: 3, day: 2 }) });
  assert.deepEqual(out.dates?.anniversaries, [yearly]);
  assert.deepEqual(out.dates?.birthday, { calendar: "solar", month: 3, day: 2 });
});

test("미리 채울 때 약속만 있던 생일·기념일 칸은 칸째 뺀다(빈 칸을 '맞아요?'로 묻지 않게)", () => {
  const out = prefillForRecipient({ dates: dates([once]), taste: undefined });
  assert.equal(out.dates, undefined);
  const card: PartialCard = { dates: dates([once]) };
  prefillForRecipient(card);
  assert.equal(card.dates?.anniversaries.length, 1, "받은 기록은 바꾸지 않는다");
});

test("상대가 생일·기념일에 답해도 내가 적어 둔 약속은 남고, 상대가 보낸 약속은 받지 않는다", () => {
  const answer = dates([{ label: "새 기념일", spec: { calendar: "solar", month: 1, day: 2 } }, { ...once, label: "끼워 넣은 약속" }]);
  const out = keepAskerPlans(answer, dates([yearly, once]));
  assert.deepEqual(out.anniversaries.map((a) => a.label), ["새 기념일", "깜짝 파티"]);
  assert.equal(keepAskerPlans(dates([yearly]), dates([yearly])).anniversaries.length, 1);
  assert.equal(keepAskerPlans(dates([yearly]), null).anniversaries.length, 1);
});
