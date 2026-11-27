import assert from "node:assert/strict";
import { test } from "node:test";
import { findNamedPeople, insertMention, mentionAt, mentionLabel, resolveMentions, scanMentions, tagKey, tagsForSave, type MentionPerson, type MentionTag } from "../mention";

const PEOPLE: MentionPerson[] = [
  { id: "wife", name: "김지수", tag: "와이프" },
  { id: "mom", name: "엄마", tag: "" },
  { id: "boss", name: "김민수", tag: "김 과장님" },
];

test("@부름: 커서 앞의 '@낱말'만 찾는다", () => {
  assert.deepEqual(mentionAt("@와", 2), { start: 0, query: "와" });
  assert.deepEqual(mentionAt("오늘 @", 4), { start: 3, query: "" });
  assert.deepEqual(mentionAt("오늘 @ㅇㅍ", 6), { start: 3, query: "ㅇㅍ" });
  assert.equal(mentionAt("@와이프 바닐라", 8), null);
  assert.equal(mentionAt("mail@x", 6), null);
  assert.equal(mentionAt("그냥 글", 4), null);
});

test("@부름: 고르면 '@부름 '으로 바꾸고 커서는 그 뒤", () => {
  assert.deepEqual(insertMention("@와 좋아해", 0, 2, "와이프"), { text: "@와이프 좋아해", caret: 5 });
  assert.deepEqual(insertMention("오늘 @", 3, 4, "엄마"), { text: "오늘 @엄마 ", caret: 7 });
  assert.equal(mentionLabel({ name: "김지수", tag: "와이프" }), "와이프");
  assert.equal(mentionLabel({ name: "엄마", tag: "" }), "엄마");
});

test("@부름: 고른 사람은 그 사람으로, @는 뗀다(띄어쓰기 있는 태그도)", () => {
  const r = resolveMentions("@김 과장님 커피는 아이스 @와이프 바닐라라떼", PEOPLE, [
    { id: "boss", label: "김 과장님" },
    { id: "wife", label: "와이프" },
  ]);
  assert.equal(r.text, "김 과장님 커피는 아이스 와이프 바닐라라떼");
  assert.deepEqual(new Set(r.ids), new Set(["boss", "wife"]));
});

test("@부름: 직접 적어도 이름·태그로 찾고, 조사가 붙어도 된다", () => {
  assert.deepEqual(resolveMentions("@와이프는 바닐라라떼를 좋아해", PEOPLE), { text: "와이프는 바닐라라떼를 좋아해", ids: ["wife"] });
  assert.deepEqual(resolveMentions("@엄마한테 수국", PEOPLE), { text: "엄마한테 수국", ids: ["mom"] });
  assert.deepEqual(resolveMentions("@김지수 생일 3월", PEOPLE).ids, ["wife"]);
  assert.deepEqual(resolveMentions("@김과장님 아메리카노", PEOPLE).ids, ["boss"]);
});

test("@부름: 모르는 사람·지워진 고르기는 @만 떼고 넘긴다", () => {
  assert.deepEqual(resolveMentions("@처제 고양이 좋아함", PEOPLE), { text: "처제 고양이 좋아함", ids: [] });
  assert.deepEqual(resolveMentions("바닐라라떼", PEOPLE, [{ id: "wife", label: "와이프" }]), { text: "바닐라라떼", ids: [] });
  assert.deepEqual(resolveMentions("@와이프 라떼", PEOPLE, [{ id: "someone-else", label: "와이프" }]).ids, ["wife"]);
});

// ── 메모 쓰기: 본문의 @이름·이름 → 저장할 주인공들 ──
const CHOROM: MentionPerson[] = [...PEOPLE, { id: "choro", name: "초롱이", tag: "" }, { id: "min", name: "민", tag: "" }];

test("본문 @: 이미 있는 이름·태그면 그 사람, 없으면 새 사람 이름(조사·띄어쓰기·구두점 처리)", () => {
  assert.deepEqual(scanMentions("@초롱이 마라탕 좋아함", CHOROM), [{ kind: "person", id: "choro" }]);
  assert.deepEqual(scanMentions("@새친구 떡볶이 좋아함", CHOROM), [{ kind: "new", name: "새친구" }]);
  assert.deepEqual(scanMentions("@새친구, 떡볶이 좋아함.", CHOROM), [{ kind: "new", name: "새친구" }]);
  // 조사가 붙어도 그 사람 · 1글자 이름('민')이 더 긴 낱말('민지') 안에서 맞지는 않는다
  assert.deepEqual(scanMentions("@초롱이는 마라탕 좋아함", CHOROM), [{ kind: "person", id: "choro" }]);
  assert.deepEqual(scanMentions("@민지 좋아함", CHOROM), [{ kind: "new", name: "민지" }]);
  assert.deepEqual(scanMentions("@민은 좋아함", CHOROM), [{ kind: "person", id: "min" }]);
  // 이름이 아니라 태그로, 띄어쓰기가 든 태그도 · 대소문자·띄어쓰기는 보지 않는다
  assert.deepEqual(scanMentions("@와이프 라떼 @김 과장님 아메리카노", CHOROM), [
    { kind: "person", id: "wife" },
    { kind: "person", id: "boss" },
  ]);
  assert.deepEqual(scanMentions("@김 과장님은 아메리카노", CHOROM), [{ kind: "person", id: "boss" }]);
  assert.deepEqual(scanMentions("@김과장님 아메리카노", CHOROM), [{ kind: "person", id: "boss" }]);
  // 같은 사람·이름은 한 번, 이메일·@ 없는 글은 아무것도 아님
  assert.deepEqual(scanMentions("@엄마 수국 @엄마 장미 @새친구 @새친구", CHOROM), [
    { kind: "person", id: "mom" },
    { kind: "new", name: "새친구" },
  ]);
  assert.deepEqual(scanMentions("mail@x.com 로 보냄, @ 혼자", CHOROM), []);
  assert.deepEqual(scanMentions("초롱이 마라탕", CHOROM), []);
});

test("본문 @: 같은 부름이 둘이면 못 정해 건너뛴다(없는 사람으로 만들지 않는다)", () => {
  const twins: MentionPerson[] = [
    { id: "a", name: "민수", tag: "" },
    { id: "b", name: "민수", tag: "동생" },
  ];
  assert.deepEqual(scanMentions("@민수 커피", twins), []);
  assert.deepEqual(scanMentions("@동생 커피", twins), [{ kind: "person", id: "b" }]);
});

test("본문에 이름이 그대로 나온 사람: 낱말 첫머리에서 끝·구두점·조사가 이어질 때만", () => {
  assert.deepEqual(findNamedPeople("초롱이는 마라탕 좋아함", CHOROM), ["choro"]);
  assert.deepEqual(findNamedPeople("오늘 엄마가 수국을 사 오래", CHOROM), ["mom"]);
  assert.deepEqual(findNamedPeople("엄마, 초롱이랑 같이 감", CHOROM), ["mom", "choro"]);
  assert.deepEqual(findNamedPeople("엄마한테는 말 안 함 · 김 과장님께서는 커피", CHOROM), ["mom", "boss"]);
  // 다른 낱말 안, 조사가 아닌 뒤, 1글자 이름이 긴 낱말의 앞부분인 경우는 아니다
  assert.deepEqual(findNamedPeople("큰엄마 선물 · 엄마표 김치 · 민지랑 민트", CHOROM), []);
  assert.deepEqual(findNamedPeople("마라탕 좋아함", CHOROM), []);
});

test("저장할 주인공: 칩 + 본문 @, 아무도 안 골랐고 @도 없으면 본문 이름, 일부러 뺀 사람은 다시 넣지 않는다", () => {
  const none: MentionTag[] = [];
  // 칩 없이 @만: 있는 사람은 그 사람, 없는 이름은 새 사람
  assert.deepEqual(tagsForSave("@초롱이 마라탕 좋아함", CHOROM, none), [{ kind: "person", id: "choro" }]);
  assert.deepEqual(tagsForSave("@새친구 떡볶이 좋아함", CHOROM, none), [{ kind: "new", name: "새친구" }]);
  // 칩 + @: 칩이 먼저, 같은 사람은 한 번
  assert.deepEqual(tagsForSave("@엄마 @새친구 @초롱이", CHOROM, [{ kind: "person", id: "mom" }]), [
    { kind: "person", id: "mom" },
    { kind: "new", name: "새친구" },
    { kind: "person", id: "choro" },
  ]);
  // 새 사람 칩과 같은 이름의 @는 한 사람
  assert.deepEqual(tagsForSave("@새친구 떡볶이", CHOROM, [{ kind: "new", name: "새 친구" }]), [{ kind: "new", name: "새 친구" }]);
  // @ 없이 이름만: 아무도 안 골랐을 때만 본문 이름을 고른다
  assert.deepEqual(tagsForSave("초롱이는 마라탕 좋아함", CHOROM, none), [{ kind: "person", id: "choro" }]);
  assert.deepEqual(tagsForSave("초롱이는 마라탕 좋아함", CHOROM, [{ kind: "person", id: "mom" }]), [{ kind: "person", id: "mom" }]);
  // @가 있으면 본문 이름 찾기는 하지 않는다(모르는 @만 새 사람)
  assert.deepEqual(tagsForSave("@새친구 와 초롱이는 친함", CHOROM, none), [{ kind: "new", name: "새친구" }]);
  // 아무도 못 찾음
  assert.deepEqual(tagsForSave("마라탕 좋아함", CHOROM, none), []);
  // 칩에서 일부러 뺀 사람은 다시 넣지 않는다(새 사람은 이름 열쇠로)
  assert.deepEqual(tagsForSave("@초롱이 마라탕", CHOROM, none, new Set(["choro"])), []);
  assert.deepEqual(tagsForSave("@새친구 마라탕", CHOROM, none, new Set([tagKey({ kind: "new", name: "새친구" })])), []);
  assert.deepEqual(tagsForSave("초롱이는 마라탕", CHOROM, none, new Set(["choro"])), []);
});

test("저장할 주인공: 새 사람은 칩까지 합쳐 한 번에 5명까지, 이름은 40자까지", () => {
  const six = tagsForSave("@가 @나 @다 @라 @마 @바 @사", [], []);
  assert.deepEqual(six.map((t) => (t.kind === "new" ? t.name : "")), ["가", "나", "다", "라", "마"]);
  const withChips = tagsForSave("@가 @나 @다", [], [{ kind: "new", name: "x1" }, { kind: "new", name: "x2" }, { kind: "new", name: "x3" }, { kind: "new", name: "x4" }]);
  assert.equal(withChips.length, 5);
  const long = tagsForSave(`@${"가".repeat(60)} 좋아함`, [], []);
  assert.equal(long[0]!.kind === "new" ? long[0]!.name.length : 0, 40);
});
