"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "@/components/AppLink";

export interface RateChip {
  section: string;
  /** 항목 짧은 이름(음식·선물·취향 …) */
  label: string;
  /** 그 항목이 펼쳐진 고치는 화면 */
  href: string;
}

/** 말풍선 맨 끝의 '물어보기' 링크: 남은 항목을 이 사람에게 물어보는 화면 */
export interface RateAsk {
  label: string;
  href: string;
}

/** 말풍선이 프로필 카드 안쪽 양옆에서 띄우는 거리 */
const SIDE = 14;

/**
 * 프로필 카드의 '기억해 둔 것 작성률' 막대(시안 Rate-A): 망고 빗금으로 N%만큼 찬 둥근 막대 + 오른쪽에 손글씨 N%.
 * 막대는 진짜 <button>이라, 마우스를 올리면(키보드 포커스도) 말풍선이 막대 밑에 뜨고, 터치에서는 누를 때마다 열고 닫는다(마우스로 누르면 고정되어 올려 둔 채 칩으로 옮겨 갈 수 있다).
 * 말풍선은 '어느 항목 채우기가 남았어요' 한 줄과 그 항목 칩(누르면 그 항목이 펼쳐진 고치는 화면), 칩 끝에 작은 '물어보기' 링크(ask: 물어보기 화면이 이 사람과 남은 항목으로 열린다). 다 채웠으면 한 줄만.
 * 바깥을 누르거나 Esc면 닫힌다. 말풍선은 가장 가까운 relative 조상(프로필 카드) 안쪽 양옆에 맞춰 화면 밖으로 나가지 않고,
 * 꼬리만 막대 가운데를 가리킨다(이 요소 자체는 relative가 아니다)
 */
export function CompletionBar({ pct, label, message, chips, ask = null }: { pct: number; label: string; message: string; chips: RateChip[]; ask?: RateAsk | null }) {
  const bubbleId = useId();
  const messageId = useId();
  // 눌러서 연 것(터치·마우스 클릭) · 마우스를 올린 것 · 키보드 포커스. 하나라도 있으면 보인다
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hover || focused;
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  const [place, setPlace] = useState<{ top: number; tail: number } | null>(null);

  const closeAll = () => {
    window.clearTimeout(leaveTimer.current);
    setPinned(false);
    setHover(false);
    setFocused(false);
  };

  // 열릴 때(그리고 창 크기가 바뀔 때) 막대 밑·가운데에 맞춘다
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const card = bubble.current?.offsetParent;
      const bar = track.current?.getBoundingClientRect();
      if (!(card instanceof HTMLElement) || !bar) return;
      const c = card.getBoundingClientRect();
      const width = c.width - SIDE * 2;
      const tail = Math.min(Math.max(bar.left + bar.width / 2 - (c.left + SIDE), 18), width - 18);
      setPlace({ top: bar.bottom - c.top + 9, tail });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) closeAll();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (box.current?.contains(document.activeElement) && document.activeElement !== button.current) button.current?.focus({ preventScroll: true });
      closeAll();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  return (
    <div
      ref={box}
      className="w-full"
      // 마우스일 때만 올려서 연다(터치는 눌러서). 막대에서 말풍선으로 옮겨 가는 틈에 닫히지 않게 조금 늦게 닫는다
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        window.clearTimeout(leaveTimer.current);
        setHover(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = window.setTimeout(() => setHover(false), 160);
      }}
      // 키보드로 닿았을 때만(마우스·터치로 누른 포커스는 제외) 열고, 칩으로 옮겨 가도 닫지 않는다
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={bubbleId}
        aria-describedby={messageId}
        onClick={() => (pinned ? closeAll() : setPinned(true))}
        className="relative flex w-full items-center gap-[8.1px] text-left before:absolute before:inset-x-0 before:-inset-y-[11px]"
      >
        <span ref={track} aria-hidden="true" className="relative box-border h-[11.7px] min-w-0 flex-1 overflow-hidden rounded-full border border-edge bg-[#FFF8E8]">
          {pct > 0 ? (
            <span
              className={`absolute inset-y-0 left-0 rounded-full ${pct < 100 ? "border-r border-edge" : ""}`}
              style={{ width: `${pct}%`, backgroundImage: "repeating-linear-gradient(135deg, #FFC23D 0 5.4px, #FFD46B 5.4px 10.8px)" }}
            />
          ) : null}
        </span>
        <span aria-hidden="true" className="hand shrink-0 text-[19.8px] leading-none">
          {pct}
          <span className="text-[14.4px]">%</span>
        </span>
      </button>
      {/* 말풍선: 항상 그려 두고(설명으로 읽히게) 닫혀 있을 땐 hidden */}
      <div
        ref={bubble}
        id={bubbleId}
        role="group"
        aria-label={label}
        hidden={!open}
        className="absolute z-40 rounded-[12.6px] border border-edge bg-white px-[12.6px] pb-[10.8px] pt-[9.9px] shadow-[0_12px_24px_-12px_rgb(31_35_64/0.5)]"
        style={{ left: SIDE, right: SIDE, top: place?.top ?? 0 }}
      >
        {/* 꼬리: 막대 가운데를 가리킨다 */}
        <span aria-hidden="true" className="absolute -top-[5.4px] box-border h-[9.9px] w-[9.9px] rotate-45 border-l border-t border-edge bg-white" style={{ left: (place?.tail ?? 24) - 5 }} />
        <p id={messageId} className="text-[13.5px] leading-[1.4]">
          {message}
        </p>
        {chips.length ? (
          <ul className="mt-[7.2px] flex flex-wrap gap-x-[6.3px] gap-y-[7.2px]">
            {chips.map((c) => (
              <li key={c.section}>
                <Link
                  href={c.href}
                  onClick={closeAll}
                  className="hand relative inline-flex h-[30.6px] items-center rounded-full border border-edge bg-sky-soft px-[11.7px] text-[16.2px] leading-none before:absolute before:-inset-y-[7px] before:inset-x-0"
                >
                  {c.label}
                </Link>
              </li>
            ))}
            {ask ? (
              <li>
                <Link
                  href={ask.href}
                  onClick={closeAll}
                  className="hand relative inline-flex h-[30.6px] items-center gap-[4.5px] rounded-full border border-dashed border-ink/50 bg-white pl-[9px] pr-[11.7px] text-[16.2px] leading-none before:absolute before:-inset-y-[7px] before:inset-x-0"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="15.3" height="15.3" fill="none" stroke="#1F2340" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <rect x="3" y="6" width="18" height="13" rx="2" fill="#F9CBD5" />
                    <path d="M3.8 7l8.2 6.2L20.2 7" />
                  </svg>
                  {ask.label}
                </Link>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
