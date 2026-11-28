// 메모 쓰기 화면의 '복사한 글 붙여 넣기' 알약: 언제 보일지·클립보드 읽은 값을 어떻게 볼지(순수 판단)
// 클립보드 글은 이 화면의 본문 칸에만 들어간다(서버로 보내거나 로그에 남기지 않는다)

/** 나갔다 돌아온 사이가 이 안이어야 알약을 보인다 */
export const PASTE_RETURN_WINDOW_MS = 10 * 60_000;
/** 알약을 보인 채로 두는 시간(안 쓰면 사라진다) */
export const PASTE_SHOW_MS = 2 * 60_000;

/**
 * 돌아왔을 때 알약을 보일까.
 * - leftAt: 이 화면을 떠난 때(없으면 떠난 적이 없다), hopAt: '메모 앱에서'로 메모 앱을 연 때(없으면 null)
 * - probe: 앱 안쪽에서 클립보드에 새로 복사한 글이 있나 읽지 않고 본 결과(probeVerdict, true/false). 볼 수 없으면(웹·예전 앱 빌드) null
 * 볼 수 있으면 새 글이 있을 때만, 볼 수 없으면 메모 앱을 열고 나간 뒤 돌아왔을 때만(탭만 바꿨다 온 것에는 보이지 않는다)
 */
export function offerPaste(o: { leftAt: number | null; hopAt: number | null; now: number; probe: boolean | null }): boolean {
  const { leftAt, hopAt, now, probe } = o;
  if (leftAt == null || now < leftAt || now - leftAt > PASTE_RETURN_WINDOW_MS) return false;
  if (probe !== null) return probe;
  return hopAt != null && now >= hopAt && now - hopAt <= PASTE_RETURN_WINDOW_MS;
}

/**
 * 앱 안쪽이 클립보드를 읽지 않고 본 결과. stamp는 클립보드가 바뀔 때마다 달라지는 값(안드로이드는 담긴 때, iOS는 changeCount; 모르면 0)
 */
export interface ClipboardProbe {
  has: boolean;
  stamp: number;
}

/**
 * 본 결과를 offerPaste의 probe로: 글이 있고 '새로 복사한 것'일 때만 true.
 * seen은 이미 알약으로 권했거나 이 화면을 열 때 이미 있던 클립보드의 stamp(같은 글을 다시 권하지 않는다). stamp를 모르면(0 이하) 늘 새것으로 본다. 볼 수 없으면 null
 */
export function probeVerdict(p: ClipboardProbe | null, seen: number | null): boolean | null {
  if (!p) return null;
  if (!p.has) return false;
  return p.stamp <= 0 || p.stamp !== seen;
}

/** 클립보드를 읽은 결과: 글 / 비어 있음 / 못 읽음(권한·지원 없음) */
export type ClipboardRead = { status: "ok"; text: string } | { status: "empty" } | { status: "failed" };

/** 읽은 값을 결과로: 글이 아닌 값이나 공백뿐이면 비어 있음(글 자체는 손대지 않고 붙일 때 appendBlock이 다듬는다) */
export function classifyClipboard(raw: unknown): ClipboardRead {
  if (typeof raw !== "string" || !raw.trim()) return { status: "empty" };
  return { status: "ok", text: raw };
}
