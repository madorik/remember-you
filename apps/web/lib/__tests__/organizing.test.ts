import assert from "node:assert/strict";
import { test } from "node:test";
import { REFRESH_AFTER_MS, parseOrganizing, refreshDelays } from "../organizing";

const mark = (ids: string[], at: number) => JSON.stringify({ ids, at });

test("정리 표시: 이 사람이 들어 있고 아직 효력이 있을 때만 저장한 때를 돌려준다", () => {
  const at = 1_000_000;
  assert.equal(parseOrganizing(mark(["a", "b"], at), "b", at + 1000), at);
  // 다른 사람 · 효력이 끝남 · 없음 · 깨진 값
  assert.equal(parseOrganizing(mark(["a"], at), "b", at + 1000), null);
  assert.equal(parseOrganizing(mark(["a"], at), "a", at + REFRESH_AFTER_MS[REFRESH_AFTER_MS.length - 1]!), null);
  assert.equal(parseOrganizing(null, "a", at), null);
  assert.equal(parseOrganizing("{깨진", "a", at), null);
  assert.equal(parseOrganizing(JSON.stringify({ ids: "a", at }), "a", at), null);
  assert.equal(parseOrganizing(JSON.stringify({ ids: ["a"] }), "a", at), null);
});

test("정리 표시: 저장한 때부터 아직 안 지난 새로 받기만 남는다", () => {
  const at = 5000;
  assert.deepEqual(refreshDelays(at, at), [...REFRESH_AFTER_MS]);
  assert.deepEqual(refreshDelays(at, at + 4000), [REFRESH_AFTER_MS[1]! - 4000, REFRESH_AFTER_MS[2]! - 4000]);
  assert.deepEqual(refreshDelays(at, at + REFRESH_AFTER_MS[2]!), []);
});
