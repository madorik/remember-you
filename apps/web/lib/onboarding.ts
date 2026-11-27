import "server-only";
import type { Q } from "./db";

/** 브라우저가 알려 준 시간대가 쓸 수 있는 이름이면 그것, 아니면 Asia/Seoul */
export function validTimeZone(v: unknown): string {
  const tz = String(v ?? "");
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz.slice(0, 64) || "Asia/Seoul";
  } catch {
    return "Asia/Seoul";
  }
}

/**
 * 온보딩을 마친다(첫 메모를 저장했거나 건너뛰었다): 처음 마친 때만 기록하고(onboarded_at), 시간대는 그 사람 기기 것으로(빈 값이면 그대로).
 * 알림 시점(reminder_offsets)은 건드리지 않는다: 가입할 때의 기본값(생일 일주일 전·당일)이 그대로다
 */
export async function markOnboarded(q: Q, userId: string, tz: unknown): Promise<void> {
  const zone = tz ? validTimeZone(tz) : null;
  await q("update profiles set onboarded_at = coalesce(onboarded_at, now()), time_zone = coalesce($2, time_zone) where id = $1", [userId, zone]);
}
