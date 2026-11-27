import { SECTIONS_BY_IMPORTANCE, type PartialCard, type Section } from "./card";
import { QUESTIONS, QUESTION_SECTION, isAnswered } from "./questions";

// 기억해 둔 것 작성률(사람 화면 프로필 카드의 막대).
// 분모는 오늘의 질문이 묻는 칸 전부(QUESTIONS)이고, 그 칸에 답이 있는지는 오늘의 질문과 같은 isAnswered로 본다.
// 그래서 질문에 답해도, 메모를 AI가 정리해 그 칸이 채워져도 오른다. '없음'(없어요·못 먹어요·별로예요 …)도 답이라 채운 칸으로 센다.
// 오늘의 질문에는 알레르기·사이즈·반려동물·생일 칸이 없어서(묻는 칸은 입맛·선물·취향·문화생활·생활과 여행 다섯 항목) 그 항목들은 작성률에 넣지 않는다.

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
  const total = QUESTIONS.length;
  const open = QUESTIONS.filter((q) => !isAnswered(card, q.id));
  const filled = total - open.length;
  const left = new Set<Section>(open.map((q) => QUESTION_SECTION[q.id]));
  return {
    pct: Math.min(open.length ? 99 : 100, Math.round((filled / total) * 100)),
    filled,
    total,
    missing: SECTIONS_BY_IMPORTANCE.filter((s) => left.has(s)),
  };
}
