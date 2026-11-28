import assert from "node:assert/strict";
import { test } from "node:test";
import type { EffectLine, NoteEffect } from "@readme/core";
import { groupResults, isAdded, lineText, personHref, resultKind, type PersonLines, type SavedPerson } from "../save-result";

const SAVED: SavedPerson[] = [
  { id: "p1", name: "엄마", noteId: "n1" },
  { id: "p2", name: "아빠", noteId: "n2" },
];
const LINE = (label: string, value: string, prev?: string): EffectLine => ({ section: "taste", label, value, ...(prev ? { prev } : {}) });

test("더한 일만: 목록은 새로 든 것이 있을 때, 한 칸짜리는 이미 그 값이었던 게 아닐 때", () => {
  const likes = (add: string[], known?: string[]): NoteEffect => ({ f: "taste.likes", t: "items", add, ...(known ? { known } : {}) });
  assert.equal(isAdded(likes(["마라탕"])), true);
  assert.equal(isAdded(likes([], ["마라탕"])), false);
  assert.equal(isAdded({ f: "sizes.shoe", t: "one", next: 245, prev: 240 }), true);
  assert.equal(isAdded({ f: "sizes.shoe", t: "one", next: 245, ok: 1 }), false);
});

test("결과는 저장한 사람 순서대로 묶고, 결과에 없는 사람은 빈 줄", () => {
  const people: PersonLines[] = [{ contactId: "p2", noteId: "n2", lines: [LINE("좋아하는 음식", "마라탕")] }];
  const g = groupResults(SAVED, people);
  assert.deepEqual(
    g.map((r) => [r.person.name, r.lines.length]),
    [
      ["엄마", 0],
      ["아빠", 1],
    ],
  );
  assert.deepEqual(groupResults(SAVED, []).map((r) => r.lines.length), [0, 0]);
});

test("줄 글: '칸 · 값', 바꾼 것은 '칸 · 전 값 → 값'", () => {
  assert.equal(lineText(LINE("좋아하는 음식", "마라탕")), "좋아하는 음식 · 마라탕");
  assert.equal(lineText(LINE("신발(mm)", "245", "240")), "신발(mm) · 240 → 245");
});

test("사람 화면 주소: 더한 게 있으면 기억해 둔 것, 없으면 메모장, 온보딩은 환영 표시", () => {
  assert.equal(personHref("p1", true), "/people/p1?tab=remembered");
  assert.equal(personHref("p1", false), "/people/p1?tab=memo");
  assert.equal(personHref("p1", true, true), "/people/p1?welcome=1&tab=remembered");
});

test("결과 문구: 더한 게 있으면 머리글, 없으면 이유(한도는 따로, 실패·AI 꺼짐·기다리다 지침은 같은 말)", () => {
  assert.equal(resultKind("ok", true), "added");
  assert.equal(resultKind("ok", false), "nothing"); // 줄이 없다(그 사이 되돌렸다)
  assert.equal(resultKind("nothing", false), "nothing");
  assert.equal(resultKind("known", false), "known");
  assert.equal(resultKind("limit", false), "limit");
  assert.equal(resultKind("failed", false), "failed");
  assert.equal(resultKind("ai_off", false), "failed");
  assert.equal(resultKind("timeout", false), "failed");
});
