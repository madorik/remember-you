"use client";

import { ALCOHOL_KINDS, ALCOHOL_LEVELS, SPICY_LEVELS, type AlcoholData, type Locale, type TasteData } from "@readme/core";
import { useState } from "react";
import { ChiliIcon } from "../Chili";
import { CircleOption, Collapsible, TextField, joinList, splitList, useT } from "./shared";

/** 고르기 이름 뒤에 괄호로 기준이 붙은 것('보통 매운맛 (신라면 정도)')은 그 기준만: 한 줄 오른쪽 자리에 들어가게 */
function shortLabel(label: string): string {
  return /\(([^)]+)\)/.exec(label)?.[1] ?? label;
}

/** 매운맛: 한 줄. 왼쪽 이름 · 동그란 고추 단추 다섯(몇 번째를 누르느냐가 단계, 그만큼 빨개진다) · 오른쪽 단계 이름. 같은 걸 다시 누르면 뺀다 */
export function SpicyScale({ value, onChange, locale }: { value: number | null; onChange: (v: number | null) => void; locale: Locale }) {
  const t = useT(locale);
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-[12.6px] text-muted">{t("taste.spicy")}</span>
      <div role="radiogroup" aria-label={t("taste.spicy")} className="flex shrink-0 gap-1.5">
        {SPICY_LEVELS.map((label, i) => {
          const on = value != null && i <= value;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i}
              aria-label={label[locale]}
              onClick={() => onChange(value === i ? null : i)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-edge transition-transform before:absolute before:-inset-[3.6px] before:content-[''] active:scale-90 ${on ? "bg-[#FFE1DC]" : "bg-white"}`}
            >
              <ChiliIcon on={on} size={20} />
            </button>
          );
        })}
      </div>
      <span aria-hidden="true" className="ml-auto min-w-0 text-right text-[11.25px] leading-[1.3] text-muted">
        {value != null ? shortLabel(SPICY_LEVELS[value]?.[locale] ?? "") : ""}
      </span>
    </div>
  );
}

/** 술: 얼마나(하나만) + 좋아하는 종류(여러 개, 안 마시면 숨김) */
export function AlcoholPicker({ value, onChange, locale }: { value: AlcoholData; onChange: (v: AlcoholData) => void; locale: Locale }) {
  const t = useT(locale);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.8px] text-muted">{t("taste.alcohol")}</span>
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
          <span className="pt-2 text-[11.7px] text-muted">{t("taste.alcoholKinds")}</span>
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

export function TasteEditor({ value, onChange, locale, lite = false }: { value: TasteData; onChange: (v: TasteData) => void; locale: Locale; lite?: boolean }) {
  const t = useT(locale);
  const [likes, setLikes] = useState(joinList(value.likes));
  const rest = (
    <>
      <TextField label={t("fav.dessert")} value={value.dessert ?? ""} onChange={(dessert) => onChange({ ...value, dessert })} placeholder={t("fav.dessertPlaceholder")} />
      <TextField label={t("taste.drinks")} value={value.drinks} onChange={(drinks) => onChange({ ...value, drinks })} placeholder={t("taste.drinksPlaceholder")} />
      <AlcoholPicker value={value.alcohol ?? { level: null, kinds: [] }} onChange={(alcohol) => onChange({ ...value, alcohol })} locale={locale} />
    </>
  );
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
      <SpicyScale value={value.spicy} onChange={(spicy) => onChange({ ...value, spicy })} locale={locale} />
      {/* lite(받는 사람 화면): 간식·마시는 것·술은 접어 둔다(값이 있으면 펼친 채) */}
      {lite ? (
        <Collapsible title={t("answer.more")} startOpen={!!(value.dessert || value.drinks || value.alcohol?.level)}>
          {rest}
        </Collapsible>
      ) : (
        rest
      )}
    </div>
  );
}
