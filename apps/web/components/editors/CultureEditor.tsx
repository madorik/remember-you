"use client";

import { MOVIE_GENRES, MUSIC_GENRES, NONE, NONE_LABEL, type CatalogItem, type CultureData, type Locale } from "@readme/core";
import { CircleOption, SectionHeading, TextField, toggleWithNone, useT } from "./shared";

type CodeKey = "movieGenres" | "musicGenres";
type TextKey = "movie" | "drama" | "shows" | "song" | "book";

/** 문화생활: 영화·드라마·TV(예전 좋아하는 것들) · 음악 · 책(예전 생활과 여행) */
export function CultureEditor({ value, onChange, locale }: { value: CultureData; onChange: (v: CultureData) => void; locale: Locale }) {
  const t = useT(locale);
  const toggle = (key: CodeKey, code: string) => {
    onChange({ ...value, [key]: toggleWithNone(value[key] ?? [], code) });
  };
  const chips = (key: CodeKey, label: string, list: CatalogItem[]) => (
    <div className="flex flex-col gap-1">
      <span className="hand text-[21px] leading-none">{label}</span>
      <div className="flex flex-wrap gap-2 pt-1">
        <CircleOption label={NONE_LABEL[locale]} on={(value[key] ?? []).includes(NONE)} color="ink" onToggle={() => toggle(key, NONE)} textClass="whitespace-nowrap" />
        {list.map((i) => (
          <CircleOption key={i.code} label={i.label[locale]} on={(value[key] ?? []).includes(i.code)} color="ink" onToggle={() => toggle(key, i.code)} textClass="whitespace-nowrap" />
        ))}
      </div>
    </div>
  );
  const field = (key: TextKey) => (
    <TextField label={t(`fav.${key}` as "fav.movie")} value={value[key] ?? ""} onChange={(v) => onChange({ ...value, [key]: v })} placeholder={t(`fav.${key}Placeholder` as "fav.moviePlaceholder")} />
  );
  const group = (title: string, children: React.ReactNode) => (
    <section className="flex flex-col gap-4">
      <div className="border-b-[1.5px] border-dashed border-ink/20 pb-1.5">
        <SectionHeading>{title}</SectionHeading>
      </div>
      {children}
    </section>
  );

  return (
    <div className="flex flex-col gap-9">
      {group(
        t("fav.watch"),
        <>
          {chips("movieGenres", t("fav.movieGenres"), MOVIE_GENRES)}
          {field("movie")}
          {field("drama")}
          {field("shows")}
        </>,
      )}
      {group(
        t("fav.listen"),
        <>
          {chips("musicGenres", t("fav.musicGenres"), MUSIC_GENRES)}
          {field("song")}
        </>,
      )}
      {group(t("fav.read"), field("book"))}
    </div>
  );
}
