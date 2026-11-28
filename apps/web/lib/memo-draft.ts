// 메모 쓰기 초안: 쓰던 글을 닫았다 열어도(다른 앱을 보다 웹뷰가 닫히거나 화면을 벗어나도) 이어 쓰게 이 탭의 저장소(sessionStorage)에만 둔다.
// 서버·localStorage에는 두지 않는다. 쓸 수 없으면 건너뛴다(이어 쓰기만 안 된다)
import { NEW_PEOPLE_MAX, tidyName } from "./capture-target";
import type { MentionTag } from "./mention";

const PREFIX = "rm_memo_draft:";

/** 저장소가 하는 일(sessionStorage와 같은 모양, 시험에서는 가짜로 갈아 끼운다) */
export interface DraftStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MemoDraft {
  text: string;
  tags: MentionTag[];
  /** 칩의 ×로 일부러 뺀 사람의 열쇠(본문에 @이름이 남아 있어도 저장할 때 다시 넣지 않는다) */
  dropped: string[];
}

/**
 * 초안을 가르는 열쇠: 온보딩의 첫 메모 / 사람 화면에서 온(?to=) 그 사람 / 그냥 연 메모.
 * 서로의 초안을 가져오지 않는다(온보딩 ↔ 일반, 사람 A ↔ 사람 B)
 */
export function draftKey(ctx: { onboarding: boolean; to: string | null }): string {
  return PREFIX + (ctx.onboarding ? "onboarding" : ctx.to ? `to:${ctx.to}` : "free");
}

/** 저장소에 넣을 글. 본문이 비었으면 null(= 초안을 지운다) */
export function serializeDraft(d: MemoDraft): string | null {
  if (!d.text.trim()) return null;
  return JSON.stringify({ text: d.text, tags: d.tags, dropped: d.dropped } satisfies MemoDraft);
}

/** 저장소 글 풀기: 깨졌거나 본문이 비면 null. 글은 max자, 칩은 모양이 맞는 것만(새 사람은 이름을 다듬고 NEW_PEOPLE_MAX명까지) */
export function parseDraft(raw: string | null, max: number): MemoDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<MemoDraft> | null;
    if (!d || typeof d.text !== "string" || !d.text.trim()) return null;
    const tags: MentionTag[] = [];
    let fresh = 0;
    for (const t of Array.isArray(d.tags) ? (d.tags as unknown[]) : []) {
      const x = t as Partial<{ kind: string; id: unknown; name: unknown }> | null;
      if (x?.kind === "person" && typeof x.id === "string" && x.id) tags.push({ kind: "person", id: x.id });
      else if (x?.kind === "new" && typeof x.name === "string" && tidyName(x.name) && fresh < NEW_PEOPLE_MAX) {
        tags.push({ kind: "new", name: tidyName(x.name) });
        fresh += 1;
      }
    }
    const dropped = Array.isArray(d.dropped) ? (d.dropped as unknown[]).filter((k): k is string => typeof k === "string") : [];
    return { text: d.text.slice(0, max), tags, dropped };
  } catch {
    return null;
  }
}

/** 이 탭의 초안 읽기(없거나 못 읽으면 null) */
export function readDraft(store: DraftStore | null, key: string, max: number): MemoDraft | null {
  try {
    return parseDraft(store?.getItem(key) ?? null, max);
  } catch {
    return null;
  }
}

/** 초안 남기기: 본문이 비었으면 지운다. 저장소를 못 쓰면 건너뛴다 */
export function writeDraft(store: DraftStore | null, key: string, d: MemoDraft): void {
  try {
    const raw = serializeDraft(d);
    if (raw == null) store?.removeItem(key);
    else store?.setItem(key, raw);
  } catch {
    /* 저장소를 못 쓰면 이어 쓰기만 안 된다 */
  }
}

/** 초안 지우기(저장에 성공했을 때) */
export function clearDraft(store: DraftStore | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    /* 저장소를 못 쓰면 건너뛴다 */
  }
}

/** 모든 메모 초안 지우기(로그아웃: 같은 탭에서 다음에 들어온 사람에게 남의 글이 보이지 않게) */
export function clearAllDrafts(store: DraftStore | null): void {
  try {
    if (!store) return;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) store.removeItem(k);
  } catch {
    /* 저장소를 못 쓰면 건너뛴다 */
  }
}

/** 이 탭의 sessionStorage(못 쓰는 곳이면 null) */
export function tabStore(): DraftStore | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}
