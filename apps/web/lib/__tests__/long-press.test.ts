import assert from "node:assert/strict";
import { test } from "node:test";
import { createHold, HOLD_MS, HOLD_SLOP, placeMenu, ROW_MENU_H, ROW_MENU_W, type HoldTimers } from "../long-press";

/** 시간을 손으로 흘려보내는 가짜 타이머 */
function fakeTimers() {
  let now = 0;
  let next = 1;
  const jobs = new Map<number, { at: number; fn: () => void }>();
  const timers: HoldTimers = {
    set(fn, ms) {
      const id = next++;
      jobs.set(id, { at: now + ms, fn });
      return id;
    },
    clear(id) {
      jobs.delete(id as number);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, job] of [...jobs]) {
      if (job.at <= now) {
        jobs.delete(id);
        job.fn();
      }
    }
  };
  return { timers, advance, count: () => jobs.size };
}

test("꾹 누르기: 기본은 500ms·10px", () => {
  assert.equal(HOLD_MS, 500);
  assert.equal(HOLD_SLOP, 10);
});

test("꾹 누르기: 가만히 ms가 차면 한 번만 울리고 fired가 켜진다", () => {
  const t = fakeTimers();
  let n = 0;
  const hold = createHold({ onFire: () => n++, timers: t.timers });
  hold.start(100, 200);
  assert.equal(hold.pending, true);
  t.advance(HOLD_MS - 1);
  assert.equal(n, 0);
  assert.equal(hold.fired, false);
  t.advance(1);
  assert.equal(n, 1);
  assert.equal(hold.fired, true);
  assert.equal(hold.pending, false);
  t.advance(5000);
  assert.equal(n, 1, "다시 울리지 않는다");
});

test("꾹 누르기: 짧게 누르고 떼면(cancel) 안 울리고 fired도 켜지지 않는다", () => {
  const t = fakeTimers();
  let n = 0;
  const hold = createHold({ onFire: () => n++, timers: t.timers });
  hold.start(0, 0);
  t.advance(200);
  hold.cancel();
  assert.equal(t.count(), 0, "타이머를 치웠다");
  t.advance(1000);
  assert.equal(n, 0);
  assert.equal(hold.fired, false);
  assert.equal(hold.pending, false);
});

test("꾹 누르기: 10px 이내로 흔들리는 건 괜찮고, 넘게 움직이면 접힌다", () => {
  const t = fakeTimers();
  let n = 0;
  const hold = createHold({ onFire: () => n++, timers: t.timers });
  hold.start(100, 100);
  assert.equal(hold.move(106, 108), false, "거리 10 = 이내");
  assert.equal(hold.pending, true);
  assert.equal(hold.move(100, 111), true, "거리 11 = 넘음");
  assert.equal(hold.pending, false);
  assert.equal(t.count(), 0);
  t.advance(2000);
  assert.equal(n, 0);
  assert.equal(hold.fired, false);
});

test("꾹 누르기: 울린 뒤에는 움직여도 접지 않고(이미 열렸다), cancel해도 fired는 남는다", () => {
  const t = fakeTimers();
  const hold = createHold({ onFire: () => {}, timers: t.timers });
  hold.start(0, 0);
  t.advance(HOLD_MS);
  assert.equal(hold.move(500, 500), false);
  hold.cancel();
  assert.equal(hold.fired, true, "뗀 뒤 따라오는 클릭을 막으려고 남겨 둔다");
});

test("꾹 누르기: 다시 누르면 이전 것은 접히고 fired는 처음으로, 새로 잰다", () => {
  const t = fakeTimers();
  let n = 0;
  const hold = createHold({ onFire: () => n++, timers: t.timers });
  hold.start(0, 0);
  t.advance(HOLD_MS);
  assert.equal(hold.fired, true);
  hold.start(0, 0);
  assert.equal(hold.fired, false);
  assert.equal(hold.pending, true);
  t.advance(300);
  hold.start(0, 0); // 300ms 때 또 누름: 그 뒤 500ms를 다시 센다
  t.advance(300);
  assert.equal(n, 1, "처음 것만 울렸다");
  t.advance(200);
  assert.equal(n, 2);
});

test("꾹 누르기: ms·slop을 바꿔 쓸 수 있다", () => {
  const t = fakeTimers();
  let n = 0;
  const hold = createHold({ onFire: () => n++, ms: 100, slop: 3, timers: t.timers });
  hold.start(0, 0);
  assert.equal(hold.move(4, 0), true);
  hold.start(0, 0);
  t.advance(100);
  assert.equal(n, 1);
});

const VIEW = { w: 390, h: 844 };
const INSET = 96;

test("메뉴 자리: 줄 바로 밑에, 누른 자리가 가운데", () => {
  const p = placeMenu({ x: 200, row: { top: 300, bottom: 350 }, view: VIEW, bottomInset: INSET });
  assert.equal(p.above, false);
  assert.equal(p.top, 356);
  assert.equal(p.left, 200 - ROW_MENU_W / 2);
});

test("메뉴 자리: 화면 왼쪽·오른쪽 끝에서는 안으로 밀어 넣는다", () => {
  const row = { top: 300, bottom: 350 };
  assert.equal(placeMenu({ x: 4, row, view: VIEW, bottomInset: INSET }).left, 12);
  assert.equal(placeMenu({ x: 389, row, view: VIEW, bottomInset: INSET }).left, VIEW.w - ROW_MENU_W - 12);
});

test("메뉴 자리: 아래 막대에 가리면 줄 위에 놓는다", () => {
  const row = { top: 700, bottom: 750 }; // 밑 756+58 > 844-96
  const p = placeMenu({ x: 200, row, view: VIEW, bottomInset: INSET });
  assert.equal(p.above, true);
  assert.equal(p.top, 700 - 6 - ROW_MENU_H);
});

test("메뉴 자리: 위에도 못 놓으면 아래에 두고 화면 밖으로는 안 나간다", () => {
  const tiny = { w: 390, h: 120 };
  const p = placeMenu({ x: 200, row: { top: 10, bottom: 60 }, view: tiny, bottomInset: INSET });
  assert.equal(p.above, false);
  assert.ok(p.top >= 12 && p.top + ROW_MENU_H <= tiny.h, `top=${p.top}`);
});
