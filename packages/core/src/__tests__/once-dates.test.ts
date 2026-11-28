import assert from "node:assert/strict";
import { test } from "node:test";
import {
  captureField,
  describeCapture,
  describeEffect,
  dueWithCatchUp,
  emptySection,
  eventPath,
  isOnceSpec,
  mergeCapture,
  mergeImport,
  ONCE_MAX,
  onceSpec,
  parseEffects,
  recordEffect,
  reminderBody,
  resolveOnce,
  revertEffects,
  sanitizeSection,
  upcomingEvents,
  whyUnchanged,
  eventTitle,
  type CaptureOp,
  type CaptureValue,
  type DatesData,
  type NoteEffect,
  type PartialCard,
  type YMD,
} from "../index";

// 한 번만 있는 날(약속·집들이 …): 기념일 한 줄에 once 표시가 붙는다. 해마다 돌아오지 않고 그 하루에만 오고, 지나면 다가오는 날에서 빠진다

const TODAY: YMD = { y: 2026, m: 11, d: 28 };
const plan = captureField("dates.plan")!;
const anniversary = captureField("dates.anniversary")!;
const dates = (d: Partial<DatesData>): DatesData => ({ ...emptySection("dates"), ...d });
const day = (y: number, m: number, d: number, extra: object = {}) => ({ calendar: "solar" as const, month: m, day: d, year: y, ...extra });

test("resolveOnce: 연도가 없으면 오늘 이후 가장 가까운 그 날, 오늘은 오늘", () => {
  assert.deepEqual(resolveOnce({ calendar: "solar", month: 12, day: 6 }, TODAY), { y: 2026, m: 12, d: 6 });
  assert.deepEqual(resolveOnce({ calendar: "solar", month: 3, day: 2 }, TODAY), { y: 2027, m: 3, d: 2 }, "올해 3월은 지났으니 내년");
  assert.deepEqual(resolveOnce({ calendar: "solar", month: 11, day: 28 }, TODAY), TODAY);
  assert.deepEqual(resolveOnce({ calendar: "solar", month: 2, day: 29 }, TODAY), { y: 2027, m: 2, d: 28 }, "평년 2월 29일은 28일");
});

test("resolveOnce: 연도가 있으면 그 해의 그 날. 지난 날·너무 먼 날·없는 날은 null", () => {
  assert.deepEqual(resolveOnce(day(2027, 1, 3), TODAY), { y: 2027, m: 1, d: 3 });
  assert.equal(resolveOnce(day(2026, 11, 27), TODAY), null, "어제");
  assert.equal(resolveOnce(day(2025, 12, 6), TODAY), null, "작년");
  assert.equal(resolveOnce(day(2030, 1, 1), TODAY), null, "몇 년 뒤");
  assert.equal(resolveOnce({ calendar: "solar", month: 4, day: 31 }, TODAY), null, "없는 날");
});

test("resolveOnce: 음력은 양력으로 풀어 돌려준다", () => {
  // 2026년 음력 8월 15일(추석) = 양력 2026-09-25 → 오늘(11-28) 이후 가장 가까운 것은 2027년 추석
  const d = resolveOnce({ calendar: "lunar", month: 8, day: 15 }, TODAY);
  assert.ok(d && d.y === 2027);
  assert.deepEqual(resolveOnce({ calendar: "lunar", month: 11, day: 1, year: 2026 }, { y: 2026, m: 11, d: 1 }), { y: 2026, m: 12, d: 9 });
});

test("isOnceSpec·onceSpec: 양력 연·월·일이 다 있어야 한 번만 있는 날", () => {
  assert.equal(isOnceSpec(day(2026, 12, 6)), true);
  assert.equal(isOnceSpec({ calendar: "solar", month: 12, day: 6 }), false);
  assert.equal(isOnceSpec({ calendar: "lunar", month: 8, day: 15, year: 2026 }), false);
  assert.deepEqual(onceSpec({ y: 2026, m: 12, d: 6 }), day(2026, 12, 6));
});

test("정리: once는 양력 연·월·일이 다 있을 때만 남고(아니면 해마다 도는 기념일), 한도는 따로 센다", () => {
  const clean = sanitizeSection("dates", {
    birthday: null,
    anniversaries: [
      { label: "집들이", spec: day(2026, 12, 6), once: true },
      { label: "연도 없음", spec: { calendar: "solar", month: 12, day: 6 }, once: true },
      { label: "음력", spec: { calendar: "lunar", month: 8, day: 15, year: 2026 }, once: true },
      { label: "결혼기념일", spec: day(2015, 5, 3) },
    ],
  });
  assert.deepEqual(clean.anniversaries, [
    { label: "집들이", spec: day(2026, 12, 6), once: true },
    { label: "연도 없음", spec: { calendar: "solar", month: 12, day: 6 } },
    { label: "음력", spec: { calendar: "lunar", month: 8, day: 15, leap: false, year: 2026 } },
    { label: "결혼기념일", spec: day(2015, 5, 3) },
  ]);
  const many = sanitizeSection("dates", {
    anniversaries: [
      ...Array.from({ length: 12 }, (_, i) => ({ label: `기념일${i}`, spec: day(2000, 1, i + 1) })),
      ...Array.from({ length: ONCE_MAX + 3 }, (_, i) => ({ label: `약속${i}`, spec: day(2026, 12, (i % 28) + 1), once: true })),
    ],
  });
  assert.equal(many.anniversaries.filter((a) => !a.once).length, 10);
  assert.equal(many.anniversaries.filter((a) => a.once).length, ONCE_MAX);
});

test("upcomingEvents: 한 번만 있는 날은 그 하루에 한 번 오고, 지나면 빠진다(해마다 돌아오지 않는다)", () => {
  const people = [{ contactId: "a", name: "초롱이", anniversaries: [{ label: "집들이", spec: day(2026, 12, 6), once: true as const }, { label: "병원", spec: day(2026, 11, 20), once: true as const }, { label: "결혼기념일", spec: day(2015, 12, 6) }] }];
  const now = upcomingEvents(people, TODAY);
  assert.deepEqual(now.map((e) => [e.label, e.daysUntil, !!e.once]), [["집들이", 8, true], ["결혼기념일", 8, false]]);
  assert.deepEqual(now[0]!.date, { y: 2026, m: 12, d: 6 });
  // 해가 바뀐 뒤: 집들이는 내년에 다시 오지 않는다, 기념일은 온다
  const later = upcomingEvents(people, { y: 2026, m: 12, d: 7 });
  assert.deepEqual(later.map((e) => e.label), ["결혼기념일"]);
  assert.equal(later[0]!.daysUntil, 364);
  // 당일은 0일 남음
  assert.equal(upcomingEvents(people, { y: 2026, m: 12, d: 6 }).find((e) => e.label === "집들이")!.daysUntil, 0);
});

test("알림: 한 번만 있는 날도 같은 규칙(남은 날이 알림 시점과 같을 때)으로 나가고, 지난 날은 어제 것도 안 보낸다", () => {
  const people = [{ contactId: "a", name: "초롱이", anniversaries: [{ label: "집들이", spec: day(2026, 12, 6), once: true as const }] }];
  const due = (today: YMD) => dueWithCatchUp(people, today, [7, 0]).map((d) => [d.event.label, d.offset]);
  assert.deepEqual(due({ y: 2026, m: 11, d: 29 }), [["집들이", 7]]);
  assert.deepEqual(due({ y: 2026, m: 12, d: 6 }), [["집들이", 0]]);
  assert.deepEqual(due({ y: 2026, m: 12, d: 7 }), [], "하루 지났으면 어제 당일 알림을 뒤늦게 보내지 않는다");
  assert.deepEqual(due({ y: 2027, m: 12, d: 6 }), [], "내년 같은 날에도 안 온다");
});

test("이름: 한 번만 있는 날은 'n주년'이 붙지 않는다", () => {
  const e = upcomingEvents([{ contactId: "a", name: "초롱이", anniversaries: [{ label: "집들이", spec: day(2026, 12, 6), once: true }] }], TODAY)[0]!;
  assert.equal(eventTitle("ko", e), "초롱이 집들이");
});

const merge = (cur: DatesData | null, value: CaptureValue, op: CaptureOp = "add", f = plan) => mergeCapture(f, cur as never, value, op) as DatesData | null;

test("dates.plan 더하기: 연·월·일이 다 있는 양력 날짜만, 한 번만 있는 날로 들어간다", () => {
  const out = merge(null, { label: "집들이", date: day(2026, 12, 6) });
  assert.deepEqual(out?.anniversaries, [{ label: "집들이", spec: day(2026, 12, 6), once: true }]);
  assert.equal(merge(null, { label: "집들이", date: { calendar: "solar", month: 12, day: 6 } }), null, "연도 없음");
  assert.equal(merge(null, { label: "집들이", date: { calendar: "lunar", month: 8, day: 15, year: 2026 } }), null, "음력");
  assert.equal(merge(null, { label: "", date: day(2026, 12, 6) }), null, "이름 없음");
});

test("dates.plan: 같은 이름·같은 날은 그대로, 이름이 같아도 날이 다르면 다른 일정, 바꾸기는 같은 이름의 것을 바꾼다", () => {
  const one = merge(null, { label: "병원", date: day(2026, 12, 3) })!;
  assert.equal(merge(one, { label: "병원", date: day(2026, 12, 3) }), null);
  const two = merge(one, { label: "병원", date: day(2026, 12, 20) })!;
  assert.equal(two.anniversaries.length, 2);
  const moved = merge(two, { label: "병원", date: day(2026, 12, 24) }, "replace")!;
  assert.deepEqual(moved.anniversaries.map((a) => a.spec.day), [24]);
});

test("해마다 도는 기념일과 한 번만 있는 날은 서로 건드리지 않는다", () => {
  const cur = dates({ anniversaries: [{ label: "집들이", spec: day(2020, 12, 6) }] });
  const out = merge(cur, { label: "집들이", date: day(2026, 12, 6) })!;
  assert.equal(out.anniversaries.length, 2, "같은 이름이라도 해마다 도는 것은 그대로");
  const back = merge(out, { label: "집들이", date: day(2021, 5, 5) }, "add", anniversary)!;
  assert.equal(back.anniversaries.filter((a) => a.once).length, 1, "기념일을 더해도 한 번만 있는 날은 그대로");
  assert.equal(back.anniversaries.filter((a) => !a.once).length, 1, "같은 이름의 기념일은 바뀐다");
});

test("dates.plan 지우기: 한 번만 있는 날만 이름으로 지운다(기념일은 건드리지 않는다)", () => {
  const cur = dates({ anniversaries: [{ label: "결혼기념일", spec: day(2015, 5, 3) }, { label: "집들이", spec: day(2026, 12, 6), once: true }] });
  const out = merge(cur, { label: "집들이" }, "remove")!;
  assert.deepEqual(out.anniversaries.map((a) => a.label), ["결혼기념일"]);
  assert.equal(merge(cur, { label: "결혼기념일" }, "remove"), null, "기념일은 이 칸으로 못 지운다");
  assert.deepEqual(merge(cur, { label: "결혼기념일" }, "remove", anniversary)!.anniversaries.map((a) => a.label), ["집들이"], "기념일 칸은 예전처럼");
});

test("한 번만 있는 날이 한도를 넘으면 날짜가 가장 이른 것부터 빠진다", () => {
  const cur = dates({ anniversaries: Array.from({ length: ONCE_MAX }, (_, i) => ({ label: `약속${i}`, spec: day(2026, 12, i + 1), once: true as const })) });
  const out = merge(cur, { label: "새 약속", date: day(2027, 1, 5) })!;
  assert.equal(out.anniversaries.length, ONCE_MAX);
  assert.ok(out.anniversaries.some((a) => a.label === "새 약속"));
  assert.ok(!out.anniversaries.some((a) => a.label === "약속0"), "가장 이른 12월 1일 약속이 빠진다");
});

test("가져오기: 한 번만 있는 날 칸은 같은 이름·같은 날이 아니면 더한다(기념일 칸은 같은 이름이면 건드리지 않는다)", () => {
  const cur = dates({ anniversaries: [{ label: "결혼기념일", spec: day(2015, 5, 3) }] });
  assert.equal(mergeImport(anniversary, cur as never, { label: "결혼기념일", date: day(2016, 5, 3) }), null);
  assert.ok(mergeImport(plan, cur as never, { label: "결혼기념일", date: day(2026, 12, 6) }));
});

test("말하는 값: '12월 6일 집들이'(날짜가 먼저), 영어는 '12/6 …'", () => {
  assert.equal(describeCapture(plan, { label: "집들이", date: day(2026, 12, 6) }, "ko"), "12월 6일 집들이");
  assert.equal(describeCapture(plan, { label: "Housewarming", date: day(2026, 12, 6) }, "en"), "12/6 Housewarming");
  assert.equal(describeCapture(anniversary, { label: "결혼기념일", date: day(2015, 5, 3) }, "ko"), "결혼기념일 5월 3일", "예전 기념일 말은 그대로");
});

// ── 메모가 더한 것의 기록·되돌리기 ──

function put(card: PartialCard, value: CaptureValue, op: CaptureOp = "add"): NoteEffect | null {
  const before = card.dates ?? emptySection("dates");
  const merged = mergeCapture(plan, before as never, value, op);
  const e = recordEffect(plan, value, op, before, merged);
  if (merged) card.dates = merged as DatesData;
  return e;
}

test("메모 정리 기록: '챙길 날 · 12월 6일 집들이'로 보이고, 같이 지우면 그 일정만 되돌린다", () => {
  const card: PartialCard = { dates: dates({ anniversaries: [{ label: "결혼기념일", spec: day(2015, 5, 3) }] }) };
  const e = put(card, { label: "집들이", date: day(2026, 12, 6) });
  assert.ok(e);
  assert.equal(e.f, "dates.plan");
  assert.deepEqual(describeEffect(e, "ko"), { section: "dates", label: "챙길 날", value: "12월 6일 집들이" });
  assert.equal(card.dates?.anniversaries.length, 2);
  const r = revertEffects(card, [e], []);
  assert.deepEqual(r.sections.dates?.anniversaries.map((a) => a.label), ["결혼기념일"]);
  assert.equal(r.undone.length, 1);
});

test("메모 정리 기록: 다시 말한 같은 일정은 '이미 있다'(ok)로만 남고, 다른 메모가 뒷받침하면 같이 지워도 남는다", () => {
  const card: PartialCard = {};
  const first = put(card, { label: "집들이", date: day(2026, 12, 6) })!;
  const again = put(card, { label: "집들이", date: day(2026, 12, 6) });
  assert.deepEqual(again, { f: "dates.plan", t: "one", next: first.t === "one" ? first.next : null, ok: 1 });
  assert.equal(whyUnchanged(plan, { label: "집들이", date: day(2026, 12, 6) }, "add", card.dates), "same");
  assert.equal(revertEffects(card, [first], [again!]).undone.length, 0, "다른 메모도 같은 일정을 말했다");
  assert.equal(revertEffects(card, [first], []).undone.length, 1);
});

test("메모 정리 기록: 같은 이름의 일정을 바꾸면 전 일정이 prev로 남아 되돌릴 때 돌아온다", () => {
  const card: PartialCard = {};
  put(card, { label: "병원", date: day(2026, 12, 3) });
  const e = put(card, { label: "병원", date: day(2026, 12, 24) }, "replace")!;
  assert.ok(e.t === "one" && e.prev && (e.prev as { spec: { day: number } }).spec.day === 3);
  const r = revertEffects(card, [e], []);
  assert.deepEqual(r.sections.dates?.anniversaries.map((a) => a.spec.day), [3]);
  // 이름이 같아도 날이 다른 일정을 더한 것은 전 일정을 가리키지 않는다
  const c2: PartialCard = {};
  put(c2, { label: "병원", date: day(2026, 12, 3) });
  const added = put(c2, { label: "병원", date: day(2026, 12, 20) })!;
  assert.ok(added.t === "one" && added.prev == null);
  assert.deepEqual(revertEffects(c2, [added], []).sections.dates?.anniversaries.map((a) => a.spec.day), [3]);
});

test("저장한 기록 풀기: 한 번만 있는 날의 일은 그대로 읽힌다", () => {
  const card: PartialCard = {};
  const e = put(card, { label: "집들이", date: day(2026, 12, 6) })!;
  assert.deepEqual(parseEffects(JSON.parse(JSON.stringify([e]))), [e]);
});

// ── 알림 문구·링크: 약속은 선물 얘기 없이 그 사람 화면으로 ──

const evs = (anniversaries: { label: string; spec: ReturnType<typeof day>; once?: true }[]) => upcomingEvents([{ contactId: "p1", name: "엄마", anniversaries }], TODAY);

test("알림 본문: 생일·기념일은 선물 힌트 안내, 한 번만 있는 날은 '내일 · 엄마 꽃시장 가기'(오늘·내일, 그 밖에는 날짜)", () => {
  const yearlyEvent = evs([{ label: "결혼기념일", spec: day(2015, 12, 6) }])[0]!;
  assert.equal(reminderBody("ko", yearlyEvent, 7), "기억해 둔 선물 힌트를 열어 보세요.");
  const [soon] = evs([{ label: "꽃시장 가기", spec: day(2026, 11, 29), once: true }]);
  assert.equal(reminderBody("ko", soon!, 1), "내일 · 엄마 꽃시장 가기");
  assert.match(reminderBody("en", soon!, 1), /^Tomorrow · .*꽃시장 가기$/);
  const [far] = evs([{ label: "꽃시장 가기", spec: day(2026, 12, 6), once: true }]);
  assert.equal(reminderBody("ko", far!, 7), "12월 6일 일요일 · 엄마 꽃시장 가기");
  assert.equal(reminderBody("ko", far!, 0), "오늘 · 엄마 꽃시장 가기");
});

test("눌러 열 곳: 생일·기념일은 선물 힌트, 한 번만 있는 날은 그 사람 화면", () => {
  const yearlyEvent = evs([{ label: "결혼기념일", spec: day(2015, 12, 6) }])[0]!;
  assert.equal(eventPath(yearlyEvent), `/people/p1/reminder?kind=anniversary&label=${encodeURIComponent("결혼기념일")}`);
  assert.equal(eventPath(evs([{ label: "집들이", spec: day(2026, 12, 6), once: true }])[0]!), "/people/p1");
});
