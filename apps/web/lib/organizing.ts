// 메모 저장은 이제 화면이 정리(organizeSaved)를 끝까지 기다리고 카드로 과정을 보이므로(app/(app)/voice/SaveCard.tsx) 이 표시를 남기지 않는다.
// 이 표시가 남는 곳은 메모 글을 고치는 길(updateNote → 응답 뒤(after)에 organizeNote)뿐이다: 그 화면은 정리가 끝나도 저절로 바뀌지 않아("기억해 둔 것"이 새로 고쳐야만 보였다),
// 고칠 때 표시를 남겨 두면 그 사람 화면이 정리가 끝날 즈음 스스로 다시 받아 오고 새로 더해진 것을 알린다.
// 표시는 브라우저 탭 저장소(sessionStorage)에 두고, 쓸 수 없으면 그냥 건너뛴다(새로 고치면 보인다)

import { translate, type EffectLine, type Locale } from "@readme/core";

export const ORGANIZING_KEY = "rm_organizing";

/** 저장한 때부터 몇 ms 뒤에 화면을 다시 받아 올까(보통 정리는 2~8초). 마지막 것이 지나면 표시는 효력이 없다 */
export const REFRESH_AFTER_MS = [3500, 8000, 16000] as const;

/**
 * 메모 글을 고쳐 다시 정리하는 표시(새 메모를 저장한 표시와 달리 어느 메모인지 안다): note 고친 메모 id · base 그때 그 메모에 남아 있던 '더한 것'(저장된 일)의 수 ·
 * seen 그때 이미 보이던 '더해진 것' 줄(lineKey). 다시 정리해 새로 생긴 줄만 알리고, 되돌리기는 base 뒤의 일(새로 붙은 것)만 되돌린다
 */
export interface EditMark {
  note: string;
  base: number;
  seen: string[];
}

interface Mark {
  ids: string[];
  at: number;
  edit?: EditMark;
}

/** 다시 받아 오기 표시를 알리는 창 이벤트: 이미 열려 있는 사람 화면(OrganizeRefresh)이 표시를 다시 읽고 새로 받기를 시작한다 */
export const ORGANIZING_EVENT = "rm-organizing";

/** 메모를 고친 직후: 이 사람 화면을 곧 다시 받아 오게 표시한다(고친 메모 edit도 남긴다). 이미 열려 있는 화면이 바로 알아채게 이벤트도 보낸다 */
export function markOrganizing(ids: string[], now = Date.now(), edit?: EditMark): void {
  try {
    sessionStorage.setItem(ORGANIZING_KEY, JSON.stringify({ ids, at: now, ...(edit ? { edit } : {}) } satisfies Mark));
    window.dispatchEvent(new Event(ORGANIZING_EVENT));
  } catch {
    /* 저장소를 못 쓰면 표시 없이 */
  }
}

/** 표시 풀기: 이 사람이 들어 있고 아직 효력이 있으면 저장한 때(ms)와 고친 메모 표시, 아니면 null */
function readMark(raw: string | null, contactId: string, now: number): { at: number; edit: EditMark | null } | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Partial<Mark> | null;
    if (!m || typeof m.at !== "number" || !Array.isArray(m.ids) || !m.ids.includes(contactId)) return null;
    if (now - m.at >= REFRESH_AFTER_MS[REFRESH_AFTER_MS.length - 1]!) return null;
    const e = m.edit as Partial<EditMark> | undefined;
    const edit = e && typeof e.note === "string" && Number.isInteger(e.base) && e.base! >= 0 && Array.isArray(e.seen) ? { note: e.note, base: e.base!, seen: e.seen.filter((x): x is string => typeof x === "string").slice(0, 40) } : null;
    return { at: m.at, edit };
  } catch {
    return null;
  }
}

/** 표시 풀기: 이 사람이 들어 있고 아직 효력이 있으면 저장한 때(ms), 아니면 null */
export function parseOrganizing(raw: string | null, contactId: string, now = Date.now()): number | null {
  return readMark(raw, contactId, now)?.at ?? null;
}

/** 저장한 때(at)부터 지금(now)까지 아직 안 지난 새로 받기들의 남은 시간(ms) */
export function refreshDelays(at: number, now: number): number[] {
  return REFRESH_AFTER_MS.map((d) => at + d - now).filter((d) => d > 0);
}

// ── 정리가 끝났다는 알림(토스트) ─────────────────────────────
// 저장 뒤 새로 받은 화면에서 '방금 저장한 메모'에 AI가 더한 것이 보이면 한 번만 알린다(되돌리기 포함). 어느 메모가 방금 저장한 것인지는 저장 표시(at)와 메모의 적은 때로 가린다.

/** 마지막 새로 받기(16초) 응답이 늦게 와도 알림이 뜰 수 있게 주는 여유 */
export const TOAST_GRACE_MS = 12_000;
/** 서버 시계(메모를 적은 때)와 기기 시계(저장 표시)가 어긋나도 방금 저장한 메모로 보는 폭 */
export const CLOCK_SKEW_MS = 30_000;
/** 이미 알린 메모 id를 두는 탭 저장소 칸 */
export const TOASTED_KEY = "rm_organize_toasted";
const TOASTED_MAX = 40;

/** 알림용 표시 풀기: parseOrganizing과 같지만 마지막 새로 받기 뒤로도 TOAST_GRACE_MS 동안 효력이 있다 */
export function organizedAt(raw: string | null, contactId: string, now = Date.now()): number | null {
  return organizedMark(raw, contactId, now)?.at ?? null;
}

/** organizedAt에 고친 메모 표시(edit)까지: 메모 고치기 뒤의 표시면 edit이 있다 */
export function organizedMark(raw: string | null, contactId: string, now = Date.now()): { at: number; edit: EditMark | null } | null {
  return readMark(raw, contactId, now - TOAST_GRACE_MS);
}

/** '더해진 것' 한 줄의 비교용 글(칸·값·전 값이 같으면 같은 줄) */
export function lineKey(l: EffectLine): string {
  return [l.section, l.label, l.value, l.prev ?? ""].join("|");
}

/** 고친 메모를 다시 정리해 새로 생긴 줄: 그 메모의 지금 '더해진 것' 중 고칠 때 이미 보이던 줄(seen)이 아닌 것 */
export function newEditLines(notes: readonly { id: string; adds: readonly EffectLine[] }[], edit: EditMark): EffectLine[] {
  const note = notes.find((n) => n.id === edit.note);
  return note ? note.adds.filter((l) => !edit.seen.includes(lineKey(l))) : [];
}

/** 고친 메모 알림을 한 번만 띄우려고 탭 저장소에 적는 이름(고칠 때마다 다르다) */
export const editToastKey = (edit: EditMark, at: number): string => `${edit.note}@${at}`;

export interface EffectNote {
  id: string;
  /** 메모를 적은 때(ISO) */
  createdAt: string;
  /** 이 메모가 지금 사람 기록에 더해 둔 것(되돌려질 것)의 줄 수 */
  count: number;
}

/** 알릴 메모 하나: 저장 표시(at) 즈음에 적은, 더한 것이 있는, 아직 알리지 않은 메모 중 가장 새 것(없으면 null) */
export function pickEffectNote(notes: readonly EffectNote[], at: number, seen: readonly string[]): EffectNote | null {
  let best: EffectNote | null = null;
  let bestAt = -Infinity;
  for (const n of notes) {
    const made = new Date(n.createdAt).getTime();
    if (n.count <= 0 || !Number.isFinite(made) || made < at - CLOCK_SKEW_MS || seen.includes(n.id)) continue;
    if (made > bestAt) {
      best = n;
      bestAt = made;
    }
  }
  return best;
}

/** 탭 저장소에서 읽은 '이미 알린 메모 id들'(깨졌으면 빈 목록) */
export function parseToasted(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-TOASTED_MAX) : [];
  } catch {
    return [];
  }
}

/** 알린 메모 id를 더한 저장 값(오래된 것부터 한도까지만 둔다) */
export function addToasted(raw: string | null, id: string): string {
  const list = parseToasted(raw).filter((x) => x !== id);
  return JSON.stringify([...list, id].slice(-TOASTED_MAX));
}

/**
 * 알림 한 줄: 첫 줄만 말하고 나머지는 "외 n개". "좋아하는 음식에 마라탕 넣었어요", 바꾼 것은 "신발(mm)에 240 대신 245 넣었어요".
 * 칸 이름·값에 조사를 붙이지 않는 말투라 어떤 값이 와도 어색하지 않다. 줄이 없으면 빈 글
 */
export function effectToastText(lines: readonly EffectLine[], locale: Locale): string {
  const first = lines[0];
  if (!first) return "";
  const text = translate(locale, first.prev ? "memo.fx.change" : "memo.fx.add", { label: first.label, value: first.value, prev: first.prev ?? "" });
  return lines.length > 1 ? translate(locale, "memo.fx.more", { text, n: lines.length - 1 }) : text;
}
