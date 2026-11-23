"use client";

import type { AvatarConfig } from "@readme/core";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/Avatar";

/**
 * 홈 오른쪽 위 내 얼굴: 누르면 내 프로필 / (관리자 계정이면 관리자) / 로그아웃 메뉴. 바깥을 누르거나 Esc면 닫힌다.
 * 열면 첫 항목으로 포커스가 가고, ↑↓·Home·End로 옮기며, Esc·Tab으로 닫으면 얼굴 단추로 돌아온다
 */
export function ProfileMenu({ avatar, admin = false, labels }: { avatar: AvatarConfig | null; admin?: boolean; labels: { menu: string; profile: string; admin: string; signOut: string } }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const items = () => Array.from(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const closeAndReturn = () => {
    setOpen(false);
    button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // 메뉴가 그려진 뒤 첫 항목으로
    box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
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

  const onMenuKey = (e: React.KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") list[(at + 1) % list.length]?.focus();
    else if (e.key === "ArrowUp") list[(at - 1 + list.length) % list.length]?.focus();
    else if (e.key === "Home") list[0]?.focus();
    else if (e.key === "End") list[list.length - 1]?.focus();
    else if (e.key === "Tab") closeAndReturn();
    else return;
    e.preventDefault();
  };

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={labels.menu}
        onClick={() => setOpen(!open)}
        className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center"
      >
        <Avatar config={avatar} size={34} label={labels.menu} />
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label={labels.menu} onKeyDown={onMenuKey} className="absolute right-1 top-full z-40 mt-1 w-44 overflow-hidden rounded-[12.6px] bg-paper py-1 shadow-[0_0_0_1px_var(--color-edge),0_12px_26px_-12px_rgb(31_35_64/0.5)]">
          <Link role="menuitem" href="/me/avatar" onClick={() => setOpen(false)} className="flex min-h-12 items-center px-4 text-[15.3px]">
            {labels.profile}
          </Link>
          {/* 관리자 계정(ADMIN_EMAILS)만. 우리 통계 화면(/admin)으로 간다 */}
          {admin ? (
            <Link role="menuitem" href="/admin" prefetch={false} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-t border-rule px-4 text-[15.3px]">
              {labels.admin}
            </Link>
          ) : null}
          <form action={signOut} className="border-t border-rule">
            <button role="menuitem" className="flex min-h-12 w-full items-center px-4 text-left text-[15.3px]">
              {labels.signOut}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
