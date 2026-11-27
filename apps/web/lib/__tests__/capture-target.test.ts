import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeSection } from "@readme/core";
import { cleanCaptureItems, type CaptureItem, type CapturePerson } from "../capture-ai";
import { makeT } from "../t";
import { personHint } from "../summary";
import { firstPick, holdsForConfirm, matchPeople, resolveCapture, resolveSaved, retarget, sameSectionValue, sameTarget, siblingCount, tidyName, unfitForOrganize, whoOf, type CaptureTarget } from "../capture-target";

const person = (id: string, name: string, nickname = ""): CapturePerson => ({ id, name, nickname });
const item = (who: CaptureItem["who"], extra: Partial<CaptureItem> = {}): CaptureItem => ({ who, target: "favorites.flowers", op: "add", text: "수국", codes: null, number: null, date: null, label: null, ...extra });
const existing = (contactId: string, name: string | null = null): CaptureItem["who"] => ({ type: "existing", contactId, name });
const fresh = (name: string): CaptureItem["who"] => ({ type: "new", contactId: null, name });

const MOM = person("mom", "엄마");
const WIFE = person("wife", "지수", "아내");
const JISU = person("jisu", "지수", "친구");
const BOSS = person("boss", "김 과장님");

test("이름 맞추기: 닉네임·이름이 같은 사람(exact)과 같은 부름말인 사람(related)", () => {
  const m = matchPeople("와이프", [MOM, WIFE, JISU]);
  assert.deepEqual(m.exact, []);
  assert.deepEqual(m.related.map((p) => p.id), ["wife"]);
  // 띄어쓰기·대소문자는 보지 않는다
  assert.deepEqual(matchPeople("김과장님", [BOSS]).exact.map((p) => p.id), ["boss"]);
  assert.deepEqual(matchPeople("", [MOM]), { exact: [], related: [] });
  // 이름이 같은 사람이 둘이면 둘 다
  assert.deepEqual(matchPeople("지수", [WIFE, JISU]).exact.map((p) => p.id), ["wife", "jisu"]);
});

test("대상 정하기: AI가 고른 내 사람은 그 사람, 나는 me", () => {
  const out = resolveCapture([item(existing("mom")), item({ type: "me", contactId: null, name: null })], [MOM, WIFE], { detect: true });
  assert.deepEqual(out.map((r) => r.target), [{ kind: "person", id: "mom" }, { kind: "me" }]);
  assert.deepEqual(out.map((r) => r.idx), [0, 1]);
  assert.equal(out[0]!.spoken, "엄마");
  assert.deepEqual(out[0]!.candidates, []);
});

test("대상 정하기: 새 사람이라는 이름이 같은 부름말로 한 명만 맞으면 그 사람으로(새로 만들지 않는다)", () => {
  const [r] = resolveCapture([item(fresh("와이프"))], [MOM, WIFE], { detect: true });
  assert.deepEqual(r!.target, { kind: "person", id: "wife" });
  assert.equal(r!.spoken, "와이프");
});

test("대상 정하기: 맞는 사람이 없으면 말한 이름의 새 사람. 이름이 없으면 건너뛴다", () => {
  const out = resolveCapture([item(fresh("처제")), item(fresh("  ")), item({ type: "existing", contactId: "ghost", name: null })], [MOM], { detect: true });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0]!.target, { kind: "new", name: "처제" });
});

test("대상 정하기: 같은 말 안의 새 사람은 같은 이름(·같은 부름말)이면 한 명으로", () => {
  const out = resolveCapture([item(fresh("처제")), item(fresh("처제")), item(fresh("김 대리")), item(fresh("김대리"))], [MOM], { detect: true });
  assert.deepEqual(out.map((r) => r.target), [
    { kind: "new", name: "처제" },
    { kind: "new", name: "처제" },
    { kind: "new", name: "김 대리" },
    { kind: "new", name: "김 대리" },
  ]);
  const rel = resolveCapture([item(fresh("와이프")), item(fresh("아내"))], [MOM], { detect: true });
  assert.deepEqual(rel.map((r) => r.target), [{ kind: "new", name: "와이프" }, { kind: "new", name: "와이프" }]);
  // 말한 이름은 줄마다 그대로 남는다
  assert.deepEqual(rel.map((r) => r.spoken), ["와이프", "아내"]);
});

test("같은 이름이 여럿: 이름으로 찾은 사람이 둘 이상이면 못 정함(pick)과 후보", () => {
  const [r] = resolveCapture([item(fresh("지수"))], [MOM, WIFE, JISU], { detect: true });
  assert.deepEqual(r!.target, { kind: "pick" });
  assert.deepEqual(r!.candidates, ["wife", "jisu"]);
  assert.equal(r!.spoken, "지수");
  // 이름이 꼭 같은 사람이 있으면 그 사람이 먼저다(엄마 ↔ 어머니는 같은 부름말이지만 이름이 같은 쪽으로)
  const [e] = resolveCapture([item(fresh("엄마"))], [person("a", "엄마"), person("b", "어머니")], { detect: true });
  assert.deepEqual(e!.target, { kind: "person", id: "a" });
  // 이름이 같은 사람은 없고 같은 부름말을 쓰는 사람이 둘이면 후보로(어머니 · 모친)
  const [m] = resolveCapture([item(fresh("엄마"))], [person("a", "어머니"), person("b", "모친")], { detect: true });
  assert.deepEqual(m!.target, { kind: "pick" });
  assert.deepEqual(m!.candidates, ["a", "b"]);
});

test("같은 이름이 여럿: AI가 그중 한 명을 골라도 이름이 겹치면 못 정함(고른 사람이 후보 맨 앞)", () => {
  const [r] = resolveCapture([item(existing("jisu"))], [MOM, WIFE, JISU], { detect: true });
  assert.deepEqual(r!.target, { kind: "pick" });
  assert.deepEqual(r!.candidates, ["jisu", "wife"]);
});

test("같은 이름이 여럿이어도 직접 짚은 사람(@부름·그 사람 화면)은 그 사람으로 확정", () => {
  const [r] = resolveCapture([item(existing("jisu"))], [MOM, WIFE, JISU], { detect: true, certain: new Set(["jisu"]) });
  assert.deepEqual(r!.target, { kind: "person", id: "jisu" });
  assert.deepEqual(r!.candidates, []);
});

test("detect를 끄면(그 자리에서 바로 적는 길) 예전처럼: 이름이 같으면 첫 사람, 부름말이 여럿이면 새 사람", () => {
  const dup = resolveCapture([item(fresh("지수"))], [WIFE, JISU], { detect: false });
  assert.deepEqual(dup[0]!.target, { kind: "person", id: "wife" });
  const many = resolveCapture([item(fresh("엄마"))], [person("a", "어머니"), person("b", "엄마님")], { detect: false });
  assert.deepEqual(many[0]!.target, { kind: "new", name: "엄마" });
  const picked = resolveCapture([item(existing("jisu"))], [WIFE, JISU], { detect: false });
  assert.deepEqual(picked[0]!.target, { kind: "person", id: "jisu" });
});

test("저장 대상: 화면이 정한 내 사람·새 사람·나. 내 사람이 아닌 contactId는 줄째 버리고 새 사람으로 두지 않는다", () => {
  const out = resolveSaved(
    [item(existing("wife")), item(existing("stranger", "아내")), item({ type: "me", contactId: null, name: null }), item(fresh("처제")), item(fresh("  처제 ")), item(fresh(""))],
    [MOM, WIFE],
  );
  assert.deepEqual(out.map((r) => [r.idx, r.target]), [
    [0, { kind: "person", id: "wife" }],
    [2, { kind: "me" }],
    [3, { kind: "new", name: "처제" }],
    [4, { kind: "new", name: "처제" }],
  ]);
});

test("저장 대상: 새 사람으로 정한 이름은 이미 있는 사람의 이름이어도 이름 맞추기로 합치지 않는다(사람이 정한 대로)", () => {
  const [r] = resolveSaved([item(fresh("엄마"))], [MOM]);
  assert.deepEqual(r!.target, { kind: "new", name: "엄마" });
});

test("저장 대상: 같은 새 이름은 글자만 달라도(띄어쓰기·대소문자) 한 명", () => {
  const out = resolveSaved([item(fresh("Kim Dae ri")), item(fresh("kim daeri"))], []);
  assert.deepEqual(out.map((r) => r.target), [{ kind: "new", name: "Kim Dae ri" }, { kind: "new", name: "Kim Dae ri" }]);
});

test("화면에서 되돌려 보낸 항목 모양 맞추기: 대상과 값이 그대로 온다", () => {
  const sent = [{ ...item(existing("wife")), who: whoOf({ kind: "person", id: "wife" }) }, { ...item(fresh("x")), who: whoOf({ kind: "new", name: "처제" }) }];
  const back = cleanCaptureItems(sent);
  assert.deepEqual(back[0]!.who, { type: "existing", contactId: "wife", name: null });
  assert.deepEqual(back[1]!.who, { type: "new", contactId: null, name: "처제" });
});

test("whoOf: 대상 → 항목의 who(못 정함은 말한 이름의 새 사람)", () => {
  assert.deepEqual(whoOf({ kind: "me" }), { type: "me", contactId: null, name: null });
  assert.deepEqual(whoOf({ kind: "person", id: "p" }), { type: "existing", contactId: "p", name: null });
  assert.deepEqual(whoOf({ kind: "new", name: "처제" }), { type: "new", contactId: null, name: "처제" });
  assert.deepEqual(whoOf({ kind: "pick" }, "지수"), { type: "new", contactId: null, name: "지수" });
});

test("tidyName·sameTarget", () => {
  assert.equal(tidyName("  김   과장  "), "김 과장");
  assert.equal(tidyName(null), "");
  assert.equal(tidyName("가".repeat(50)).length, 40);
  assert.ok(sameTarget({ kind: "person", id: "a" }, { kind: "person", id: "a" }));
  assert.ok(!sameTarget({ kind: "person", id: "a" }, { kind: "person", id: "b" }));
  assert.ok(sameTarget({ kind: "new", name: "Kim Daeri" }, { kind: "new", name: "kim  daeri" }));
  assert.ok(!sameTarget({ kind: "new", name: "a" }, { kind: "person", id: "a" }));
  assert.ok(sameTarget({ kind: "pick" }, { kind: "pick" }));
});

interface Row {
  key: number;
  target: CaptureTarget;
  spoken: string;
}
const rows = (): Row[] => [
  { key: 0, target: { kind: "new", name: "와이프" }, spoken: "와이프" },
  { key: 1, target: { kind: "new", name: "와이프" }, spoken: "와이프" },
  { key: 2, target: { kind: "person", id: "mom" }, spoken: "엄마" },
  { key: 3, target: { kind: "new", name: "와이프" }, spoken: "아내" },
];

test("대상 바꾸기: 같은 이름 줄(같은 말·같은 대상)을 모두 바꾸는 것이 기본, 그 줄만도 가능", () => {
  const all = retarget(rows(), 0, { kind: "person", id: "wife" }, true);
  assert.deepEqual(all.changed, [0, 1]);
  assert.deepEqual(all.rows.map((r) => r.target), [{ kind: "person", id: "wife" }, { kind: "person", id: "wife" }, { kind: "person", id: "mom" }, { kind: "new", name: "와이프" }]);
  const one = retarget(rows(), 0, { kind: "person", id: "wife" }, false);
  assert.deepEqual(one.changed, [0]);
  assert.deepEqual(one.rows[1]!.target, { kind: "new", name: "와이프" });
});

test("대상 바꾸기: 이미 따로 바꾼 줄은 같은 이름 줄이 아니다(다시 바꿔도 따라오지 않는다)", () => {
  const split = retarget(rows(), 0, { kind: "person", id: "wife" }, false).rows;
  assert.equal(siblingCount(split, 0), 0);
  assert.equal(siblingCount(split, 1), 0);
  assert.equal(siblingCount(rows(), 0), 1);
  assert.equal(siblingCount(rows(), 2), 0);
  const back = retarget(split, 0, { kind: "person", id: "mom" }, true);
  assert.deepEqual(back.changed, [0]);
});

test("저장 전에 못 정한 첫 줄", () => {
  assert.equal(firstPick(rows()), undefined);
  const list = rows();
  list[2] = { ...list[2]!, target: { kind: "pick" } };
  list[3] = { ...list[3]!, target: { kind: "pick" } };
  assert.equal(firstPick(list)?.key, 2);
  assert.equal(firstPick(retarget(list, 2, { kind: "person", id: "a" }, false).rows)?.key, 3);
});

test("이름이 같은 사람을 가리는 힌트: 알레르기·입맛처럼 사람마다 다른 기록의 첫 줄, 기록이 없으면 빈 글", () => {
  const t = makeT("ko");
  assert.equal(personHint({}, "ko", t), "");
  assert.equal(personHint({ taste: sanitizeSection("taste", { likes: ["소고기"] }) }, "ko", t), "소고기");
  // 알레르기가 있으면 그것이 먼저
  const both = personHint({ safety: sanitizeSection("safety", { allergens: ["peanut"] }), taste: sanitizeSection("taste", { likes: ["소고기"] }) }, "ko", t);
  assert.match(both, /알레르기/);
  assert.ok(personHint({ taste: sanitizeSection("taste", { likes: ["가".repeat(60)] }) }, "ko", t).length <= 30);
});

test("되돌리기 판단: 지금 값이 말로 적은 값 그대로일 때만 되돌린다(그 뒤에 직접 고쳤으면 그대로 둔다)", () => {
  const written = { ...sanitizeSection("favorites", {}), flowers: "수국" };
  // 그대로: 되돌려도 된다(저장·읽기를 거쳐 모양이 조금 달라도 같은 값이면 같다)
  assert.equal(sameSectionValue("favorites", { flowers: "수국" }, written), true);
  assert.equal(sameSectionValue("favorites", JSON.parse(JSON.stringify(written)), written), true);
  // 그 뒤에 직접 고쳤다: 되돌리면 그 고친 내용이 사라지니 건드리지 않는다
  assert.equal(sameSectionValue("favorites", { ...written, flowers: "장미" }, written), false);
  assert.equal(sameSectionValue("favorites", { ...written, scent: "우디" }, written), false);
  // 지금 비어 있다(누가 항목을 지웠다)면 적은 값과 다르다. 둘 다 비면 같다
  assert.equal(sameSectionValue("favorites", null, written), false);
  assert.equal(sameSectionValue("favorites", undefined, null), true);
});

test("바로 적지 않고 확인받을 것: 알레르기·못 먹는 것·식단을 지우거나 바꾸는 것만(더하기·다른 칸은 바로)", () => {
  const hold = (target: CaptureItem["target"], op: CaptureItem["op"]) => holdsForConfirm({ target, op });
  // 안전 칸의 지우기·바꾸기는 확인을 거친다(전체 비우기도 같은 remove)
  for (const t of ["safety.allergens", "safety.dislikes", "safety.diets", "safety.allergyNote"] as const) {
    assert.equal(hold(t, "remove"), true, `${t} remove`);
    assert.equal(hold(t, "replace"), true, `${t} replace`);
    assert.equal(hold(t, "add"), false, `${t} add`);
  }
  // 안전 칸이 아니면 예전처럼 바로
  for (const t of ["favorites.flowers", "taste.drinks", "memo", "dates.birthday"] as const) {
    for (const op of ["add", "replace", "remove"] as const) assert.equal(hold(t as CaptureItem["target"], op), false, `${t} ${op}`);
  }
});


test("메모 정리: '마라탕 좋아함' 같은 칸 항목은 고른 사람에게 적고, 메모·확인이 필요한 줄·다른 대상은 이유와 함께 거른다", () => {
  const likes = (who: CaptureItem["who"], extra: Partial<CaptureItem> = {}) => item(who, { target: "taste.likes", text: "마라탕", ...extra });
  const rows = resolveCapture(
    [
      likes(existing("wife")), // 고른 사람 → 적는다
      likes(existing("mom")), // 다른 사람
      likes({ type: "me", contactId: null, name: null }), // 나
      likes(existing("wife"), { target: "memo", text: "마라탕을 좋아함" }), // 메모 칸
      likes(existing("wife"), { target: "safety.dislikes", op: "remove" }), // 확인이 필요한 줄
      likes(existing("wife"), { target: "safety.dislikes", op: "add", text: "오이" }), // 더하기는 안전 칸이라도 바로 적는다
      likes(fresh("처제")), // 새 사람
    ],
    [MOM, WIFE],
    { detect: true, certain: new Set(["wife"]) },
  );
  assert.deepEqual(
    rows.map((r) => unfitForOrganize(r, ["wife"])),
    [null, "other", "other", "memo", "held", null, "other"],
  );
  // 같은 이름 둘이 있어 못 정한 줄(pick)도 적지 않는다
  const [twin] = resolveCapture([likes(fresh("지수"))], [WIFE, JISU], { detect: true });
  assert.equal(twin!.target.kind, "pick");
  assert.equal(unfitForOrganize(twin!, ["wife", "jisu"]), "other");
});
