import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyClipboard, offerPaste, PASTE_RETURN_WINDOW_MS, PASTE_SHOW_MS, probeVerdict } from "../clipboard-paste";

const T0 = 1_000_000;
const MIN = 60_000;

test("보일 시간은 돌아오는 창 10분 · 알약 2분", () => {
  assert.equal(PASTE_RETURN_WINDOW_MS, 10 * MIN);
  assert.equal(PASTE_SHOW_MS, 2 * MIN);
});

test("떠난 적이 없거나 10분이 지나 돌아오면 보이지 않는다(클립보드에 글이 있어도·메모 앱을 열었어도)", () => {
  assert.equal(offerPaste({ leftAt: null, hopAt: T0, now: T0 + MIN, probe: true }), false);
  assert.equal(offerPaste({ leftAt: T0, hopAt: T0, now: T0 + 10 * MIN, probe: true }), true);
  assert.equal(offerPaste({ leftAt: T0, hopAt: T0, now: T0 + 10 * MIN + 1, probe: true }), false);
  assert.equal(offerPaste({ leftAt: T0, hopAt: T0, now: T0 + 11 * MIN, probe: null }), false);
  // 시계가 거꾸로 간 이상한 값
  assert.equal(offerPaste({ leftAt: T0, hopAt: null, now: T0 - 1, probe: true }), false);
});

test("클립보드를 볼 수 있으면 글이 있을 때만(메모 앱을 안 열었어도), 없으면 메모 앱을 열었어도 보이지 않는다", () => {
  assert.equal(offerPaste({ leftAt: T0, hopAt: null, now: T0 + 30_000, probe: true }), true);
  assert.equal(offerPaste({ leftAt: T0, hopAt: T0, now: T0 + 30_000, probe: false }), false);
});

test("클립보드를 볼 수 없으면(웹·예전 앱) 메모 앱을 열고 나간 뒤에만 보이고, 탭만 바꿨다 오면 보이지 않는다", () => {
  assert.equal(offerPaste({ leftAt: T0, hopAt: T0, now: T0 + 20_000, probe: null }), true);
  assert.equal(offerPaste({ leftAt: T0, hopAt: null, now: T0 + 20_000, probe: null }), false);
  // 메모 앱을 연 지 10분이 넘었으면(그 뒤 다른 일로 나갔다 온 것) 보이지 않는다
  assert.equal(offerPaste({ leftAt: T0 + 12 * MIN, hopAt: T0, now: T0 + 13 * MIN, probe: null }), false);
});

test("읽은 값: 글이 있으면 그대로, 비었거나 공백뿐이거나 글이 아니면 비어 있음", () => {
  assert.deepEqual(classifyClipboard("초롱이 마라탕\n신발 240"), { status: "ok", text: "초롱이 마라탕\n신발 240" });
  assert.deepEqual(classifyClipboard(""), { status: "empty" });
  assert.deepEqual(classifyClipboard("  \n\t "), { status: "empty" });
  assert.deepEqual(classifyClipboard(null), { status: "empty" });
  assert.deepEqual(classifyClipboard(undefined), { status: "empty" });
  assert.deepEqual(classifyClipboard(42), { status: "empty" });
});

test("클립보드를 본 결과: 글이 있고 이미 권한 것·열 때 있던 것이 아닐 때만 새것(stamp를 모르면 늘 새것), 볼 수 없으면 null", () => {
  assert.equal(probeVerdict(null, 5), null);
  assert.equal(probeVerdict({ has: false, stamp: 9 }, null), false);
  assert.equal(probeVerdict({ has: true, stamp: 9 }, null), true);
  assert.equal(probeVerdict({ has: true, stamp: 9 }, 8), true);
  assert.equal(probeVerdict({ has: true, stamp: 9 }, 9), false);
  assert.equal(probeVerdict({ has: true, stamp: 0 }, 0), true);
});
