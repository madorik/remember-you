import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_REVIEW, GAP_MS, MAX_ASKS, MIN_DAYS, SAVED_FRESH_MS, noteAsked, noteDay, parseReview, reviewDue, savedFresh, type ReviewState } from "../review";

const NOW = Date.UTC(2026, 10, 22);
const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-11-${String(10 + i).padStart(2, "0")}`);
const used = (n: number, asked: number[] = []): ReviewState => ({ days: days(n), asked });

test("며칠 써 보기 전에는 묻지 않는다", () => {
  assert.equal(reviewDue(EMPTY_REVIEW, NOW), false);
  assert.equal(reviewDue(used(MIN_DAYS - 1), NOW), false);
  assert.equal(reviewDue(used(MIN_DAYS), NOW), true);
});

test("한 번 물은 뒤 90일 안에는 다시 묻지 않는다", () => {
  assert.equal(reviewDue(used(5, [NOW - GAP_MS + 1]), NOW), false);
  assert.equal(reviewDue(used(5, [NOW - GAP_MS]), NOW), true);
});

test("평생 세 번까지만 묻는다", () => {
  const long = GAP_MS * 2;
  const three = [NOW - long * 3, NOW - long * 2, NOW - long];
  assert.equal(three.length, MAX_ASKS);
  assert.equal(reviewDue(used(5, three), NOW), false);
  assert.equal(reviewDue(used(5, three.slice(1)), NOW), true);
});

test("같은 날을 두 번 적어도 하루로 센다", () => {
  const once = noteDay(EMPTY_REVIEW, "2026-11-22");
  assert.deepEqual(noteDay(once, "2026-11-22").days, ["2026-11-22"]);
  assert.equal(noteDay(once, "2026-11-23").days.length, 2);
});

test("날짜는 최근 10개만 남기고, 그래도 며칠 써 본 것으로 본다", () => {
  let s = EMPTY_REVIEW;
  for (let i = 1; i <= 15; i++) s = noteDay(s, `2026-11-${String(i).padStart(2, "0")}`);
  assert.equal(s.days.length, 10);
  assert.equal(s.days[0], "2026-11-06");
  assert.equal(reviewDue(s, NOW), true);
});

test("띄운 시각은 세 개까지만 남긴다", () => {
  let s = used(5);
  for (let i = 1; i <= 5; i++) s = noteAsked(s, NOW + i);
  assert.deepEqual(s.asked, [NOW + 3, NOW + 4, NOW + 5]);
});

test("깨졌거나 이상한 저장값은 빈 상태로 본다", () => {
  assert.deepEqual(parseReview(null), EMPTY_REVIEW);
  assert.deepEqual(parseReview("{깨진 글자"), EMPTY_REVIEW);
  assert.deepEqual(parseReview("null"), EMPTY_REVIEW);
  assert.deepEqual(parseReview(JSON.stringify({ days: ["오늘", 3, "2026-11-22"], asked: ["a", 5, null] })), { days: ["2026-11-22"], asked: [5] });
  assert.deepEqual(parseReview(JSON.stringify({ days: "x", asked: {} })), EMPTY_REVIEW);
});

test("저장한 직후에만 '기록을 저장한 순간'으로 친다", () => {
  assert.equal(savedFresh(NOW - 1000, NOW), true);
  assert.equal(savedFresh(NOW - SAVED_FRESH_MS - 1, NOW), false);
  assert.equal(savedFresh(NOW + 5000, NOW), false);
  assert.equal(savedFresh(Number.NaN, NOW), false);
});
