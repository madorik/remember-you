import {
  ALCOHOL_KINDS,
  ALCOHOL_LEVELS,
  ALLERGENS,
  COLORS,
  DIETS,
  DISLIKES,
  METALS,
  MOVIE_GENRES,
  MUSIC_GENRES,
  NONE,
  PATTERNS,
  SEASONS,
  SPICY_LEVELS,
  STYLES,
  VIBES,
  isEmptySection,
  labelOf,
  realCodes,
  type CatalogItem,
  type DatesData,
  type Locale,
  type PartialCard,
  type Section,
  type YMD,
  PET_KINDS,
  formatSpec,
  monthName,
  nextOccurrence,
} from "@readme/core";
import type { T } from "@/lib/i18n";
import { ChiliMeter } from "./Chili";
import { ColorDot } from "./ColorDot";
import { Icon } from "./marks";
import { sectionSummary } from "./SectionSummary";

/** 시안의 항목 본문 한 줄: 작은 라벨(고운돋움) + 사람이 적은 값(손글씨 400)이 한 줄로 이어진다 */
function Row({ label, children, center = false }: { label: string; children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`py-[3px] ${center ? "flex flex-wrap items-center gap-x-1.5" : ""}`}>
      <span className="text-[12px] leading-[1.3] text-muted">{label} </span>
      <span className="hand-written min-w-0 text-[22px] leading-[1.1]">{children}</span>
    </div>
  );
}

/** 한 장 뜯어 쓰는 작은 달력(시안 34×40): 위 망고 띠에 달, 아래 큰 날, 위에 고리 두 개 */
function CalendarLeaf({ m, d, locale }: { m: number; d: number; locale: Locale }) {
  return (
    <span aria-hidden="true" className="relative block h-10 w-[34px] shrink-0">
      <span className="absolute left-0 top-[3px] flex h-[37px] w-[34px] flex-col overflow-hidden rounded-[9px] border-[1.5px] border-ink bg-white">
        <span className="flex h-3 shrink-0 items-center justify-center border-b-[1.5px] border-ink bg-sky text-[11px] leading-none">{monthName(m, locale)}</span>
        <span className="hand flex flex-1 items-center justify-center text-[23px] leading-none">{d}</span>
      </span>
      <span className="absolute left-2 top-0 h-[9px] w-1 rounded-[3px] bg-ink" />
      <span className="absolute left-[22px] top-0 h-[9px] w-1 rounded-[3px] bg-ink" />
    </span>
  );
}

/** 생일·기념일: 작은 달력 + '양력 5월 3일'(기념일은 이름을 앞에). 날마다 한 줄 */
function DateLines({ dates, today, locale }: { dates: DatesData | undefined; today: YMD; locale: Locale }) {
  const items = [
    ...(dates?.birthday ? [{ label: "", spec: dates.birthday }] : []),
    ...(dates?.anniversaries ?? []).map((a) => ({ label: a.label, spec: a.spec })),
  ].slice(0, 4);
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => {
        const next = nextOccurrence(item.spec, today);
        return (
          <li key={i} className="flex items-center gap-2">
            <CalendarLeaf m={next ? next.date.m : item.spec.month} d={next ? next.date.d : item.spec.day} locale={locale} />
            <span className="hand-written min-w-0 text-[23px] leading-[1.1]">{[item.label, formatSpec(item.spec, locale)].filter(Boolean).join(" · ")}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 사람 기록 한 항목에 기억해 둔 것. 적어 둔 게 없으면 null(빈 항목은 제목 줄만 보인다) */
export function SectionBody({ section, card, today, locale, t }: { section: Section; card: PartialCard; today: YMD; locale: Locale; t: T }): React.ReactNode {
  if (isEmptySection(section, card[section])) return null;
  const and = t("common.and");
  const codes = (list: CatalogItem[], c: string[]) => c.map((x) => labelOf(list, x, locale)).join(and);

  switch (section) {
    case "dates":
      return <DateLines dates={card.dates} today={today} locale={locale} />;

    case "safety": {
      const s = card.safety!;
      const allergens = realCodes(s.allergens);
      return (
        <>
          {allergens.length ? (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 py-[3px]">
              {allergens.map((c) => (
                <span key={c} className="hand-written rounded-full border-[1.5px] border-red px-[9px] py-0.5 text-[20px] leading-none text-red">
                  {labelOf(ALLERGENS, c, locale)}
                </span>
              ))}
              <span className="text-[12px] leading-[1.3] text-muted">{t("person.allergy")}</span>
            </div>
          ) : null}
          {s.allergens.includes(NONE) ? <Row label={t("safety.allergens")}>{labelOf(ALLERGENS, NONE, locale)}</Row> : null}
          {s.dislikes.length ? <Row label={t("person.wontEat")}>{codes(DISLIKES, s.dislikes)}</Row> : null}
          {s.diets.length ? <Row label={t("person.diet")}>{codes(DIETS, s.diets)}</Row> : null}
          {s.allergyNote ? <p className="hand-written py-[3px] text-[22px] leading-[1.2]">“{s.allergyNote}”</p> : null}
        </>
      );
    }

    case "taste": {
      const x = card.taste!;
      const a = x.alcohol;
      return (
        <>
          {x.likes.length ? <Row label={t("person.likes")}>{x.likes.join(and)}</Row> : null}
          {x.spicy != null ? (
            <Row label={t("person.spicy")} center>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <ChiliMeter level={x.spicy} size={16} />
                <span className="font-sans text-[12px] tracking-[-0.035em] text-muted">{SPICY_LEVELS[x.spicy]?.[locale]}</span>
              </span>
            </Row>
          ) : null}
          {x.dessert ? <Row label={t("fav.dessert")}>{x.dessert}</Row> : null}
          {x.drinks ? <Row label={t("person.drinks")}>{x.drinks}</Row> : null}
          {a?.level || a?.kinds.length ? (
            <Row label={t("person.alcohol")}>
              {[a.level ? labelOf(ALCOHOL_LEVELS, a.level, locale) : "", codes(ALCOHOL_KINDS, a.kinds)].filter(Boolean).join(" · ")}
            </Row>
          ) : null}
        </>
      );
    }

    case "sizes": {
      const line = sectionSummary("sizes", card, locale, t);
      return line ? <p className="hand-written py-[3px] text-[22px] leading-[1.1]">{line.text}</p> : null;
    }

    case "gifts": {
      const g = card.gifts!;
      return (
        <>
          {g.wishlist.length ? (
            <Row label={t("gift.ideas")}>
              <span className="flex flex-col">
                {g.wishlist.map((w, i) =>
                  w.url ? (
                    <a key={i} href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="flex min-h-11 items-center justify-between gap-2">
                      {w.title}
                      <Icon name="external" size={16} className="shrink-0 text-muted" />
                    </a>
                  ) : (
                    <span key={i}>{w.title}</span>
                  ),
                )}
              </span>
            </Row>
          ) : null}
          {g.brands?.length ? <Row label={t("gift.brands")}>{g.brands.join(and)}</Row> : null}
          {g.giftCard ? <Row label={t("gift.giftCard")}>{t(g.giftCard === "yes" ? "gift.giftCardYes" : "gift.giftCardNo")}</Row> : null}
          {g.skip.length ? (
            <Row label={t("gift.skip")}>
              <span className="text-muted line-through decoration-red decoration-2">{g.skip.join(and)}</span>
            </Row>
          ) : null}
        </>
      );
    }

    case "favorites": {
      const f = card.favorites!;
      return (
        <>
          {f.scent ? <Row label={t("gift.scent")}>{f.scent}</Row> : null}
          {f.flowers ? <Row label={t("gift.flowers")}>{f.flowers}</Row> : null}
          {f.colors?.length ? (
            <Row label={t("gift.colors")} center>
              <span className="flex flex-wrap gap-x-3 gap-y-1.5">
                {f.colors.map((code) => {
                  const c = COLORS.find((x) => x.code === code);
                  return (
                    <span key={code} className="flex items-center gap-1.5">
                      <ColorDot hex={c?.hex ?? "#FFFFFF"} size={18} />
                      {c?.label[locale] ?? code}
                    </span>
                  );
                })}
              </span>
            </Row>
          ) : null}
          {f.idol ? <Row label={t("fav.idol")}>{f.idol}</Row> : null}
          {f.character ? <Row label={t("fav.character")}>{f.character}</Row> : null}
          {f.team ? <Row label={t("fav.team")}>{f.team}</Row> : null}
          {f.animal ? <Row label={t("fav.animal")}>{f.animal}</Row> : null}
          {f.patterns.length ? <Row label={t("fav.patterns")}>{codes(PATTERNS, f.patterns)}</Row> : null}
          {f.styles.length ? <Row label={t("fav.styles")}>{codes(STYLES, f.styles)}</Row> : null}
          {f.metals.length ? <Row label={t("fav.metals")}>{codes(METALS, f.metals)}</Row> : null}
          {f.vibes?.length ? <Row label={t("fav.vibes")}>{codes(VIBES, f.vibes)}</Row> : null}
          {f.places?.length ? <Row label={t("fav.places")}>{f.places.join(and)}</Row> : null}
        </>
      );
    }

    case "culture": {
      const c = card.culture!;
      return (
        <>
          {c.movie ? <Row label={t("fav.movie")}>{c.movie}</Row> : null}
          {c.movieGenres.length ? <Row label={t("fav.movieGenres")}>{codes(MOVIE_GENRES, c.movieGenres)}</Row> : null}
          {c.drama ? <Row label={t("fav.drama")}>{c.drama}</Row> : null}
          {c.shows ? <Row label={t("fav.shows")}>{c.shows}</Row> : null}
          {c.song ? <Row label={t("fav.song")}>{c.song}</Row> : null}
          {c.musicGenres.length ? <Row label={t("fav.musicGenres")}>{codes(MUSIC_GENRES, c.musicGenres)}</Row> : null}
          {c.book ? <Row label={t("fav.book")}>{c.book}</Row> : null}
        </>
      );
    }

    case "pets": {
      const p = card.pets!;
      if (!p.pets.length) return <Row label={t("section.pets")}>{t("pets.none")}</Row>;
      return (
        <>
          {p.pets.map((pet, i) => {
            const kind = pet.kind ? labelOf(PET_KINDS, pet.kind, locale) : "";
            const what = [kind, pet.breed].filter(Boolean).join(" · ");
            return (
              <Row key={i} label={pet.name || kind || t("section.pets")}>
                <span className="flex flex-col gap-0.5">
                  {what && pet.name ? <span>{what}</span> : pet.breed && !pet.name ? <span>{pet.breed}</span> : null}
                  {pet.treats.length ? (
                    <span className="font-sans text-[13px] tracking-[-0.035em] text-ink-2">
                      {t("pets.treats")} · {pet.treats.join(and)}
                    </span>
                  ) : null}
                  {pet.note ? <span className="font-sans text-[13px] tracking-[-0.035em] text-muted">{pet.note}</span> : null}
                </span>
              </Row>
            );
          })}
        </>
      );
    }
    case "life": {
      const l = card.life!;
      return (
        <>
          {l.hobbies.length ? <Row label={t("life.hobbies")}>{l.hobbies.join(and)}</Row> : null}
          {l.seasons.length ? <Row label={t("fav.seasons")}>{codes(SEASONS, l.seasons)}</Row> : null}
          {l.travel ? <Row label={t("fav.travel")}>{l.travel}</Row> : null}
        </>
      );
    }
  }
}
