import { NONE, PET_KINDS, ALCOHOL_LEVELS, ALLERGENS, COLORS, DISLIKES, MUSIC_GENRES, PATTERNS, SEASONS, SPICY_LEVELS, clip, formatSpec, formatSpecFull, labelOf, type CardData, type Locale, type PartialCard, type Section } from "@readme/core";
import type { T } from "./i18n";

/** 내 리드미 목록에 보일 한 줄 요약 */
export function summarize(section: Section, data: CardData[Section] | undefined, locale: Locale, t: T): string {
  if (!data) return "";
  const and = t("common.and");
  switch (section) {
    case "safety": {
      const d = data as CardData["safety"];
      const parts = [
        d.allergens.includes(NONE)
          ? `${t("person.allergy")} ${labelOf(ALLERGENS, NONE, locale)}`
          : d.allergens.length
            ? `${d.allergens.map((c) => labelOf(ALLERGENS, c, locale)).join(and)} ${t("person.allergy")}`
            : "",
        d.dislikes.map((c) => labelOf(DISLIKES, c, locale)).join(and),
      ].filter(Boolean);
      return parts.join(" / ");
    }
    case "taste": {
      const d = data as CardData["taste"];
      return [
        d.likes.slice(0, 3).join(and),
        d.spicy != null ? `${t("taste.spicy")} ${SPICY_LEVELS[d.spicy]?.[locale]}` : "",
        d.dessert,
        d.drinks,
        d.alcohol?.level ? `${t("taste.alcohol")} ${labelOf(ALCOHOL_LEVELS, d.alcohol.level, locale)}` : "",
      ]
        .filter(Boolean)
        .join(" / ");
    }
    case "sizes": {
      const d = data as CardData["sizes"];
      return [
        d.top ? `${t("size.top")} ${d.top}` : "",
        d.bottom ? `${t("size.bottom")} ${d.bottom}` : "",
        d.shoe ? `${t("size.shoe")} ${d.shoe}` : "",
        d.ring ? `${t("size.ring")} ${d.ring}` : "",
      ]
        .filter(Boolean)
        .join(and);
    }
    case "gifts": {
      const d = data as CardData["gifts"];
      return [d.wishlist.slice(0, 2).map((w) => w.title).join(and), d.brands?.slice(0, 2).join(and) ?? "", d.giftCard ? `${t("gift.giftCard")} ${t(d.giftCard === "yes" ? "gift.giftCardYes" : "gift.giftCardNo")}` : ""]
        .filter(Boolean)
        .join(" / ");
    }
    case "favorites": {
      const d = data as CardData["favorites"];
      return [d.scent, d.flowers, (d.colors ?? []).map((c) => labelOf(COLORS, c, locale)).join(and), (d.places ?? []).slice(0, 2).join(and), d.idol, d.character, d.patterns.slice(0, 2).map((c) => labelOf(PATTERNS, c, locale)).join(and), d.animal]
        .filter(Boolean)
        .slice(0, 4)
        .join(" / ");
    }
    case "culture": {
      const d = data as CardData["culture"];
      return [d.movie, d.drama, d.musicGenres.slice(0, 2).map((c) => labelOf(MUSIC_GENRES, c, locale)).join(and), d.song, d.book].filter(Boolean).slice(0, 4).join(" / ");
    }
    case "life": {
      const d = data as CardData["life"];
      return [d.hobbies.slice(0, 3).join(and), d.seasons.map((c) => labelOf(SEASONS, c, locale)).join(and), d.travel].filter(Boolean).join(" / ");
    }
    case "pets": {
      const d = data as CardData["pets"];
      if (!d.pets.length) return d.none ? t("pets.none") : "";
      return d.pets
        .map((p) => {
          const who = [p.name, [p.kind ? labelOf(PET_KINDS, p.kind, locale) : "", p.breed].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
          return p.treats.length ? `${who} (${p.treats.slice(0, 3).join(and)})` : who;
        })
        .join(" / ");
    }
    case "dates": {
      const d = data as CardData["dates"];
      return [d.birthday ? `${t("dates.birthday")} ${formatSpecFull(d.birthday, locale)}` : "", ...d.anniversaries.map((a) => `${a.label} ${a.once ? formatSpecFull(a.spec, locale) : formatSpec(a.spec, locale)}`)].filter(Boolean).join(and);
    }
  }
}

/** 이름이 같은 사람을 가려 볼 때 곁에 작게 붙이는, 그 사람 기록의 첫 줄 요약(없으면 ""). 알레르기·입맛처럼 사람마다 다른 것부터 본다 */
export function personHint(card: PartialCard, locale: Locale, t: T): string {
  for (const section of ["safety", "taste", "favorites", "dates", "sizes", "gifts", "culture", "life", "pets"] as const) {
    const line = summarize(section, card[section], locale, t).trim();
    if (line) return clip(line, 30);
  }
  return "";
}
