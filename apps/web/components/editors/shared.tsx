"use client";

import { NONE, translate, type Locale, type MessageKey, type Vars } from "@readme/core";
import { useState } from "react";
import { CheckGlyph, DrawnCheck, Icon } from "../marks";

export type TFn = (key: MessageKey, vars?: Vars) => string;

/** '없음'이 있는 고르기: 없음을 누르면 나머지를 지우고, 다른 것을 누르면 없음을 뺀다 */
export function toggleWithNone(list: readonly string[], code: string): string[] {
  if (code === NONE) return list.includes(NONE) ? [] : [NONE];
  const real = list.filter((c) => c !== NONE);
  return real.includes(code) ? real.filter((c) => c !== code) : [...real, code];
}

export function useT(locale: Locale): TFn {
  return (key, vars) => translate(locale, key, vars);
}

/**
 * 눌러서 고르는 칩 하나(플래너 시안): 둥근 네모 + 남색 1.5px 선, 고르면 망고 바탕 + 체크. 보이는 높이는 36px, 누르는 자리는 위아래로 넓혀 44px.
 * color는 예전 호출 호환용(시안은 알레르기도 같은 망고)
 */
export function CircleOption({
  label,
  on,
  onToggle,
  textClass = "",
  className = "",
  noCheck = false,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  color?: "red" | "ink" | "warn";
  textClass?: string;
  /** 칩 자리를 더 줄이거나 바꿀 때(설정의 알림 시점 한 줄) */
  className?: string;
  /** 골랐다는 표시를 체크 대신 칩 바탕·테두리로만(자리가 좁을 때) */
  noCheck?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`relative inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-edge text-[12.6px] before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] h-9 px-3 ${on ? "bg-sky" : "bg-white"} ${textClass} ${className}`}
    >
      {on && !noCheck ? <CheckGlyph /> : null}
      {label}
    </button>
  );
}

/** 칩을 담는 줄(넘치면 다음 줄로) */
export const CHIP_ROW = "flex flex-wrap gap-2";

export function CheckRow({ on, onToggle, label, sub }: { on: boolean; onToggle: () => void; label: string; sub?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onToggle} className="flex min-h-[52.2px] w-full items-center gap-3.5 border-t border-rule text-left first:border-t-0">
      <DrawnCheck on={on} />
      <span className="flex flex-col gap-0.5">
        <span className="text-[16.2px]">{label}</span>
        {sub ? <span className="text-[13.5px] text-muted">{sub}</span> : null}
      </span>
    </button>
  );
}

/** 칸 제목(손글씨 700): 알레르기는 빨강 */
export function SectionHeading({ children, tone = "ink", right }: { children: React.ReactNode; tone?: "ink" | "red"; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`hand text-[18.6px] leading-none ${tone === "red" ? "text-red" : ""}`}>{children}</span>
      {right ? <span className="text-[11.7px] text-muted">{right}</span> : null}
    </div>
  );
}

/**
 * 접어 두는 칸 묶음(받는 사람 화면에서 긴 항목이 설문처럼 보이지 않게): 제목 줄을 누르면 펼쳐진다. 이미 값이 든 묶음(startOpen)은 처음부터 펼쳐 둔다.
 * 접혀도 값은 위 편집기가 쥐고 있어서 그대로 남는다
 */
export function Collapsible({ title, startOpen = false, children }: { title: string; startOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="flex flex-col gap-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 items-center justify-between border-b border-dashed border-ink/30 pb-1.5 text-left">
        <SectionHeading>{title}</SectionHeading>
        <Icon name="chevron" size={17} strokeWidth={2} className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? children : null}
    </section>
  );
}

/** 항목 더하기 알약(기념일 추가·해주고 싶은 선물 추가 등): 옅은 망고 바탕 + 남색 선 */
export const ADD_PILL =
  "relative inline-flex h-[30.6px] items-center gap-1 self-start whitespace-nowrap rounded-full border border-edge bg-sky-soft pl-2.5 pr-3.5 text-[11.7px] before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']";

/** 점선 밑줄 입력칸 바탕(시안): 위 작은 라벨 + 밑줄. 안에 적은 값은 손글씨(사람이 적은 글), 안내글은 고운돋움 */
export const UNDERLINE_INPUT =
  "hand-written w-full min-w-0 border-0 border-b border-dashed border-ink/30 bg-transparent p-0 text-[17.8px] outline-none rounded-none placeholder:font-sans placeholder:text-[13.5px] placeholder:text-muted focus:border-edge";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  multiline = false,
  name,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "url";
  multiline?: boolean;
  name?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10.8px] text-muted">{label}</span>
      {multiline ? (
        <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={1} className={`${UNDERLINE_INPUT} min-h-10 resize-none py-1.5 leading-[1.3] [field-sizing:content]`} />
      ) : (
        <input name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} className={`${UNDERLINE_INPUT} h-10`} />
      )}
    </label>
  );
}

export function joinList(v: string[]): string {
  return v.join(", ");
}

export function splitList(v: string): string[] {
  return v
    .split(/[,\n、，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
