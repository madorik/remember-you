// 메모를 저장하면 AI가 그 글을 사람의 항목으로 정리하는 일은 응답을 보낸 뒤(after)에 돈다. 그래서 저장하고 곧바로 연 사람 화면은 정리 전의 모습이고,
// 정리가 끝나도 그 화면은 저절로 바뀌지 않는다("기억해 둔 것"이 새로 고쳐야만 보였다). 저장할 때 표시를 남겨 두면 그 사람 화면이 정리가 끝날 즈음 스스로 다시 받아 온다.
// 표시는 브라우저 탭 저장소(sessionStorage)에 두고, 쓸 수 없으면 그냥 건너뛴다(새로 고치면 보인다)

export const ORGANIZING_KEY = "rm_organizing";

/** 저장한 때부터 몇 ms 뒤에 화면을 다시 받아 올까(보통 정리는 2~8초). 마지막 것이 지나면 표시는 효력이 없다 */
export const REFRESH_AFTER_MS = [3500, 8000, 16000] as const;

interface Mark {
  ids: string[];
  at: number;
}

/** 저장 직후: 이 사람들 화면을 곧 다시 받아 오게 표시한다 */
export function markOrganizing(ids: string[], now = Date.now()): void {
  try {
    sessionStorage.setItem(ORGANIZING_KEY, JSON.stringify({ ids, at: now } satisfies Mark));
  } catch {
    /* 저장소를 못 쓰면 표시 없이 */
  }
}

/** 표시 풀기: 이 사람이 들어 있고 아직 효력이 있으면 저장한 때(ms), 아니면 null */
export function parseOrganizing(raw: string | null, contactId: string, now = Date.now()): number | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Partial<Mark> | null;
    if (!m || typeof m.at !== "number" || !Array.isArray(m.ids) || !m.ids.includes(contactId)) return null;
    return now - m.at < REFRESH_AFTER_MS[REFRESH_AFTER_MS.length - 1] ? m.at : null;
  } catch {
    return null;
  }
}

/** 저장한 때(at)부터 지금(now)까지 아직 안 지난 새로 받기들의 남은 시간(ms) */
export function refreshDelays(at: number, now: number): number[] {
  return REFRESH_AFTER_MS.map((d) => at + d - now).filter((d) => d > 0);
}
