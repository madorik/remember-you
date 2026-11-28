import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultBookTab, parseBookTab } from "../person-tab";

test("처음 여는 칸: 메모가 없고 적어 둔 항목이 있으면 기억해 둔 것, 아무것도 없으면 메모장", () => {
  assert.equal(defaultBookTab(0, 0), "memo");
  assert.equal(defaultBookTab(0, 1), "remembered");
  assert.equal(defaultBookTab(0, 9), "remembered");
});

test("처음 여는 칸: 메모가 둘 이하여도 항목이 셋 이상이면 기억해 둔 것, 메모가 셋부터는 늘 메모장", () => {
  assert.equal(defaultBookTab(1, 2), "memo");
  assert.equal(defaultBookTab(1, 3), "remembered");
  assert.equal(defaultBookTab(2, 2), "memo");
  assert.equal(defaultBookTab(2, 5), "remembered");
  assert.equal(defaultBookTab(3, 9), "memo");
  assert.equal(defaultBookTab(40, 9), "memo");
});

test("주소의 tab은 두 값만 받는다(그 밖에는 정하지 않음)", () => {
  assert.equal(parseBookTab("memo"), "memo");
  assert.equal(parseBookTab("remembered"), "remembered");
  assert.equal(parseBookTab("x"), null);
  assert.equal(parseBookTab(undefined), null);
  assert.equal(parseBookTab(""), null);
});
