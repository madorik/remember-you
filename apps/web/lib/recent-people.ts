import { recentlyViewed } from "@readme/core";

// 사람들 화면의 '최근 본 사람' 줄(순수 계산이라 서버 전용 모듈을 들이지 않는다)

/** '최근 본 사람' 칸 수 */
export const RECENT_MAX = 6;
/** 사람 화면을 연 적 있는 사람이 이만큼은 돼야 줄을 보인다 */
export const RECENT_MIN = 2;

/** 최근 본 사람의 contactId(늦게 연 날 → 연 날 수 → 받은 순서, mostRecentlyViewed와 같은 순서). 연 적 있는 사람이 RECENT_MIN명 미만이면 [] */
export function recentIds(people: readonly { contactId: string; viewedOn: string | null; viewDays: number }[]): string[] {
  if (people.filter((p) => p.viewedOn).length < RECENT_MIN) return [];
  return recentlyViewed(people, RECENT_MAX).map((p) => p.contactId);
}
