import assert from "node:assert/strict";
import { test } from "node:test";
import { RECENT_MAX, RECENT_MIN, recentIds } from "../recent-people";

const mk = (contactId: string, viewedOn: string | null, viewDays = 1) => ({ contactId, viewedOn, viewDays });

test("최근 본 사람: 연 적 있는 사람이 RECENT_MIN명 미만이면 줄을 숨긴다", () => {
  assert.equal(RECENT_MIN, 2);
  assert.deepEqual(recentIds([]), []);
  assert.deepEqual(recentIds([mk("a", null, 0), mk("b", null, 0)]), []);
  assert.deepEqual(recentIds([mk("a", "2026-11-26"), mk("b", null, 0), mk("c", null, 0)]), [], "한 명만 봤으면 숨긴다");
  assert.deepEqual(recentIds([mk("a", "2026-11-26"), mk("b", "2026-11-25"), mk("c", null, 0)]), ["a", "b"]);
});

test("최근 본 사람: 늦게 본 날 → 연 날 수 순서로 RECENT_MAX명까지, 본 적 없는 사람은 넣지 않는다", () => {
  assert.equal(RECENT_MAX, 6);
  const people = [mk("a", "2026-11-01", 2), mk("b", "2026-11-20", 1), mk("c", "2026-11-20", 5), mk("d", null, 0), mk("e", "2026-11-19", 1), mk("f", "2026-11-18", 1), mk("g", "2026-11-17", 1), mk("h", "2026-11-16", 1)];
  assert.deepEqual(recentIds(people), ["c", "b", "e", "f", "g", "h"]);
});
