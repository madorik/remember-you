import assert from "node:assert/strict";
import { test } from "node:test";
import { ASK_DEFAULT_TOPICS, INVITE_TTL_DAYS, INVITE_TTL_FALLBACK_DAYS, SHARE_TTL_DAYS, askMinutes, defaultAskTopics, emptySections, pickAskTopics, questionSections, sanitizeQuestionIds, SECTIONS, translate, type PartialCard } from "../index";

test("물어보기 기본 항목: 비어 있는 것 중 중요한 것부터 최대 3개", () => {
  assert.equal(ASK_DEFAULT_TOPICS, 3);
  // 순서는 SECTIONS가 아니라 중요도 순(생일·못 먹는 것·좋아하는 음식 …)
  assert.deepEqual(defaultAskTopics(["safety", "taste", "sizes", "gifts", "favorites", "culture", "life", "dates"]), ["dates", "safety", "taste"]);
  assert.deepEqual(defaultAskTopics([...SECTIONS]), ["dates", "safety", "taste"]);
  // 생일이 이미 적혀 있으면 다음 중요한 것이 올라온다
  assert.deepEqual(defaultAskTopics(["safety", "sizes", "gifts", "life"]), ["safety", "gifts", "sizes"]);
  // 3개보다 적게 비어 있으면 있는 만큼, 다 적혀 있으면 빈 배열
  assert.deepEqual(defaultAskTopics(["life", "culture"]), ["culture", "life"]);
  assert.deepEqual(defaultAskTopics([]), []);
  assert.deepEqual(defaultAskTopics([...SECTIONS], 1), ["dates"]);
});

test("받는 사람 부담: 기본 3개는 1분, 많이 고를수록 늘어난다", () => {
  assert.equal(askMinutes(["dates", "safety", "taste"]), 1);
  assert.equal(askMinutes(["dates"]), 1);
  assert.equal(askMinutes([]), 1);
  assert.equal(askMinutes(["dates", "safety", "taste", "gifts"]), 2);
  assert.ok(askMinutes([...SECTIONS]) >= 3 && askMinutes([...SECTIONS]) <= 5);
});

test("링크 기간: 지금은 처리방침대로 7일(제약은 31일까지 풀려 있음), 제약이 아직 8일이면 7일로 물러난다. 내 기록 공유는 7일 그대로", () => {
  assert.equal(INVITE_TTL_DAYS, 7);
  assert.equal(INVITE_TTL_FALLBACK_DAYS, 7);
  assert.equal(SHARE_TTL_DAYS, 7);
});

test("질문 id: 오늘의 질문에 있는 것만, 겹치지 않게, 개수 제한", () => {
  assert.deepEqual(sanitizeQuestionIds(["scent"]), ["scent"]);
  assert.deepEqual(sanitizeQuestionIds(["nope", "flowers", "flowers", "scent"]), ["flowers"]);
  assert.deepEqual(sanitizeQuestionIds(["nope", "flowers", "flowers", "scent"], 3), ["flowers", "scent"]);
  assert.deepEqual(sanitizeQuestionIds("scent"), []);
  assert.deepEqual(sanitizeQuestionIds(null), []);
  assert.deepEqual(sanitizeQuestionIds([1, {}, "spicy"]), ["spicy"]);
});

test("질문이 속한 항목: 겹침 없이 중요도 순", () => {
  assert.deepEqual(questionSections(["scent"]), ["favorites"]);
  assert.deepEqual(questionSections(["movieGenre", "spicy", "scent", "flowers"]), ["taste", "favorites", "culture"]);
  assert.deepEqual(questionSections([]), []);
});

test("링크 미리보기 문구: 보낸 사람 말투로, 개수와 시간을 넣는다", () => {
  assert.equal(translate("ko", "og.requestTitle", { name: "민수" }), "민수님이 궁금해해요");
  assert.equal(translate("ko", "og.requestDesc", { n: 3, min: 1 }), "로그인 없이 3가지, 1분이면 돼요");
  assert.equal(translate("ko", "answer.onlyFrom", { from: "민수" }), "민수님만 볼 수 있어요");
  assert.equal(translate("ko", "accept.expiredFrom", { from: "민수" }), "민수님이 보낸 링크는 기간이 지났어요. 민수님께 다시 보내 달라고 해 주세요.");
  assert.equal(translate("ko", "accept.usedFrom", { from: "민수" }), "이미 답하셨어요. 민수님이 받았어요.");
  assert.equal(translate("ko", "answer.consent", { from: "민수" }), "알레르기 같은 건강 정보도 민수님께 전해져요 (필수)");
  // 가족 호칭이면 '님'을 빼고 조사를 맞춘다
  assert.equal(translate("ko", "answer.onlyFrom", { from: "엄마" }), "엄마만 볼 수 있어요");
  assert.equal(translate("en", "og.requestDesc", { n: 1, min: 1 }), "No login, 1 thing, about 1 min");
});

test("물어보기 처음 고르는 항목: 안 적은 항목이 먼저(중요한 순서 3개), 적은 항목은 빠진다", () => {
  // 생일을 적은 사람: dates는 비지 않았으니 처음 고르지 않는다
  const card: PartialCard = { dates: { birthday: { calendar: "solar", month: 3, day: 9 }, anniversaries: [] } };
  const empty = emptySections(card, SECTIONS.filter((s) => s !== "pets"));
  assert.equal(empty.includes("dates"), false);
  assert.deepEqual(pickAskTopics(empty, ["dates", "safety", "taste"]), ["safety", "taste", "gifts"]);
  // 카드에 있어도 비어 있으면 안 적은 항목
  const hollow: PartialCard = { safety: { allergens: [], dislikes: [], diets: [], allergyNote: "" }, taste: { likes: ["단 것"] } as PartialCard["taste"] };
  assert.deepEqual(emptySections(hollow, ["safety", "taste"]), ["safety"]);
  // 안 적은 항목이 3개보다 적으면 그것만(아는 항목을 채워 넣지 않는다)
  assert.deepEqual(pickAskTopics(["life", "culture"], ["dates", "safety", "taste"]), ["culture", "life"]);
  assert.deepEqual(pickAskTopics(["life"], ["dates", "safety", "taste"]), ["life"]);
  // 하나도 없을 때만 기본 항목, 아무것도 안 적은 새 사람은 중요한 순서 3개
  assert.deepEqual(pickAskTopics([], ["dates", "safety", "taste"]), ["dates", "safety", "taste"]);
  assert.deepEqual(pickAskTopics(emptySections({}, SECTIONS.filter((s) => s !== "pets")), ["gifts"]), ["dates", "safety", "taste"]);
});
