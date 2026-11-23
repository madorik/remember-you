"use client";

import { COLOR_BASIC_COUNT, COLORS, type Locale } from "@readme/core";
import { useState } from "react";
import { ColorDot } from "../ColorDot";
import { SectionHeading, useT } from "./shared";

const MAX = 5;

/** 좋아하는 색: 큰 동그라미 + 이름, 한 줄에 다섯. 기본 10가지 다음은 '색 더 보기'. 다섯 개까지 */
export function ColorPicker({ value, onChange, locale }: { value: string[]; onChange: (v: string[]) => void; locale: Locale }) {
  const t = useT(locale);
  // 더 보기 색을 이미 골라 두었으면 처음부터 펼쳐 둔다
  const [more, setMore] = useState(() => value.some((code) => COLORS.findIndex((c) => c.code === code) >= COLOR_BASIC_COUNT));
  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else if (value.length < MAX) onChange([...value, code]);
  };
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading right={`${value.length}/${MAX}`}>{t("gift.colors")}</SectionHeading>
      <div className="grid grid-cols-5 gap-y-3 pt-1">
        {(more ? COLORS : COLORS.slice(0, COLOR_BASIC_COUNT)).map((c) => {
          const on = value.includes(c.code);
          return (
            <button key={c.code} type="button" aria-pressed={on} onClick={() => toggle(c.code)} className="flex flex-col items-center gap-1.5 py-1">
              <ColorDot hex={c.hex} size={44} on={on} />
              <span className={`text-[14.4px] ${on ? "text-accent" : ""}`}>{c.label[locale]}</span>
            </button>
          );
        })}
      </div>
      <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="chip self-start !bg-transparent text-muted !shadow-[inset_0_0_0_1px_var(--color-edge)]">
        {more ? t("safety.less") : t("gift.moreColors")}
      </button>
    </div>
  );
}
