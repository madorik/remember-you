"use server";

import { clip, revertEffects, type Section } from "@readme/core";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { organizeNote } from "@/app/actions/capture";
import { openNote, readContactCard, requireSession, sealNote, writeContactSection } from "@/lib/data";
import { effectsAfterRevert } from "@/lib/note-revert";
import { isUuid } from "@/lib/uuid";

// 사람 화면 메모장의 메모 하나 다루기(capture.ts의 메모 지우기와 같은 방식): 저장 잠금 → 메모 줄 → 사람 기록 차례로 잡아,
// 메모를 정리하는 AI(organizeMemo의 apply)와 서로 엇갈리지 않는다.

/**
 * 메모 하나가 사람 기록에 더한 것만 되돌린다(메모는 그대로 둔다): 지금도 그대로 남아 있고 다른 남는 메모가 뒷받침하지 않는 것만(revertEffects, 메모 지우기의 '같이 지우기'와 같다).
 * 되돌린 뒤 이 메모에 저장된 '더한 것'은 비운다(다시 말했다는 표시만 남긴다): 메모 시트가 더는 같이 지우기를 내놓지 않고, 다시 눌러도 아무 일이 없다.
 * 이미 지워졌거나 더한 것이 없으면 ok(되돌린 것 0). reverted는 실제로 되돌린 칸(일)의 수.
 * from을 주면 메모에 남은 일 중 그 번째부터 뒤의 것만 되돌린다(앞의 것은 그대로): 고친 메모를 다시 정리해 새로 더해진 것만 되돌릴 때(새 일은 늘 뒤에 붙는다)
 */
export async function revertNoteEffects(contactId: string, noteId: string, from = 0): Promise<{ ok: boolean; reverted: number }> {
  const s = await requireSession();
  if (!isUuid(contactId) || !isUuid(noteId)) return { ok: false, reverted: 0 };
  const start = Number.isInteger(from) && from > 0 ? from : 0;
  try {
    const reverted = await s.tx(async (q) => {
      await q("select pg_advisory_xact_lock(hashtext($1))", [`capture:${s.user.id}`]);
      const row = await q.one<{ id: string; payload: unknown }>("select id, payload from notes where id = $1::uuid and contact_id = $2::uuid and author_id = $3 for update", [noteId, contactId, s.user.id]);
      if (!row) return 0; // 이미 없다
      const note = openNote(row.payload, s.user.id, contactId);
      const mine = note?.effects.slice(start) ?? [];
      if (!note || !mine.length) return 0;
      const rest = await q<{ payload: unknown }>("select payload from notes where contact_id = $1::uuid and id <> $2::uuid", [contactId, noteId]);
      // 같은 메모의 앞 일(start 앞)도 이 일을 뒷받침하는 것으로 본다(앞 일이 남는다)
      const others = [...note.effects.slice(0, start), ...rest.flatMap((r) => openNote(r.payload, s.user.id, contactId)?.effects ?? [])];
      const card = await readContactCard(q, s.user.id, contactId, true);
      const result = revertEffects(card, mine, others);
      for (const section of Object.keys(result.sections) as Section[]) await writeContactSection(q, s.user.id, contactId, section, result.sections[section]!);
      await q("update notes set payload = $2::jsonb where id = $1::uuid", [noteId, JSON.stringify(sealNote(s.user.id, contactId, note.body, [...note.effects.slice(0, start), ...effectsAfterRevert(mine)]))]);
      return result.undone.length;
    });
    revalidatePath("/people", "layout");
    revalidatePath("/home");
    return { ok: true, reverted };
  } catch {
    return { ok: false, reverted: 0 };
  }
}

/**
 * 메모 글 고치기(내가 적은 메모만): 앞뒤 공백을 걷고 1000자까지, 빈 글은 받지 않는다(지우려면 메모 지우기).
 * 이 메모가 사람 기록에 더한 것(effects)은 그대로 둔다 — 글을 고쳤다고 이미 정리된 기록을 되돌리지 않는다.
 * 글이 실제로 바뀌었으면 저장 뒤 응답을 보낸 다음(after) AI가 고친 글을 그 사람 하나로 다시 정리한다(organizeNote): 새로 더해진 것은 이 메모의 더한 것 뒤에 합쳐진다.
 * 돌려주는 body는 실제로 저장된 글(자른 뒤), organizing은 다시 정리를 시작했는지(화면이 곧 새로 받아 알리게). 이미 지워진 메모면 ok가 아니다
 */
export async function updateNote(contactId: string, noteId: string, rawBody: string): Promise<{ ok: boolean; body: string; organizing: boolean }> {
  const s = await requireSession();
  const body = clip(String(rawBody ?? "").trim(), 1000).trim();
  const fail = { ok: false, body: "", organizing: false };
  if (!isUuid(contactId) || !isUuid(noteId) || !body) return fail;
  try {
    const done = await s.tx(async (q) => {
      await q("select pg_advisory_xact_lock(hashtext($1))", [`capture:${s.user.id}`]);
      const row = await q.one<{ id: string; payload: unknown }>("select id, payload from notes where id = $1::uuid and contact_id = $2::uuid and author_id = $3 for update", [noteId, contactId, s.user.id]);
      if (!row) return null;
      const note = openNote(row.payload, s.user.id, contactId);
      if (!note) return null; // 풀 수 없는 메모는 덮어쓰지 않는다
      await q("update notes set payload = $2::jsonb where id = $1::uuid", [noteId, JSON.stringify(sealNote(s.user.id, contactId, body, note.effects))]);
      return { changed: note.body.trim() !== body };
    });
    if (!done) return fail;
    revalidatePath("/people", "layout");
    // 글이 바뀌었을 때만 다시 정리한다(응답 뒤: 서버 액션 안의 after는 세션을 그대로 쓴다)
    if (done.changed) after(() => organizeNote(contactId, noteId));
    return { ok: true, body, organizing: done.changed };
  } catch {
    return fail;
  }
}
