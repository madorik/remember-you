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
  PET_KINDS,
  SEASONS,
  SPICY_LEVELS,
  STYLES,
  VIBES,
  describeRing,
  describeShoe,
  describeTop,
  isEmptySection,
  labelOf,
  realCodes,
  type CatalogItem,
  type Locale,
  type PartialCard,
  type Section,
} from "@readme/core";
import type { T } from "@/lib/i18n";

/** 사람 화면 '기억해 둔 것' 한 줄: lead는 붉게 보일 앞부분(알레르기), text는 나머지. 적어 둔 게 없으면 null */
export interface SectionLine {
  lead?: string;
  text: string;
}

/**
 * 항목 하나를 한 줄로 줄인다(플래너 시안: 알레르기 '복숭아 알레르기', 음식 '잡채, 갈비찜 · 매운맛 보통', 사이즈 '상의 66 · 신발 235').
 * 자세한 값은 그 줄을 눌러 고치는 화면에서 본다
 */
export function sectionSummary(section: Section, card: PartialCard, locale: Locale, t: T): SectionLine | null {
  if (isEmptySection(section, card[section])) return null;
  const and = t("common.and");
  const codes = (list: CatalogItem[], c: string[]) => c.map((x) => labelOf(list, x, locale)).join(and);
  const dot = " · ";
  const line = (parts: (string | false | null | undefined)[], lead?: string): SectionLine | null => {
    const text = parts.filter(Boolean).join(dot);
    return text || lead ? { lead, text } : null;
  };

  switch (section) {
    case "dates":
      return null;

    case "safety": {
      const s = card.safety!;
      const allergens = realCodes(s.allergens);
      const lead = allergens.length ? t("person.allergyOf", { list: codes(ALLERGENS, allergens) }) : undefined;
      return line(
        [
          s.allergens.includes(NONE) && !allergens.length ? labelOf(ALLERGENS, NONE, locale) : "",
          s.dislikes.length ? `${t("person.wontEat")} ${codes(DISLIKES, s.dislikes)}` : "",
          s.diets.length ? codes(DIETS, s.diets) : "",
          s.allergyNote ? `“${s.allergyNote}”` : "",
        ],
        lead,
      );
    }

    case "taste": {
      const x = card.taste!;
      const a = x.alcohol;
      return line([
        x.likes.length ? x.likes.join(and) : "",
        x.spicy != null ? `${t("person.spicy")} ${SPICY_LEVELS[x.spicy]?.[locale] ?? ""}` : "",
        x.dessert,
        x.drinks,
        a?.level || a?.kinds.length ? [a.level ? labelOf(ALCOHOL_LEVELS, a.level, locale) : "", codes(ALCOHOL_KINDS, a.kinds)].filter(Boolean).join(" ") : "",
      ]);
    }

    case "sizes": {
      const z = card.sizes!;
      const top = describeTop(z.top, locale);
      const shoe = describeShoe(z.shoe, locale);
      const ring = describeRing(z.ring, locale);
      return line([
        top ? `${t("size.top")} ${top.value}` : "",
        z.bottom ? `${t("size.bottom")} ${z.bottom}` : "",
        shoe ? `${t("size.shoe")} ${shoe.value}` : "",
        ring ? `${t("size.ring")} ${ring.value}` : "",
      ]);
    }

    case "gifts": {
      const g = card.gifts!;
      return line([g.wishlist.length ? g.wishlist.map((w) => w.title).join(and) : "", g.brands?.length ? g.brands.join(and) : "", g.giftCard ? t(g.giftCard === "yes" ? "gift.giftCardYes" : "gift.giftCardNo") : ""]);
    }

    case "favorites": {
      const f = card.favorites!;
      const colors = (f.colors ?? []).map((code) => COLORS.find((c) => c.code === code)?.label[locale] ?? code);
      return line([
        colors.length ? colors.join(and) : "",
        f.scent,
        f.flowers,
        f.idol,
        f.character,
        f.team,
        f.animal,
        f.patterns.length ? codes(PATTERNS, f.patterns) : "",
        f.styles.length ? codes(STYLES, f.styles) : "",
        f.metals.length ? codes(METALS, f.metals) : "",
        f.vibes?.length ? codes(VIBES, f.vibes) : "",
        f.places?.length ? f.places.join(and) : "",
      ]);
    }

    case "culture": {
      const c = card.culture!;
      return line([
        c.movie,
        c.movieGenres.length ? codes(MOVIE_GENRES, c.movieGenres) : "",
        c.drama,
        c.shows,
        c.song,
        c.musicGenres.length ? codes(MUSIC_GENRES, c.musicGenres) : "",
        c.book,
      ]);
    }

    case "pets": {
      const p = card.pets!;
      if (!p.pets.length) return { text: t("pets.none") };
      return line([p.pets.map((pet) => pet.name || (pet.kind ? labelOf(PET_KINDS, pet.kind, locale) : "") || t("section.pets")).join(and)]);
    }

    case "life": {
      const l = card.life!;
      return line([l.hobbies.length ? l.hobbies.join(and) : "", l.seasons.length ? codes(SEASONS, l.seasons) : "", l.travel]);
    }
  }
}
