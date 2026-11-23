"use client";

import { REMINDER_OFFSETS, type Locale, type ReminderOffset } from "@readme/core";
import { CircleOption, useT } from "./shared";

/** 생일·기념일을 언제 알릴지(2주 전·1주일 전·3일 전·당일) 고르기. 설정과 온보딩이 같이 쓴다 */
export function ReminderPicker({ value, onChange, locale, compact = false }: { value: ReminderOffset[]; onChange: (v: ReminderOffset[]) => void; locale: Locale; compact?: boolean }) {
  const t = useT(locale);
  return (
    <div className="flex flex-col gap-1">
      <span className={compact ? "pl-1 text-[11.7px] leading-[1.3] text-muted" : "text-[13.5px] leading-[1.35]"}>{t("remind.when")}</span>
      <div className={compact ? "grid grid-cols-4 gap-1.5 pt-1" : "flex flex-wrap gap-2 pt-1"}>
        {REMINDER_OFFSETS.map((o) => (
          <CircleOption
            key={o}
            label={t(`remind.${o}` as "remind.7")}
            on={value.includes(o)}
            onToggle={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : REMINDER_OFFSETS.filter((x) => x === o || value.includes(x)))}
            textClass="whitespace-nowrap"
            className={compact ? "!px-0" : ""}
            noCheck={compact}
          />
        ))}
      </div>
    </div>
  );
}
