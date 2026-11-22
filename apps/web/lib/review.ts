// 스토어 리뷰 창을 언제 띄울지(기기에 적어 둔 값으로만 판단, 서버 전용 아님).
// 아이폰·안드로이드 모두 OS가 창을 띄울지 말지를 스스로 정하고 앱에는 알려 주지 않는다(iOS는 해마다 3번까지).
// 그래서 우리가 먼저 며칠 써 본 사람에게만, 뜸하게, 몇 번까지만 부른다.

const DAY = 24 * 3600_000;

/** 앱을 연 날이 이만큼은 돼야 한다(첫날 바로 묻지 않는다) */
export const MIN_DAYS = 3;
/** 한 번 띄운 뒤 다시 부르기까지 */
export const GAP_MS = 90 * DAY;
/** 한 기기에서 평생 부르는 횟수(iOS가 1년에 3번만 보여 주니 그 안에서) */
export const MAX_ASKS = 3;
/** 날짜는 최근 것만 적어 둔다(MIN_DAYS만 넘으면 된다) */
const KEEP_DAYS = 10;

export interface ReviewState {
  /** 앱을 연 날(기기 날짜 YYYY-MM-DD) */
  days: string[];
  /** 리뷰 창을 띄운 시각(ms) */
  asked: number[];
}

export const EMPTY_REVIEW: ReviewState = { days: [], asked: [] };

/** 저장된 글자를 상태로(깨졌거나 없으면 빈 상태) */
export function parseReview(raw: string | null): ReviewState {
  if (!raw) return EMPTY_REVIEW;
  try {
    const v = JSON.parse(raw) as Partial<ReviewState> | null;
    const days = Array.isArray(v?.days) ? v.days.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
    const asked = Array.isArray(v?.asked) ? v.asked.filter((n): n is number => typeof n === "number" && Number.isFinite(n)) : [];
    return { days: days.slice(-KEEP_DAYS), asked: asked.slice(-MAX_ASKS) };
  } catch {
    return EMPTY_REVIEW;
  }
}

/** 오늘 앱을 연 것으로 적는다(같은 날은 한 번만) */
export function noteDay(s: ReviewState, ymd: string): ReviewState {
  if (s.days.includes(ymd)) return s;
  return { ...s, days: [...s.days, ymd].slice(-KEEP_DAYS) };
}

/** 리뷰 창을 띄웠다고 적는다 */
export function noteAsked(s: ReviewState, now: number): ReviewState {
  return { ...s, asked: [...s.asked, now].slice(-MAX_ASKS) };
}

/** 지금 리뷰를 부탁해도 되는지(며칠 써 봤고, 최근에 부탁하지 않았고, 횟수가 남았을 때) */
export function reviewDue(s: ReviewState, now: number): boolean {
  if (s.days.length < MIN_DAYS) return false;
  if (s.asked.length >= MAX_ASKS) return false;
  const last = s.asked[s.asked.length - 1];
  return last === undefined || now - last >= GAP_MS;
}

/** '기록을 저장했다'는 표시가 이만큼 지나면 잊는다(저장하고 한참 뒤 홈에서 갑자기 묻지 않게) */
export const SAVED_FRESH_MS = 2 * 60_000;

export function savedFresh(at: number, now: number): boolean {
  return Number.isFinite(at) && now - at >= 0 && now - at <= SAVED_FRESH_MS;
}
