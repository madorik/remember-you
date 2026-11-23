"use client";

import Link from "@/components/AppLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { RemovePersonSheet, type RemoveLabels } from "@/components/RemovePersonSheet";

const ICON = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "shrink-0" } as const;
const ITEM = "flex h-[46px] w-full items-center gap-2.5 px-3.5 text-left text-[15px]";

/**
 * 사람 화면 오른쪽 위 ···: 누르면 단추 밑에 작은 메뉴(물어보기 · 선물 고르기 · 구분선 · 지우기(빨강))가 열린다.
 * 바깥을 누르거나 Esc로 닫고, 위·아래 화살표로 옮긴다. 지우기는 시트로 한 번 더 확인한다(RemovePersonSheet)
 */
export function PersonMenu({ contactId, labels }: { contactId: string; labels: { more: string; ask: string; gift: string; remove: string; sheet: RemoveLabels } }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeSheet = useCallback(() => setAsking(false), []);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const down = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const arrows = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <>
      <div ref={wrap} className="relative">
        <button
          ref={trigger}
          type="button"
          aria-label={labels.more}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`flex h-11 w-11 items-center justify-center rounded-full ${open ? "bg-sky-soft" : ""}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="1.7" fill="#1F2340" />
            <circle cx="12" cy="12" r="1.7" fill="#1F2340" />
            <circle cx="19" cy="12" r="1.7" fill="#1F2340" />
          </svg>
        </button>
        {open ? (
          <div role="menu" aria-label={labels.more} onKeyDown={arrows} className="absolute right-1 top-full z-40 -mt-[3px] w-[196px] rounded-[14px] border-[1.5px] border-ink bg-white py-1.5 shadow-[0_14px_28px_-12px_rgb(31_35_64/0.45)]">
            <Link role="menuitem" href={`/request?to=${encodeURIComponent(contactId)}`} className={ITEM}>
              <svg {...ICON} stroke="#1F2340">
                <rect x="3" y="6" width="18" height="13" rx="2" fill="#F9CBD5" />
                <path d="M3.8 7l8.2 6.2L20.2 7" />
              </svg>
              {labels.ask}
            </Link>
            <Link role="menuitem" href={`/people/${contactId}/reminder`} className={ITEM}>
              <svg {...ICON} stroke="#1F2340">
                <rect x="4" y="10.5" width="16" height="10" rx="1.6" fill="#FFFFFF" />
                <rect x="3" y="7" width="18" height="3.5" rx="1.2" fill="#F9CBD5" />
                <path d="M12 7v13.5" />
                <path d="M12 7c-1.6-3.2-5.4-3.6-5.4-1.3C6.6 7 9.6 7 12 7zM12 7c1.6-3.2 5.4-3.6 5.4-1.3C17.4 7 14.4 7 12 7z" />
              </svg>
              {labels.gift}
            </Link>
            <div role="separator" className="mx-3 my-1 h-[1.5px] bg-ink/10" />
            <button
              type="button"
              role="menuitem"
              aria-haspopup="dialog"
              onClick={() => {
                setOpen(false);
                setAsking(true);
              }}
              className={`${ITEM} text-red`}
            >
              <svg {...ICON} stroke="#C8283A">
                <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.5h9l1-12.5" />
              </svg>
              {labels.remove}
            </button>
          </div>
        ) : null}
      </div>
      {asking ? <RemovePersonSheet contactId={contactId} labels={labels.sheet} onClose={closeSheet} /> : null}
    </>
  );
}
