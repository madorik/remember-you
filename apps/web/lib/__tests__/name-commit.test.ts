import assert from "node:assert/strict";
import { test } from "node:test";
import { NEW_PEOPLE_MAX } from "../capture-target";
import { exactPeople, type MentionPerson, type MentionTag } from "../mention";
import { decideNameCommit } from "../name-commit";

const PEOPLE: MentionPerson[] = [
  { id: "wife", name: "김지수", tag: "와이프" },
  { id: "mom", name: "엄마", tag: "" },
  { id: "a1", name: "민수", tag: "" },
  { id: "a2", name: "민수", tag: "친구" },
];

test("이름 칸 부름 맞추기: 이름·태그가 똑같을 때만(띄어쓰기·대소문자 무시, 조사나 앞부분만 같은 건 아니다)", () => {
  assert.deepEqual(exactPeople("엄마", PEOPLE), ["mom"]);
  assert.deepEqual(exactPeople(" 와 이프 ", PEOPLE), ["wife"]);
  assert.deepEqual(exactPeople("김지수", PEOPLE), ["wife"]);
  assert.deepEqual(exactPeople("엄", PEOPLE), []);
  assert.deepEqual(exactPeople("엄마는", PEOPLE), []);
  assert.deepEqual(exactPeople("민수", PEOPLE), ["a1", "a2"]);
  assert.deepEqual(exactPeople("", PEOPLE), []);
});

test("포커스 아웃: 이미 있는 이름이면 그 사람 칩", () => {
  assert.deepEqual(decideNameCommit("엄마", PEOPLE, []), { kind: "tag", tag: { kind: "person", id: "mom" } });
  assert.deepEqual(decideNameCommit("  와이프 ", PEOPLE, []), { kind: "tag", tag: { kind: "person", id: "wife" } });
});

test("포커스 아웃: 없는 이름이면 새 사람 칩(앞뒤 공백·여러 칸 띄어쓰기는 다듬는다)", () => {
  assert.deepEqual(decideNameCommit("  초롱   이 ", PEOPLE, []), { kind: "tag", tag: { kind: "new", name: "초롱 이" } });
  assert.deepEqual(decideNameCommit("엄", PEOPLE, []), { kind: "tag", tag: { kind: "new", name: "엄" } });
});

test("포커스 아웃: 비었거나 같은 부름이 둘 이상이면 아무것도 하지 않는다", () => {
  assert.deepEqual(decideNameCommit("", PEOPLE, []), { kind: "none" });
  assert.deepEqual(decideNameCommit("   ", PEOPLE, []), { kind: "none" });
  assert.deepEqual(decideNameCommit("민수", PEOPLE, []), { kind: "none" });
});

test("포커스 아웃: 이미 고른 사람·이름이면 칩은 그대로(dup)", () => {
  assert.deepEqual(decideNameCommit("엄마", PEOPLE, [{ kind: "person", id: "mom" }]), { kind: "dup" });
  assert.deepEqual(decideNameCommit("초롱이", PEOPLE, [{ kind: "new", name: "초롱이" }]), { kind: "dup" });
  // 새 이름은 모양을 맞춰 같은 이름으로 본다(띄어쓰기·대소문자)
  assert.deepEqual(decideNameCommit("Mi Nji", PEOPLE, [{ kind: "new", name: "miNji" }]), { kind: "dup" });
});

test("포커스 아웃: 새 사람은 한 번에 NEW_PEOPLE_MAX명까지(넘으면 full)", () => {
  const full: MentionTag[] = Array.from({ length: NEW_PEOPLE_MAX }, (_, i) => ({ kind: "new" as const, name: `새${i}` }));
  assert.deepEqual(decideNameCommit("또새", PEOPLE, full), { kind: "full" });
  // 이미 있는 사람은 한도와 상관없이 고를 수 있다
  assert.deepEqual(decideNameCommit("엄마", PEOPLE, full), { kind: "tag", tag: { kind: "person", id: "mom" } });
});

test("포커스 아웃: 이름 길이 한도(40자)로 다듬는다", () => {
  const r = decideNameCommit("가".repeat(60), PEOPLE, []);
  assert.equal(r.kind, "tag");
  if (r.kind === "tag" && r.tag.kind === "new") assert.equal(r.tag.name.length, 40);
});
