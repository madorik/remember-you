"use client";

import type { Locale } from "@readme/core";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { removeContacts } from "@/app/actions/people";
import { createHold, placeMenu, ROW_MENU_W } from "@/lib/long-press";
import { makeT } from "@/lib/t";
import { Icon } from "./marks";
import { Sheet } from "./Sheet";

// 사람 줄을 꾹 눌러(마우스는 오른쪽 단추 · 키보드는 Shift+F10 / 메뉴 키) 뜨는 작은 메뉴: '지우기' 하나.
// 지우기는 사람 화면 ··· 메뉴와 같은 확인 시트(누구를·무엇이 사라지는지)를 거치고, 지우는 일은 사람 목록 '선택' 모드의 지우기와 같은 서버 액션(removeContacts)을 쓴다.
// 사람 줄이 그냥 눌리면(짧게) 예전처럼 사람 화면으로 간다. 꾹 눌렀다 뗄 때 따라오는 클릭은 막는다.

export interface RowMenuTarget {
  contactId: string;
  name: string;
}

/** 줄(li)에 붙일 클래스: iOS가 꾹 누르면 띄우는 링크 미리보기·글자 선택을 줄에서만 끈다 */
export const ROW_MENU_CLASS = "select-none [-webkit-touch-callout:none]";

/** 아래 탭 막대(--tab-h 70 + --pb-tab 20 안팎)에 메뉴가 가리지 않게 비워 두는 높이 */
const BOTTOM_INSET = 96;
/** 뗀 직후 따라오는 클릭을 막아 두는 시간 */
const SWALLOW_MS = 400;

interface Open {
  target: RowMenuTarget;
  left: number;
  top: number;
  /** Esc·메뉴 닫을 때 포커스를 돌려줄 곳(줄 안의 링크) */
  back: HTMLElement | null;
}

/** 꾹 눌렀다 뗄 때 뒤따르는 클릭(사람 화면으로 가는 링크)을 한 번 막는다 */
function swallowNextClick() {
  const block = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("click", block, true);
  };
  window.addEventListener("click", block, true);
  window.setTimeout(() => window.removeEventListener("click", block, true), SWALLOW_MS);
}

/**
 * 사람 줄 꾹 누르기 메뉴. 부르는 화면에서 rowProps(줄마다)와 node(한 번)를 쓴다.
 *  - rowProps(target): 줄(li)에 펼칠 이벤트. press: false면 눌림은 따로 처리한다(끌어서 폴더에 넣는 줄: useDragToFolder의 onHold가 openHold를 부른다)
 *  - optimistic: 지우기를 확인하면 서버 응답 전에 줄을 먼저 뺀다(useOptimistic 목록용)
 */
export function usePersonRowMenu({ locale, optimistic }: { locale: Locale; optimistic?: (contactId: string) => void }) {
  const [menu, setMenu] = useState<Open | null>(null);
  const [confirm, setConfirm] = useState<{ target: RowMenuTarget; back: HTMLElement | null } | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [removing, startRemove] = useTransition();
  const openId = useRef<string | null>(null);
  const press = useRef<(() => void) | null>(null);
  const optimisticRef = useRef(optimistic);
  useEffect(() => {
    optimisticRef.current = optimistic;
  });
  const t = makeT(locale);
  const shown = useRef<Open | null>(null);

  const close = useCallback((refocus: boolean) => {
    const m = shown.current;
    shown.current = null;
    openId.current = null;
    setMenu(null);
    if (m && refocus) m.back?.focus({ preventScroll: true });
  }, []);

  /** x가 없으면(키보드) 줄 왼쪽 얼굴 근처에 */
  const open = useCallback((target: RowMenuTarget, row: HTMLElement, x: number | null) => {
    if (openId.current === target.contactId) return; // 이미 열려 있다(꾹 누르기와 contextmenu가 같이 올 때)
    const r = row.getBoundingClientRect();
    const at = placeMenu({ x: x ?? r.left + 56, row: r, view: { w: window.innerWidth, h: window.innerHeight }, bottomInset: BOTTOM_INSET });
    const next: Open = { target, left: at.left, top: at.top, back: row.querySelector<HTMLElement>("a[href]") };
    openId.current = target.contactId;
    shown.current = next;
    setMenu(next);
  }, []);

  /** 꾹 눌러서 열 때(손에 가볍게 진동) */
  const openHold = useCallback(
    (target: RowMenuTarget, row: HTMLElement, x: number) => {
      navigator.vibrate?.(10);
      open(target, row, x);
    },
    [open],
  );

  // 이 줄만의 꾹 누르기(끌기가 없는 줄: 찾은 사람·폴더 안 사람)
  const startPress = (e: React.PointerEvent<HTMLElement>, target: RowMenuTarget) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // 줄 안의 따로 눌리는 단추(폴더에서 빼기 −)는 제외
    if (e.target instanceof Element && e.target.closest("button")) return;
    press.current?.();
    const row = e.currentTarget;
    const hold = createHold({ onFire: () => openHold(target, row, e.clientX) });
    hold.start(e.clientX, e.clientY);
    const detach = () => {
      hold.cancel();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("scroll", up, true);
      if (press.current === detach) press.current = null;
    };
    const up = () => {
      const fired = hold.fired;
      detach();
      if (fired) swallowNextClick();
    };
    const move = (ev: PointerEvent) => {
      if (hold.move(ev.clientX, ev.clientY)) up();
    };
    press.current = detach;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("scroll", up, { capture: true, passive: true });
  };

  const rowProps = (
    target: RowMenuTarget,
    opts: { press?: boolean; /** true면 메뉴를 열지 않는다(끄는 중) */ ignore?: () => boolean } = {},
  ) => ({
    onPointerDown: opts.press === false ? undefined : (e: React.PointerEvent<HTMLElement>) => startPress(e, target),
    // 마우스 오른쪽 단추·맥 Ctrl+클릭·안드로이드 꾹 누르기의 contextmenu: 기본 메뉴 대신 우리 메뉴
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      if (opts.ignore?.()) return;
      // 눌림 감시는 그대로 둔다: 뗄 때 따라오는 클릭을 막아야 해서
      open(target, e.currentTarget, e.clientX);
    },
    // 키보드: 포커스가 줄(안의 링크)에 있을 때 Shift+F10 또는 메뉴 키
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== "ContextMenu" && !(e.key === "F10" && e.shiftKey)) return;
      e.preventDefault();
      open(target, e.currentTarget, null);
    },
  });

  const flash = useCallback((text: string, error: boolean) => setMsg({ text, error }), []);
  useEffect(() => {
    if (!msg) return;
    const id = window.setTimeout(() => setMsg(null), 3200);
    return () => window.clearTimeout(id);
  }, [msg]);

  // 화면을 떠나면 걸어 둔 눌림 감시도 걷는다
  useEffect(() => () => press.current?.(), []);

  const pick = () => {
    if (!menu) return;
    const { target, back } = menu;
    close(false);
    setConfirm({ target, back });
  };

  // 시트를 닫으면(취소·Esc·X) 포커스는 줄로. Sheet는 열릴 때 포커스가 있던 메뉴 항목으로 돌려주려다 못 하니(이미 사라졌다) 우리가 한 박자 뒤에 줄로 보낸다. 지워서 줄이 없어졌으면 그대로
  const closeConfirm = () => {
    const back = confirm?.back;
    setConfirm(null);
    window.setTimeout(() => {
      if (back?.isConnected) back.focus({ preventScroll: true });
    }, 0);
  };

  const remove = () => {
    const target = confirm?.target;
    if (!target) return;
    startRemove(async () => {
      optimisticRef.current?.(target.contactId);
      const r = await removeContacts([target.contactId]).catch(() => ({ ok: false, removed: 0 }));
      closeConfirm();
      flash(r.ok ? t("people.removed", { n: 1 }) : t("common.error"), !r.ok);
    });
  };

  const node = (
    <>
      {menu
        ? createPortal(<RowMenuPopover key={menu.target.contactId} open={menu} label={t("common.delete")} onPick={pick} onClose={close} />, document.body)
        : null}
      {confirm ? (
        <Sheet
          id="row-remove-title"
          title={t("person.removeTitle", { name: confirm.target.name })}
          closeLabel={t("common.close")}
          onClose={closeConfirm}
          footer={
            <div className="grid grid-cols-2 gap-2">
              {/* 처음 포커스는 취소: 실수로 엔터를 쳐도 안 지워진다 */}
              <button type="button" autoFocus onClick={closeConfirm} className="btn-soft">
                {t("common.cancel")}
              </button>
              <button type="button" disabled={removing} aria-busy={removing} onClick={remove} className="btn-soft !bg-red !text-white !shadow-none disabled:opacity-50 motion-safe:disabled:animate-pulse">
                {t("common.delete")}
              </button>
            </div>
          }
        >
          <p className="px-6 pb-3 pt-1 text-[16.2px] leading-[1.6]">{t("person.removeBody", { name: confirm.target.name })}</p>
        </Sheet>
      ) : null}
      {/* 지운 결과·오류: 아래 막대 위에 잠깐. 알림 영역은 늘 달아 둔다(스크린리더가 읽게) */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4" style={{ bottom: "calc(var(--tab-h) + var(--pb-tab) + 12px)" }}>
        {msg ? <span className={`card px-4 py-2 text-[14.4px] ${msg.error ? "text-red" : ""}`}>{msg.text}</span> : null}
      </div>
    </>
  );

  return { rowProps, openHold, node };
}

/**
 * 줄 밑에 뜨는 작은 메뉴(role=menu): 지우기 하나(빨강 + 휴지통). 열리면 포커스가 안으로 들어오고,
 * Esc·Tab은 닫고 줄로 돌려준다. 바깥을 누르거나 스크롤·창 크기 바뀜·앱이 가려지면 닫는다
 */
function RowMenuPopover({ open, label, onPick, onClose }: { open: Open; label: string; onPick: () => void; onClose: (refocus: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) {
        e.preventDefault();
        closeRef.current(true);
      }
    };
    const away = () => closeRef.current(false);
    const hidden = () => {
      if (document.visibilityState === "hidden") closeRef.current(false);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", away, { capture: true, passive: true });
    window.addEventListener("resize", away);
    window.addEventListener("blur", away);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
      window.removeEventListener("blur", away);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={open.target.name}
      onKeyDown={(e) => {
        // 항목이 하나라 화살표는 제자리, Tab은 메뉴를 닫고 줄로
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") e.preventDefault();
        else if (e.key === "Tab") {
          e.preventDefault();
          onClose(true);
        }
      }}
      className="fixed z-[55] rounded-[12.6px] border border-edge bg-white py-1.5 shadow-[0_14px_28px_-12px_rgb(31_35_64/0.45)]"
      style={{ left: open.left, top: open.top, width: ROW_MENU_W }}
    >
      <button
        type="button"
        role="menuitem"
        aria-haspopup="dialog"
        onClick={onPick}
        className="flex h-11 w-full items-center gap-2.5 px-3.5 text-left text-[13.5px] text-red outline-none active:bg-fill focus-visible:bg-sky-soft"
      >
        <Icon name="trash" size={19} strokeWidth={1.7} />
        {label}
      </button>
    </div>
  );
}
