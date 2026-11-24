import { diffDays, ymdKey, type YMD } from "./calendar";
import { METALS, MOVIE_GENRES, MUSIC_GENRES, NONE, NONE_LABEL, PATTERNS, SEASONS, STYLES, type CatalogItem } from "./catalog";
import { emptySection, type CardData, type CultureData, type FavoritesData, type Section } from "./card";
import type { Label, Locale } from "./locale";
import { josa } from "./i18n";
import { clip } from "./text";

// 오늘의 질문: 내가 등록해 둔 사람들 중 아직 답이 없는 칸을 한 번에 하나씩 묻는다("엄마는 어떤 향을 좋아해요?"). 답은 그 사람 기록의 한 칸에 바로 들어간다.

export interface QuestionOption {
  value: string;
  label: Label;
}

export interface DailyQuestion {
  id: "drinks" | "flowers" | "scent" | "giftCard" | "spicy" | "season" | "musicGenre" | "movieGenre" | "pattern" | "metal" | "style";
  prompt: Label;
  options: QuestionOption[];
}

/** 좋아하는 것들 질문: 답은 그 칸(배열)에 코드로 더한다. 음악·영화는 문화생활, 계절은 생활과 여행 칸으로 */
const FAVORITE_QUESTION_KEY = {
  pattern: "patterns",
  metal: "metals",
  style: "styles",
} as const satisfies Partial<Record<DailyQuestion["id"], keyof FavoritesData>>;
const CULTURE_QUESTION_KEY = {
  musicGenre: "musicGenres",
  movieGenre: "movieGenres",
} as const satisfies Partial<Record<DailyQuestion["id"], keyof CultureData>>;

/** 첫 칸 '없음'. 고르는 칸이면 코드(none), 글 칸이면 글자(없음)로 저장한다 */
const NONE_OPTION: QuestionOption = { value: NONE, label: NONE_LABEL };

/** 그 목록의 보기 전부(앞에 '없음') */
function fromCatalog(list: CatalogItem[]): QuestionOption[] {
  return [NONE_OPTION, ...list.map((i) => ({ value: i.code, label: i.label }))];
}

/** 글 칸 질문의 보기: 값은 한국어 글 그대로 저장한다 */
function texts(list: [string, string][]): QuestionOption[] {
  return [NONE_OPTION, ...list.map(([ko, en]) => ({ value: ko, label: { ko, en } }))];
}

// 보기는 많아도 된다: 홈 카드에서는 한 줄로 두고 옆으로 민다
export const QUESTIONS: DailyQuestion[] = [
  {
    id: "drinks",
    prompt: { ko: "요즘 제일 자주 마시는 건?", en: "What do you drink most these days?" },
    options: texts([
      ["아메리카노", "Americano"],
      ["라떼", "Latte"],
      ["믹스커피", "Instant coffee mix"],
      ["녹차", "Green tea"],
      ["보리차", "Barley tea"],
      ["유자차", "Citron tea"],
      ["허브티", "Herbal tea"],
      ["탄산수", "Sparkling water"],
      ["콜라·사이다", "Soda"],
      ["과일 주스", "Fruit juice"],
      ["우유", "Milk"],
      ["두유", "Soy milk"],
    ]),
  },
  {
    id: "flowers",
    prompt: { ko: "꽃을 받는다면?", en: "If someone gave you flowers?" },
    options: texts([
      ["장미", "Roses"],
      ["튤립", "Tulips"],
      ["수국", "Hydrangeas"],
      ["프리지아", "Freesias"],
      ["안개꽃", "Baby's breath"],
      ["해바라기", "Sunflowers"],
      ["카네이션", "Carnations"],
      ["작약", "Peonies"],
      ["백합", "Lilies"],
      ["라넌큘러스", "Ranunculus"],
      ["리시안셔스", "Lisianthus"],
      ["꽃보다 화분", "A potted plant"],
    ]),
  },
  {
    id: "scent",
    prompt: { ko: "좋아하는 향은?", en: "Which scent do you like?" },
    options: texts([
      ["우디", "Woody"],
      ["플로럴", "Floral"],
      ["시트러스", "Citrus"],
      ["머스크", "Musk"],
      ["비누 향", "Clean soap"],
      ["바닐라", "Vanilla"],
      ["허브", "Herbal"],
      ["바다 향", "Aquatic"],
      ["파우더리", "Powdery"],
      ["과일 향", "Fruity"],
      ["향 없는 게 좋아요", "Unscented"],
    ]),
  },
  {
    id: "giftCard",
    prompt: { ko: "선물로 상품권은 어때요?", en: "How do you feel about gift cards?" },
    options: [
      { value: "yes", label: { ko: "좋아요", en: "Love them" } },
      { value: "no", label: { ko: "별로예요", en: "Rather not" } },
    ],
  },
  {
    id: "spicy",
    prompt: { ko: "매운 음식은 어디까지?", en: "How spicy can you go?" },
    // 매운맛 0~4 다섯 단계 전부(가운데는 신라면 정도)
    options: [
      { value: "0", label: { ko: "못 먹어요", en: "None" } },
      { value: "1", label: { ko: "살짝만", en: "A little" } },
      { value: "2", label: { ko: "신라면 정도", en: "Medium" } },
      { value: "3", label: { ko: "매운 거 좋아요", en: "Hot" } },
      { value: "4", label: { ko: "아주 매워도", en: "Very hot" } },
    ],
  },
  { id: "season", prompt: { ko: "제일 좋아하는 계절은?", en: "Your favorite season?" }, options: fromCatalog(SEASONS) },
  { id: "musicGenre", prompt: { ko: "요즘 즐겨 듣는 음악은?", en: "What music are you into?" }, options: fromCatalog(MUSIC_GENRES) },
  { id: "movieGenre", prompt: { ko: "영화를 고른다면?", en: "Pick a movie genre" }, options: fromCatalog(MOVIE_GENRES) },
  { id: "pattern", prompt: { ko: "옷이나 소품, 어떤 무늬가 좋아요?", en: "Which pattern do you like?" }, options: fromCatalog(PATTERNS) },
  { id: "metal", prompt: { ko: "액세서리는 어떤 색?", en: "Jewelry: which metal?" }, options: fromCatalog(METALS) },
  { id: "style", prompt: { ko: "평소 옷 스타일은?", en: "Your everyday style?" }, options: fromCatalog(STYLES) },
];

/** 보기에 없는 답을 직접 적을 수 있는 질문과 그 답이 들어갈 글 칸(음악은 즐겨 듣는 노래, 영화는 인생 영화) */
const OWN_ANSWER = ["drinks", "flowers", "scent", "musicGenre", "movieGenre"] as const satisfies DailyQuestion["id"][];

export function canAnswerOwn(id: DailyQuestion["id"]): boolean {
  return (OWN_ANSWER as readonly string[]).includes(id);
}

/** 이미 답이 있는 질문 */
export function isAnswered(card: Partial<CardData>, id: DailyQuestion["id"]): boolean {
  switch (id) {
    case "drinks":
      return !!card.taste?.drinks;
    case "flowers":
      return !!card.favorites?.flowers;
    case "scent":
      return !!card.favorites?.scent;
    case "giftCard":
      return card.gifts?.giftCard != null;
    case "spicy":
      return card.taste?.spicy != null;
    case "season":
      return !!card.life?.seasons.length;
    case "musicGenre":
      return !!card.culture?.musicGenres?.length || !!card.culture?.song;
    case "movieGenre":
      return !!card.culture?.movieGenres?.length || !!card.culture?.movie;
    default:
      return !!card.favorites?.[FAVORITE_QUESTION_KEY[id]]?.length;
  }
}

/** 하루에 질문 카드를 띄우는 최대 횟수(답하기·건너뛰기·물어보기·그만 묻기로 처리한 만큼 센다) */
export const DAILY_QUESTION_LIMIT = 2;
/** 사람 화면을 이만큼의 서로 다른 날에 열었으면 '자주 보는 사람' */
export const CLOSE_VIEW_DAYS = 3;

/** 오늘 질문 카드를 몇 번 처리했나(기록된 날이 오늘이 아니면 0) */
export function questionsUsedToday(profile: { questionDay: string | null; questionCount: number }, today: YMD): number {
  return profile.questionDay === ymdKey(today) ? Math.max(0, profile.questionCount) : 0;
}

/** 오늘 더 띄울 수 있는 질문 수 */
export function questionsLeft(usedToday: number): number {
  return Math.max(0, DAILY_QUESTION_LIMIT - Math.max(0, Math.floor(usedToday) || 0));
}

/** 방금 더한 사람: 말로 적거나 물어보다가 저절로 생긴 사람은 폴더도 즐겨찾기도 없어, 처음 이만큼의 날 동안은 오늘의 질문에 올린다 */
export const RECENT_PERSON_DAYS = 14;

/** 더한 지 RECENT_PERSON_DAYS일이 안 된 사람인가(createdAt은 ISO 글, 모르면 아니다) */
export function isRecentlyAdded(createdAt: string | null | undefined, nowMs: number = Date.now()): boolean {
  const at = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(at) && nowMs - at >= 0 && nowMs - at < RECENT_PERSON_DAYS * 86_400_000;
}

/**
 * 오늘의 질문을 물어볼 만큼 가까운 사람인가: 가족 폴더에 있거나, 즐겨찾기거나, 사람 화면을 여러 날 열어 본 사람, 또는 방금(recent) 더한 사람.
 * '다시 묻지 않기'를 한 사람은 늘 아니다. 아무나(그냥 적어 둔 지 오래된 사람)에게는 묻지 않는다
 */
export function isCloseEnough(p: { askOff: boolean; favorite: boolean; closeFolder: boolean; viewDays: number; recent?: boolean }): boolean {
  if (p.askOff) return false;
  return p.closeFolder || p.favorite || p.viewDays >= CLOSE_VIEW_DAYS || p.recent === true;
}

/** 질문에 답이 들어갈 항목(물어보기로 그 항목만 물어볼 때) */
export const QUESTION_SECTION = {
  drinks: "taste",
  spicy: "taste",
  flowers: "favorites",
  scent: "favorites",
  pattern: "favorites",
  metal: "favorites",
  style: "favorites",
  giftCard: "gifts",
  season: "life",
  musicGenre: "culture",
  movieGenre: "culture",
} as const satisfies Record<DailyQuestion["id"], Section>;

/** 누구에 대한 어떤 질문인지 */
export interface PersonQuestion {
  contactId: string;
  question: DailyQuestion;
}

/**
 * 등록한 사람들 중 아직 답이 없는 (사람, 질문)을 하나 고른다. 사람 순서 → 질문 순서로 늘어놓고 날짜마다 한 칸씩 옮겨 가며,
 * skip(건너뛰기를 누른 횟수)만큼 더 옮긴다. 하나 답하면 그 쌍이 빠져 같은 자리에 다음 것이 온다. 사람이 없거나 모두 답했으면 null
 */
export function questionForPeople(today: YMD, people: { contactId: string; card: Partial<CardData> }[], skip = 0): PersonQuestion | null {
  const open = people.flatMap((p) => QUESTIONS.filter((q) => !isAnswered(p.card, q.id)).map((question) => ({ contactId: p.contactId, question })));
  if (!open.length) return null;
  // 남은 게 하나뿐인데 이미 하나 넘겼으면(skip>0) 같은 질문이 또 나오니 오늘은 그만 묻는다
  if (open.length === 1 && skip > 0) return null;
  const day = Math.abs(diffDays({ y: 2026, m: 1, d: 1 }, today));
  return open[(day + Math.max(0, Math.floor(skip) || 0)) % open.length] ?? null;
}

/** 그 사람에 대해 묻는 말(질문마다 사람 이름을 넣는다). 한국어는 이름에 받침이 있으면 '은/이' */
const ABOUT: Record<DailyQuestion["id"], { ko: (n: string) => string; en: (n: string) => string }> = {
  drinks: { ko: (n) => `${josa(n, "은")} 요즘 제일 자주 마시는 게 뭐예요?`, en: (n) => `What does ${n} drink most these days?` },
  flowers: { ko: (n) => `${n}에게 꽃을 준다면 어떤 꽃이 좋을까요?`, en: (n) => `Which flowers would ${n} like?` },
  scent: { ko: (n) => `${josa(n, "은")} 어떤 향을 좋아해요?`, en: (n) => `Which scent does ${n} like?` },
  giftCard: { ko: (n) => `${n}에게 상품권을 선물하면 좋아할까요?`, en: (n) => `Would ${n} like a gift card?` },
  spicy: { ko: (n) => `${josa(n, "은")} 매운 음식을 어디까지 먹어요?`, en: (n) => `How spicy can ${n} go?` },
  season: { ko: (n) => `${josa(n, "은")} 어떤 계절을 제일 좋아해요?`, en: (n) => `What's ${n}'s favorite season?` },
  musicGenre: { ko: (n) => `${josa(n, "은")} 요즘 어떤 음악을 즐겨 들어요?`, en: (n) => `What music is ${n} into?` },
  movieGenre: { ko: (n) => `${josa(n, "은")} 어떤 영화를 좋아해요?`, en: (n) => `Which movie genre does ${n} like?` },
  pattern: { ko: (n) => `${josa(n, "은")} 어떤 무늬를 좋아해요?`, en: (n) => `Which pattern does ${n} like?` },
  metal: { ko: (n) => `${josa(n, "은")} 액세서리는 어떤 색을 좋아해요?`, en: (n) => `Which metal does ${n} like in jewelry?` },
  style: { ko: (n) => `${n}의 평소 옷 스타일은 어때요?`, en: (n) => `What's ${n}'s everyday style?` },
};

export function aboutPrompt(id: DailyQuestion["id"], name: string, locale: Locale): string {
  return ABOUT[id][locale](clip(name.trim(), 20).trim() || (locale === "ko" ? "이 사람" : "this person"));
}

/** 답을 카드 칸에 넣은 결과(바뀐 항목만) */
export function applyAnswer(card: Partial<CardData>, id: DailyQuestion["id"], value: string, locale: Locale = "ko"): Partial<CardData> {
  const v = clip(value.trim(), 60).trim();
  const text = v === NONE ? NONE_LABEL[locale] : v;
  const add = (list: string[]) => (v === NONE ? [NONE] : list.includes(v) ? list.filter((x) => x !== NONE) : [...list.filter((x) => x !== NONE), v]);
  switch (id) {
    case "drinks":
      return { taste: { ...emptySection("taste"), ...card.taste, drinks: text } };
    case "spicy": {
      const n = Number(v);
      return { taste: { ...emptySection("taste"), ...card.taste, spicy: Number.isInteger(n) && n >= 0 && n <= 4 ? n : null } };
    }
    case "flowers":
    case "scent":
      return { favorites: { ...emptySection("favorites"), ...card.favorites, [id]: text } };
    case "giftCard": {
      const base = { ...emptySection("gifts"), ...card.gifts };
      return { gifts: { ...base, giftCard: v === "yes" ? "yes" : v === "no" ? "no" : null } };
    }
    case "season": {
      const base = { ...emptySection("life"), ...card.life };
      return { life: { ...base, seasons: add(base.seasons) } };
    }
    case "musicGenre":
    case "movieGenre": {
      const key = CULTURE_QUESTION_KEY[id];
      const base = { ...emptySection("culture"), ...card.culture };
      // 보기에 없는 말(직접 적은 답)은 글 칸으로: 음악은 즐겨 듣는 노래, 영화는 인생 영화
      const known = v === NONE || (id === "musicGenre" ? MUSIC_GENRES : MOVIE_GENRES).some((c) => c.code === v);
      if (!known) return { culture: { ...base, [id === "musicGenre" ? "song" : "movie"]: v } };
      return { culture: { ...base, [key]: add(base[key] ?? []) } };
    }
    default: {
      const key = FAVORITE_QUESTION_KEY[id];
      const base = { ...emptySection("favorites"), ...card.favorites };
      return { favorites: { ...base, [key]: add(base[key] ?? []) } };
    }
  }
}
