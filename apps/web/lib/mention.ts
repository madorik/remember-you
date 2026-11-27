// 글로 적기의 @부름: '@와이프 바닐라라떼를 좋아해'처럼 누구 이야기인지 짚는다. 화면(고르기 목록)·서버(누구인지 확정)가 같이 쓴다.
import { NEW_PEOPLE_MAX, nameKey, tidyName } from "./capture-target";

export interface MentionPerson {
  id: string;
  /** 그 사람 이름(앱 사용자와 이어지지 않은 사람은 내가 적은 말) */
  name: string;
  /** 내가 붙인 태그(부르는 말). 이름과 같거나 없으면 "" */
  tag: string;
}

/** 부를 때 쓰는 말: 태그가 있으면 태그(와이프), 없으면 이름 */
export function mentionLabel(p: Pick<MentionPerson, "name" | "tag">): string {
  return (p.tag || p.name).trim();
}

/** 커서 바로 앞이 '@낱말'(띄어쓰기 없이)이면 그 자리와 찾는 말. 아니면 null */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|[^\p{L}\p{N}_])@([^\s@]*)$/u.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[2]!.length - 1, query: m[2]! };
}

/** start(@ 자리)부터 caret까지를 '@부름 '으로 바꾼다. 바뀐 글과 새 커서 자리 */
export function insertMention(text: string, start: number, caret: number, label: string): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(caret);
  const ins = `@${label}${after.startsWith(" ") ? "" : " "}`;
  return { text: before + ins + after, caret: before.length + ins.length + (after.startsWith(" ") ? 1 : 0) };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** 부름 뒤에 붙어도 되는 조사 길이(와이프는, 엄마한테, 아빠께서) */
const PARTICLE_MAX = 3;

/**
 * 글 속의 @부름을 사람으로 바꾼다. 고른 것(picked)이 먼저, 그다음 직접 적은 @낱말을 이름·태그와 맞춘다(띄어쓰기·대소문자 무시, 뒤에 조사가 붙어도).
 * 돌려주는 글에서는 @를 뗀다(AI가 자연스럽게 읽게). 못 찾은 @낱말도 @만 뗀다
 */
export function resolveMentions(text: string, people: MentionPerson[], picked: { id: string; label: string }[] = []): { text: string; ids: string[] } {
  const known = new Set(people.map((p) => p.id));
  const ids: string[] = [];
  let out = text;
  for (const m of [...picked].filter((m) => known.has(m.id) && m.label).sort((a, b) => b.label.length - a.label.length)) {
    const token = `@${m.label}`;
    if (!out.includes(token)) continue;
    out = out.split(token).join(m.label);
    if (!ids.includes(m.id)) ids.push(m.id);
  }
  out = out.replace(/(^|[^\p{L}\p{N}_])@([^\s@]+)/gu, (_all, pre: string, word: string) => {
    const w = norm(word);
    let best: MentionPerson | null = null;
    let bestLen = 0;
    for (const p of people) {
      for (const label of [p.tag, p.name]) {
        const l = norm(label ?? "");
        if (l && w.startsWith(l) && w.length - l.length <= PARTICLE_MAX && l.length > bestLen) {
          best = p;
          bestLen = l.length;
        }
      }
    }
    if (best && !ids.includes(best.id)) ids.push(best.id);
    return pre + word;
  });
  return { text: out, ids };
}

// ── 메모 쓰기: 본문에 적은 @이름·이름을 저장할 때 사람 칩으로 ──────────────────────────

/** 메모의 주인공 한 명: 이미 있는 사람(id) 또는 이번에 새로 더할 사람(이름) */
export type MentionTag = { kind: "person"; id: string } | { kind: "new"; name: string };

/** 칩을 가리는 열쇠(이미 있는 사람은 id, 새 사람은 이름 모양을 맞춘 것) */
export const tagKey = (t: MentionTag): string => (t.kind === "person" ? t.id : `new:${nameKey(t.name)}`);

/** 이름 뒤에 붙는 조사(엄마는, 엄마한테는, 초롱이랑, 엄마께서는). 두 개까지 겹쳐도 된다 */
const PARTICLES = /^(?:(?:께서|에게서|한테서|에게|한테|으로|하고|부터|까지|처럼|보다|이라고|라고|이라|이랑|랑|이|가|은|는|을|를|의|도|만|와|과|아|야|께|로)){1,2}$/u;

const WORD = /[\p{L}\p{N}_]/u;

/** 낱말 뒤 구두점은 이름이 아니다("@새친구," → 새친구) */
export const mentionWord = (s: string): string => s.replace(/[.,!?;:()[\]{}"'“”‘’…~]+$/u, "");

/** 사람 한 명을 부르는 말들(태그·이름, 겹치는 건 한 번) */
const labelsOf = (p: Pick<MentionPerson, "name" | "tag">): string[] => [...new Set([p.tag, p.name].map((l) => (l ?? "").replace(/\s+/g, " ").trim()).filter(Boolean))];

/** 글에서 @로 짚은 이름 하나를 사람으로: 한 명이면 그 사람, 같은 부름이 둘 이상이면 못 정함(ambiguous), 내 사람에 없으면 null */
type Hit = { kind: "one"; id: string } | { kind: "ambiguous" } | null;

function hitOf(word: string, people: readonly MentionPerson[]): Hit {
  const w = norm(word);
  const exact = new Set<string>();
  const loose = new Map<string, number>(); // 사람 id → 맞은 부름의 길이(조사가 붙은 것)
  for (const p of people) {
    for (const label of labelsOf(p)) {
      const l = norm(label);
      if (!l) continue;
      if (l === w) exact.add(p.id);
      else if (w.startsWith(l) && PARTICLES.test(w.slice(l.length))) loose.set(p.id, Math.max(loose.get(p.id) ?? 0, l.length));
    }
  }
  if (exact.size) return exact.size === 1 ? { kind: "one", id: [...exact][0]! } : { kind: "ambiguous" };
  if (!loose.size) return null;
  const best = Math.max(...loose.values());
  const top = [...loose].filter(([, len]) => len === best);
  return top.length === 1 ? { kind: "one", id: top[0]![0] } : { kind: "ambiguous" };
}

/**
 * 글 속 @부름 전부(나온 순서, 같은 사람·이름은 한 번): 이미 있는 사람이면 person, 내 사람에 없으면 그 낱말이 새 사람 이름(new).
 * '@김 과장님'처럼 띄어쓰기가 든 이름도 사람 목록에서 찾는다. 같은 부름이 둘 이상이라 못 정한 낱말은 건너뛴다(없는 사람으로 둔갑시키지 않는다)
 */
export function scanMentions(text: string, people: readonly MentionPerson[]): MentionTag[] {
  const out: MentionTag[] = [];
  const seen = new Set<string>();
  const push = (t: MentionTag) => {
    const k = tagKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  // 띄어쓰기가 든 부름(김 과장님)은 낱말로 못 가르니 먼저 글에서 그대로 찾는다
  const spaced = people
    .flatMap((p) => labelsOf(p).filter((l) => l.includes(" ")).map((l) => ({ id: p.id, label: l.toLowerCase() })))
    .sort((a, b) => b.label.length - a.label.length);
  const re = /(^|[^\p{L}\p{N}_])@(?=[^\s@])/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const at = m.index + m[1]!.length; // '@'의 자리
    const rest = text.slice(at + 1);
    const lower = rest.toLowerCase().replace(/\s+/g, " ");
    const long = spaced.find((s) => {
      if (!lower.startsWith(s.label)) return false;
      const tail = /^[\p{L}\p{N}_]*/u.exec(lower.slice(s.label.length))![0];
      return !tail || PARTICLES.test(tail);
    });
    if (long) {
      push({ kind: "person", id: long.id });
      continue;
    }
    const word = mentionWord(/^[^\s@]+/u.exec(rest)![0]);
    if (!word) continue;
    const hit = hitOf(word, people);
    if (hit?.kind === "one") push({ kind: "person", id: hit.id });
    else if (!hit) {
      const name = tidyName(word);
      if (name) push({ kind: "new", name });
    }
  }
  return out;
}

/**
 * @ 없이 글에 이름이 그대로 나온 내 사람(나온 순서): 이름·태그가 낱말 첫머리에서 시작하고 뒤가 끝·띄어쓰기·구두점·조사일 때만
 * ("초롱이는 마라탕 좋아함", "엄마가 …" 는 맞고 "큰엄마", "엄마표"는 아니다). 같은 부름이 둘 이상이면 건너뛴다
 */
export function findNamedPeople(text: string, people: readonly MentionPerson[]): string[] {
  const flat = text.toLowerCase().replace(/\s+/g, " ");
  const owners = new Map<string, Set<string>>(); // 부름 → 그 부름을 쓰는 사람들
  for (const p of people) {
    for (const label of labelsOf(p)) {
      const l = label.toLowerCase();
      owners.set(l, (owners.get(l) ?? new Set()).add(p.id));
    }
  }
  const found: { id: string; at: number }[] = [];
  for (const [label, ids] of owners) {
    if (ids.size !== 1) continue;
    for (let from = flat.indexOf(label); from >= 0; from = flat.indexOf(label, from + 1)) {
      if (from > 0 && WORD.test(flat.charAt(from - 1))) continue;
      const tail = /^[\p{L}\p{N}_]*/u.exec(flat.slice(from + label.length))![0];
      if (tail && !PARTICLES.test(tail)) continue;
      found.push({ id: [...ids][0]!, at: from });
      break;
    }
  }
  return [...new Set(found.sort((a, b) => a.at - b.at).map((f) => f.id))];
}

/** 글에 @부름이 하나라도 있나(@ 뒤에 글자가 이어진 것) */
const hasMention = (text: string) => /(^|[^\p{L}\p{N}_])@[^\s@]/u.test(text);

/**
 * 저장할 때의 주인공들: 칩으로 고른 사람(tags) + 글에 적은 @이름(이미 있는 사람이면 그 사람, 아니면 새 사람).
 * 아무도 안 골랐고 @도 없으면 글에 이름이 그대로 나온 내 사람을 고른다. 칩에서 일부러 뺀 사람(dropped의 열쇠)은 다시 넣지 않는다.
 * 새 사람은 칩으로 고른 것까지 합쳐 NEW_PEOPLE_MAX명까지(이름은 scanMentions가 NEW_NAME_MAX자로 다듬는다)
 */
export function tagsForSave(text: string, people: readonly MentionPerson[], tags: readonly MentionTag[], dropped: ReadonlySet<string> = new Set()): MentionTag[] {
  const out: MentionTag[] = [...tags];
  const have = new Set(out.map(tagKey));
  const add = (t: MentionTag) => {
    const key = tagKey(t);
    if (have.has(key) || dropped.has(key)) return;
    if (t.kind === "new" && (!nameKey(t.name) || out.filter((o) => o.kind === "new").length >= NEW_PEOPLE_MAX)) return;
    have.add(key);
    out.push(t);
  };
  for (const t of scanMentions(text, people)) add(t);
  if (!tags.length && !hasMention(text)) for (const id of findNamedPeople(text, people)) add({ kind: "person", id });
  return out;
}
