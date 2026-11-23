"use client";

import { MOVIE_GENRES, MUSIC_GENRES, NONE, NONE_LABEL, type CatalogItem, type CultureData, type Locale } from "@readme/core";
import { CircleOption, Collapsible, SectionHeading, TextField, toggleWithNone, useT } from "./shared";

type CodeKey = "movieGenres" | "musicGenres";
type TextKey = "movie" | "drama" | "shows" | "song" | "book";

/** 문화생활: 영화·드라마·TV(예전 좋아하는 것들) · 음악 · 책(예전 생활과 여행) */
export function CultureEditor({ value, onChange, locale, lite = false }: { value: CultureData; onChange: (v: CultureData) => void; locale: Locale; lite?: boolean }) {
  const t = useT(locale);
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
    <TextField label={t(`fav.${key}` as "fav.movie")} value={value[key] ?? ""} onChange={(v) => onChange({ ...value, [key]: v })} placeholder={t(`fav.${key}Placeholder` as "fav.moviePlaceholder")} />
  );
  // lite(받는 사람 화면): collapse를 건 묶음은 접어 둔다(값이 든 묶음은 펼친 채)
  const group = (title: string, children: React.ReactNode, collapse = false, filled = false) =>
    lite && collapse ? (
      <Collapsible title={title} startOpen={filled}>
        {children}
      </Collapsible>
    ) : (
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
        true,
        !!(value.musicGenres?.length || value.song),
      )}
      {group(t("fav.read"), field("book"), true, !!value.book)}
    </div>
  );
}
