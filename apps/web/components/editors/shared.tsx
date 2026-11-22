"use client";

import { NONE, translate, type Locale, type MessageKey, type Vars } from "@readme/core";
import { CheckGlyph, DrawnCheck } from "../marks";

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

/** 눌러서 고르는 칩 하나. warn이면 켰을 때 분홍(알레르기) */
export function CircleOption({
  label,
  on,
  onToggle,
  color = "ink",
  large = false,
  textClass = "",
  className = "",
  noCheck = false,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  color?: "red" | "ink" | "warn";
  large?: boolean;
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
      className={`chip ${color === "warn" ? "chip-warn" : ""} ${large ? "!min-h-12 !px-[18px] text-[19px]" : ""} ${textClass} ${className}`}
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
    <button type="button" aria-pressed={on} onClick={onToggle} className="flex min-h-[58px] w-full items-center gap-3.5 border-t border-rule text-left first:border-t-0">
      <DrawnCheck on={on} />
      <span className="flex flex-col gap-0.5">
        <span className="text-[18px]">{label}</span>
        {sub ? <span className="text-[15px] text-muted">{sub}</span> : null}
      </span>
    </button>
  );
}

export function SectionHeading({ children, tone = "ink", right }: { children: React.ReactNode; tone?: "ink" | "red"; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-[19px] ${tone === "red" ? "text-red" : ""}`}>{children}</span>
      {right ? <span className="text-[15px] text-muted">{right}</span> : null}
    </div>
  );
}

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
    <label className="flex flex-col gap-1.5">
      <span className="text-[17px]">{label}</span>
      {multiline ? (
        <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className="field resize-none leading-[1.5]" />
      ) : (
        <input name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} className="field" />
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
