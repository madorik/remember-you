import assert from "node:assert/strict";
import { test } from "node:test";
import type { EffectLine } from "@readme/core";
import { CLOCK_SKEW_MS, ORGANIZING_EVENT, ORGANIZING_KEY, REFRESH_AFTER_MS, TOAST_GRACE_MS, addToasted, editToastKey, effectToastText, lineKey, markOrganizing, newEditLines, organizedAt, organizedMark, parseOrganizing, parseToasted, pickEffectNote, refreshDelays } from "../organizing";

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

test("알림용 정리 표시: 마지막 새로 받기가 지난 뒤에도 잠시(여유) 효력이 있고, 그다음엔 없다", () => {
  const at = 1_000_000;
  const last = REFRESH_AFTER_MS[REFRESH_AFTER_MS.length - 1]!;
  assert.equal(organizedAt(mark(["a"], at), "a", at + last + 500), at);
  assert.equal(organizedAt(mark(["a"], at), "a", at + last + TOAST_GRACE_MS), null);
  assert.equal(organizedAt(mark(["a"], at), "b", at + 1000), null);
  assert.equal(organizedAt(null, "a", at), null);
});

test("알릴 메모: 저장 표시 즈음에 적은, 더한 것이 있는, 아직 알리지 않은 메모 중 가장 새 것", () => {
  const at = Date.parse("2026-11-28T03:00:00Z");
  const iso = (ms: number) => new Date(at + ms).toISOString();
  const notes = [
    { id: "old", createdAt: iso(-10 * 60_000), count: 2 }, // 한참 전 메모
    { id: "none", createdAt: iso(-1000), count: 0 }, // 더한 것 없음
    { id: "a", createdAt: iso(-2000), count: 1 },
    { id: "b", createdAt: iso(1000), count: 3 },
  ];
  assert.equal(pickEffectNote(notes, at, [])?.id, "b");
  // 이미 알렸으면 건너뛰고 그다음 것
  assert.equal(pickEffectNote(notes, at, ["b"])?.id, "a");
  assert.equal(pickEffectNote(notes, at, ["a", "b"]), null);
  // 시계가 어긋난 만큼은 방금 저장한 메모로 본다(그보다 이른 것은 아니다)
  assert.equal(pickEffectNote([{ id: "x", createdAt: iso(-CLOCK_SKEW_MS + 1000), count: 1 }], at, [])?.id, "x");
  assert.equal(pickEffectNote([{ id: "y", createdAt: iso(-CLOCK_SKEW_MS - 1000), count: 1 }], at, []), null);
  assert.equal(pickEffectNote([{ id: "z", createdAt: "깨진 날짜", count: 1 }], at, []), null);
  assert.equal(pickEffectNote([], at, []), null);
});

test("알린 메모 목록: 깨진 값은 빈 목록, 더하면 중복 없이 맨 뒤에 붙고 한도를 넘으면 오래된 것부터 버린다", () => {
  assert.deepEqual(parseToasted(null), []);
  assert.deepEqual(parseToasted("{깨진"), []);
  assert.deepEqual(parseToasted(JSON.stringify({ a: 1 })), []);
  assert.deepEqual(parseToasted(JSON.stringify(["a", 3, "b"])), ["a", "b"]);
  assert.deepEqual(parseToasted(addToasted(addToasted(null, "a"), "b")), ["a", "b"]);
  assert.deepEqual(parseToasted(addToasted(JSON.stringify(["a", "b"]), "a")), ["b", "a"]);
  let raw: string | null = null;
  for (let i = 0; i < 60; i++) raw = addToasted(raw, `n${i}`);
  const list = parseToasted(raw);
  assert.equal(list.length, 40);
  assert.equal(list[0], "n20");
  assert.equal(list[39], "n59");
});

test("알림 글: 첫 줄만 말하고 나머지는 외 n개, 바꾼 것은 전 값 대신 새 값", () => {
  const food: EffectLine = { section: "taste", label: "좋아하는 음식", value: "마라탕" };
  const shoe: EffectLine = { section: "sizes", label: "신발(mm)", value: "245", prev: "240" };
  assert.equal(effectToastText([], "ko"), "");
  assert.equal(effectToastText([food], "ko"), "좋아하는 음식에 마라탕 넣었어요");
  assert.equal(effectToastText([shoe], "ko"), "신발(mm)에 240 대신 245 넣었어요");
  assert.equal(effectToastText([food, shoe, shoe], "ko"), "좋아하는 음식에 마라탕 넣었어요 외 2개");
  assert.equal(effectToastText([food], "en"), "Added 마라탕 to 좋아하는 음식");
  assert.equal(effectToastText([shoe, food], "en"), "Changed 신발(mm) from 240 to 245 and 1 more");
});

const food: EffectLine = { section: "taste", label: "좋아하는 음식", value: "마라탕" };
const noodle: EffectLine = { section: "taste", label: "좋아하는 음식", value: "짜장면" };
const shoe: EffectLine = { section: "sizes", label: "신발(mm)", value: "245", prev: "240" };

test("고친 메모 표시: 표시에 고친 메모(edit)가 실려 있으면 읽어 주고, 모양이 틀리면 edit만 없는 것으로 본다", () => {
  const at = 1_000_000;
  const edit = { note: "n1", base: 2, seen: ["a", "b"] };
  const withEdit = JSON.stringify({ ids: ["p"], at, edit });
  assert.deepEqual(organizedMark(withEdit, "p", at + 1000), { at, edit });
  assert.equal(organizedAt(withEdit, "p", at + 1000), at);
  assert.equal(parseOrganizing(withEdit, "p", at + 1000), at);
  // 새 메모 저장 표시는 edit이 없다
  assert.deepEqual(organizedMark(mark(["p"], at), "p", at + 1000), { at, edit: null });
  // 깨진 edit(메모 id 없음·음수·소수·seen이 배열이 아님)은 edit만 버린다
  for (const bad of [{ base: 1, seen: [] }, { note: "n", base: -1, seen: [] }, { note: "n", base: 1.5, seen: [] }, { note: "n", base: 1, seen: "x" }]) {
    assert.deepEqual(organizedMark(JSON.stringify({ ids: ["p"], at, edit: bad }), "p", at + 1000), { at, edit: null });
  }
  // 다른 사람·여유까지 지난 뒤는 없다
  assert.equal(organizedMark(withEdit, "q", at + 1000), null);
  assert.equal(organizedMark(withEdit, "p", at + REFRESH_AFTER_MS[REFRESH_AFTER_MS.length - 1]! + TOAST_GRACE_MS), null);
});

test("고친 메모 알림: 고칠 때 이미 보이던 줄은 빼고 새로 생긴 줄만, 고칠 때마다 다른 이름으로 한 번", () => {
  const edit = { note: "n1", base: 2, seen: [lineKey(food)] };
  const notes = [
    { id: "n1", adds: [food, noodle, shoe] },
    { id: "n2", adds: [noodle] },
  ];
  assert.deepEqual(newEditLines(notes, edit), [noodle, shoe]);
  // 새로 생긴 게 없으면(다시 정리가 아무것도 더하지 않았다) 빈 목록
  assert.deepEqual(newEditLines([{ id: "n1", adds: [food] }], edit), []);
  // 그 메모가 없으면 빈 목록
  assert.deepEqual(newEditLines([{ id: "zz", adds: [food] }], edit), []);
  // 값이 같은 줄이어도 전 값이 다르면 다른 줄
  assert.notEqual(lineKey(shoe), lineKey({ ...shoe, prev: "250" }));
  assert.notEqual(editToastKey(edit, 100), editToastKey(edit, 200));
  assert.equal(editToastKey(edit, 100), "n1@100");
});

test("정리 표시를 남기면 탭 저장소에 적고 이미 열린 화면에 이벤트를 보낸다(고친 메모 표시도 함께)", () => {
  const store = new Map<string, string>();
  const events: string[] = [];
  const g = globalThis as unknown as Record<string, unknown>;
  const prevStorage = g.sessionStorage;
  const prevWindow = g.window;
  g.sessionStorage = { setItem: (k: string, v: string) => void store.set(k, v), getItem: (k: string) => store.get(k) ?? null };
  g.window = { dispatchEvent: (e: Event) => void events.push(e.type) };
  try {
    markOrganizing(["p"], 5000);
    assert.deepEqual(JSON.parse(store.get(ORGANIZING_KEY)!), { ids: ["p"], at: 5000 });
    markOrganizing(["p"], 6000, { note: "n1", base: 1, seen: ["k"] });
    assert.deepEqual(JSON.parse(store.get(ORGANIZING_KEY)!), { ids: ["p"], at: 6000, edit: { note: "n1", base: 1, seen: ["k"] } });
    assert.deepEqual(events, [ORGANIZING_EVENT, ORGANIZING_EVENT]);
  } finally {
    g.sessionStorage = prevStorage;
    g.window = prevWindow;
  }
});
