"use client";

import { useEffect, useRef, useState } from "react";
import { createHold, type Hold } from "@/lib/long-press";

// 사람들 목록(폴더 없는 사람)에서 사람을 끌어 위의 폴더 칸에 놓기.
// 휴대폰 웹뷰는 HTML 드래그를 못 쓰니 포인터 이벤트로 직접 한다:
//  - 터치: 길게(350ms) 누르면 집을 준비가 된다(진동). 그 전에 움직이면 스크롤로 보고 놓아준다. 준비된 뒤 8px 넘게 움직이면 끌기가 시작된다.
//  - 마우스: 누른 채 6px 넘게 끌면 집는다.
//  - 꾹 누르기 메뉴(onHold): 터치·마우스 모두 500ms 동안 가만히 누르고 있으면(끌기를 시작하지 않고) onHold. 끌기가 먼저 시작되면 메뉴는 없던 일이 된다.
// 놓을 곳은 손가락 아래의 [data-drop] 칸(폴더 id). 화면 위·아래 끝에서는 저절로 스크롤한다.

const LONG_PRESS_MS = 350;
const TOUCH_SLOP = 8;
const MOUSE_SLOP = 6;
/** 꾹 눌렀다 뗀 뒤 따라오는 클릭을 막아 두는 시간 */
const HELD_CLICK_MS = 400;
/** 아래쪽 자동 스크롤 시작선(탭 막대 위) */
const BOTTOM_EDGE = 130;
const TOP_EDGE = 90;

interface Press {
  id: string;
  name: string;
  from: string;
  pointerType: string;
  x0: number;
  y0: number;
  /** 터치: 350ms 눌러 집을 준비가 됐다(아직 안 움직였으면 끌기는 시작 전) */
  armed: boolean;
  started: boolean;
  /** 꾹 누르기 메뉴가 열렸다(뗄 때까지 끌기는 안 한다) */
  held: boolean;
  hold: Hold | null;
  timer: number;
}

export function useDragToFolder({
  enabled,
  onDrop,
  onHold,
}: {
  enabled: boolean;
  onDrop: (contactId: string, target: string) => void;
  /** 가만히 꾹 눌렀다: 줄(row)과 누른 가로 자리 */
  onHold?: (contactId: string, row: HTMLElement, x: number) => void;
}) {
  // x·y: 집은 자리(고스트 첫 위치). 그 뒤로는 손가락을 따라 DOM에서 바로 옮긴다
  const [dragging, setDragging] = useState<{ id: string; name: string; from: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const overRef = useRef<string | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const raf = useRef(0);
  const dropRef = useRef(onDrop);
  const holdRef = useRef(onHold);
  useEffect(() => {
    dropRef.current = onDrop;
    holdRef.current = onHold;
  });
  const cleanupRef = useRef<() => void>(() => {});

  // 화면을 떠나면 끌기 표시(<html data-dragging>)도 치운다
  useEffect(
    () => () => {
      cleanupRef.current();
      delete document.documentElement.dataset.dragging;
    },
    [],
  );

  function placeGhost() {
    if (ghost.current) ghost.current.style.transform = `translate(${pos.current.x - 28}px, ${pos.current.y - 34}px)`;
  }

  function findTarget() {
    const el = document.elementFromPoint(pos.current.x, pos.current.y);
    const key = el?.closest("[data-drop]")?.getAttribute("data-drop") ?? null;
    if (key !== overRef.current) {
      overRef.current = key;
      setOver(key);
    }
  }

  function autoScroll() {
    const p = press.current;
    if (!p?.started) return;
    const y = pos.current.y;
    const h = window.innerHeight;
    const step = y < TOP_EDGE ? -Math.ceil((TOP_EDGE - y) / 6) : y > h - BOTTOM_EDGE ? Math.ceil((y - (h - BOTTOM_EDGE)) / 6) : 0;
    if (step) {
      window.scrollBy(0, step);
      findTarget();
    }
    raf.current = requestAnimationFrame(autoScroll);
  }

  function begin(p: Press) {
    p.hold?.cancel();
    p.started = true;
    // 끄는 동안은 아래 탭 넘기기(SwipeTabs)를 막는다
    document.documentElement.dataset.dragging = "";
    setDragging({ id: p.id, name: p.name, from: p.from, x: pos.current.x, y: pos.current.y });
    overRef.current = p.from;
    setOver(p.from);
    raf.current = requestAnimationFrame(autoScroll);
  }

  /** 터치로 350ms 눌렀다: 집을 준비(진동). 손가락이 움직이면 그때 끌기가 시작된다 */
  function arm(p: Press) {
    p.armed = true;
    navigator.vibrate?.(12);
  }

  function onPointerDown(e: React.PointerEvent, id: string, name: string, from: string) {
    if (!enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    cleanupRef.current();
    const row = e.currentTarget as HTMLElement;
    const p: Press = { id, name, from, pointerType: e.pointerType, x0: e.clientX, y0: e.clientY, armed: false, started: false, held: false, hold: null, timer: 0 };
    press.current = p;
    pos.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType !== "mouse") p.timer = window.setTimeout(() => arm(p), LONG_PRESS_MS);
    if (holdRef.current) {
      p.hold = createHold({
        onFire: () => {
          if (p.started) return;
          p.held = true;
          holdRef.current?.(p.id, row, pos.current.x);
        },
      });
      p.hold.start(e.clientX, e.clientY);
    }

    const move = (ev: PointerEvent) => {
      pos.current = { x: ev.clientX, y: ev.clientY };
      if (p.held) return;
      const dist = Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0);
      if (!p.started) {
        if (p.pointerType === "mouse") {
          if (dist <= MOUSE_SLOP) return;
          begin(p);
        } else if (p.armed) {
          if (dist <= TOUCH_SLOP) return;
          begin(p);
        } else {
          if (dist > TOUCH_SLOP) cleanup(); // 집기 전에 움직이면 스크롤
          return;
        }
      }
      placeGhost();
      findTarget();
    };
    // 집을 준비가 된 뒤에는 화면이 같이 스크롤되지 않게(터치)
    const blockScroll = (ev: TouchEvent) => {
      if ((p.armed || p.started) && ev.cancelable) ev.preventDefault();
    };
    const up = () => {
      const target = overRef.current;
      const started = p.started;
      const pressed = started || p.armed || p.held;
      cleanup();
      if (!pressed) return;
      // 꾹 눌렀다 뗀 뒤의 클릭(링크 이동)은 막는다. 손가락은 뗀 뒤 한 박자 늦게 클릭이 오기도 해서 꾹 누른 쪽은 조금 더 막아 둔다
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), p.held || p.armed ? HELD_CLICK_MS : 0);
      if (started && target && target !== p.from) dropRef.current(p.id, target);
    };
    const cleanup = () => {
      p.hold?.cancel();
      window.clearTimeout(p.timer);
      cancelAnimationFrame(raf.current);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cleanup);
      document.removeEventListener("touchmove", blockScroll);
      delete document.documentElement.dataset.dragging;
      if (press.current === p) press.current = null;
      overRef.current = null;
      setDragging(null);
      setOver(null);
      cleanupRef.current = () => {};
    };
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cleanup);
    document.addEventListener("touchmove", blockScroll, { passive: false });
  }

  /** 끌다 놓은 직후의 클릭(링크 이동)은 막는다 */
  function onClickCapture(e: React.MouseEvent) {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  }

  const ghostEl = dragging ? (
    <div
      ref={ghost}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 max-w-[60vw] truncate rounded-xl bg-white px-3.5 py-2.5 text-[15.3px] shadow-[0_0_0_2px_var(--color-sky),0_10px_28px_rgba(31,35,64,0.2)]"
      style={{ transform: `translate(${dragging.x - 28}px, ${dragging.y - 34}px)` }}
    >
      {dragging.name}
    </div>
  ) : null;

  return { dragging, over, onPointerDown, onClickCapture, ghost: ghostEl };
}
