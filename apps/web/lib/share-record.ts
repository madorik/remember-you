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
  formatSpec,
  formatSpecFull,
  isEmptySection,
  labelOf,
  realCodes,
  type CatalogItem,
  type Locale,
  type PartialCard,
  type Section,
} from "@readme/core";
import type { T } from "./t";

// 적어 둔 기록을 항목별 줄로 풀어 보여 주는 것(보내는 쪽 시트의 미리보기, 링크로 받은 기록을 보여 주는 화면). 화면의 항목 보기(components/SectionBody)와 같은 순서·같은 이름표로 쓴다.
// 서버 전용 코드가 없는 순수 함수라 시험에서 바로 돌린다. 이 줄들을 글로 이어 붙여 밖으로 내보내지 않는다(개인정보): 기록은 링크(lib/record-share)로만 나간다

export interface SharePart {
  section: Section;
  /** 항목 이름("알레르기와 못 먹는 음식") */
  title: string;
  /** "알레르기: 땅콩, 새우" 같은 줄들 */
  lines: string[];
}

/**
 * 한 항목을 줄들로. 비었으면 [].
 * wishlist: 선물 칸의 '해주고 싶은 선물'을 넣을지. 다른 사람 기록의 이 칸은 내가 몰래 준비하는 선물이라 기본은 뺀다(받는 사람이 당사자에게 전하면 놀라움이 사라진다).
 * 내 기록의 이 칸은 '받고 싶은 것'이라 보내려고 적어 둔 것이니 넣는다
 */
export function sectionShareLines(section: Section, card: PartialCard, locale: Locale, t: T, opts: { wishlist?: boolean } = {}): string[] {
  if (isEmptySection(section, card[section])) return [];
  const and = t("common.and");
  const codes = (list: CatalogItem[], c: string[]) => c.map((x) => labelOf(list, x, locale)).join(and);
  const line = (label: string, value: string) => (value.trim() ? `${label}: ${value.trim()}` : "");
  const out: string[] = [];

  switch (section) {
    case "dates": {
      const d = card.dates!;
      if (d.birthday) out.push(line(t("dates.birthday"), formatSpecFull(d.birthday, locale)));
      for (const a of d.anniversaries) out.push(line(a.label, a.once ? formatSpecFull(a.spec, locale) : formatSpec(a.spec, locale)));
      break;
    }
    case "safety": {
      const s = card.safety!;
      const allergens = realCodes(s.allergens);
      if (allergens.length) out.push(line(t("safety.allergens"), codes(ALLERGENS, allergens)));
      else if (s.allergens.includes(NONE)) out.push(line(t("safety.allergens"), labelOf(ALLERGENS, NONE, locale)));
      if (s.dislikes.length) out.push(line(t("person.wontEat"), codes(DISLIKES, s.dislikes)));
      if (s.diets.length) out.push(line(t("person.diet"), codes(DIETS, s.diets)));
      if (s.allergyNote) out.push(`“${s.allergyNote}”`);
      break;
    }
    case "taste": {
      const x = card.taste!;
      const a = x.alcohol;
      if (x.likes.length) out.push(line(t("person.likes"), x.likes.join(and)));
      if (x.spicy != null) out.push(line(t("person.spicy"), SPICY_LEVELS[x.spicy]?.[locale] ?? ""));
      if (x.dessert) out.push(line(t("fav.dessert"), x.dessert));
      if (x.drinks) out.push(line(t("person.drinks"), x.drinks));
      if (a?.level || a?.kinds.length) out.push(line(t("person.alcohol"), [a.level ? labelOf(ALCOHOL_LEVELS, a.level, locale) : "", codes(ALCOHOL_KINDS, a.kinds)].filter(Boolean).join(" · ")));
      break;
    }
    case "sizes": {
      const z = card.sizes!;
      const top = describeTop(z.top, locale);
      const shoe = describeShoe(z.shoe, locale);
      const ring = describeRing(z.ring, locale);
      const size = (label: string, v: { value: string; unit: string; hint: string | null } | null) => (v ? line(label, `${v.value}${v.unit ? ` ${v.unit}` : ""}${v.hint ? ` (${v.hint})` : ""}`) : "");
      out.push(size(t("size.top"), top), z.bottom ? line(t("size.bottom"), `${z.bottom} ${t("size.bottomUnit")}`) : "", size(t("size.shoe"), shoe), size(t("size.ring"), ring));
      break;
    }
    case "gifts": {
      const g = card.gifts!;
      if (opts.wishlist && g.wishlist.length) out.push(line(t("gift.ideas"), g.wishlist.map((w) => w.title).join(and)));
      if (g.brands?.length) out.push(line(t("gift.brands"), g.brands.join(and)));
      if (g.giftCard) out.push(line(t("gift.giftCard"), t(g.giftCard === "yes" ? "gift.giftCardYes" : "gift.giftCardNo")));
      if (g.skip.length) out.push(line(t("gift.skip"), g.skip.join(and)));
      break;
    }
    case "favorites": {
      const f = card.favorites!;
      if (f.scent) out.push(line(t("gift.scent"), f.scent));
      if (f.flowers) out.push(line(t("gift.flowers"), f.flowers));
      if (f.colors?.length) out.push(line(t("gift.colors"), f.colors.map((c) => COLORS.find((x) => x.code === c)?.label[locale] ?? c).join(and)));
      if (f.idol) out.push(line(t("fav.idol"), f.idol));
      if (f.character) out.push(line(t("fav.character"), f.character));
      if (f.team) out.push(line(t("fav.team"), f.team));
      if (f.animal) out.push(line(t("fav.animal"), f.animal));
      if (f.patterns.length) out.push(line(t("fav.patterns"), codes(PATTERNS, f.patterns)));
      if (f.styles.length) out.push(line(t("fav.styles"), codes(STYLES, f.styles)));
      if (f.metals.length) out.push(line(t("fav.metals"), codes(METALS, f.metals)));
      if (f.vibes?.length) out.push(line(t("fav.vibes"), codes(VIBES, f.vibes)));
      if (f.places?.length) out.push(line(t("fav.places"), f.places.join(and)));
      break;
    }
    case "culture": {
      const c = card.culture!;
      if (c.movie) out.push(line(t("fav.movie"), c.movie));
      if (c.movieGenres.length) out.push(line(t("fav.movieGenres"), codes(MOVIE_GENRES, c.movieGenres)));
      if (c.drama) out.push(line(t("fav.drama"), c.drama));
      if (c.shows) out.push(line(t("fav.shows"), c.shows));
      if (c.song) out.push(line(t("fav.song"), c.song));
      if (c.musicGenres.length) out.push(line(t("fav.musicGenres"), codes(MUSIC_GENRES, c.musicGenres)));
      if (c.book) out.push(line(t("fav.book"), c.book));
      break;
    }
    case "life": {
      const l = card.life!;
      if (l.hobbies.length) out.push(line(t("life.hobbies"), l.hobbies.join(and)));
      if (l.seasons.length) out.push(line(t("fav.seasons"), codes(SEASONS, l.seasons)));
      if (l.travel) out.push(line(t("fav.travel"), l.travel));
      break;
    }
    case "pets": {
      const p = card.pets!;
      if (!p.pets.length) {
        out.push(t("pets.none"));
        break;
      }
      for (const pet of p.pets) {
        const kind = pet.kind ? labelOf(PET_KINDS, pet.kind, locale) : "";
        const who = pet.name || kind || t("section.pets");
        const what = [pet.name ? kind : "", pet.breed].filter(Boolean).join(" · ");
        const extra = [what, pet.treats.length ? `${t("pets.treats")} ${pet.treats.join(and)}` : "", pet.note].filter(Boolean).join(" / ");
        out.push(line(who, extra) || who);
      }
      break;
    }
  }
  return out.filter(Boolean);
}

/** 보낼 수 있는 항목들(적어 둔 것만, 중요한 순서) */
export function shareParts(sections: readonly Section[], card: PartialCard, locale: Locale, t: T, opts: { wishlist?: boolean } = {}): SharePart[] {
  return sections
    .map((section) => ({ section, title: t(`section.${section}`), lines: sectionShareLines(section, card, locale, t, opts) }))
    .filter((p) => p.lines.length > 0);
}
