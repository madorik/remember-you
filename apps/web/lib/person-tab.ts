// 사람 화면 바인더가 처음 여는 칸. 주소의 ?tab=이 있으면 그것이 먼저이고, 없으면 기본은 메모장이다.
// 다만 기록은 풍부한데 메모가 거의 없는 사람(예: 물어보기 답이나 직접 적은 항목으로만 채운 사람)은 빈 메모장보다 '기억해 둔 것'이 먼저 보여야 해서 그쪽을 연다.

export type BookTab = "memo" | "remembered";

/** 주소의 tab 값(둘 중 하나일 때만, 아니면 null = 정하지 않음) */
export function parseBookTab(raw: string | null | undefined): BookTab | null {
  return raw === "memo" || raw === "remembered" ? raw : null;
}

/**
 * 주소가 정하지 않았을 때의 기본 칸. 메모가 하나도 없고 적어 둔 항목이 하나라도 있으면, 또는 메모가 둘 이하인데 적어 둔 항목이 셋 이상이면 기억해 둔 것, 그 밖에는 메모장.
 * filled는 사람 화면 '기억해 둔 것'에 보이는 항목 수(생일·기념일 항목도 한 항목)
 */
export function defaultBookTab(noteCount: number, filledCount: number): BookTab {
  if (noteCount === 0 && filledCount >= 1) return "remembered";
  if (noteCount <= 2 && filledCount >= 3) return "remembered";
  return "memo";
}
