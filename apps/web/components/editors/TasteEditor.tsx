"use client";

import { ALCOHOL_KINDS, ALCOHOL_LEVELS, SPICY_LEVELS, type AlcoholData, type Locale, type TasteData } from "@readme/core";
import { useState } from "react";
import { ChiliIcon } from "../Chili";
import { CircleOption, SectionHeading, TextField, joinList, splitList, useT } from "./shared";

/** 매운맛: 고추 다섯 개 한 줄. 몇 번째를 누르느냐가 단계(그만큼 빨개진다), 옆에 그 단계 이름. 같은 걸 다시 누르면 뺀다 */
export function SpicyScale({ value, onChange, locale, large = false }: { value: number | null; onChange: (v: number | null) => void; locale: Locale; large?: boolean }) {
  const t = useT(locale);
  const size = large ? 34 : 32;
  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeading>{t("taste.spicy")}</SectionHeading>
      <div className="flex flex-col items-center">
        <div role="radiogroup" aria-label={t("taste.spicy")} className="relative flex shrink-0 items-center pb-[22px]">
          {SPICY_LEVELS.map((label, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i}
              aria-label={label[locale]}
              onClick={() => onChange(value === i ? null : i)}
              className={`flex items-center justify-center rounded-full transition-transform active:scale-90 ${large ? "h-14 w-14" : "h-11 w-11"}`}
            >
              <ChiliIcon on={value != null && i <= value} size={size} />
            </button>
          ))}
          {/* 가운데(보통)가 어느 정도인지 기준 하나: 신라면. 고르면 옆 이름에 같은 말이 나오니 그때는 뺀다 */}
          {value !== 2 ? (
            <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[13px] leading-none text-muted">
              {t("taste.spicyAnchor")}
            </span>
          ) : null}
        </div>
        {value != null ? <span className="min-w-0 text-center text-[13px] leading-[1.3]">{SPICY_LEVELS[value]?.[locale]}</span> : null}
      </div>
    </div>
  );
}

/** 술: 얼마나(하나만) + 좋아하는 종류(여러 개, 안 마시면 숨김) */
export function AlcoholPicker({ value, onChange, locale }: { value: AlcoholData; onChange: (v: AlcoholData) => void; locale: Locale }) {
  const t = useT(locale);
  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeading>{t("taste.alcohol")}</SectionHeading>
      <div className="flex flex-wrap gap-2 pt-1">
        {ALCOHOL_LEVELS.map((l) => (
          <CircleOption
            key={l.code}
            label={l.label[locale]}
            on={value.level === l.code}
            color="ink"
            onToggle={() => onChange(value.level === l.code ? { level: null, kinds: value.kinds } : { level: l.code, kinds: l.code === "none" ? [] : value.kinds })}
            textClass="whitespace-nowrap"
          />
        ))}
      </div>
      {value.level && value.level !== "none" ? (
        <>
          <span className="pt-2 text-[13px] text-muted">{t("taste.alcoholKinds")}</span>
          <div className="flex flex-wrap gap-2">
            {ALCOHOL_KINDS.map((k) => (
              <CircleOption
                key={k.code}
                label={k.label[locale]}
                on={value.kinds.includes(k.code)}
                color="ink"
                onToggle={() => onChange({ ...value, kinds: value.kinds.includes(k.code) ? value.kinds.filter((x) => x !== k.code) : [...value.kinds, k.code] })}
               
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function TasteEditor({ value, onChange, locale, large = false }: { value: TasteData; onChange: (v: TasteData) => void; locale: Locale; large?: boolean }) {
  const t = useT(locale);
  const [likes, setLikes] = useState(joinList(value.likes));
  return (
    <div className="flex flex-col gap-6">
      <TextField
        label={t("taste.likes")}
        value={likes}
        onChange={(v) => {
          setLikes(v);
          onChange({ ...value, likes: splitList(v) });
        }}
        placeholder={t("taste.likesPlaceholder")}
      />
      <SpicyScale value={value.spicy} onChange={(spicy) => onChange({ ...value, spicy })} locale={locale} large={large} />
      <TextField label={t("fav.dessert")} value={value.dessert ?? ""} onChange={(dessert) => onChange({ ...value, dessert })} placeholder={t("fav.dessertPlaceholder")} />
      <TextField label={t("taste.drinks")} value={value.drinks} onChange={(drinks) => onChange({ ...value, drinks })} placeholder={t("taste.drinksPlaceholder")} />
      <AlcoholPicker value={value.alcohol ?? { level: null, kinds: [] }} onChange={(alcohol) => onChange({ ...value, alcohol })} locale={locale} />
    </div>
  );
}
