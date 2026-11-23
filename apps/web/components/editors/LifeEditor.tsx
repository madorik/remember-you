"use client";

import { NONE, NONE_LABEL, SEASONS, type LifeData, type Locale } from "@readme/core";
import { useState } from "react";
import { CircleOption, TextField, joinList, splitList, toggleWithNone, useT } from "./shared";

/** 생활과 여행: 취미 · 계절 · 가 보고 싶은 곳(디저트는 좋아하는 음식, 동물은 좋아하는 것들, 책은 문화생활로) */
export function LifeEditor({ value, onChange, locale }: { value: LifeData; onChange: (v: LifeData) => void; locale: Locale }) {
  const t = useT(locale);
  const [hobbies, setHobbies] = useState(joinList(value.hobbies));
  const toggle = (code: string) => onChange({ ...value, seasons: toggleWithNone(value.seasons, code) });
  return (
    <div className="flex flex-col gap-6">
      <TextField
        label={t("life.hobbies")}
        value={hobbies}
        onChange={(v) => {
          setHobbies(v);
          onChange({ ...value, hobbies: splitList(v) });
        }}
        placeholder={t("life.hobbiesPlaceholder")}
      />
      <div className="flex flex-col gap-1">
        <span className="hand text-[21px] leading-none">{t("fav.seasons")}</span>
        <div className="flex flex-wrap gap-2 pt-1">
          <CircleOption label={NONE_LABEL[locale]} color="ink" on={value.seasons.includes(NONE)} onToggle={() => toggle(NONE)} textClass="whitespace-nowrap" />
          {SEASONS.map((i) => (
            <CircleOption key={i.code} label={i.label[locale]} on={value.seasons.includes(i.code)} onToggle={() => toggle(i.code)} textClass="whitespace-nowrap" />
          ))}
        </div>
      </div>
      <TextField label={t("fav.travel")} value={value.travel ?? ""} onChange={(travel) => onChange({ ...value, travel })} placeholder={t("fav.travelPlaceholder")} />
    </div>
  );
}
