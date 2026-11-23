"use server";

import { track } from "@/lib/track";
import { IMAGE_MAX_BYTES, IMAGE_MAX_COUNT, captureField, checkJpegBytes, cleanMemo, clip, describeCapture, isSection, mergeCapture, mergeImport, sanitizeSection, splitMemo, translate, type CaptureOp, type CardData, type PartialCard, type Section } from "@readme/core";
import { revalidatePath } from "next/cache";
import { aiConfigured, classifyCapture, classifyImport, classifyImportImage, type CaptureItem, type ImageKind, type ImageReading, type ImportScope } from "@/lib/ai";
import { cleanCaptureItems, tidyImportItems, type CapturePerson } from "@/lib/capture-ai";
import { findLeftovers } from "@/lib/capture-leftover";
import { holdsForConfirm, nameKey, resolveCapture, resolveSaved, sameSectionValue, tidyName, whoOf, type CaptureTarget, type ResolvedCapture } from "@/lib/capture-target";
import { refundAi, reserveAi } from "@/lib/ai-quota";
import { displayName, listNotes, listPeopleLite, readCard, readContactCard, requireSession, sealNote, writeContactSection, writeSection, type Note, type Person, type Session } from "@/lib/data";
import { LIMITS } from "@/lib/data-core";
import { isUuid } from "@/lib/uuid";
import { resolveMentions } from "@/lib/mention";

/** 화면에 보일 한 줄: "아내 · 요즘 마시는 것 · 바닐라라떼" */
export interface CaptureLine {
  who: string;
  /** 이번에 새로 더한 사람 */
  isNew: boolean;
  /** 더하기·바꾸기·지우기 */
  op: CaptureOp;
  /** 바뀐 게 없는 칸(더하기·바꾸기: 이미 그렇게 적혀 있다, 지우기: 이미 없다) */
  same?: boolean;
  /** 칸 이름(메모면 '메모') */
  field: string;
  value: string;
  /** 사람 화면 주소(나면 /me) */
  href: string;
}

/**
 * 되돌리기에 쓰는 것(적은 순서대로). 내 것만 고치므로 값은 화면에서 받아도 된다(RLS가 내 줄만 허락).
 * section의 after는 이 말이 적은 값: 되돌릴 때 지금 값이 그것과 다르면(그 뒤에 직접 고쳤다) 그 항목은 건드리지 않는다
 */
export type UndoOp =
  | { type: "section"; who: "me" | string; section: Section; before: unknown; after?: unknown }
  | { type: "note"; contactId: string; id: string }
  | { type: "contact"; contactId: string };

export interface CaptureState {
  lines: CaptureLine[];
  undo: UndoOp[];
  error: "ai_off" | "failed" | "nothing" | "limit" | null;
  /**
   * 바로 적지 않고 한 번 더 확인받을 줄: 알레르기·못 먹는 것·식단을 지우거나 바꾸는 말(holdsForConfirm).
   * 화면이 확인을 받으면 이 줄의 item을 saveCapture로 보낸다(그때 되돌리기도 생긴다)
   */
  held?: CaptureDraftLine[];
}

/**
 * 확인 화면의 한 줄: 화면에 보일 한 줄 + 그 줄이 된 항목(고친 값은 이 항목을 고쳐 저장 단계로 되돌려 보낸다)
 * target: 누구의 이야기로 정했나(같은 이름이 여럿이라 못 정했으면 pick). spoken: 말한 이름. candidates: 같은 이름 후보(contactId)
 * idx: 이 줄이 된 항목이 보낸 목록에서 몇 번째인가(미리 보기가 줄을 항목에 맞춰 돌려준다)
 */
export interface CaptureDraftLine extends CaptureLine {
  item: CaptureItem;
  idx: number;
  target: CaptureTarget;
  spoken: string;
  candidates: string[];
}

/** 대상·항목을 바꾼 줄을 다시 따져 본 결과(이미 알고 있어요 표시만). 줄이 빠졌으면 저장해도 아무것도 안 적히는 줄이다 */
export interface CapturePreview {
  /** false면 따져 보지 못했다(그대로 둔다) */
  ok: boolean;
  lines: { idx: number; same: boolean }[];
}

/** 나누기만 한 초안(아직 아무것도 저장하지 않았다) */
export interface CaptureDraft {
  lines: CaptureDraftLine[];
  error: CaptureState["error"];
  /** 어느 줄에도 안 들어간 안전한 말(알레르기·못 먹는 것) — 화면이 '메모로 남기기·다시 하기'를 보인다. 없으면 생략 */
  leftover?: string[];
}

const failed = (error: NonNullable<CaptureState["error"]>) => ({ error }) as const;

/**
 * 말(글)을 나눌 준비: 로그인·빈 말·AI 설정·하루 한도를 보고, 사람 목록과 @부름을 풀어 AI로 나눈다. 나눈 결과(items)와 이어서 쓸 것을 돌려준다
 * aboutId: 그 사람 화면에서 적었을 때. 다른 사람 이름이 없는 말은 그 사람 이야기로 본다
 * picked: 글로 적기에서 @로 고른 사람(글에 '@부름'이 남아 있는 것만 쓴다). 직접 적은 @낱말도 이름·태그로 찾는다.
 *   한 사람만 짚으면 그 사람 화면에서 적은 것처럼, 여럿이면 짚은 이름 뒤의 말을 그 사람 이야기로 본다
 */
const asCapture = (p: Person): CapturePerson => ({ id: p.contactId, name: p.name, nickname: p.nickname });

async function classify(raw: string, aboutId?: string, picked?: { id: string; label: string }[]) {
  const s = await requireSession();
  const { locale } = s.profile;
  const said = clip(String(raw ?? "").replace(/\s+/g, " ").trim(), 500).trim();
  if (!said) return failed("nothing");
  if (!aiConfigured()) return failed("ai_off");
  // 사람 목록(이름만, 기록은 풀지 않는다)과 하루 한도(사람마다·서비스 전체)는 서로 상관없어 같이 확인한다. 한도에 막히면 OpenAI를 부르지 않는다
  const [people, gate] = await Promise.all([listPeopleLite(s), reserveAi({ id: s.user.id, demo: s.user.isAnonymous || s.profile.isDemo }, "capture")]);
  if (gate === "user_limit" || gate === "global_limit") return failed("limit");
  if (gate !== "ok") return failed("failed");
  const pickedOk = (Array.isArray(picked) ? picked : [])
    .filter((m) => m && typeof m.id === "string" && typeof m.label === "string")
    .map((m) => ({ id: m.id, label: clip(m.label, 40) }));
  const { text, ids } = resolveMentions(
    said,
    people.map((p) => ({ id: p.contactId, name: p.name, tag: p.nickname })),
    pickedOk,
  );
  const mentioned = ids.map((id) => people.find((p) => p.contactId === id)).filter((p): p is Person => !!p);
  const about = aboutId ? people.find((p) => p.contactId === aboutId) : mentioned.length === 1 ? mentioned[0] : undefined;
  let items;
  try {
    items = await classifyCapture(text, people.map(asCapture), locale, about ? asCapture(about) : null, mentioned.map(asCapture));
  } catch {
    // 불러 보지도 못하고 실패했으니 하루 한도는 돌려준다
    await refundAi(s.user.id, "capture");
    return failed("failed");
  }
  if (!items.length) return failed("nothing");
  // 사람이 직접 짚은 사람(@부름·그 사람 화면)은 이름이 겹쳐도 그 사람으로 확정이다
  const certain = new Set([...(about ? [about.contactId] : []), ...mentioned.map((p) => p.contactId)]);
  return { s, people, items, certain, said };
}

/** 아직 없는 사람(초안의 새 사람·못 정한 줄)이라 contactId 자리에 쓰는 이름표 */
const ghost = (id: string) => id.startsWith("new:") || id.startsWith("pick:");

/**
 * 대상이 정해진 항목을 사람 기록·내 리드미·메모에 넣는다(write). 새 사람은 같은 이름당 한 명만 새로 더한다.
 * write가 false면 같은 길을 가되 아무것도 쓰지 않고(새 사람도 만들지 않는다) 어떻게 적힐지 줄만 돌려준다 — 확인 화면의 초안·미리 보기.
 * 대상이 내 사람이 아니거나(사람 목록에 없다) 저장인데 아직 못 정한 줄(pick)은 건너뛴다
 * importing이면 메모 가져오기: 더하기만 한다(바꾸기는 더하기로, 지우기는 건너뛴다). 이미 값이 있는 한 칸짜리는 건드리지 않는다(mergeImport)
 */
async function apply(s: Session, people: Person[], rows: ResolvedCapture[], write: boolean, importing = false): Promise<{ lines: CaptureDraftLine[]; undo: UndoOp[] }> {
  const { locale } = s.profile;
  const lines: CaptureDraftLine[] = [];
  const undo: UndoOp[] = [];
  const me = translate(locale, "voice.me");
  await s.tx(async (q) => {
    // 저장은 사람마다 한 번에 하나씩(같은 사람이 동시에 두 번 적어도 서로 덮어쓰지 않게), 저장하는 사람의 기록은 읽을 때 잠가서 그 사이 다른 저장이 못 끼어들게 한다
    if (write) await q("select pg_advisory_xact_lock(hashtext($1))", [`capture:${s.user.id}`]);
    const mine = (await readCard(q, s.user.id, write)).card;
    // 같은 말 안에서 같은 칸을 여러 번 고쳐도 차례로 합쳐지게 지금 값을 들고 다닌다. 사람의 기록은 처음 건드릴 때 읽는다(목록은 기록을 풀지 않은 것)
    const known = new Set(people.map((p) => p.contactId));
    const cards = new Map<string, PartialCard>([["me", { ...mine }]]);
    const names = new Map<string, string>([["me", me], ...people.map((p) => [p.contactId, displayName(p)] as [string, string])]);
    const cardOf = async (id: string): Promise<PartialCard> => {
      let card = cards.get(id);
      if (!card) cards.set(id, (card = await readContactCard(q, s.user.id, id, write)));
      return card;
    };
    const created = new Map<string, string>(); // 새 사람 이름(nameKey) → contactId(초안에서는 아직 없는 사람이라 이름표 new:이름)
    const touched = new Set<string>();
    // 사람 수 한도(LIMITS.people): 사람 더하기·물어보기와 같다. 처음 새 사람이 나올 때 한 번 세고 더할 때마다 올린다
    let total: number | null = null;
    // 사람마다 메모는 이 말 안에서 한 번만 읽고, 새로 남긴 것은 목록에 보탠다
    const notes = new Map<string, Note[]>();
    const notesOf = async (id: string): Promise<Note[]> => {
      let list = notes.get(id);
      if (!list) notes.set(id, (list = ghost(id) ? [] : await listNotes(q, s.user.id, id)));
      return list;
    };

    for (const row of rows) {
      if (importing && row.item.op === "remove") continue; // 가져오기는 지우지 않는다
      const { target } = row;
      let who: string;
      if (target.kind === "me") who = "me";
      else if (target.kind === "person") {
        if (!known.has(target.id) || target.id === "me") continue; // 내 사람이 아니면 어디에도 적지 않는다
        who = target.id;
      } else if (target.kind === "new") {
        const key = nameKey(target.name);
        const existing = created.get(key);
        if (existing) who = existing;
        else {
          if (write) {
            total ??= (await q.one<{ n: number }>("select count(*)::int as n from contacts where user_id = $1", [s.user.id]))?.n ?? 0;
            if (total >= LIMITS.people) continue; // 사람이 너무 많으면 새 사람은 더하지 않는다(사람 더하기와 같다)
            total++;
            const c = await q.one<{ id: string }>("insert into contacts (user_id, nickname) values ($1, $2) returning id", [s.user.id, target.name]);
            await q("insert into contact_cards (contact_id, author_id) values ($1, $2)", [c!.id, s.user.id]);
            who = c!.id;
            undo.push({ type: "contact", contactId: who });
          } else who = `new:${target.name}`;
          created.set(key, who);
          cards.set(who, {});
          notes.set(who, []);
          names.set(who, target.name);
        }
      } else {
        if (write) continue; // 못 정한 줄은 저장하지 않는다
        who = `pick:${row.idx}`;
        cards.set(who, {});
        notes.set(who, []);
        names.set(who, row.spoken);
      }
      // 화면이 줄과 함께 되돌려 받는 것: 대상까지 반영한 항목과 대상·말한 이름·후보
      const item = { ...row.item, who: whoOf(target, row.spoken), ...(importing ? { op: "add" as const } : {}) };
      const extra = { item, idx: row.idx, target, spoken: row.spoken, candidates: row.candidates };
      const isNew = [...created.values()].includes(who);
      const href = who === "me" ? "/me" : ghost(who) ? "" : `/people/${who}`;

      if (item.target === "memo") {
        if (item.op !== "add") continue; // 메모를 고치거나 지우는 건 메모 칸에서
        const body = clip((item.text ?? "").trim(), 1000).trim();
        if (!body || who === "me") continue; // 나에 대한 메모 칸은 없다
        // 같은 말을 또 하면 메모를 두 번 남기지 않는다
        const kept = await notesOf(who);
        if (kept.some((n) => n.body.trim() === body)) continue;
        if (write && kept.length >= LIMITS.notes) continue; // 메모가 너무 많으면 더하지 않는다(메모 더하기와 같다)
        if (write) {
          const n = await q.one<{ id: string }>("insert into notes (author_id, contact_id, label, payload) values ($1, $2, '', $3) returning id", [
            s.user.id,
            who,
            JSON.stringify(sealNote(s.user.id, who, body)),
          ]);
          kept.unshift({ id: n!.id, label: "", body, createdAt: new Date().toISOString() });
          undo.push({ type: "note", contactId: who, id: n!.id });
        } else kept.unshift({ id: "", label: "", body, createdAt: new Date().toISOString() });
        lines.push({ who: names.get(who)!, isNew, op: "add", field: translate(locale, "voice.memo"), value: body, href, ...extra });
        continue;
      }

      const field = captureField(item.target);
      if (!field) continue;
      const card = await cardOf(who);
      const op = item.op;
      const merged = importing ? mergeImport(field, card[field.section], item) : mergeCapture(field, card[field.section], item, op);
      // 내 리드미의 선물 목록은 '받고 싶은 것', 다른 사람 기록에서는 '해주고 싶은 선물'
      const label = who === "me" && field.key === "gifts.wishlist" ? translate(locale, "gift.wishTitle") : field.label[locale];
      const line = { who: names.get(who)!, isNew, op, field: label, value: describeCapture(field, item, locale), href, ...extra };
      if (!merged) {
        // 이미 그대로 적혀 있으면 '이미 알고 있어요', 지울 게 없으면 '이미 없어요'(값이 틀린 더하기·바꾸기는 버린다)
        if (op === "remove" || (importing ? mergeImport(field, null, item) : mergeCapture(field, null, item, op))) lines.push({ ...line, same: true });
        continue;
      }
      const key = `${who}:${field.section}`;
      if (!touched.has(key)) {
        touched.add(key);
        undo.push({ type: "section", who, section: field.section, before: card[field.section] ?? null, after: merged });
      } else {
        // 같은 항목을 이 말에서 또 고쳤다: 되돌릴 때 비교할 '적은 값'을 마지막 값으로
        const first = undo.find((u) => u.type === "section" && u.who === who && u.section === field.section);
        if (first && first.type === "section") first.after = merged;
      }
      if (write) {
        if (who === "me") await writeSection(q, s.user.id, field.section, merged);
        else await writeContactSection(q, s.user.id, who, field.section, merged);
      }
      (card as Record<string, unknown>)[field.section] = merged;
      lines.push(line);
    }
  });
  return { lines, undo };
}

/** 저장이 끝난 뒤 화면을 새로 그리게 하고 이용 기록을 남긴다 */
function committed(s: Session) {
  track("capture", { userId: s.user.id });
  revalidatePath("/people", "layout");
  revalidatePath("/home");
  revalidatePath("/me");
}

/** 확인 화면에 보일 줄(저장 단계가 쓰는 항목은 빼고 화면용 줄만) */
const plain = (l: CaptureDraftLine): CaptureLine => ({ who: l.who, isNew: l.isNew, op: l.op, same: l.same, field: l.field, value: l.value, href: l.href });

/**
 * 말(글) 한 번을 나눠 바로 사람 기록·내 리드미·메모에 넣는다(되돌리기로 취소). 그 사람 화면의 한 줄 적기가 쓴다
 * aboutId·picked는 classify와 같다
 */
export async function captureNote(raw: string, aboutId?: string, picked?: { id: string; label: string }[]): Promise<CaptureState> {
  const c = await classify(raw, aboutId, picked);
  if ("error" in c) return { lines: [], undo: [], error: c.error };
  let done;
  let held: CaptureDraftLine[] = [];
  try {
    const rows = resolveCapture(c.items, c.people.map(asCapture), { detect: false });
    // 알레르기·못 먹는 것·식단을 지우거나 바꾸는 말은 바로 적지 않는다: 말을 잘못 알아들으면 알레르기가 조용히 사라질 수 있다. 나머지는 바로 적는다
    const hold = rows.filter((r) => holdsForConfirm(r.item));
    done = await apply(c.s, c.people, rows.filter((r) => !hold.includes(r)), true);
    // 확인받을 줄은 아무것도 쓰지 않고 어떻게 바뀔지만 만든다(이미 그렇게 되어 있는 줄은 확인할 게 없다)
    if (hold.length) held = (await apply(c.s, c.people, hold, false)).lines.filter((l) => !l.same);
  } catch {
    return { lines: [], undo: [], error: "failed" };
  }
  if (!done.lines.length && !held.length) return { lines: [], undo: [], error: "nothing" };
  if (done.lines.length) committed(c.s);
  return { lines: done.lines.map(plain), undo: done.undo, error: null, ...(held.length ? { held } : {}) };
}

/**
 * 말로 적기 1단계 — 나누기만 한다: AI가 (사람 · 칸 · 값)으로 나눈 결과를 아무것도 저장하지 않고 초안으로 돌려준다.
 * 화면은 초안의 값을 고치게 하고, 저장 단계(saveCapture)에 고친 항목을 되돌려 보낸다
 */
export async function draftCapture(raw: string, aboutId?: string, picked?: { id: string; label: string }[], only = false): Promise<CaptureDraft> {
  const c = await classify(raw, aboutId, picked);
  if ("error" in c) return { lines: [], error: c.error };
  let done;
  try {
    // only: 사람 화면의 구슬에서 온 말(?to=)이라 모든 줄이 aboutId 사람의 기록이다(누구 이야기인지 따지지 않는다). 내 사람이 아니면 아무 줄도 만들지 않는다
    const target = only && aboutId ? c.people.find((p) => p.contactId === aboutId) : undefined;
    const rows: ResolvedCapture[] = target
      ? c.items.map((item, idx) => ({ idx, item, target: { kind: "person", id: target.contactId }, spoken: displayName(target), candidates: [] }))
      : // 같은 이름이 여럿이면 어느 쪽인지 고르게(pick) 하고, 후보를 같이 돌려준다
        resolveCapture(c.items, c.people.map(asCapture), { detect: true, certain: c.certain });
    done = await apply(c.s, c.people, rows, false);
  } catch {
    return { lines: [], error: "failed" };
  }
  if (!done.lines.length) return { lines: [], error: "nothing" };
  const leftover = findLeftovers(c.said, done.lines);
  return { lines: done.lines, error: null, ...(leftover.length ? { leftover } : {}) };
}

/**
 * 말로 적기 2단계 — 저장: 초안에서 대상을 정하고 값을 고치고 줄을 뺀 항목들을 실제 기록에 넣는다(기존 합치기·'이미 알고 있어요' 판단·새 사람 더하기를 그대로).
 * 항목의 who가 정해진 대상이다: 내 사람(contactId)이거나 새 사람(이름). contactId가 내 사람이 아니면 그 줄은 건너뛰고(새 사람으로 둔갑시키지 않는다),
 * 새 사람은 같은 이름당 한 명만 만든다. 화면에서 온 값이라 모양을 다시 맞추고, AI는 부르지 않는다. 내 기록만 고칠 수 있다(RLS)
 */
export async function saveCapture(raw: unknown): Promise<CaptureState> {
  const s = await requireSession();
  const items = cleanCaptureItems(raw);
  if (!items.length) return { lines: [], undo: [], error: "nothing" };
  let done;
  try {
    const people = await listPeopleLite(s);
    done = await apply(s, people, resolveSaved(items, people.map(asCapture)), true);
  } catch {
    return { lines: [], undo: [], error: "failed" };
  }
  if (!done.lines.length) return { lines: [], undo: [], error: "nothing" };
  committed(s);
  return { lines: done.lines.map(plain), undo: done.undo, error: null };
}

/**
 * 초안에서 줄의 대상·항목을 바꾼 뒤 '이미 알고 있어요'를 다시 따진다(아무것도 저장하지 않고, AI도 부르지 않는다).
 * 보낸 항목 순서대로 idx를 돌려주고, 줄이 안 오면 저장해도 적히지 않는 줄이다
 */
export async function previewCapture(raw: unknown): Promise<CapturePreview> {
  const s = await requireSession();
  const items = cleanCaptureItems(raw);
  if (!items.length) return { ok: false, lines: [] };
  try {
    const people = await listPeopleLite(s);
    const done = await apply(s, people, resolveSaved(items, people.map(asCapture)), false);
    return { ok: true, lines: done.lines.map((l) => ({ idx: l.idx, same: !!l.same })) };
  } catch {
    return { ok: false, lines: [] };
  }
}

/**
 * 방금 말로 적은 것 되돌리기(거꾸로). 항목은 그 뒤에 직접 고치지 않았을 때만 되돌린다(지금 값이 말로 적은 값 그대로일 때):
 * 그 사이에 고친 내용을 옛 값으로 덮어쓰지 않으려고, 달라졌으면 그 항목은 그대로 둔다
 */
export async function undoCapture(ops: UndoOp[]): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!Array.isArray(ops)) return { ok: false };
  try {
    await s.tx(async (q) => {
      await q("select pg_advisory_xact_lock(hashtext($1))", [`capture:${s.user.id}`]);
      const mine = (await readCard(q, s.user.id, true)).card;
      for (const op of [...ops].reverse()) {
        if (op?.type === "note" && isUuid(op.id)) await q("delete from notes where id = $1::uuid", [op.id]);
        else if (op?.type === "contact" && isUuid(op.contactId)) await q("delete from contacts where id = $1::uuid", [op.contactId]);
        else if (op?.type === "section" && isSection(op.section) && typeof op.who === "string" && (op.who === "me" || isUuid(op.who))) {
          const section = op.section;
          // 적은 뒤에 직접 고쳤으면(지금 값 ≠ 적은 값) 건드리지 않는다. after가 없는 옛 요청은 예전처럼 되돌린다
          if (op.after !== undefined) {
            const now = op.who === "me" ? mine[section] : (await readContactCard(q, s.user.id, op.who, true))[section];
            if (!sameSectionValue(section, now, op.after)) continue;
          }
          if (op.who === "me") {
            if (op.before == null) await q("delete from card_sections where owner_id = $1 and section = $2", [s.user.id, section]);
            else await writeSection(q, s.user.id, section, sanitizeSection(section, op.before) as CardData[Section]);
          } else if (op.before == null) {
            await q("update contact_cards set sections = sections - $2::text where contact_id = $1::uuid", [op.who, section]);
          } else {
            await writeContactSection(q, s.user.id, op.who, section, sanitizeSection(section, op.before));
          }
        }
      }
    });
  } catch {
    return { ok: false };
  }
  revalidatePath("/people", "layout");
  revalidatePath("/home");
  revalidatePath("/me");
  return { ok: true };
}

// ── 메모 가져오기 ─────────────────────────────────────────────
// 사람들이 따로 적어 둔 메모(붙여넣은 글·받아쓴 글)를 긴 채로 읽어 새 사람을 더하거나 있는 사람에 없는 것만 더한다.
// 말로 적기와 같은 길(나누기 초안 → 확인 → 저장 → 되돌리기)을 쓰되: 글이 길어 조각으로 잘라 동시에 읽고(한 번 가져오기가 하루 한도 한 번),
// 더하기만 하고(이미 값이 있는 칸은 그대로), 범위를 정할 수 있다 — any: 메모에 여러 사람 / 내 사람 한 명(contactId): 그 사람 이야기뿐 / new: 아직 없는 한 사람.

/** 가져오기가 읽지 못한 이유(말로 적기와 같은 것 + 사진을 받지 않는 이유) */
export type ImportError = NonNullable<CaptureState["error"]> | "bad_image" | "not_memo" | "unreadable" | "sensitive";

/** 가져오기 초안: 말로 적기 초안 줄들. new 범위에서는 AI가 읽은 이름(없으면 빈 글), 사진이면 읽지 못해 건너뛴 사진 수를 같이 돌려준다 */
export interface ImportDraft {
  lines: CaptureDraftLine[];
  error: ImportError | null;
  name: string;
  skipped: number;
  /** 어느 줄에도 안 들어간 안전한 말(글 메모만. 사진은 글자가 없어 보지 않는다) */
  leftover?: string[];
}

/** 조각 사이를 이어 주는 앞 조각의 끝(누구 목록인지 알려 주는 용도) */
const PREVIOUS_CHARS = 200;

/** new 범위에서 메모가 한 사람을 부르는 이름: AI가 새 사람으로 읽은 이름 중 가장 많이 나온 것 */
function commonName(items: readonly CaptureItem[]): string {
  const count = new Map<string, { name: string; n: number }>();
  for (const it of items) {
    if (it.who.type !== "new") continue;
    const name = tidyName(it.who.name);
    if (!name) continue;
    const key = nameKey(name);
    const cur = count.get(key);
    if (cur) cur.n++;
    else count.set(key, { name, n: 1 });
  }
  return [...count.values()].sort((a, b) => b.n - a.n)[0]?.name ?? "";
}

/** 받지 않은 사진의 이유 중 사람에게 가장 알려 줄 것(신분증·카드 > 메모가 아님 > 글이 안 읽힘 > 적을 게 없음) */
const REJECT_ORDER: ImportError[] = ["sensitive", "not_memo", "unreadable", "nothing"];
const rejectReason = (kind: ImageKind): ImportError => (kind === "id_or_payment" || kind === "inappropriate" ? "sensitive" : kind === "other" ? "not_memo" : kind === "unreadable" ? "unreadable" : "nothing");

/** 가져올 것: 메모 글, 또는 서버가 이미 확인한 사진들(JPEG data URL, 저장하지 않고 AI에만 보낸다) */
type ImportInput = { kind: "text"; memo: string } | { kind: "images"; photos: string[] };

/**
 * 읽기 본체(글·사진 공통): 한도를 잡고 AI로 읽어 항목을 다듬고, 범위에 맞게 대상을 정해 초안 줄들로 돌려준다.
 * - 읽는 사진이 아니면(풍경·신분증·카드·안 읽힘) 아무것도 적지 않는다. 읽은 항목은 tidyImportItems로 쓸데없는 것(식별 정보·긴 메모·중복·메모뿐인 새 사람)을 걸러 낸다
 * - 한 조각·한 장이라도 불러 보지 못했으면 통째로 실패로 하고 한도를 돌려준다. 불러서 답을 받은 뒤의 거절(사진이 메모가 아님 등)은 비용이 났으니 돌려주지 않는다
 */
async function runImport(s: Session, scopeRaw: string, input: ImportInput): Promise<ImportDraft> {
  const none = (error: ImportError, skipped = 0): ImportDraft => ({ lines: [], error, name: "", skipped });
  const { locale } = s.profile;
  if (!aiConfigured()) return none("ai_off");
  const people = await listPeopleLite(s);
  let scope: ImportScope = { kind: "any" };
  let about: Person | undefined;
  if (scopeRaw === "new") scope = { kind: "new" };
  else if (isUuid(scopeRaw)) {
    about = people.find((p) => p.contactId === scopeRaw);
    if (!about) return none("failed");
    scope = { kind: "person", person: asCapture(about) };
  }
  const gate = await reserveAi({ id: s.user.id, demo: s.user.isAnonymous || s.profile.isDemo }, "import");
  if (gate === "user_limit" || gate === "global_limit") return none("limit");
  if (gate !== "ok") return none("failed");
  const known = people.map(asCapture);
  let items: CaptureItem[];
  let skipped = 0;
  if (input.kind === "images") {
    const settled = await Promise.allSettled(input.photos.map((url) => classifyImportImage(url, known, locale, scope)));
    if (settled.some((r) => r.status === "rejected")) {
      await refundAi(s.user.id, "import");
      return none("failed");
    }
    const readings = settled.map((r) => (r as PromiseFulfilledResult<ImageReading>).value);
    const accepted = readings.filter((r) => r.accepted);
    skipped = readings.length - accepted.length;
    track("import_draft", { userId: s.user.id, source: "image" });
    if (!accepted.length) {
      const why = readings.map((r) => rejectReason(r.kind)).sort((a, b) => REJECT_ORDER.indexOf(a) - REJECT_ORDER.indexOf(b))[0]!;
      return none(why, skipped);
    }
    items = accepted.flatMap((r) => r.items);
  } else {
    const chunks = splitMemo(input.memo);
    try {
      items = (await Promise.all(chunks.map((c, i) => classifyImport(c, i ? chunks[i - 1]!.slice(-PREVIOUS_CHARS) : "", known, locale, scope)))).flat();
    } catch {
      await refundAi(s.user.id, "import");
      return none("failed");
    }
    track("import_draft", { userId: s.user.id, source: scope.kind });
  }
  items = tidyImportItems(items);
  if (!items.length) return none("nothing", skipped);
  let name = "";
  let rows: ResolvedCapture[];
  if (scope.kind === "person") {
    // 그 사람 이야기뿐: 누구 이야기라고 했든 그 사람으로
    rows = resolveSaved(items.map((it) => ({ ...it, who: { type: "existing" as const, contactId: about!.contactId, name: null } })), known);
  } else if (scope.kind === "new") {
    name = commonName(items);
    const label = name || translate(locale, "import.unnamed");
    rows = resolveSaved(items.map((it) => ({ ...it, who: { type: "new" as const, contactId: null, name: label } })), known);
  } else {
    rows = resolveCapture(items, known, { detect: true });
  }
  let done;
  try {
    done = await apply(s, people, rows, false, true);
  } catch {
    return none("failed", skipped);
  }
  if (!done.lines.length) return none("nothing", skipped);
  const leftover = input.kind === "text" ? findLeftovers(input.memo, done.lines) : [];
  return { lines: done.lines, error: null, name, skipped, ...(leftover.length ? { leftover } : {}) };
}

/**
 * 메모 가져오기 1단계(글) — 읽기만 한다(아무것도 저장하지 않는다): 붙여 넣거나 말한 메모를 조각으로 잘라 동시에 읽어
 * 말로 적기 초안과 같은 줄들로 돌려준다. scope: "new" | "any"(그 밖의 값) | 내 사람의 contactId
 */
export async function draftImport(raw: string, scopeRaw: string): Promise<ImportDraft> {
  const s = await requireSession();
  const memo = cleanMemo(raw);
  if (!memo) return { lines: [], error: "nothing", name: "", skipped: 0 };
  return runImport(s, scopeRaw, { kind: "text", memo });
}

/**
 * 메모 가져오기 1단계(사진) — 읽기만 한다: 폰에서 줄여 JPEG로 다시 만든 사진 한 장 이상 세 장까지를 파일(FormData의 image, scope)로 받는다.
 * AI에 보내기 전에 서버가 사진마다 한 번 더 확인한다(파일 크기·JPEG 시작과 끝 표시·가로세로 범위, core checkJpegBytes). 하나라도 걸리면
 * 한도를 쓰지 않고 bad_image로 돌려보낸다. 사진은 저장하지 않고 AI에만 보낸다(store:false)
 */
export async function draftImportImages(form: FormData): Promise<ImportDraft> {
  const s = await requireSession();
  const bad: ImportDraft = { lines: [], error: "bad_image", name: "", skipped: 0 };
  if (!(form instanceof FormData)) return bad;
  const entries = form.getAll("image");
  if (entries.length < 1 || entries.length > IMAGE_MAX_COUNT) return bad;
  const photos: string[] = [];
  for (const e of entries) {
    // 문자열이거나 파일이 아니면, 너무 크면(읽어 들이기 전에) 거절
    if (typeof e === "string" || typeof (e as Blob).arrayBuffer !== "function" || (e as Blob).size > IMAGE_MAX_BYTES) return bad;
    const bytes = new Uint8Array(await (e as Blob).arrayBuffer());
    if (!checkJpegBytes(bytes).ok) return bad;
    photos.push(`data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`);
  }
  return runImport(s, String(form.get("scope") ?? "any"), { kind: "images", photos });
}

/**
 * 메모 가져오기 2단계 — 저장: 초안에서 대상을 정하고 줄을 뺀 항목들을 더하기만으로 기록에 넣는다(AI는 부르지 않는다). 되돌리기 정보를 같이 돌려준다.
 * 항목의 who가 정해진 대상이다(내 사람 contactId 또는 새 사람 이름, 내 사람이 아닌 contactId는 줄째 버린다). 새 사람은 같은 이름당 한 명만 만든다
 */
export async function saveImport(raw: unknown): Promise<CaptureState> {
  const s = await requireSession();
  const items = cleanCaptureItems(raw, new Date(), 240);
  if (!items.length) return { lines: [], undo: [], error: "nothing" };
  let done;
  try {
    const people = await listPeopleLite(s);
    done = await apply(s, people, resolveSaved(items, people.map(asCapture)), true, true);
  } catch {
    return { lines: [], undo: [], error: "failed" };
  }
  if (!done.lines.length) return { lines: [], undo: [], error: "nothing" };
  track("import_save", { userId: s.user.id });
  revalidatePath("/people", "layout");
  revalidatePath("/home");
  revalidatePath("/me");
  return { lines: done.lines.map(plain), undo: done.undo, error: null };
}
