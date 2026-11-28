import assert from "node:assert/strict";
import { test } from "node:test";
import { captureField, describeEffect, emptySection, mergeCapture, mergeNoteEffects, NOTE_EFFECTS_MAX, parseEffects, recordEffect, revertEffects, sanitizeSection, whyUnchanged, type CaptureOp, type CaptureValue, type NoteEffect, type PartialCard, type Section } from "../index";

const field = (key: string) => {
  const f = captureField(key);
  assert.ok(f, key);
  return f;
};

/** AI 정리가 한 줄을 적는 것을 흉내: 합치고(merge), 그 일을 기록한다. card는 그 자리에서 바뀐다 */
function put(card: PartialCard, key: string, value: CaptureValue, op: CaptureOp = "add"): NoteEffect | null {
  const f = field(key);
  const before = card[f.section] ?? emptySection(f.section);
  const merged = mergeCapture(f, before as never, value, op);
  const effect = recordEffect(f, value, op, before, merged);
  if (merged) (card as Record<string, unknown>)[f.section] = merged;
  return effect;
}

const fx = (e: NoteEffect | null): NoteEffect => {
  assert.ok(e);
  return e;
};

test("목록 칸: 새로 든 것(add)과 이미 있던 것(known)을 나눠 남긴다", () => {
  const card: PartialCard = { taste: { ...emptySection("taste"), likes: ["떡볶이"] } };
  const e = fx(put(card, "taste.likes", { text: "마라탕, 떡볶이" }));
  assert.deepEqual(e, { f: "taste.likes", t: "items", add: ["마라탕"], known: ["떡볶이"] });
  assert.deepEqual(card.taste?.likes, ["떡볶이", "마라탕"]);
});

test("이미 그렇게 적혀 있던 말은 '다시 말했다'(known)만 남기고, 맞지 않는 값·지우기는 남기지 않는다", () => {
  const card: PartialCard = { taste: { ...emptySection("taste"), likes: ["마라탕"], spicy: 3 } };
  assert.deepEqual(put(card, "taste.likes", { text: "마라탕" }), { f: "taste.likes", t: "items", add: [], known: ["마라탕"] });
  assert.deepEqual(put(card, "taste.spicy", { number: 3 }), { f: "taste.spicy", t: "one", next: 3, ok: 1 });
  assert.equal(put(card, "taste.spicy", { number: 99 }), null, "범위 밖 값");
  assert.equal(put(card, "taste.likes", { text: "마라탕" }, "remove"), null, "지우기는 기록하지 않는다");
  assert.equal(put(card, "taste.likes", { text: "" }), null);
});

// ── 합친 게 없을 때 이유(whyUnchanged): 로그의 same·limit·invalid_value ─────────────────────────────

const likesOf = (likes: string[]): PartialCard => ({ taste: { ...emptySection("taste"), likes } });
const reason = (key: string, value: CaptureValue, card: PartialCard, op: CaptureOp = "add") => {
  const f = field(key);
  const before = card[f.section] ?? emptySection(f.section);
  assert.equal(mergeCapture(f, before as never, value, op), null, "이 시험은 합친 게 없는 경우만"); // 합쳐졌다면 이유를 물을 일이 아니다
  return whyUnchanged(f, value, op, before);
};

test("합친 게 없는 이유: 이미 그렇게 적혀 있으면 same ('마라탕 좋아함'을 또 말한 경우)", () => {
  assert.equal(reason("taste.likes", { text: "마라탕" }, likesOf(["마라탕", "김치찌개"])), "same");
  assert.equal(reason("taste.likes", { text: "마라탕, 김치찌개" }, likesOf(["김치찌개", "마라탕"])), "same");
  assert.equal(reason("taste.likes", { text: " 마라탕 " }, likesOf(["마라탕"])), "same");
  // 한 칸짜리(수·고르는 한 칸)도 같은 값이면 same
  assert.equal(reason("taste.spicy", { number: 3 }, { taste: { ...emptySection("taste"), spicy: 3 } }), "same");
  assert.equal(reason("sizes.shoe", { number: 245 }, { sizes: { ...emptySection("sizes"), shoe: 245 } }), "same");
  assert.equal(reason("taste.alcoholLevel", { codes: ["lots"] }, { taste: { ...emptySection("taste"), alcohol: { level: "lots", kinds: [] } } }), "same");
  // 지울 게 없으면 same ('이미 없어요')
  assert.equal(reason("taste.likes", { text: "마라탕" }, likesOf(["김치찌개"]), "remove"), "same");
});

test("합친 게 없는 이유: 목록이 한도(20개)에 차서 새 값이 못 들어갔으면 same이 아니라 capped", () => {
  const full = Array.from({ length: 20 }, (_, i) => `음식${i + 1}`);
  assert.equal(reason("taste.likes", { text: "마라탕" }, likesOf(full)), "capped");
  // 한도에 찬 목록에 이미 있는 값은 그냥 same
  assert.equal(reason("taste.likes", { text: "음식3" }, likesOf(full)), "same");
  // 글 한 줄 칸이 글자 수 한도(120자)에 차서 이어 붙이지 못한 경우
  const long = "가".repeat(120);
  assert.equal(reason("taste.drinks", { text: "아메리카노" }, { taste: { ...emptySection("taste"), drinks: long } }), "capped");
});

test("합친 게 없는 이유: 칸에 맞지 않는 값은 invalid(없는 코드·범위 밖 수·빈 값·수가 아닌 값)", () => {
  assert.equal(reason("taste.spicy", { number: 7 }, {}), "invalid");
  assert.equal(reason("taste.spicy", { text: "마라탕" }, {}), "invalid"); // 매운맛 칸에 글: 칸을 잘못 고른 것
  assert.equal(reason("taste.spicy", { number: null }, { taste: { ...emptySection("taste"), spicy: 3 } }), "invalid");
  assert.equal(reason("taste.alcoholLevel", { text: "마라탕" }, {}), "invalid");
  assert.equal(reason("favorites.colors", { codes: ["nope"] }, {}), "invalid");
  assert.equal(reason("taste.likes", { text: "  " }, likesOf(["마라탕"])), "invalid");
  assert.equal(reason("dates.birthday", { date: { calendar: "solar", month: 4, day: 31 } }, {}), "invalid");
});

test("한도에 막혀 못 들어간 값은 메모가 '이미 말했다'(known)로 남기지 않는다(나중에 다른 메모를 지울 때 뒷받침으로 오해하지 않게)", () => {
  const full = Array.from({ length: 20 }, (_, i) => `음식${i + 1}`);
  const card = likesOf(full);
  assert.equal(put(card, "taste.likes", { text: "마라탕" }), null);
  assert.deepEqual(card.taste?.likes, full);
  // 19개 + 새 둘: 하나만 들어가고(add), 못 들어간 하나는 known이 아니다
  const nearly = likesOf(full.slice(0, 19));
  assert.deepEqual(fx(put(nearly, "taste.likes", { text: "마라탕, 꿔바로우" })), { f: "taste.likes", t: "items", add: ["마라탕"] });
  // 한 칸짜리·기념일: 값이 다른데 못 합쳤다면(글자 수 한도) ok 표시를 남기지 않는다
  const long = "가".repeat(120);
  assert.equal(put({ taste: { ...emptySection("taste"), drinks: long } }, "taste.drinks", { text: "아메리카노" }), null);
});

test("한 칸짜리: 전 값(prev)과 적은 값(next)을 남긴다", () => {
  const card: PartialCard = { sizes: { ...emptySection("sizes"), shoe: 240 } };
  assert.deepEqual(put(card, "sizes.shoe", { number: 245 }), { f: "sizes.shoe", t: "one", next: 245, prev: 240 });
  const empty: PartialCard = {};
  assert.deepEqual(put(empty, "sizes.shoe", { number: 245 }), { f: "sizes.shoe", t: "one", next: 245, prev: null });
  assert.deepEqual(put(empty, "sizes.top", { text: "L" }), { f: "sizes.top", t: "one", next: "L", prev: null });
});

test("되돌리기 목록: 이 메모가 더한 것만 빼고 나머지는 그대로", () => {
  const card: PartialCard = { taste: { ...emptySection("taste"), likes: ["떡볶이"] } };
  const e = fx(put(card, "taste.likes", { text: "마라탕, 짜장면" }));
  const r = revertEffects(card, [e], []);
  assert.deepEqual((r.sections.taste as { likes: string[] }).likes, ["떡볶이"]);
  assert.deepEqual(r.undone, [{ f: "taste.likes", t: "items", add: ["마라탕", "짜장면"] }]);
});

test("되돌리기 목록: 그 사이 직접 지운 것은 건드릴 것이 없고, 있는 것만 되돌린 줄로 센다", () => {
  const card: PartialCard = {};
  const e = fx(put(card, "taste.likes", { text: "마라탕, 짜장면" }));
  card.taste = { ...card.taste!, likes: ["짜장면", "피자"] }; // 마라탕은 직접 지웠고 피자는 직접 더했다
  const r = revertEffects(card, [e], []);
  assert.deepEqual((r.sections.taste as { likes: string[] }).likes, ["피자"]);
  assert.deepEqual(r.undone, [{ f: "taste.likes", t: "items", add: ["짜장면"] }]);
  const none = revertEffects({ taste: { ...emptySection("taste"), likes: ["피자"] } }, [e], []);
  assert.deepEqual(none, { sections: {}, undone: [] }, "남은 게 없으면 아무것도 바꾸지 않는다");
});

test("되돌리기: 다른 메모가 더했거나 다시 말한 값은 지우지 않는다", () => {
  const card: PartialCard = {};
  const first = fx(put(card, "taste.likes", { text: "마라탕" }));
  const second = fx(put(card, "taste.likes", { text: "마라탕" })); // 이미 있다 → 다시 말함
  assert.deepEqual(second, { f: "taste.likes", t: "items", add: [], known: ["마라탕"] });
  assert.deepEqual(revertEffects(card, [first], [second]), { sections: {}, undone: [] });
  // 다른 메모가 같은 것을 '더한' 경우도 마찬가지(대소문자·띄어쓰기 달라도)
  const other: NoteEffect = { f: "taste.likes", t: "items", add: [" 마라탕 "] };
  assert.deepEqual(revertEffects(card, [first], [other]), { sections: {}, undone: [] });
  // 다른 칸의 같은 말은 뒷받침이 아니다
  const elsewhere: NoteEffect = { f: "gifts.skip", t: "items", add: ["마라탕"] };
  assert.equal(revertEffects(card, [first], [elsewhere]).undone.length, 1);
  // 다른 메모가 같은 목록의 다른 것을 더했다면 그것만 남는다
  const mixed = fx(put(card, "taste.likes", { text: "마라탕, 훠궈" }));
  const r = revertEffects(card, [mixed], [first]);
  assert.deepEqual((r.sections.taste as { likes: string[] }).likes, ["마라탕"]);
});

test("되돌리기 한 칸짜리: 지금 값이 이 메모가 적은 값일 때만 전 값으로(없었으면 비운다)", () => {
  const card: PartialCard = { sizes: { ...emptySection("sizes"), shoe: 240 } };
  const e = fx(put(card, "sizes.shoe", { number: 245 }));
  const back = revertEffects(card, [e], []);
  assert.equal((back.sections.sizes as { shoe: number }).shoe, 240);
  assert.deepEqual(back.undone, [e]);
  // 그 사이 250으로 직접 고쳤으면 그대로
  const edited: PartialCard = { sizes: { ...emptySection("sizes"), shoe: 250 } };
  assert.deepEqual(revertEffects(edited, [e], []), { sections: {}, undone: [] });
  // 처음 적은 값이면 비운다
  const fresh: PartialCard = {};
  const first = fx(put(fresh, "sizes.shoe", { number: 245 }));
  assert.equal((revertEffects(fresh, [first], []).sections.sizes as { shoe: number | null }).shoe, null);
  // 바꿔 쓰는 글·생일·술 한 칸
  const more: PartialCard = {};
  const effects = [fx(put(more, "sizes.top", { text: "M" })), fx(put(more, "dates.birthday", { date: { calendar: "solar", month: 3, day: 5 } })), fx(put(more, "taste.alcoholLevel", { codes: ["some"] }))];
  const r = revertEffects(more, effects, []);
  assert.equal((r.sections.sizes as { top: string }).top, "");
  assert.equal((r.sections.dates as { birthday: unknown }).birthday, null);
  assert.equal((r.sections.taste as { alcohol: { level: string | null } }).alcohol.level, null);
});

test("되돌리기 한 칸짜리: 다른 메모가 같은 값을 말했으면 그대로", () => {
  const card: PartialCard = { sizes: { ...emptySection("sizes"), shoe: 240 } };
  const e = fx(put(card, "sizes.shoe", { number: 245 }));
  const again = fx(put(card, "sizes.shoe", { number: 245 }));
  assert.deepEqual(again, { f: "sizes.shoe", t: "one", next: 245, ok: 1 });
  assert.deepEqual(revertEffects(card, [e], [again]), { sections: {}, undone: [] });
  // 다시 말한 메모 자신은 더한 게 없어 되돌릴 것이 없다
  assert.deepEqual(revertEffects(card, [again], [e]), { sections: {}, undone: [] });
});

test("한 메모가 같은 칸을 여러 번 바꿨으면 거꾸로 차례로 되돌린다", () => {
  const card: PartialCard = { sizes: { ...emptySection("sizes"), shoe: 240 } };
  const a = fx(put(card, "sizes.shoe", { number: 245 }));
  const b = fx(put(card, "sizes.shoe", { number: 250 }));
  const r = revertEffects(card, [a, b], []);
  assert.equal((r.sections.sizes as { shoe: number }).shoe, 240);
  assert.equal(r.undone.length, 2);
});

test("이어 붙인 글(요즘 마시는 것)은 그 조각만 뺀다", () => {
  const card: PartialCard = { taste: { ...emptySection("taste"), drinks: "아메리카노" } };
  const e = fx(put(card, "taste.drinks", { text: "바닐라라떼" }));
  assert.equal(card.taste?.drinks, "아메리카노, 바닐라라떼");
  assert.equal((revertEffects(card, [e], []).sections.taste as { drinks: string }).drinks, "아메리카노");
  const only: PartialCard = {};
  const first = fx(put(only, "taste.drinks", { text: "바닐라라떼" }));
  assert.equal((revertEffects(only, [first], []).sections.taste as { drinks: string }).drinks, "");
});

test("목록을 통째로 바꿨으면(replace) 되돌릴 때 빠졌던 것을 되살린다", () => {
  const card: PartialCard = { life: { ...emptySection("life"), hobbies: ["수영", "독서"] } };
  const e = fx(put(card, "life.hobbies", { text: "등산" }, "replace"));
  assert.deepEqual(card.life?.hobbies, ["등산"]);
  assert.deepEqual(e, { f: "life.hobbies", t: "items", add: ["등산"], drop: ["수영", "독서"] });
  assert.deepEqual((revertEffects(card, [e], []).sections.life as { hobbies: string[] }).hobbies, ["수영", "독서"]);
  // 등산을 이미 지웠다면(바꾼 것을 되돌릴 일이 없으니) 빠졌던 것도 되살리지 않는다
  const gone: PartialCard = { life: { ...emptySection("life"), hobbies: ["캠핑"] } };
  assert.deepEqual(revertEffects(gone, [e], []), { sections: {}, undone: [] });
});

test("고르는 칸(코드): '없음'이 있던 칸에 더했다면 되돌릴 때 '없음'으로 돌아간다", () => {
  const card: PartialCard = { favorites: { ...emptySection("favorites"), patterns: ["none"] as string[] } };
  const e = fx(put(card, "favorites.patterns", { codes: ["stripe"] }));
  assert.deepEqual(card.favorites?.patterns, ["stripe"]);
  const r = revertEffects(card, [e], []);
  assert.deepEqual((r.sections.favorites as { patterns: string[] }).patterns, ["none"]);
});

test("알레르기: 이 메모가 더한 것만 빼고 원래 있던 알레르기는 건드리지 않는다", () => {
  const card: PartialCard = { safety: { ...emptySection("safety"), allergens: ["peanut"] } };
  const e = fx(put(card, "safety.allergens", { codes: ["shrimp"] }));
  assert.deepEqual(card.safety?.allergens.sort(), ["peanut", "shrimp"]);
  const r = revertEffects(card, [e], []);
  assert.deepEqual((r.sections.safety as { allergens: string[] }).allergens, ["peanut"]);
  // 이미 있는 알레르기를 다시 말한 메모는 되돌릴 것이 없다
  const again = fx(put(card, "safety.allergens", { codes: ["peanut"] }));
  assert.deepEqual(revertEffects(card, [again], []), { sections: {}, undone: [] });
});

test("위시리스트: 남는 항목의 링크는 그대로 둔다", () => {
  const card: PartialCard = { gifts: { ...emptySection("gifts"), wishlist: [{ title: "목도리", url: "https://example.com/a" }] } };
  const e = fx(put(card, "gifts.wishlist", { text: "텀블러" }));
  const r = revertEffects(card, [e], []);
  assert.deepEqual((r.sections.gifts as { wishlist: unknown[] }).wishlist, [{ title: "목도리", url: "https://example.com/a" }]);
});

test("기념일·반려동물: 지금 그 모양 그대로일 때만 전 모양으로(없었으면 지운다)", () => {
  const card: PartialCard = {};
  const ann = fx(put(card, "dates.anniversary", { label: "결혼기념일", date: { calendar: "solar", month: 5, day: 1 } }));
  const pet = fx(put(card, "pets.pet", { label: "초코", codes: ["dog"], text: "푸들" }));
  const treat = fx(put(card, "pets.treats", { label: "초코", text: "닭가슴살" }));
  assert.deepEqual(treat.t === "one" && (treat.prev as { name: string }).name, "초코");
  // 간식을 되돌리면 푸들은 남는다
  const t = revertEffects(card, [treat], []);
  assert.deepEqual((t.sections.pets as { pets: { treats: string[]; breed: string }[] }).pets.map((p) => [p.breed, p.treats]), [["푸들", []]]);
  // 셋 다 되돌리면 모두 사라진다
  const all = revertEffects(card, [ann, pet, treat], []);
  assert.deepEqual((all.sections.pets as { pets: unknown[] }).pets, []);
  assert.deepEqual((all.sections.dates as { anniversaries: unknown[] }).anniversaries, []);
  // 그 뒤에 직접 고친 반려동물은 그대로
  const edited: PartialCard = { ...card, pets: { pets: [{ name: "초코", kind: "dog", breed: "말티즈", treats: [], note: "" }], none: false } };
  assert.equal(revertEffects(edited, [pet], []).undone.length, 0);
});

test("되돌린 결과는 저장 모양(sanitizeSection)과 같다", () => {
  const card: PartialCard = {};
  const e = fx(put(card, "taste.likes", { text: "마라탕" }));
  const r = revertEffects(card, [e], []);
  assert.deepEqual(r.sections.taste, sanitizeSection("taste", r.sections.taste));
});

test("화면에 보일 줄: 칸 이름 · 값, 바뀐 값은 전 값 → 값", () => {
  const ko = (e: NoteEffect) => describeEffect(e, "ko");
  assert.deepEqual(ko({ f: "taste.likes", t: "items", add: ["마라탕"] }), { section: "taste", label: "좋아하는 음식", value: "마라탕" });
  assert.deepEqual(ko({ f: "sizes.shoe", t: "one", next: 245, prev: 240 }), { section: "sizes", label: "신발(mm)", value: "245", prev: "240" });
  assert.deepEqual(ko({ f: "sizes.shoe", t: "one", next: 245, prev: null }), { section: "sizes", label: "신발(mm)", value: "245" });
  assert.equal(ko({ f: "safety.allergens", t: "items", add: ["shrimp", "복숭아 껍질"] })?.value, "새우, 복숭아 껍질");
  assert.equal(ko({ f: "taste.spicy", t: "one", next: 3, prev: 1 })?.value, describeEffect({ f: "taste.spicy", t: "one", next: 3 }, "ko")?.value);
  assert.equal(describeEffect({ f: "taste.likes", t: "items", add: ["Maratang"] }, "en")?.label, "Favorite foods");
  assert.equal(ko({ f: "nope.nope", t: "items", add: ["x"] }), null);
  assert.equal(ko({ f: "taste.likes", t: "items", add: [] }), null);
});

test("저장·받은 값 정리: 모르는 칸·깨진 모양은 버리고, 길이·개수를 자른다", () => {
  const good: NoteEffect[] = [
    { f: "taste.likes", t: "items", add: ["마라탕"], drop: ["수영"], known: ["떡볶이"] },
    { f: "sizes.shoe", t: "one", next: 245, prev: 240 },
    { f: "sizes.shoe", t: "one", next: 245, ok: 1 },
  ];
  assert.deepEqual(parseEffects(JSON.parse(JSON.stringify(good))), good);
  assert.deepEqual(parseEffects("nope"), []);
  assert.deepEqual(parseEffects([null, 3, { f: "x.y", t: "items", add: ["a"] }, { f: "taste.likes", t: "items", add: [] }, { f: "taste.likes", t: "items" }, { f: "sizes.shoe", t: "one" }, { f: "taste.likes", t: "zzz" }]), []);
  const long = parseEffects([{ f: "taste.likes", t: "items", add: ["가".repeat(500), 3, "  "] }]);
  assert.equal((long[0] as { add: string[] }).add[0]!.length, 80);
  assert.equal((long[0] as { add: string[] }).add.length, 1);
  assert.equal(parseEffects(Array.from({ length: 80 }, () => ({ f: "taste.likes", t: "items", add: ["a"] }))).length, 24);
  assert.deepEqual(parseEffects([{ f: "sizes.shoe", t: "one", next: "x".repeat(700), prev: null }]), []);
  // 빠진 것(drop)은 더한 것이 있을 때만 의미가 있다
  assert.deepEqual(parseEffects([{ f: "taste.likes", t: "items", add: [], known: ["a"], drop: ["b"] }]), [{ f: "taste.likes", t: "items", add: [], known: ["a"] }]);
});

test("모든 칸 종류에 대해: 합치고 기록한 일을 그대로 되돌리면 합치기 전 모양으로 돌아온다", () => {
  const samples: [string, CaptureValue, CaptureOp?][] = [
    ["taste.likes", { text: "마라탕" }],
    ["taste.spicy", { number: 4 }],
    ["taste.dessert", { text: "마카롱" }],
    ["taste.alcoholLevel", { codes: ["lots"] }],
    ["taste.alcoholKinds", { codes: ["soju"] }],
    ["sizes.top", { text: "XL" }],
    ["sizes.ring", { number: 12 }],
    ["gifts.skip", { text: "향초" }],
    ["gifts.giftCard", { codes: ["yes"] }],
    ["favorites.colors", { codes: ["red"] }],
    ["culture.song", { text: "봄날" }],
    ["life.seasons", { codes: ["autumn"] }],
    ["dates.birthday", { date: { calendar: "lunar", month: 2, day: 9 } }],
    ["safety.dislikes", { text: "고수" }],
    ["safety.diets", { codes: ["vegan"] }],
  ];
  for (const [key, value, op] of samples) {
    const card: PartialCard = {};
    const f = field(key);
    const e = put(card, key, value, op);
    if (!e) continue; // 그 칸이 받지 않는 시험 값
    const r = revertEffects(card, [e], []);
    const after = sanitizeSection(f.section as Section, r.sections[f.section]);
    assert.deepEqual(after, sanitizeSection(f.section as Section, emptySection(f.section)), key);
  }
});

test("고친 메모를 다시 정리할 때: 이미 있던 일은 그대로(순서도) 두고 새 일만 뒤에 붙이며, 똑같은 일은 다시 넣지 않는다", () => {
  const likes = (...add: string[]): NoteEffect => ({ f: "taste.likes", t: "items", add });
  const known = (...k: string[]): NoteEffect => ({ f: "taste.likes", t: "items", add: [], known: k });
  const shoe = (next: number, prev: number): NoteEffect => ({ f: "sizes.shoe", t: "one", next, prev });
  const first = [likes("마라탕"), shoe(245, 240)];
  assert.deepEqual(mergeNoteEffects([], first), first);
  // 새 것만 뒤에: 앞의 둘은 '그 전 일'로 그대로
  const merged = mergeNoteEffects(first, [likes("짜장면")]);
  assert.deepEqual(merged, [...first, likes("짜장면")]);
  // 똑같은 일은 건너뛴다(대소문자·순서 차이가 없는 같은 값): '다시 말했다' 표시가 쌓이지 않는다
  assert.deepEqual(mergeNoteEffects([...first, known("마라탕")], [known("마라탕"), likes("마라탕"), shoe(245, 240), likes("우동")]), [...first, known("마라탕"), likes("우동")]);
  // 이번에 새로 더한 것 안의 똑같은 일도 한 번만
  assert.deepEqual(mergeNoteEffects([], [likes("a"), likes("a")]), [likes("a")]);
  // 한도를 넘으면 뒤를 버리고 앞(그 전 일)은 지킨다
  const many = Array.from({ length: NOTE_EFFECTS_MAX }, (_, i) => likes(`항목${i}`));
  assert.deepEqual(mergeNoteEffects(many, [likes("넘침")]), many);
  assert.equal(mergeNoteEffects(many.slice(0, 23), [likes("x"), likes("y")]).length, NOTE_EFFECTS_MAX);
});
