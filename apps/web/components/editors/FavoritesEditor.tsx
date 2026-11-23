"use client";

import { METALS, PATTERNS, STYLES, VIBES, NONE, NONE_LABEL, type CatalogItem, type FavoritesData, type Locale } from "@readme/core";
import { useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { CircleOption, SectionHeading, TextField, joinList, splitList, toggleWithNone, useT } from "./shared";

type CodeKey = "patterns" | "styles" | "metals" | "vibes";
type TextKey = "idol" | "character" | "team" | "animal";

/** 취향: 향과 꽃 · 스타일(좋아하는 색 포함) · 분위기와 장소 · 최애(사람·캐릭터·팀·동물). 영화·드라마·음악은 '문화생활' 항목 */
export function FavoritesEditor({ value, onChange, locale }: { value: FavoritesData; onChange: (v: FavoritesData) => void; locale: Locale }) {
  const t = useT(locale);
  const [places, setPlaces] = useState(joinList(value.places ?? []));
  const toggle = (key: CodeKey, code: string) => {
    onChange({ ...value, [key]: toggleWithNone(value[key] ?? [], code) });
  };
  const chips = (key: CodeKey, label: string, list: CatalogItem[]) => (
    <div className="flex flex-col gap-1">
      <span className="hand text-[17px] leading-none">{label}</span>
      <div className="flex flex-wrap gap-2 pt-1">
        <CircleOption label={NONE_LABEL[locale]} on={(value[key] ?? []).includes(NONE)} color="ink" onToggle={() => toggle(key, NONE)} textClass="whitespace-nowrap" />
        {list.map((i) => (
          <CircleOption key={i.code} label={i.label[locale]} on={(value[key] ?? []).includes(i.code)} color="ink" onToggle={() => toggle(key, i.code)} textClass="whitespace-nowrap" />
        ))}
      </div>
    </div>
  );
  const field = (key: TextKey) => (
    <TextField label={t(`fav.${key}` as "fav.idol")} value={value[key] ?? ""} onChange={(v) => onChange({ ...value, [key]: v })} placeholder={t(`fav.${key}Placeholder` as "fav.idolPlaceholder")} />
  );
  const group = (title: string, children: React.ReactNode) => (
    <section className="flex flex-col gap-4">
      <div className="border-b border-dashed border-ink/30 pb-1.5">
        <SectionHeading>{title}</SectionHeading>
      </div>
      {children}
    </section>
  );

  return (
    <div className="flex flex-col gap-9">
      {group(
        t("fav.senses"),
        <>
          <TextField label={t("gift.scent")} value={value.scent ?? ""} onChange={(scent) => onChange({ ...value, scent })} placeholder={t("gift.scentPlaceholder")} />
          <TextField label={t("gift.flowers")} value={value.flowers ?? ""} onChange={(flowers) => onChange({ ...value, flowers })} placeholder={t("gift.flowersPlaceholder")} />
        </>,
      )}
      {group(
        t("fav.style"),
        <>
          <ColorPicker value={value.colors ?? []} onChange={(colors) => onChange({ ...value, colors })} locale={locale} />
          {chips("patterns", t("fav.patterns"), PATTERNS)}
          {chips("styles", t("fav.styles"), STYLES)}
          {chips("metals", t("fav.metals"), METALS)}
        </>,
      )}
      {group(
        t("fav.mood"),
        <>
          {chips("vibes", t("fav.vibes"), VIBES)}
          <TextField
            label={t("fav.places")}
            value={places}
            onChange={(v) => {
              setPlaces(v);
              onChange({ ...value, places: splitList(v) });
            }}
            placeholder={t("fav.placesPlaceholder")}
          />
        </>,
      )}
      {group(
        t("fav.people"),
        <>
          {field("idol")}
          {field("character")}
          {field("team")}
          {field("animal")}
        </>,
      )}
    </div>
  );
}
