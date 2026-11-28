// 사람 줄을 꾹 눌러 메뉴 열기: 누르고 있는 시간·움직이면 취소하는 규칙과, 메뉴를 놓을 자리 계산.
// DOM에 기대지 않는 순수한 값만 둔다(타이머는 바꿔 끼울 수 있어 단위 시험이 된다). 화면 쪽은 components/PersonRowMenu.tsx

/** 이만큼 가만히 누르고 있으면 꾹 누른 것 */
export const HOLD_MS = 500;
/** 누른 자리에서 이만큼(px) 넘게 움직이면 꾹 누르기를 접는다(스크롤·끌기로 본다) */
export const HOLD_SLOP = 10;

export interface HoldTimers {
  set(fn: () => void, ms: number): unknown;
  clear(id: unknown): void;
}

const realTimers: HoldTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export interface Hold {
  /** 눌렀다: 시간을 재기 시작(이전 것은 접고, fired도 처음으로) */
  start(x: number, y: number): void;
  /** 움직였다: 눌렀던 자리에서 slop을 넘었으면 접고 true */
  move(x: number, y: number): boolean;
  /** 뗐다·빼앗겼다·스크롤된다: 아직 안 울렸으면 접는다(이미 울렸으면 fired는 그대로) */
  cancel(): void;
  /** 재는 중(아직 안 울렸고 접히지도 않았다) */
  readonly pending: boolean;
  /** 시간이 다 차서 울렸다(뗀 뒤에 따라오는 클릭을 막을 때 본다) */
  readonly fired: boolean;
}

/** 꾹 누르기 판정: start 뒤 ms 동안 접히지 않으면 onFire를 한 번 부른다 */
export function createHold({ onFire, ms = HOLD_MS, slop = HOLD_SLOP, timers = realTimers }: { onFire: () => void; ms?: number; slop?: number; timers?: HoldTimers }): Hold {
  let timer: unknown = null;
  let x0 = 0;
  let y0 = 0;
  let pending = false;
  let fired = false;

  const cancel = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
    pending = false;
  };

  return {
    start(x, y) {
      cancel();
      fired = false;
      x0 = x;
      y0 = y;
      pending = true;
      timer = timers.set(() => {
        timer = null;
        if (!pending) return;
        pending = false;
        fired = true;
        onFire();
      }, ms);
    },
    move(x, y) {
      if (!pending || Math.hypot(x - x0, y - y0) <= slop) return false;
      cancel();
      return true;
    },
    cancel,
    get pending() {
      return pending;
    },
    get fired() {
      return fired;
    },
  };
}

/** 메뉴 크기(px). 항목이 하나뿐이라 늘 같다: 위아래 여백 6 + 줄 44 + 선 2 */
export const ROW_MENU_W = 148;
export const ROW_MENU_H = 58;
/** 화면 가장자리·줄과 메뉴 사이 여백 */
const EDGE = 12;
const GAP = 6;

/**
 * 메뉴를 놓을 자리(화면 기준 left·top). 가로는 누른 자리(x)를 가운데로 하되 화면 안으로,
 * 세로는 줄 바로 밑에, 아래 막대(bottomInset) 때문에 모자라면 줄 위에 놓는다.
 */
export function placeMenu({
  x,
  row,
  view,
  bottomInset,
}: {
  x: number;
  row: { top: number; bottom: number };
  view: { w: number; h: number };
  bottomInset: number;
}): { left: number; top: number; above: boolean } {
  const left = Math.min(Math.max(x - ROW_MENU_W / 2, EDGE), Math.max(view.w - ROW_MENU_W - EDGE, EDGE));
  const below = row.bottom + GAP;
  const fitsBelow = below + ROW_MENU_H <= view.h - bottomInset;
  const aboveTop = row.top - GAP - ROW_MENU_H;
  if (fitsBelow || aboveTop < EDGE) {
    // 위에도 못 놓으면(줄이 화면 맨 위에 붙은 때) 아래에 놓되 화면 밖으로 나가지 않게
    return { left, top: Math.max(Math.min(below, view.h - ROW_MENU_H - EDGE), EDGE), above: false };
  }
  return { left, top: aboveTop, above: true };
}
