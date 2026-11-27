// 메모가 사람 기록에 더한 것의 기록과 되돌리기. AI가 메모를 정리할 때 '이 메모로 실제로 바뀐 것'을 항목 단위로 남겨 두고(recordEffect),
// 메모를 지울 때 같이 지우기를 고르면 그것만 되돌린다(revertEffects). 순수 함수라 서버·화면·시험이 같이 쓴다.
import { NONE } from "./catalog";
import { emptySection, sanitizeSection, type Anniversary, type CardData, type PartialCard, type Pet, type Section, type WishItem } from "./card";
import type { DateSpec } from "./calendar";
import { captureField, describeCapture, findPet, getRaw, mergeCapture, setRaw, type CaptureField, type CaptureOp, type CaptureValue } from "./capture";
import type { Locale } from "./locale";
import { clip } from "./text";

/**
 * 메모 하나가 한 일 하나(칸 하나에 대해). 메모의 암호화된 내용 안에 같이 들어간다(값이 민감하니 따로 평문으로 두지 않는다)
 * - items: 목록·고르는 칸·이어 붙이는 글(조각). add 이 메모로 새로 든 것 · drop 같이 바꾸느라 빠진 것(되돌릴 때 되살린다) · known 이 메모가 다시 말했지만 이미 있던 것
 * - one: 한 칸짜리(수·고르는 한 칸·생일·바꿔 쓰는 글)·기념일 한 줄·반려동물 한 마리. next 이 메모가 적은 값 · prev 그 전 값(없었으면 null) · ok 이미 그 값이었다(다시 말했을 뿐)
 * known·ok는 '이 메모가 한 일'이 아니라 '이 메모도 이 값을 뒷받침한다'는 표시: 다른 메모를 같이 지울 때 이 값은 지우지 않게 한다
 */
export type NoteEffect = { f: string; t: "items"; add: string[]; drop?: string[]; known?: string[] } | { f: string; t: "one"; next: unknown; prev?: unknown; ok?: 1 };

/** 메모 하나에 남기는 일의 수 한도(저장 크기 한도 안에서) */
export const NOTE_EFFECTS_MAX = 24;

const norm = (a: string) => a.trim().toLowerCase();
const same = (a: string, b: string) => norm(a) === norm(b);
const has = (list: readonly string[], x: string) => list.some((y) => same(x, y));

/** 키 순서와 상관없이 같은 값인가(문자열은 대소문자·앞뒤 공백 무시) */
function eq(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") return same(a, b);
  const stable = (v: unknown): string =>
    JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([p], [q]) => (p < q ? -1 : 1))) : x));
  return stable(a) === stable(b);
}

type Form = "items" | "one" | "anniversary" | "pet";

/** 이 칸에 이 말을 합치면 어떤 모양의 일이 되나(글 한 줄은 이어 붙이면 조각 더하기, 바꾸면 한 칸짜리) */
function formOf(field: CaptureField, op: CaptureOp): Form {
  switch (field.kind) {
    case "list":
    case "codes":
    case "tags":
      return "items";
    case "text":
      return field.replace || op === "replace" ? "one" : "items";
    case "anniversary":
      return "anniversary";
    case "pet":
      return "pet";
    default:
      return "one";
  }
}

/** 칸의 항목들(목록은 글·코드, 이어 붙이는 글은 쉼표로 나눈 조각, 위시리스트는 이름) */
function itemsOf(field: CaptureField, data: unknown): string[] {
  const base = (data ?? {}) as Record<string, unknown>;
  if (field.key === "gifts.wishlist") return ((base.wishlist as WishItem[] | undefined) ?? []).map((w) => w.title);
  const v = getRaw(base, field.key);
  if (field.kind === "text") {
    const s = String(v ?? "").trim();
    return s ? s.split(/\s*,\s*/) : [];
  }
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** 한 칸짜리 값(없으면 null) */
function oneOf(field: CaptureField, data: unknown): unknown {
  const v = getRaw((data ?? {}) as Record<string, unknown>, field.key);
  if (field.kind === "text") return String(v ?? "").trim() || null;
  return v ?? null;
}

const petsOf = (data: unknown): Pet[] => ((data as { pets?: Pet[] } | null | undefined)?.pets ?? []).slice();
const anniversariesOf = (data: unknown): Anniversary[] => ((data as { anniversaries?: Anniversary[] } | null | undefined)?.anniversaries ?? []).slice();

/**
 * 말 하나(value·op)가 칸(before)에 합쳐진 일을 기록할 모양으로. merged는 mergeCapture가 돌려준 합친 뒤의 칸(합칠 게 없었으면 null).
 * 새로 든 것이 있으면 그것(+ 바뀐 전 값), 아무것도 안 바뀌었지만 이미 그렇게 적혀 있던 말이면 '다시 말했다'는 표시만. 지우기·맞지 않는 값은 null
 */
export function recordEffect(field: CaptureField, value: CaptureValue, op: CaptureOp, before: unknown, merged: unknown | null): NoteEffect | null {
  if (op === "remove") return null;
  // 아무것도 없는 칸에 이 말만 합친 것: 이 말이 말하는 값 전체(이미 있던 것까지)
  const stated = mergeCapture(field, null, value, op) as unknown;
  const form = formOf(field, op);
  switch (form) {
    case "items": {
      const was = itemsOf(field, before);
      const now = merged ? itemsOf(field, merged) : was;
      const add = now.filter((x) => !has(was, x));
      const drop = was.filter((x) => !has(now, x));
      const known = (stated ? itemsOf(field, stated) : []).filter((x) => !has(add, x));
      if (!add.length && !known.length) return null;
      return { f: field.key, t: "items", add, ...(add.length && drop.length ? { drop } : {}), ...(known.length ? { known } : {}) };
    }
    case "one": {
      if (merged) {
        const prev = oneOf(field, before);
        const next = oneOf(field, merged);
        return eq(prev, next) ? null : { f: field.key, t: "one", next, prev };
      }
      const next = stated ? oneOf(field, stated) : null;
      return next == null ? null : { f: field.key, t: "one", next, ok: 1 };
    }
    case "anniversary": {
      const was = anniversariesOf(before);
      if (merged) {
        const next = anniversariesOf(merged).find((a) => !was.some((b) => same(a.label, b.label) && eq(a.spec, b.spec)));
        if (!next) return null;
        return { f: field.key, t: "one", next, prev: was.find((b) => same(b.label, next.label)) ?? null };
      }
      const next = stated ? anniversariesOf(stated)[0] : undefined;
      return next ? { f: field.key, t: "one", next, ok: 1 } : null;
    }
    case "pet": {
      const was = petsOf(before);
      if (merged) {
        const now = petsOf(merged);
        const next = now.find((a) => !was.some((b) => eq(a, b)));
        if (!next) return null;
        return { f: field.key, t: "one", next, prev: was.find((b) => !now.some((a) => eq(a, b))) ?? null };
      }
      const said = stated ? petsOf(stated)[0] : undefined;
      const next = said ? findPet(was, said.name, said.kind) : null;
      return next ? { f: field.key, t: "one", next, ok: 1 } : null;
    }
  }
}

export interface RevertResult {
  /** 되돌린 뒤의 칸(바뀐 칸만) */
  sections: Partial<{ [S in Section]: CardData[S] }>;
  /** 실제로 되돌려진 것(같은 모양, 지금 기록에 남아 있고 다른 메모가 뒷받침하지 않는 것만) */
  undone: NoteEffect[];
}

/**
 * 메모가 더한 것을 되돌린다. card는 지금의 사람 기록, effects는 지우는 메모의 것, others는 같은 사람의 남는 다른 메모들의 것(뒷받침 확인용).
 * - 목록·글 조각: 이 메모가 더한 것만, 지금도 들어 있을 때만 뺀다(같이 빠졌던 것은 되살린다)
 * - 한 칸짜리·기념일·반려동물: 지금 값이 이 메모가 적은 값 그대로일 때만 전 값으로(없었으면 비운다). 그 뒤 직접 고쳤으면 그대로 둔다
 * - 다른 남는 메모가 같은 값을 더했거나 다시 말했으면(뒷받침) 건드리지 않는다
 * 적은 순서의 거꾸로 하나씩 되돌려, 한 메모가 같은 칸을 여러 번 바꿨어도 차례로 맞는다
 */
export function revertEffects(card: PartialCard, effects: readonly NoteEffect[], others: readonly NoteEffect[]): RevertResult {
  const cur: Record<string, unknown> = { ...card };
  const changed = new Set<Section>();
  const undone: NoteEffect[] = [];
  for (const e of [...effects].reverse()) {
    const field = captureField(e.f);
    if (!field) continue;
    const base = structuredClone(cur[field.section] ?? emptySection(field.section)) as Record<string, unknown>;
    const out = e.t === "items" ? undoItems(field, base, e, others) : undoOne(field, base, e, others);
    if (!out) continue;
    cur[field.section] = sanitizeSection(field.section, base);
    changed.add(field.section);
    undone.unshift(out);
  }
  const sections: Record<string, unknown> = {};
  for (const s of changed) sections[s] = cur[s];
  return { sections: sections as RevertResult["sections"], undone };
}

function undoItems(field: CaptureField, base: Record<string, unknown>, e: Extract<NoteEffect, { t: "items" }>, others: readonly NoteEffect[]): NoteEffect | null {
  const backed = (x: string) => others.some((o) => o.f === e.f && o.t === "items" && (has(o.add, x) || has(o.known ?? [], x)));
  const present = itemsOf(field, base);
  const remove = e.add.filter((x) => has(present, x) && !backed(x));
  if (!remove.length) return null;
  const kept = present.filter((x) => !has(remove, x));
  // '없음' 표시는 다른 항목이 남아 있으면 되살리지 않는다
  const restore = (e.drop ?? []).filter((x) => !has(present, x) && (x !== NONE || !kept.length));
  if (field.key === "gifts.wishlist") {
    // 남는 항목은 링크째 그대로 둔다
    base.wishlist = [...((base.wishlist as WishItem[]) ?? []).filter((w) => !has(remove, w.title)), ...restore.map((title) => ({ title, url: "" }))];
  } else if (field.kind === "text") setRaw(base, field.key, [...kept, ...restore].join(", "));
  else setRaw(base, field.key, [...kept, ...restore]);
  return { f: e.f, t: "items", add: remove, ...(restore.length ? { drop: restore } : {}) };
}

function undoOne(field: CaptureField, base: Record<string, unknown>, e: Extract<NoteEffect, { t: "one" }>, others: readonly NoteEffect[]): NoteEffect | null {
  if (e.ok) return null; // 이 메모가 더한 게 아니다
  if (others.some((o) => o.f === e.f && o.t === "one" && eq(o.next, e.next))) return null; // 다른 메모도 같은 값을 말했다
  const prev = e.prev ?? null;
  if (field.kind === "anniversary" || field.kind === "pet") {
    const key = field.kind === "pet" ? "pets" : "anniversaries";
    const list = ((base[key] as unknown[]) ?? []).slice();
    const i = list.findIndex((x) => eq(x, e.next));
    if (i < 0) return null; // 그 뒤에 고쳤거나 지웠다
    if (prev) list[i] = prev;
    else list.splice(i, 1);
    base[key] = list;
    return e;
  }
  if (!eq(oneOf(field, base), e.next)) return null; // 그 뒤에 직접 고쳤다
  setRaw(base, field.key, field.kind === "text" ? (prev ?? "") : prev);
  return e;
}

// ── 화면에 보일 줄 ─────────────────────────────

/** 화면의 한 줄: "좋아하는 음식 · 마라탕" / "신발(mm) · 240 → 245"(prev가 값 앞에 놓인 전 값) */
export interface EffectLine {
  section: Section;
  label: string;
  value: string;
  prev?: string;
}

function itemsValue(field: CaptureField, items: string[]): CaptureValue {
  if (field.kind === "codes") return { codes: items };
  if (field.kind === "tags") {
    const inCatalog = (x: string) => !!field.catalog?.some((c) => c.code === x);
    return { codes: items.filter(inCatalog), text: items.filter((x) => !inCatalog(x)).join(", ") };
  }
  return { text: items.join(", ") };
}

function oneValue(field: CaptureField, v: unknown): CaptureValue {
  switch (field.kind) {
    case "number":
      return { number: Number(v) };
    case "code":
      return { codes: [String(v)] };
    case "date":
      return { date: v as DateSpec };
    case "anniversary": {
      const a = v as Anniversary;
      return { label: a.label, date: a.spec };
    }
    case "pet": {
      const p = v as Pet;
      if (field.key === "pets.pet") return { label: p.name, codes: p.kind ? [p.kind] : null, text: p.breed };
      if (field.key === "pets.treats") return { label: p.name, text: p.treats.join(", ") };
      return { label: p.name, text: p.note };
    }
    default:
      return { text: String(v ?? "") };
  }
}

/** 되돌려질 일(undone) 하나를 화면에 보일 줄로. 보일 값이 없으면 null */
export function describeEffect(e: NoteEffect, locale: Locale): EffectLine | null {
  const field = captureField(e.f);
  if (!field) return null;
  const items = e.t === "items";
  const value = describeCapture(field, items ? itemsValue(field, e.add) : oneValue(field, e.next), locale);
  if (!value) return null;
  const prev = items ? (e.drop?.length ? describeCapture(field, itemsValue(field, e.drop), locale) : "") : e.prev == null ? "" : describeCapture(field, oneValue(field, e.prev), locale);
  return { section: field.section, label: field.label[locale], value, ...(prev ? { prev } : {}) };
}

// ── 저장·받은 값 정리 ─────────────────────────────

/** 저장한 것·화면에서 돌려받은 것을 믿을 수 있는 모양으로(모르는 칸·깨진 모양은 버리고, 길이·개수를 자른다) */
export function parseEffects(raw: unknown): NoteEffect[] {
  if (!Array.isArray(raw)) return [];
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => clip(x.trim(), 80)).filter(Boolean).slice(0, 20) : []);
  const small = (v: unknown) => {
    try {
      return JSON.stringify(v ?? null).length <= 600;
    } catch {
      return false;
    }
  };
  const out: NoteEffect[] = [];
  for (const r of raw) {
    if (out.length >= NOTE_EFFECTS_MAX) break;
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const field = typeof o.f === "string" ? captureField(o.f) : null;
    if (!field) continue;
    if (o.t === "items") {
      const add = strings(o.add);
      const drop = strings(o.drop);
      const known = strings(o.known);
      if (!add.length && !known.length) continue;
      out.push({ f: field.key, t: "items", add, ...(add.length && drop.length ? { drop } : {}), ...(known.length ? { known } : {}) });
    } else if (o.t === "one" && o.next != null && small(o.next) && small(o.prev)) {
      out.push(o.ok === 1 ? { f: field.key, t: "one", next: o.next, ok: 1 } : { f: field.key, t: "one", next: o.next, prev: o.prev ?? null });
    }
  }
  return out;
}
