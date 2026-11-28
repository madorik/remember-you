import assert from "node:assert/strict";
import { test } from "node:test";
import { noteMatches, noteParts, searchNeedle } from "../note-search";

test("메모 찾기: 대소문자 구분 없이 글자가 들어 있으면 맞고, 찾는 말이 비면 전부 맞다", () => {
  assert.equal(noteMatches("마라탕 좋아함", "마라"), true);
  assert.equal(noteMatches("Likes Latte", "latte"), true);
  assert.equal(noteMatches("Likes Latte", "LIKES"), true);
  assert.equal(noteMatches("마라탕 좋아함", "짜장"), false);
  assert.equal(noteMatches("마라탕", ""), true);
  assert.equal(noteMatches("마라탕", "   "), true);
  assert.equal(noteMatches("마라탕", null), true);
  assert.equal(searchNeedle("  마라 "), "마라");
});

test("메모 찾기: 정규식 기호도 그냥 글자로 찾는다", () => {
  assert.equal(noteMatches("가격 (3+2)?", "(3+2)?"), true);
  assert.equal(noteMatches("abc", ".*"), false);
  assert.equal(noteMatches("a.b", "a.b"), true);
  assert.equal(noteMatches("axb", "a.b"), false);
});

test("메모 찾기: 맞는 조각과 아닌 조각으로 가르고, 이어 붙이면 원래 글이다", () => {
  assert.deepEqual(noteParts("마라탕 좋아함, 마라샹궈도", "마라"), [
    { text: "마라", hit: true },
    { text: "탕 좋아함, ", hit: false },
    { text: "마라", hit: true },
    { text: "샹궈도", hit: false },
  ]);
  assert.deepEqual(noteParts("Latte latte LATTE", "latte"), [
    { text: "Latte", hit: true },
    { text: " ", hit: false },
    { text: "latte", hit: true },
    { text: " ", hit: false },
    { text: "LATTE", hit: true },
  ]);
  assert.deepEqual(noteParts("마라탕", ""), [{ text: "마라탕", hit: false }]);
  assert.deepEqual(noteParts("마라탕", "없음"), [{ text: "마라탕", hit: false }]);
  const body = "줄 하나\n줄 둘 줄";
  assert.equal(noteParts(body, "줄").map((p) => p.text).join(""), body);
});
