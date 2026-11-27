// 말로 적기 초안: 줄마다 '누구의 이야기인지'(대상)를 정한다. 서버(나누기·저장)와 화면(대상 바꾸기)이 같이 쓰는 순수 로직이라 서버 전용 모듈을 들이지 않는다.
// 대상은 나 / 내 사람(contactId) / 새 사람(이름) / 아직 못 정함(같은 이름이 여럿이라 고르기 전)
import { clip, findByRelation, sameRelation, sanitizeSection, type Section } from "@readme/core";
import type { CaptureItem, CapturePerson } from "./capture-ai";

export type CaptureTarget = { kind: "me" } | { kind: "person"; id: string } | { kind: "new"; name: string } | { kind: "pick" };

/**
 * 바로 적지 않고 사람에게 한 번 더 확인받아야 하는 항목인가: 알레르기·못 먹는 것·식단(safety.*)을 지우거나 바꾸는 것.
 * 더하는 건 안전한 쪽(조심할 게 늘 뿐)이라 바로 적고, 지우거나 바꾸는 건 틀리면 건강에 관련된 기록이 조용히 사라져서 확인을 거친다.
 * 확인 단계(말로 적기 화면의 초안, 한 줄 적기의 '바꿀까요')는 이 검사를 거치지 않고 saveCapture로 저장한다
 */
export function holdsForConfirm(item: Pick<CaptureItem, "target" | "op">): boolean {
  return item.target.startsWith("safety.") && item.op !== "add";
}

/**
 * 저장한 메모를 AI가 정리할 때, 줄을 그 사람들(pickedIds)의 기록에 적어도 되나. 적으면 null, 아니면 이유:
 * other 이 사람들이 아닌 대상(나·다른 사람·새 사람·못 정한 줄) · memo 메모 칸(메모는 이미 통째로 저장했다) · held 확인이 필요한 줄(holdsForConfirm)
 */
export function unfitForOrganize(r: Pick<ResolvedCapture, "target" | "item">, pickedIds: readonly string[]): "other" | "memo" | "held" | null {
  if (r.target.kind !== "person" || !pickedIds.includes(r.target.id)) return "other";
  if (r.item.target === "memo") return "memo";
  return holdsForConfirm(r.item) ? "held" : null;
}

/** 새 사람 이름 길이 위쪽 한도 */
export const NEW_NAME_MAX = 40;

/** 메모 한 번 저장에 새로 더할 수 있는 사람 수(메모 쓰기 화면과 서버가 같이 쓴다) */
export const NEW_PEOPLE_MAX = 5;

/** 이름 비교용: 모양을 맞추고 소문자로, 띄어쓰기·붙임표·점을 없앤다 */
export function nameKey(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\s\-_.·ㆍ]+/g, "");
}

/** 새 사람 이름을 다듬는다(여러 칸 띄어쓰기를 하나로, 앞뒤 공백 없이, 길이 한도) */
export function tidyName(s: string | null | undefined): string {
  return clip(String(s ?? "").replace(/\s+/g, " ").trim(), NEW_NAME_MAX).trim();
}

const callNames = (p: CapturePerson) => [p.nickname, p.name].filter(Boolean);

/**
 * 말한 이름에 맞는 내 사람들.
 * exact: 부르는 말(닉네임)이나 이름이 같은 사람(띄어쓰기·대소문자 무시)
 * related: 같은 부름말로 보는 사람까지("와이프" ↔ "아내", "엄마" ↔ "어머니"). exact를 품는다
 */
export function matchPeople(name: string, people: readonly CapturePerson[]): { exact: CapturePerson[]; related: CapturePerson[] } {
  const key = nameKey(name);
  if (!key) return { exact: [], related: [] };
  return {
    exact: people.filter((p) => callNames(p).some((n) => nameKey(n) === key)),
    related: people.filter((p) => callNames(p).some((n) => sameRelation(n, name))),
  };
}

/** 한 줄이 어느 항목에서 왔고 어디로 가는지 */
export interface ResolvedCapture {
  /** 받은 항목 목록에서의 자리(이름이 없어 버린 항목은 건너뛴다) */
  idx: number;
  item: CaptureItem;
  target: CaptureTarget;
  /** 말한 이름(나는 ""). 사람으로 정해진 줄도 처음 말한 이름을 남겨 대상을 바꿀 때 '새 사람으로'의 처음 이름이 된다 */
  spoken: string;
  /** 같은 이름 후보(contactId). target이 pick이면 둘 이상. 정해진 뒤에도 남겨 시트에서 다시 고르게 한다 */
  candidates: string[];
}

export interface ResolveOptions {
  /** 같은 이름이 여럿이면 못 정함(pick)으로 두고 후보를 돌려준다. false면 예전처럼 첫 사람·새 사람으로 정한다 */
  detect: boolean;
  /** 사람이 직접 짚은 사람(@부름·그 사람 화면): 이름이 겹쳐도 그 사람으로 확정 */
  certain?: ReadonlySet<string>;
}

/** 같은 말 안에서 새 사람 이름 맞추기: 같은 이름이면 먼저 나온 이름으로, 같은 부름말이 딱 하나여도 합친다 */
function sameNew(made: string[], name: string): string | undefined {
  return made.find((n) => nameKey(n) === nameKey(name)) ?? findByRelation(made, name, (n) => [n]) ?? undefined;
}

/**
 * AI가 나눈 항목마다 대상을 정한다.
 * - 나: me
 * - AI가 고른 내 사람(contactId): 그 사람. 단 detect이고 직접 짚은 사람이 아닐 때, 같은 이름(닉네임·이름)을 쓰는 내 사람이 더 있으면 pick
 * - 새 사람이라고 했거나 contactId가 내 사람이 아니면 말한 이름으로 내 사람에서 찾는다(이름 → 같은 부름말). 하나면 그 사람, 둘 이상이면 pick(detect), 없으면 새 사람
 * - 이름이 없는데 사람도 못 찾으면 건너뛴다
 */
export function resolveCapture(items: readonly CaptureItem[], people: readonly CapturePerson[], opts: ResolveOptions): ResolvedCapture[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const certain = opts.certain ?? new Set<string>();
  const made: string[] = [];
  const out: ResolvedCapture[] = [];
  items.forEach((item, idx) => {
    if (item.who.type === "me") {
      out.push({ idx, item, target: { kind: "me" }, spoken: "", candidates: [] });
      return;
    }
    const picked = item.who.type === "existing" && item.who.contactId ? byId.get(item.who.contactId) : undefined;
    if (picked) {
      const spoken = tidyName(item.who.name) || picked.nickname || picked.name;
      let candidates: string[] = [];
      if (opts.detect && !certain.has(picked.id)) {
        const names = [spoken, picked.nickname, picked.name].filter(Boolean).map(nameKey);
        const same = people.filter((p) => callNames(p).some((n) => names.includes(nameKey(n))));
        if (same.length >= 2) candidates = [picked.id, ...same.filter((p) => p.id !== picked.id).map((p) => p.id)];
      }
      out.push({ idx, item, target: candidates.length ? { kind: "pick" } : { kind: "person", id: picked.id }, spoken, candidates });
      return;
    }
    const name = tidyName(item.who.name);
    if (!name) return;
    const m = matchPeople(name, people);
    if (opts.detect) {
      const hits = m.exact.length ? m.exact : m.related;
      if (hits.length >= 2) {
        out.push({ idx, item, target: { kind: "pick" }, spoken: name, candidates: hits.map((p) => p.id) });
        return;
      }
      if (hits.length === 1) {
        out.push({ idx, item, target: { kind: "person", id: hits[0]!.id }, spoken: name, candidates: [] });
        return;
      }
    } else {
      const hit = m.exact[0] ?? (m.related.length === 1 ? m.related[0] : undefined);
      if (hit) {
        out.push({ idx, item, target: { kind: "person", id: hit.id }, spoken: name, candidates: [] });
        return;
      }
    }
    const first = sameNew(made, name);
    if (!first) made.push(name);
    out.push({ idx, item, target: { kind: "new", name: first ?? name }, spoken: name, candidates: [] });
  });
  return out;
}

/**
 * 화면에서 대상을 정해 되돌려 보낸 항목(저장·미리 보기). 내 사람이 아닌 contactId는 줄째 버리고(새 사람으로 둔갑시키지 않는다),
 * 새 사람은 같은 이름당 한 명만(먼저 나온 글자로) 만든다. 이름 맞추기는 하지 않는다: 화면에서 정한 대로
 */
export function resolveSaved(items: readonly CaptureItem[], people: readonly CapturePerson[]): ResolvedCapture[] {
  const mine = new Set(people.map((p) => p.id));
  const made: string[] = [];
  const out: ResolvedCapture[] = [];
  items.forEach((item, idx) => {
    if (item.who.type === "me") {
      out.push({ idx, item, target: { kind: "me" }, spoken: "", candidates: [] });
    } else if (item.who.type === "existing") {
      const id = item.who.contactId;
      if (id && mine.has(id)) out.push({ idx, item, target: { kind: "person", id }, spoken: "", candidates: [] });
    } else {
      const name = tidyName(item.who.name);
      if (!name) return;
      const first = made.find((n) => nameKey(n) === nameKey(name));
      if (!first) made.push(name);
      out.push({ idx, item, target: { kind: "new", name: first ?? name }, spoken: name, candidates: [] });
    }
  });
  return out;
}

/** 대상 → 항목의 who(못 정함은 말한 이름의 새 사람처럼 적어 둔다. 저장하기 전에 정해야 한다) */
export function whoOf(target: CaptureTarget, spoken = ""): CaptureItem["who"] {
  if (target.kind === "me") return { type: "me", contactId: null, name: null };
  if (target.kind === "person") return { type: "existing", contactId: target.id, name: null };
  return { type: "new", contactId: null, name: target.kind === "new" ? target.name : spoken || null };
}

export function sameTarget(a: CaptureTarget, b: CaptureTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "person") return a.id === (b as typeof a).id;
  if (a.kind === "new") return nameKey(a.name) === nameKey((b as typeof a).name);
  return true;
}

interface TargetRow {
  key: number;
  target: CaptureTarget;
  spoken: string;
}

/** 같은 이름 줄: 같은 말을 같은 대상으로 적은 줄(이미 따로 바꾼 줄은 한 묶음이 아니다) */
const sameLine = (a: TargetRow, b: TargetRow) => nameKey(a.spoken) === nameKey(b.spoken) && sameTarget(a.target, b.target);

/** key 줄과 같은 이름 줄(자기 자신 제외) 수 */
export function siblingCount(rows: readonly TargetRow[], key: number): number {
  const base = rows.find((r) => r.key === key);
  return base ? rows.filter((r) => r.key !== key && sameLine(r, base)).length : 0;
}

/** key 줄의 대상을 바꾼다. all이면 같은 이름 줄도 같이. 바뀐 줄의 key를 같이 돌려준다 */
export function retarget<T extends TargetRow>(rows: readonly T[], key: number, to: CaptureTarget, all: boolean): { rows: T[]; changed: number[] } {
  const base = rows.find((r) => r.key === key);
  if (!base) return { rows: [...rows], changed: [] };
  const changed: number[] = [];
  const next = rows.map((r) => {
    if (r.key !== key && !(all && sameLine(r, base))) return r;
    changed.push(r.key);
    return { ...r, target: to };
  });
  return { rows: next, changed };
}

/** 저장 전에 아직 못 정한 첫 줄 */
export function firstPick<T extends TargetRow>(rows: readonly T[]): T | undefined {
  return rows.find((r) => r.target.kind === "pick");
}

/**
 * 되돌리기 판단: 항목의 지금 값이 말로 적은 값(after) 그대로인지. 그대로여야 옛 값으로 되돌린다 — 그 사이에 직접 고쳤으면 그 내용을 덮어쓰지 않는다.
 * 둘 다 항목 모양(sanitizeSection)으로 맞춰 견주고, 비어 있음(null·undefined)은 같은 것으로 본다
 */
export function sameSectionValue(section: Section, a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => JSON.stringify(v == null ? null : sanitizeSection(section, v));
  return norm(a) === norm(b);
}

