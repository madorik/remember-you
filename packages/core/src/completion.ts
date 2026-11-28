import { SECTIONS_BY_IMPORTANCE, isEmptySection, type PartialCard, type Section } from "./card";
import { QUESTIONS, QUESTION_SECTION, isAnswered } from "./questions";

// 기억해 둔 것 작성률(사람 화면 프로필 카드의 막대).
// 분모는 두 갈래다: ① 오늘의 질문이 묻는 칸 전부(QUESTIONS, 답이 있는지는 오늘의 질문과 같은 isAnswered) ② 질문이 묻지 않는 항목 넷(생일·알레르기와 못 먹는 것·사이즈·반려동물, 항목당 한 칸).
// 그래서 질문에 답해도, 직접 적어도, 메모를 AI가 정리해 그 칸이 채워져도 오른다(사람 화면 '기억해 둔 것'에 보이는 것과 막대가 어긋나지 않게).
// '없음'(없어요·못 먹어요·별로예요·키우지 않아요 …)도 답이라 채운 칸으로 센다: 알레르기·못 먹는 것은 코드 none, 반려동물은 none 표시.
// ② 생일은 생일을 알 때만(기념일만 있으면 아직 빈 칸), 사이즈는 윗옷·아래옷·신발·반지 중 하나라도 있으면 채운 칸이다.

/** 오늘의 질문이 묻지 않는 항목의 한 칸: 이 항목이 채워졌나 */
const EXTRA_SLOTS: { section: Section; filled: (card: PartialCard) => boolean }[] = [
  { section: "dates", filled: (card) => !!card.dates?.birthday },
  { section: "safety", filled: (card) => !isEmptySection("safety", card.safety) },
  { section: "sizes", filled: (card) => !isEmptySection("sizes", card.sizes) },
  { section: "pets", filled: (card) => !isEmptySection("pets", card.pets) },
];

export interface RecordCompletion {
  /** 0~100 정수(반올림). 빈 칸이 하나라도 남았으면 100이 되지 않는다 */
  pct: number;
  /** 채운 칸 수 · 전체 칸 수 */
  filled: number;
  total: number;
  /** 아직 빈 칸이 남은 항목(SECTIONS_BY_IMPORTANCE 순서) */
  missing: Section[];
}

export function recordCompletion(card: PartialCard): RecordCompletion {
  const open = QUESTIONS.filter((q) => !isAnswered(card, q.id));
  const openExtra = EXTRA_SLOTS.filter((x) => !x.filled(card));
  const total = QUESTIONS.length + EXTRA_SLOTS.length;
  const left = open.length + openExtra.length;
  const filled = total - left;
  const missing = new Set<Section>([...open.map((q) => QUESTION_SECTION[q.id]), ...openExtra.map((x) => x.section)]);
  return {
    pct: Math.min(left ? 99 : 100, Math.round((filled / total) * 100)),
    filled,
    total,
    missing: SECTIONS_BY_IMPORTANCE.filter((s) => missing.has(s)),
  };
}
