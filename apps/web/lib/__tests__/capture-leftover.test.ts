import assert from "node:assert/strict";
import { test } from "node:test";
import { findLeftovers, type LeftoverLine } from "../capture-leftover";

const line = (target: string, value: string, text: string | null = null): LeftoverLine => ({ value, item: { target, text, label: null } });

test("놓친 알레르기: 말에 알레르기가 있는데 안전 칸 줄이 없으면 그 절을 돌려준다", () => {
  const out = findLeftovers("엄마는 수국을 좋아해. 새우 알레르기가 있어", [line("favorites.flowers", "수국")]);
  assert.deepEqual(out, ["새우 알레르기가 있어"]);
});

test("놓친 못 먹는 것: 쉼표 없이 이어 말해도 '~고' 뒤를 가른다", () => {
  const out = findLeftovers("엄마는 땅콩 알레르기 있고 새우는 못 먹어", [line("safety.allergens", "땅콩")]);
  assert.deepEqual(out, ["새우는 못 먹어"]);
});

test("다 적혔으면 아무것도 돌려주지 않는다(값이 절에 든다)", () => {
  assert.deepEqual(findLeftovers("아빠는 오이를 못 먹어", [line("safety.dislikes", "오이")]), []);
  assert.deepEqual(findLeftovers("엄마 땅콩 알레르기, 새우도 못 먹어", [line("safety.allergens", "땅콩"), line("safety.dislikes", "새우")]), []);
});

test("메모로 적혔어도 적힌 것으로 본다", () => {
  assert.deepEqual(findLeftovers("할머니는 국물 있는 건 못 먹어", [line("memo", "국물 있는 음식 못 먹음", "국물 있는 음식 못 먹음")]), []);
});

test("AI가 다르게 적어 낱말이 안 겹쳐도, 안전 칸 줄이 절 수 이상이면 넘어간다", () => {
  assert.deepEqual(findLeftovers("국물에 들어간 것도 안 돼요, 알레르기가 있어요", [line("safety.allergyNote", "육수 불가"), line("safety.allergens", "밀")]), []);
});

test("안전한 말이 없으면 비어 있다(일반 말은 보지 않는다)", () => {
  assert.deepEqual(findLeftovers("엄마는 수국을 좋아하고 산책을 자주 해", [line("favorites.flowers", "수국")]), []);
  assert.deepEqual(findLeftovers("", []), []);
});

test("영어도 본다", () => {
  const out = findLeftovers("Mom likes hydrangeas. She can't eat shrimp.", [line("favorites.flowers", "hydrangeas")]);
  assert.deepEqual(out, ["She can't eat shrimp"]);
});

test("한 번에 세 개까지, 긴 말은 줄인다", () => {
  const long = `${"가".repeat(80)} 못 먹어`;
  const out = findLeftovers(`${long}. 땅콩 알레르기. 새우 알레르기. 우유 알레르기. 밀 알레르기`, []);
  assert.equal(out.length, 3);
  assert.ok(out.every((s) => s.length <= 60));
});
