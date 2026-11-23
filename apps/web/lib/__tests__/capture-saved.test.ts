import assert from "node:assert/strict";
import { test } from "node:test";
import { planAfterSave } from "../capture-saved";
import type { CaptureLine } from "@/app/actions/capture";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const line = (who: string, href: string, extra: Partial<CaptureLine> = {}): CaptureLine => ({ who, isNew: false, op: "add", field: "좋아하는 꽃", value: "수국", href, ...extra });

test("저장 뒤 가는 곳: 한 사람 것뿐이면 그 사람 화면", () => {
  assert.deepEqual(planAfterSave([line("엄마", `/people/${ID}`), line("엄마", `/people/${ID}`, { field: "메모" })]), { kind: "person", id: ID, created: null });
});

test("새로 만든 사람이면 이름을 같이", () => {
  assert.deepEqual(planAfterSave([line("처제", `/people/${ID}`, { isNew: true })]), { kind: "person", id: ID, created: "처제" });
});

test("이미 알던 줄은 적은 것이 아니라 세지 않는다", () => {
  assert.deepEqual(planAfterSave([line("엄마", `/people/${ID}`), line("아빠", `/people/${ID2}`, { same: true })]), { kind: "person", id: ID, created: null });
  assert.deepEqual(planAfterSave([line("엄마", `/people/${ID}`, { same: true })]), { kind: "none" });
});

test("여러 사람(나 포함)이면 사람마다 몇 줄인지", () => {
  assert.deepEqual(planAfterSave([line("엄마", `/people/${ID}`), line("엄마", `/people/${ID}`), line("아빠", `/people/${ID2}`)]), {
    kind: "many",
    who: [
      { name: "엄마", n: 2 },
      { name: "아빠", n: 1 },
    ],
  });
  assert.deepEqual(planAfterSave([line("나", "/me"), line("엄마", `/people/${ID}`)]).kind, "many");
  assert.deepEqual(planAfterSave([line("나", "/me")]).kind, "many");
});

test("줄이 없으면 아무 데도 가지 않는다", () => {
  assert.deepEqual(planAfterSave([]), { kind: "none" });
});
