// 말로 적기: "와이프는 바닐라라떼를 좋아해" 같은 말을 AI가 (사람, 칸, 값)으로 나누면, 여기서 그 칸에 합친다.
// 어느 칸에도 안 맞는 말은 그 사람의 메모로 간다(target "memo"). 순수 함수라 서버·테스트가 같이 쓴다.
import { ALCOHOL_KINDS, ALCOHOL_LEVELS, ALLERGENS, COLORS, DIETS, DISLIKES, METALS, MOVIE_GENRES, MUSIC_GENRES, NONE, PATTERNS, PET_KINDS, SEASONS, SPICY_LEVELS, STYLES, VIBES, type CatalogItem } from "./catalog";
import { ONCE_MAX, emptySection, sanitizeSection, type Anniversary, type CardData, type Pet, type Section } from "./card";
import { compareYmd, isOnceSpec, isValidSpec, onceDate, type DateSpec } from "./calendar";
import type { Locale } from "./locale";
import { clip } from "./text";

/**
 * 칸의 종류
 * - text: 글 한 줄. 이미 있으면 ", "로 이어 붙인다(사이즈 상의·하의는 바꾼다)
 * - list: 글 목록(좋아하는 음식·취미·받고 싶은 것…). 없는 것만 더한다
 * - codes: 고르는 칸(무늬·장르…). 목록에 있는 코드만, 없는 것만 더한다
 * - tags: 알레르기·안 먹는 것. 목록의 코드 + 목록에 없는 음식 이름(text)을 새 항목으로 더한다
 * - code: 하나만 고르는 칸(술을 얼마나·상품권). 바꾼다
 * - number: 수(매운맛 0–4, 신발 mm, 반지 호수). 바꾼다
 * - date: 생일. 바꾼다
 * - anniversary: 기념일(이름 + 날짜). 같은 이름이면 바꾸고 아니면 더한다.
 *   once인 칸(dates.plan)은 한 번만 있는 날(약속·집들이 …): 양력 연·월·일이 다 있어야 하고, 같은 이름·같은 날이 아니면 따로 더한다(바꾸기는 같은 이름의 것을 바꾼다)
 * - pet: 반려동물 한 마리(label = 이름). pets.pet은 종류(codes)·품종(text), pets.treats는 좋아하는 간식·장난감(text, 쉼표), pets.note는 메모(text).
 *   이름이 같은(이름이 없으면 종류가 같은, 그것도 없으면 한 마리뿐인) 반려동물에 합치고, 없으면 새로 더한다
 */
export type CaptureKind = "text" | "list" | "codes" | "tags" | "code" | "number" | "date" | "anniversary" | "pet";

export interface CaptureField {
  key: string;
  section: Section;
  kind: CaptureKind;
  label: Record<Locale, string>;
  catalog?: CatalogItem[];
  range?: [number, number];
  /** text인데 이어 붙이지 않고 바꾸는 칸 */
  replace?: boolean;
  /** anniversary인데 해마다 돌아오지 않고 그 하루에 한 번만 있는 날(Anniversary.once) */
  once?: boolean;
}

const f = (key: string, kind: CaptureKind, ko: string, en: string, extra: Partial<CaptureField> = {}): CaptureField => ({
  key,
  section: key.split(".")[0] as Section,
  kind,
  label: { ko, en },
  ...extra,
});

export const CAPTURE_FIELDS: CaptureField[] = [
  f("safety.allergens", "tags", "알레르기", "Allergies", { catalog: ALLERGENS }),
  f("safety.dislikes", "tags", "안 먹어요", "Won't eat", { catalog: DISLIKES }),
  f("safety.diets", "codes", "식단", "Diet", { catalog: DIETS }),
  f("safety.allergyNote", "text", "꼭 알려 둘 말", "Good to know"),
  f("taste.likes", "list", "좋아하는 음식", "Favorite foods"),
  f("taste.spicy", "number", "매운맛", "Spice", { range: [0, 4] }),
  f("taste.dessert", "text", "디저트·간식", "Desserts & snacks"),
  f("taste.drinks", "text", "요즘 마시는 것", "Drinking lately"),
  f("taste.alcoholLevel", "code", "술", "Alcohol", { catalog: ALCOHOL_LEVELS }),
  f("taste.alcoholKinds", "codes", "좋아하는 술", "Favorite drinks", { catalog: ALCOHOL_KINDS }),
  f("sizes.top", "text", "상의", "Top", { replace: true }),
  f("sizes.bottom", "text", "하의", "Bottom", { replace: true }),
  f("sizes.shoe", "number", "신발(mm)", "Shoe (mm)", { range: [180, 330] }),
  f("sizes.ring", "number", "반지(호)", "Ring size", { range: [1, 30] }),
  f("gifts.wishlist", "list", "해주고 싶은 선물", "Gift ideas"),
  f("gifts.skip", "list", "사양하는 것", "Please skip"),
  f("gifts.brands", "list", "좋아하는 브랜드", "Favorite brands"),
  f("gifts.giftCard", "code", "상품권", "Gift cards", { catalog: [{ code: "yes", label: { ko: "좋아요", en: "Yes" } }, { code: "no", label: { ko: "싫어요", en: "No" } }] }),
  f("favorites.scent", "text", "향", "Scent"),
  f("favorites.flowers", "text", "꽃", "Flowers"),
  f("favorites.colors", "codes", "좋아하는 색", "Colors", { catalog: COLORS }),
  f("favorites.patterns", "codes", "무늬", "Patterns", { catalog: PATTERNS }),
  f("favorites.styles", "codes", "옷 스타일", "Style", { catalog: STYLES }),
  f("favorites.metals", "codes", "액세서리 색", "Metals", { catalog: METALS }),
  f("favorites.vibes", "codes", "좋아하는 분위기", "Vibe", { catalog: VIBES }),
  f("favorites.places", "list", "좋아하는 장소", "Favorite places"),
  f("favorites.idol", "text", "최애 연예인·가수", "Favorite star"),
  f("favorites.character", "text", "좋아하는 캐릭터", "Favorite character"),
  f("favorites.team", "text", "응원하는 팀", "Team"),
  f("favorites.animal", "text", "좋아하는 동물", "Favorite animal"),
  f("culture.movieGenres", "codes", "영화 장르", "Movie genres", { catalog: MOVIE_GENRES }),
  f("culture.musicGenres", "codes", "음악 장르", "Music genres", { catalog: MUSIC_GENRES }),
  f("culture.movie", "text", "인생 영화", "Favorite movie"),
  f("culture.drama", "text", "드라마", "Drama"),
  f("culture.shows", "text", "TV·예능·유튜브", "Shows"),
  f("culture.song", "text", "노래", "Song"),
  f("culture.book", "text", "책", "Book"),
  f("life.hobbies", "list", "취미", "Hobbies"),
  f("life.seasons", "codes", "좋아하는 계절", "Seasons", { catalog: SEASONS }),
  f("life.travel", "text", "가 보고 싶은 곳", "Dream trip"),
  f("pets.pet", "pet", "반려동물(이름·종류·품종)", "Pet (name, kind, breed)", { catalog: PET_KINDS }),
  f("pets.treats", "pet", "반려동물이 좋아하는 간식·장난감", "Pet's favorite treats & toys", { catalog: PET_KINDS }),
  f("pets.note", "pet", "반려동물 메모(나이·성격)", "Pet note (age, personality)", { catalog: PET_KINDS }),
  f("dates.birthday", "date", "생일", "Birthday"),
  f("dates.anniversary", "anniversary", "기념일", "Anniversary"),
  f("dates.plan", "anniversary", "챙길 날", "Upcoming date", { once: true }),
];

export const CAPTURE_TARGETS = [...CAPTURE_FIELDS.map((x) => x.key), "memo"] as const;

export function captureField(key: string): CaptureField | null {
  return CAPTURE_FIELDS.find((x) => x.key === key) ?? null;
}

/**
 * 무엇을 할지
 * - add: 새로 알게 된 것(기본). 글은 이어 붙이고 목록은 없는 것만 더한다
 * - replace: 바뀐 것·고친 것. 그 칸을 새 값으로 바꾼다
 * - remove: 아니라거나 지워 달라는 것. 맞는 것만 빼고, 값이 없으면 그 칸을 비운다
 */
export type CaptureOp = "add" | "replace" | "remove";

/** AI가 돌려주는 값(쓰는 칸만 채운다) */
export interface CaptureValue {
  text?: string | null;
  codes?: string[] | null;
  number?: number | null;
  date?: DateSpec | null;
  label?: string | null;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const squash = (a: string) => a.toLowerCase().replace(/\s+/g, "");
const glyphs = (a: string) => Array.from(a).length;

/**
 * 지울 때 가리킨 항목 찾기(칸 안의 위치). 항목마다 이름 여러 개(코드와 그 이름들)를 줄 수 있다.
 * 띄어쓰기·대소문자만 다른 같은 말이 있으면 그것만. 없으면 한쪽이 다른 쪽을 품은 항목이 딱 하나일 때만("수국" ↔ "카네이션보다 수국"),
 * 그것도 품은 쪽 글자가 두 글자 이상일 때만 — 그렇지 않으면 "밥"이 "김밥 만들기"·"볶음밥"을, "소"가 소고기·소주를 한꺼번에 지운다
 */
function findHits(items: string[][], needle: string): number[] {
  const y = squash(needle);
  if (!y) return [];
  const keys = items.map((names) => names.map(squash).filter(Boolean));
  const exact = keys.flatMap((ks, i) => (ks.includes(y) ? [i] : []));
  if (exact.length) return exact;
  const loose = keys.flatMap((ks, i) => (ks.some((k) => Math.min(glyphs(k), glyphs(y)) >= 2 && (k.includes(y) || y.includes(k))) ? [i] : []));
  return loose.length === 1 ? loose : [];
}

/** needles 중 하나라도 가리키는 항목의 위치들. needles가 없으면 전부 */
function hitSet(items: string[][], needles: string[]): Set<number> {
  if (!needles.length) return new Set(items.keys());
  return new Set(needles.flatMap((n) => findHits(items, n)));
}

const solo = (list: string[]) => list.map((x) => [x]);

/** 합칠 반려동물: 이름이 같은 것, 이름이 없으면 종류가 같은 한 마리, 그것도 없으면 한 마리뿐일 때 그 한 마리 */
function findPet(list: Pet[], name: string, kind: string | null): Pet | null {
  if (name) return list.find((p) => same(p.name, name)) ?? list.find((p) => !p.name && (!kind || p.kind === kind)) ?? null;
  if (kind) {
    const ofKind = list.filter((p) => p.kind === kind);
    return ofKind.length === 1 ? ofKind[0]! : null;
  }
  return list.length === 1 ? list[0]! : null;
}

/** 칸의 실제 저장 위치(술 두 칸은 taste.alcohol 안에 있다) */
function getRaw(data: Record<string, unknown>, key: string): unknown {
  const name = key.split(".")[1]!;
  if (name === "alcoholLevel") return (data.alcohol as { level: unknown } | undefined)?.level ?? null;
  if (name === "alcoholKinds") return (data.alcohol as { kinds: unknown } | undefined)?.kinds ?? [];
  return data[name];
}

function setRaw(data: Record<string, unknown>, key: string, value: unknown): void {
  const name = key.split(".")[1]!;
  if (name === "alcoholLevel" || name === "alcoholKinds") {
    const alcohol = { level: null, kinds: [], ...((data.alcohol as object) ?? {}) } as Record<string, unknown>;
    alcohol[name === "alcoholLevel" ? "level" : "kinds"] = value;
    data.alcohol = alcohol;
    return;
  }
  data[name] = value;
}

/**
 * 한 칸에 값 합치기(더하기·바꾸기·지우기). 바뀐 항목 전체를 돌려주고, 바뀐 게 없거나 값이 맞지 않으면 null.
 * 결과는 sanitizeSection을 거쳐 저장 모양과 같다
 */
export function mergeCapture<S extends Section>(field: CaptureField, current: CardData[S] | null | undefined, value: CaptureValue, op: CaptureOp = "add"): CardData[S] | null {
  const section = field.section as S;
  const base = structuredClone(current ?? emptySection(section)) as unknown as Record<string, unknown>;
  const before = JSON.stringify(sanitizeSection(section, base));
  const text = (value.text ?? "").replace(/\s+/g, " ").trim();
  const codes = (value.codes ?? []).filter((c) => !!field.catalog?.some((x) => x.code === c));
  if (op === "remove") {
    if (!removeFrom(field, base, text, codes, value)) return null;
    const out = sanitizeSection(section, base);
    return JSON.stringify(out) === before ? null : out;
  }
  const replace = op === "replace";

  switch (field.kind) {
    case "text": {
      if (!text) return null;
      const old = String(getRaw(base, field.key) ?? "").trim();
      const parts = old ? old.split(/\s*,\s*/) : [];
      setRaw(base, field.key, replace || field.replace || !old ? text : parts.some((p) => same(p, text)) ? old : `${old}, ${text}`);
      break;
    }
    case "list": {
      if (!text) return null;
      const items = text.split(/\s*,\s*/).filter(Boolean);
      if (field.key === "gifts.wishlist") {
        const old = (base.wishlist as { title: string; url: string }[]) ?? [];
        // 바꿀 때도 같은 이름의 링크는 남긴다
        const list = replace ? [] : old.slice();
        for (const title of items) if (!list.some((w) => same(w.title, title))) list.push(old.find((w) => same(w.title, title)) ?? { title, url: "" });
        base.wishlist = list;
      } else {
        const list = replace ? [] : ((getRaw(base, field.key) as string[]) ?? []).slice();
        for (const x of items) if (!list.some((y) => same(x, y))) list.push(x);
        setRaw(base, field.key, list);
      }
      break;
    }
    case "codes": {
      if (!codes.length) return null;
      const list = replace ? [] : ((getRaw(base, field.key) as string[]) ?? []).filter((c) => c !== NONE);
      for (const c of codes) if (!list.includes(c)) list.push(c);
      setRaw(base, field.key, list);
      break;
    }
    case "tags": {
      const add = [...codes, ...text.split(/\s*,\s*/).filter(Boolean)];
      if (!add.length) return null;
      const list = replace ? [] : ((getRaw(base, field.key) as string[]) ?? []).filter((c) => c !== NONE);
      for (const x of add) if (!list.some((y) => same(x, y))) list.push(x);
      setRaw(base, field.key, list); // 목록에 있는 이름은 sanitizeSection이 코드로 바꾸고 겹친 것을 지운다
      break;
    }
    case "code": {
      const code = codes[0] ?? (field.catalog?.some((x) => x.code === text) ? text : "");
      if (!code) return null;
      setRaw(base, field.key, code);
      break;
    }
    case "number": {
      const n = value.number;
      const [min, max] = field.range ?? [-Infinity, Infinity];
      if (typeof n !== "number" || !Number.isFinite(n)) return null;
      const r = Math.round(n);
      if (r < min || r > max) return null;
      setRaw(base, field.key, r);
      break;
    }
    case "date": {
      // 없는 날짜(4월 31일, 13월, 평년 2월 29일)를 넣으면 정리 단계에서 생일이 null로 지워지므로 여기서 막는다
      if (!isValidSpec(value.date)) return null;
      base.birthday = value.date;
      break;
    }
    case "anniversary": {
      const label = (value.label ?? "").trim();
      if (!isValidSpec(value.date) || !label) return null;
      const old = (base.anniversaries as Anniversary[]) ?? [];
      if (field.once) {
        // 한 번만 있는 날: 양력 연·월·일이 다 있어야 한다. 같은 이름·같은 날이 이미 있으면 그대로, 이름이 같아도 날이 다르면 다른 일정이다(바꾸기는 같은 이름의 것을 바꾼다)
        const date = value.date;
        if (!isOnceSpec(date)) return null;
        const sameDay = (a: Anniversary) => isOnceSpec(a.spec) && compareYmd(onceDate(a.spec), onceDate(date)) === 0;
        if (old.some((a) => a.once && same(a.label, label) && sameDay(a))) return null;
        const list = old.filter((a) => !(a.once && same(a.label, label) && replace));
        list.push({ label, spec: { calendar: "solar", month: date.month, day: date.day, year: date.year }, once: true });
        // 한도를 넘으면 가장 오래된(날짜가 이른) 것부터 뺀다
        const onces = list.filter((a) => a.once && isOnceSpec(a.spec));
        if (onces.length > ONCE_MAX) {
          const gone = new Set(onces.sort((a, b) => compareYmd(onceDate(a.spec as DateSpec & { year: number }), onceDate(b.spec as DateSpec & { year: number }))).slice(0, onces.length - ONCE_MAX));
          base.anniversaries = list.filter((a) => !gone.has(a));
        } else base.anniversaries = list;
        break;
      }
      // 해마다 도는 기념일: 같은 이름이면 바꾼다(한 번만 있는 날은 건드리지 않는다)
      const list = old.filter((a) => a.once || !same(a.label, label));
      list.push({ label, spec: value.date });
      base.anniversaries = list;
      break;
    }
    case "pet": {
      const name = (value.label ?? "").trim();
      const kind = codes[0] ?? null;
      const list = ((base.pets as Pet[]) ?? []).map((p) => ({ ...p, treats: [...(p.treats ?? [])] }));
      const items = text.split(/\s*,\s*/).filter(Boolean);
      if (field.key === "pets.pet" ? !name && !kind && !text : !items.length) return null;
      let pet = findPet(list, name, kind);
      if (!pet) {
        pet = { name, kind, breed: "", treats: [], note: "" };
        list.push(pet);
      }
      if (name && !pet.name) pet.name = name;
      if (kind && (replace || !pet.kind)) pet.kind = kind;
      if (field.key === "pets.pet") {
        if (text && (replace || !pet.breed)) pet.breed = text;
      } else if (field.key === "pets.treats") {
        pet.treats = replace ? items : [...pet.treats, ...items.filter((x) => !pet!.treats.some((y) => same(x, y)))];
      } else {
        const old = pet.note.trim();
        pet.note = replace || !old ? text : old.split(/\s*,\s*/).some((p) => same(p, text)) ? old : `${old}, ${text}`;
      }
      base.pets = list;
      base.none = false;
      break;
    }
  }
  const out = sanitizeSection(section, base);
  return JSON.stringify(out) === before ? null : out;
}

/**
 * 메모 가져오기: '없는 것만 더한다'. 글은 이어 붙이고 목록·고르는 칸·반려동물은 없는 것만 더하되(mergeCapture의 더하기),
 * 이미 값이 있는 한 칸짜리(하나만 고르는 칸·수·생일·바꿔 쓰는 사이즈 글)와 같은 이름의 기념일은 건드리지 않는다(null)
 */
export function mergeImport<S extends Section>(field: CaptureField, current: CardData[S] | null | undefined, value: CaptureValue): CardData[S] | null {
  const base = (current ?? {}) as unknown as Record<string, unknown>;
  const filled = (v: unknown) => v != null && String(v).trim() !== "";
  if (field.kind === "code" || field.kind === "number" || field.kind === "date") {
    if (filled(getRaw(base, field.key))) return null;
  } else if (field.kind === "text" && field.replace) {
    if (filled(getRaw(base, field.key))) return null;
  } else if (field.kind === "anniversary" && !field.once) {
    const label = (value.label ?? "").trim();
    if (((base.anniversaries as { label: string; once?: boolean }[]) ?? []).some((a) => !a.once && same(a.label, label))) return null;
  }
  return mergeCapture(field, current, value, "add");
}

/** 지우기: 맞는 것만 빼고(값이 없으면 그 칸을 비운다), 뺄 게 있었는지 */
function removeFrom(field: CaptureField, base: Record<string, unknown>, text: string, codes: string[], value: CaptureValue): boolean {
  switch (field.kind) {
    case "text": {
      const old = String(getRaw(base, field.key) ?? "").trim();
      if (!old) return false;
      const parts = old.split(/\s*,\s*/);
      const drop = hitSet(solo(parts), text ? [text] : []);
      const keep = parts.filter((_, i) => !drop.has(i));
      if (keep.length === parts.length) return false;
      setRaw(base, field.key, keep.join(", "));
      return true;
    }
    case "list": {
      const items = text.split(/\s*,\s*/).filter(Boolean);
      if (field.key === "gifts.wishlist") {
        const list = (base.wishlist as { title: string; url: string }[]) ?? [];
        const drop = hitSet(solo(list.map((w) => w.title)), items);
        base.wishlist = list.filter((_, i) => !drop.has(i));
        return (base.wishlist as unknown[]).length !== list.length;
      }
      const list = (getRaw(base, field.key) as string[]) ?? [];
      const drop = hitSet(solo(list), items);
      const keep = list.filter((_, i) => !drop.has(i));
      setRaw(base, field.key, keep);
      return keep.length !== list.length;
    }
    case "codes": {
      // 목록에 없는 말로만 지워 달라면(예: 없는 알레르기) 지울 것이 없다
      if (!codes.length && (value.codes?.length || text)) return false;
      const list = (getRaw(base, field.key) as string[]) ?? [];
      const keep = codes.length ? list.filter((c) => !codes.includes(c)) : [];
      setRaw(base, field.key, keep);
      return keep.length !== list.length;
    }
    case "tags": {
      const items = [...codes, ...text.split(/\s*,\s*/).filter(Boolean)];
      if (!items.length && value.codes?.length) return false; // 목록에 없는 코드로만 지워 달라면 지울 것이 없다
      const list = (getRaw(base, field.key) as string[]) ?? [];
      // 코드는 그 이름(한국어·영어)으로도 가리킬 수 있다
      const names = (x: string) => {
        const label = field.catalog?.find((i) => i.code === x)?.label;
        return label ? [x, label.ko, label.en] : [x];
      };
      const drop = hitSet(list.map(names), items);
      const keep = list.filter((_, i) => !drop.has(i));
      setRaw(base, field.key, keep);
      return keep.length !== list.length;
    }
    case "code":
    case "number":
      if (getRaw(base, field.key) == null) return false;
      setRaw(base, field.key, null);
      return true;
    case "date":
      if (!base.birthday) return false;
      base.birthday = null;
      return true;
    case "anniversary": {
      const label = (value.label ?? text).trim();
      const d = value.date;
      if (!label && !d) return false;
      const list = (base.anniversaries as Anniversary[]) ?? [];
      // 한 번만 있는 날 칸은 한 번만 있는 날만 지운다(해마다 도는 기념일을 잘못 지우지 않게)
      const pool = list.flatMap((a, i) => (field.once && !a.once ? [] : [i]));
      const hit = label ? findHits(solo(pool.map((i) => list[i]!.label)), label).map((k) => pool[k]!) : pool.filter((i) => list[i]!.spec.month === d!.month && list[i]!.spec.day === d!.day);
      const drop = new Set(hit);
      base.anniversaries = list.filter((_, i) => !drop.has(i));
      return (base.anniversaries as unknown[]).length !== list.length;
    }
    case "pet": {
      const list = ((base.pets as Pet[]) ?? []).map((p) => ({ ...p, treats: [...(p.treats ?? [])] }));
      const name = (value.label ?? "").trim();
      const pet = findPet(list, name, codes[0] ?? null);
      if (!pet) return false;
      if (field.key === "pets.pet") {
        base.pets = list.filter((p) => p !== pet);
        return true;
      }
      if (field.key === "pets.treats") {
        const items = text.split(/\s*,\s*/).filter(Boolean);
        const drop = hitSet(solo(pet.treats), items);
        const keep = pet.treats.filter((_, i) => !drop.has(i));
        if (keep.length === pet.treats.length) return false;
        pet.treats = keep;
      } else {
        if (!pet.note) return false;
        pet.note = "";
      }
      base.pets = list;
      return true;
    }
  }
}

// note-effects.ts(메모가 더한 것을 기록·되돌리기)가 칸의 실제 저장 위치를 같은 방식으로 읽고 쓰려고 쓴다
export { getRaw, setRaw, findPet };

/** 화면에 보일 값 한 줄("바닐라라떼", "땅콩, 새우", "270") */
export function describeCapture(field: CaptureField, value: CaptureValue, locale: Locale): string {
  const codeLabel = (c: string) => field.catalog?.find((x) => x.code === c)?.label[locale] ?? c;
  switch (field.kind) {
    case "codes":
      return (value.codes ?? []).map(codeLabel).join(", ");
    case "tags":
      return [...(value.codes ?? []).filter((c) => field.catalog?.some((x) => x.code === c)).map(codeLabel), ...(value.text ?? "").split(/\s*,\s*/).filter(Boolean)].join(", ");
    case "code":
      return codeLabel(value.codes?.[0] ?? value.text ?? "");
    case "number":
      if (value.number == null) return "";
      if (field.key === "taste.spicy") return SPICY_LEVELS[Math.round(value.number)]?.[locale] ?? String(value.number);
      return String(value.number);
    case "pet": {
      const who = (value.label ?? "").trim();
      if (field.key === "pets.pet") return [who, codeLabel(value.codes?.[0] ?? ""), (value.text ?? "").trim()].filter(Boolean).join(" · ");
      return [who, (value.text ?? "").trim()].filter(Boolean).join(" · ");
    }
    case "date":
    case "anniversary": {
      const d = value.date;
      if (!d) return "";
      const md = locale === "ko" ? `${d.calendar === "lunar" ? "음력 " : ""}${d.month}월 ${d.day}일` : `${d.calendar === "lunar" ? "Lunar " : ""}${d.month}/${d.day}`;
      if (field.kind !== "anniversary") return md;
      // 한 번만 있는 날은 날짜가 먼저: "12월 6일 집들이"
      return (field.once ? `${md} ${value.label ?? ""}` : `${value.label ?? ""} ${md}`).trim();
    }
    default:
      return (value.text ?? "").trim();
  }
}

// ── 화면에서 고친 값 글자 → 칸의 값(describeCapture의 거꾸로) ─────────────────────────────

const catalogCode = (field: CaptureField, piece: string): string | null => {
  const y = squash(piece);
  if (!y) return null;
  return field.catalog?.find((x) => squash(x.code) === y || squash(x.label.ko) === y || squash(x.label.en) === y)?.code ?? null;
};

const DATE_IN_TEXT = /(?:(\d{4})\s*(?:년|[./-])\s*)?(\d{1,2})\s*(?:월|\/|[.-])\s*(\d{1,2})\s*일?/;

/** 글에서 날짜(3월 5일 · 3/5 · 2024.3.5, 앞뒤에 음력/Lunar)를 찾는다. 날짜를 뺀 나머지 글을 같이 돌려준다 */
function dateIn(input: string, current: DateSpec | null | undefined): { date: DateSpec; rest: string } | null {
  const lunar = /음력|lunar/i.test(input);
  const plain = input.replace(/음력|lunar/gi, " ");
  const m = DATE_IN_TEXT.exec(plain);
  if (!m) return null;
  const base: DateSpec = { calendar: lunar ? "lunar" : "solar", month: Number(m[2]), day: Number(m[3]) };
  // 연도를 적지 않았으면 그 줄에 있던 연도를 그대로(맞는 날짜일 때만)
  const year = m[1] ? Number(m[1]) : current?.year;
  const withYear = year !== undefined ? { ...base, year } : null;
  const date = withYear && isValidSpec(withYear) ? withYear : base;
  if (!isValidSpec(date)) return null;
  return { date, rest: `${plain.slice(0, m.index)} ${plain.slice(m.index + m[0].length)}`.replace(/\s+/g, " ").trim() };
}

/**
 * 화면에서 고친 값 글자를 다시 칸의 값으로 읽는다(describeCapture의 거꾸로). current는 바뀌지 않는 나머지(반려동물 이름 등)를 가져온다.
 * 못 읽으면(빈 글·목록에 없는 선택지·범위 밖 수·없는 날짜) null — 화면은 그 줄을 틀린 값으로 보인다
 */
export function parseCaptureEdit(field: CaptureField, input: string, locale: Locale, current: CaptureValue = {}): CaptureValue | null {
  void locale;
  const raw = input.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const pieces = raw.split(/\s*,\s*/).filter(Boolean);
  switch (field.kind) {
    case "text":
    case "list":
      return { ...current, text: raw };
    case "tags": {
      const codes: string[] = [];
      const rest: string[] = [];
      for (const p of pieces) {
        const c = catalogCode(field, p);
        if (!c) rest.push(p);
        else if (!codes.includes(c)) codes.push(c);
      }
      return { ...current, codes: codes.length ? codes : null, text: rest.length ? rest.join(", ") : null };
    }
    case "codes": {
      const codes = pieces.map((p) => catalogCode(field, p));
      if (codes.some((c) => !c)) return null;
      return { ...current, codes: [...new Set(codes as string[])], text: null };
    }
    case "code": {
      const c = catalogCode(field, raw);
      return c ? { ...current, codes: [c], text: null } : null;
    }
    case "number": {
      let n: number | null = null;
      if (field.key === "taste.spicy") {
        const i = SPICY_LEVELS.findIndex((l) => squash(l.ko) === squash(raw) || squash(l.en) === squash(raw));
        if (i >= 0) n = i;
      }
      if (n === null) {
        const m = /-?\d+(?:\.\d+)?/.exec(raw);
        n = m ? Math.round(Number(m[0])) : null;
      }
      const [min, max] = field.range ?? [-Infinity, Infinity];
      if (n === null || !Number.isFinite(n) || n < min || n > max) return null;
      return { ...current, number: n };
    }
    case "date": {
      const d = dateIn(raw, current.date);
      return d ? { ...current, date: d.date } : null;
    }
    case "anniversary": {
      const d = dateIn(raw, current.date);
      return d && d.rest ? { ...current, label: clip(d.rest, 40), date: d.date } : null;
    }
    case "pet": {
      // "이름 · 종류 · 품종" / "이름 · 글": 이름이 있던 줄은 첫 조각이 이름
      const parts = raw.split(/\s*·\s*/).filter(Boolean);
      const hadName = !!(current.label ?? "").trim();
      const name = hadName && parts.length > 1 ? parts.shift()! : (current.label ?? "").trim();
      if (field.key !== "pets.pet") return parts.length ? { ...current, label: name || null, text: parts.join(", ") } : null;
      let kind: string | null = null;
      const breed: string[] = [];
      for (const p of parts) {
        const code: string | null = kind ? null : catalogCode(field, p);
        if (code) kind = code;
        else breed.push(p);
      }
      return { ...current, label: name || null, codes: kind ? [kind] : null, text: breed.length ? breed.join(", ") : null };
    }
  }
}
