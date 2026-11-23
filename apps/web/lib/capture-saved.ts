// 말로·글로 적기를 저장한 뒤 다음 화면에 알릴 것: 한 사람 이야기뿐이면 그 사람 화면(바로 되돌리기), 여러 사람이면 홈(누구에게 무엇을 적었는지 토스트).
// 저장 결과(줄·되돌리기 정보)를 화면 이동 사이에 sessionStorage로 넘긴다. 서버 전용 모듈을 들이지 않는다(화면이 쓴다)
import type { CaptureLine, UndoOp } from "@/app/actions/capture";

const KEY = "rm_capture_saved";
/** 이만큼 지난 표시는 버린다(옛 저장이 나중에 엉뚱하게 뜨지 않게) */
const FRESH_MS = 2 * 60_000;

export interface SavedNote {
  /** 한 사람 화면으로 가는 저장이면 그 사람(contactId), 여러 사람이면 null(홈) */
  contactId: string | null;
  /** 이번에 새로 만든 사람의 이름(없으면 null) */
  created: string | null;
  lines: CaptureLine[];
  undo: UndoOp[];
  at: number;
}

export type AfterSave =
  | { kind: "none" }
  | { kind: "person"; id: string; created: string | null }
  /** 여러 사람(나 포함): 사람마다 몇 줄 적었나 */
  | { kind: "many"; who: { name: string; n: number }[] };

const PERSON_HREF = /^\/people\/([0-9a-f-]{36})$/i;

/** 저장한 줄들이 한 사람 것뿐이면 그 사람, 아니면 여러 사람(이미 알던 줄은 적은 게 아니니 세지 않는다) */
export function planAfterSave(lines: readonly CaptureLine[]): AfterSave {
  const written = lines.filter((l) => !l.same && l.href);
  if (!written.length) return { kind: "none" };
  const hrefs = new Set(written.map((l) => l.href));
  const only = hrefs.size === 1 ? PERSON_HREF.exec([...hrefs][0]!)?.[1] : undefined;
  if (only) return { kind: "person", id: only, created: written.find((l) => l.isNew)?.who ?? null };
  const count = new Map<string, { name: string; n: number }>();
  for (const l of written) {
    const cur = count.get(l.href);
    if (cur) cur.n++;
    else count.set(l.href, { name: l.who, n: 1 });
  }
  return { kind: "many", who: [...count.values()] };
}

/** 다음 화면이 읽도록 남긴다 */
export function stashSaved(note: Omit<SavedNote, "at">): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...note, at: Date.now() } satisfies SavedNote));
  } catch {
    /* 저장소를 못 쓰면 알림 없이 넘어간다 */
  }
}

/** 이 화면(contactId, 홈이면 null)을 위해 남긴 것이 있으면 꺼낸다(한 번만 읽힌다) */
export function takeSaved(contactId: string | null): SavedNote | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const n = JSON.parse(raw) as Partial<SavedNote> | null;
    const fresh = !!n && typeof n.at === "number" && Date.now() - n.at < FRESH_MS && Array.isArray(n.lines) && Array.isArray(n.undo);
    if (!fresh) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    if ((n.contactId ?? null) !== contactId) return null;
    sessionStorage.removeItem(KEY);
    return n as SavedNote;
  } catch {
    return null;
  }
}
