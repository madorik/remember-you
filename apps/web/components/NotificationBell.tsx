"use client";

import type { AvatarConfig } from "@readme/core";
import Link from "@/components/AppLink";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/marks";

/** 알림 한 줄(서버에서 문구까지 만들어 넘긴다) */
export interface BellItem {
  id: string;
  /** 누르면 갈 곳(그 사람 화면) */
  href: string;
  avatar: AvatarConfig | null;
  /** 얼굴 읽어 줄 이름 */
  name: string;
  title: string;
  /** "3분 전" */
  when: string;
}

/**
 * 홈 오른쪽 위 종: 아직 안 본 새 알림(물어보기에 온 답장)이 개수로 붙고, 누르면 종 바로 아래에 드롭다운으로 모여 보인다.
 * 알림을 누르면 그 사람 화면으로 간다(사람 화면을 열면 읽은 것으로 바뀌어 종의 숫자가 줄어든다).
 * 드롭다운은 가장 가까운 relative 조상(머리줄) 오른쪽 끝에 붙여, 종이 어디 있든 화면 밖으로 나가지 않는다.
 * 바깥을 누르거나 Esc면 닫히고, 열면 첫 알림으로 포커스가 가며, Esc로 닫으면 종으로 돌아온다
 */
export function NotificationBell({ items, labels }: { items: BellItem[]; labels: { title: string; empty: string } }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const count = items.length;

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>("a[href]")?.focus();
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={count ? `${labels.title} ${count}` : labels.title}
        onClick={() => setOpen(!open)}
        className="relative flex h-11 w-11 before:absolute before:-inset-[2.2px] items-center justify-center rounded-full text-ink active:bg-fill"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22.5" height="22.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.1H4.4z" />
          <path d="M10 21a2.2 2.2 0 0 0 4 0" />
        </svg>
        {/* 새 알림이 있으면 망고 점(개수는 읽어 주는 이름에 있다) */}
        {count ? <span aria-hidden="true" className="absolute right-2.5 top-[8.1px] h-[8.1px] w-[8.1px] rounded-full bg-sky shadow-[0_0_0_1px_var(--color-edge)]" /> : null}
      </button>
      {open ? (
        <div
          id={listId}
          role="region"
          aria-label={labels.title}
          className="absolute right-3 top-full z-40 mt-1 max-h-[min(60dvh,26rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-[12.6px] bg-paper py-1 shadow-[0_0_0_1px_var(--color-edge),0_12px_26px_-12px_rgb(31_35_64/0.5)]"
        >
          {count ? (
            <ul className="flex flex-col">
              {items.map((n, i) => (
                <li key={n.id} className={i ? "border-t border-rule" : ""}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex min-h-[54px] items-center gap-3 px-3.5 py-2 active:bg-fill">
                    <Avatar config={n.avatar} size={38} label={n.name} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15.3px]">{n.title}</span>
                      <span className="text-[12.6px] text-muted">{n.when}</span>
                    </span>
                    <Icon name="chevron" size={18} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-[14.4px] text-muted">{labels.empty}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
