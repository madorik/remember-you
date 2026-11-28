import assert from "node:assert/strict";
import { test } from "node:test";
import { mostRecentlyViewed, recentlyViewed } from "../index";

const mk = (id: string, viewedOn: string | null, viewDays: number) => ({ id, viewedOn, viewDays });

test("최근 본 사람: 연 적 있는 사람만, 늦게 연 날 → 연 날 수 → 받은 순서, limit까지", () => {
  assert.deepEqual(recentlyViewed([], 6), []);
  assert.deepEqual(recentlyViewed([mk("a", null, 0), mk("b", null, 3)], 6), [], "연 적 없는 사람은 넣지 않는다");
  const list = [mk("a", "2026-11-20", 9), mk("b", "2026-11-26", 1), mk("c", null, 0), mk("d", "2026-11-26", 4), mk("e", "2026-11-26", 4), mk("f", "2026-11-01", 1)];
  assert.deepEqual(
    recentlyViewed(list, 6).map((p) => p.id),
    ["d", "e", "b", "a", "f"],
  );
  assert.deepEqual(
    recentlyViewed(list, 2).map((p) => p.id),
    ["d", "e"],
  );
  assert.deepEqual(recentlyViewed(list, 0), []);
  assert.equal(recentlyViewed(list, 1)[0]?.id, mostRecentlyViewed(list)?.id, "맨 앞은 mostRecentlyViewed와 같은 사람");
  assert.equal(list[0]!.id, "a", "받은 목록은 건드리지 않는다");
});
