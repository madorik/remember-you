import type { DailyQuestion, Label } from "@readme/core";

/** 오늘의 질문이 무엇에 대한 것인지 짧게('좋아하는 음악'): 오늘 한 질문 목록(체크 목록)에서 이름 옆에 적는다. 서버·화면 어디서나 쓴다 */
export const QUESTION_TOPIC: Record<DailyQuestion["id"], Label> = {
  drinks: { ko: "요즘 마시는 것", en: "Drinks lately" },
  flowers: { ko: "좋아하는 꽃", en: "Favorite flowers" },
  scent: { ko: "좋아하는 향", en: "Favorite scent" },
  giftCard: { ko: "상품권", en: "Gift cards" },
  spicy: { ko: "매운맛", en: "Spice level" },
  season: { ko: "좋아하는 계절", en: "Favorite season" },
  musicGenre: { ko: "좋아하는 음악", en: "Favorite music" },
  movieGenre: { ko: "좋아하는 영화", en: "Favorite movies" },
  pattern: { ko: "좋아하는 무늬", en: "Favorite pattern" },
  metal: { ko: "액세서리 색", en: "Jewelry metal" },
  style: { ko: "옷 스타일", en: "Everyday style" },
};

export interface QuestionLogEntry {
  /** 사람(contactId) */
  c: string;
  /** 질문 id */
  q: string;
  /** a 답함 · w 그 사람에게 물어봄(답장 기다리는 중) · k 건너뜀 · m 더 묻지 않음 */
  o: "a" | "w" | "k" | "m";
  /** 답한 말(a일 때) */
  v?: string;
}
