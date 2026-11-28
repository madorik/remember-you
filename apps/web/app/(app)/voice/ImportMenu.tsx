"use client";

import type { Locale } from "@readme/core";
import { useEffect, useRef, useState } from "react";
import { loadNotesApps, openNotesApp } from "@/components/native";
import { notesAppLabel, notesChoice, type NotesApp } from "@/lib/notes-apps";
import { u } from "@/lib/ui-scale";

export interface ImportMenuLabels {
  /** 메뉴 이름(트리거 이름과 같다) */
  menu: string;
  fromNotes: string;
  fromPhoto: string;
}

const INK = "#1F2340";

function Mini({ children }: { children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={u(21)} height={u(21)} fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {children}
    </svg>
  );
}

/** 스프링 메모장 */
const NOTEPAD = (
  <>
    <rect x="6" y="3.5" width="13" height="17" rx="2.2" fill="#FFF4D6" />
    <path d="M10 9h6M10 12.5h6M10 16h3.5" />
    <path d="M3.5 7h4M3.5 11h4M3.5 15h4" />
  </>
);

/** 폴라로이드 사진 */
const PHOTO = (
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" fill="#FFFFFF" />
    <circle cx="9" cy="10" r="1.7" fill="#FFD978" />
    <path d="M4 17l5-4.6 3.6 3.1 3-2.6 4.4 4.1" fill="#F9CBD5" />
  </>
);

const BACK = <path d="M14.5 6l-6 6 6 6" />;

const ITEM = "hand flex w-full items-center gap-[9px] text-left text-[18px] leading-none";
const itemStyle = { height: u(46), padding: `0 ${u(14)}px` } as const;

/**
 * 메모 쓰기 화면의 '메모 가져오기': 누르면 단추 밑에 작은 메뉴가 열린다(흰 카드·1px 테두리·손글씨).
 * - 메모 앱에서: 앱 안에서만(웹에는 없다). 휴대폰의 메모 앱을 열어 글을 고른 뒤 "공유 → 기억해유"를 누르면 받은 글이 이 화면 본문 뒤에 붙고,
 *   글을 복사하고 돌아오면 본문 첫 줄에 '복사한 글 붙여 넣기'가 뜬다(PastePill).
 *   설치된 메모 앱이 하나면 바로 열고, 여럿이면 같은 메뉴 안에서 고른다. 열 앱이 없거나 앱 빌드가 아직 못 열면 항목을 보이지 않는다
 * - 사진에서: 메모 화면·손글씨 사진을 골라 글로 읽어 온다(고르는 창을 여는 것까지가 이 메뉴, 읽기는 MemoPad)
 * 바깥을 누르거나 Esc로 닫고, 위·아래 화살표로 옮긴다. 이전 '/import' 화면은 사람 추가·편집에서 그대로 들어간다
 */
export function ImportMenu({
  locale,
  labels,
  disabled,
  autoOpen = false,
  onPhoto,
  onOpenNotes,
  className,
  style,
  triggerLabel,
  children,
}: {
  locale: Locale;
  labels: ImportMenuLabels;
  disabled: boolean;
  /** true가 되는 때마다 메뉴를 연다(사람 화면 ··· 메뉴의 '메모 가져오기'로 들어온 ?import=1) */
  autoOpen?: boolean;
  onPhoto: () => void;
  /** 메모 앱을 열러 나가는 때(누른 그 순간. 돌아와서 '복사한 글 붙여 넣기'를 보이는 데 쓴다) */
  onOpenNotes?: () => void;
  className: string;
  style?: React.CSSProperties;
  /** 글 없이 아이콘뿐인 단추의 이름(글이 들어 있는 단추는 비운다) */
  triggerLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // 열 수 있는 메모 앱(앱 안에서만 채워진다. 웹은 늘 빈 목록)
  const [notes, setNotes] = useState<NotesApp[]>([]);
  const [picking, setPicking] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let gone = false;
    void loadNotesApps().then((list) => {
      if (!gone) setNotes(list);
    });
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const close = () => {
    setOpen(false);
    setPicking(false);
  };

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setOpen(false);
        setPicking(false);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setPicking(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // 목록이 바뀌면(메모 앱 고르기로 들어가고 나올 때) 첫 줄로 포커스
  useEffect(() => {
    if (open) wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, picking]);

  const arrows = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const fromNotes = () => {
    const choice = notesChoice(notes.length);
    if (choice === "pick") return setPicking(true);
    close();
    if (choice === "open") {
      onOpenNotes?.();
      void openNotesApp(notes[0]!);
    }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className={`${className} ${open ? "bg-sky-soft" : ""} disabled:opacity-60`}
        style={style}
      >
        {children}
      </button>
      {open ? (
        <div role="menu" aria-label={labels.menu} onKeyDown={arrows} className="absolute right-0 top-full z-40 border border-edge bg-white" style={{ marginTop: u(4), width: u(212), padding: `${u(6)}px 0`, borderRadius: u(14), boxShadow: `0 ${u(14)}px ${u(24)}px -${u(12)}px rgb(31 35 64 / 0.45)` }}>
          {picking ? (
            <>
              <button type="button" role="menuitem" onClick={() => setPicking(false)} className={ITEM} style={itemStyle}>
                <Mini>{BACK}</Mini>
                {labels.fromNotes}
              </button>
              <div role="separator" className="mx-3 my-1 h-[1.5px] bg-ink/10" />
              {notes.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    onOpenNotes?.();
                    void openNotesApp(app);
                  }}
                  className={ITEM}
                  style={itemStyle}
                >
                  <Mini>{NOTEPAD}</Mini>
                  <span className="min-w-0 truncate">{notesAppLabel(app, locale)}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {notes.length ? (
                <button type="button" role="menuitem" onClick={fromNotes} className={ITEM} style={itemStyle}>
                  <Mini>{NOTEPAD}</Mini>
                  {labels.fromNotes}
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onPhoto();
                }}
                className={ITEM}
                style={itemStyle}
              >
                <Mini>{PHOTO}</Mini>
                {labels.fromPhoto}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
