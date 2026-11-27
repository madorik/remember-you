import assert from "node:assert/strict";
import { test } from "node:test";
import { appendBlock } from "../memo-append";

test("본문이 비었으면 그 글로 채우고, 있으면 빈 줄 하나 띄우고 뒤에 붙인다", () => {
  assert.deepEqual(appendBlock("", "초롱이 마라탕 좋아함", 1000), { text: "초롱이 마라탕 좋아함", clipped: false });
  assert.deepEqual(appendBlock("  \n", "  새 글  \n", 1000), { text: "새 글", clipped: false });
  assert.deepEqual(appendBlock("@엄마 장미\n", "신발 240\n", 1000), { text: "@엄마 장미\n\n신발 240", clipped: false });
  assert.deepEqual(appendBlock("앞 글", "   ", 1000), { text: "앞 글", clipped: false });
});

test("합쳐 한도를 넘으면 앞에서부터 한도만 담고 알린다", () => {
  const r = appendBlock("가".repeat(990), "나".repeat(50), 1000);
  assert.equal(r.text.length, 1000);
  assert.equal(r.clipped, true);
  assert.equal(r.text.slice(0, 990), "가".repeat(990));
  assert.equal(appendBlock("가".repeat(10), "나".repeat(988), 1000).clipped, false);
  assert.equal(appendBlock("", "나".repeat(1001), 1000).clipped, true);
});
