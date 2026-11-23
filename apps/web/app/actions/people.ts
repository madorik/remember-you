"use server";

import { applyAnswer, isSection, QUESTIONS, sanitizeAvatar, ymdKey, type AvatarConfig, type DailyQuestion, type Section } from "@readme/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readPerson, requireSession, sealNote, todayFor, writeContactSection, type Session } from "@/lib/data";
import type { Q } from "@/lib/db";
import { LIMITS } from "@/lib/data-core";
import { isFolderColor, isFolderIcon } from "@/lib/folders";
import { addQuestionLog } from "@/lib/question-log";
import { track } from "@/lib/track";
import { isUuid } from "@/lib/uuid";
import type { SaveState } from "./card";

function json(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v ?? "null"));
  } catch {
    return null;
  }
}

/** 내 주소록 칸인지 확인(RLS가 내 것만 돌려준다) */
async function ownContact(contactId: string) {
  const s = await requireSession();
  // uuid 모양이 아니면 DB를 부르지 않는다(id = $1::uuid로 기본키 인덱스를 쓰고, 이상한 글이 오류가 되지 않게)
  const contact = isUuid(contactId)
    ? await s.tx((q) => q.one<{ id: string; person_id: string | null }>("select id, person_id from contacts where id = $1::uuid", [contactId]))
    : null;
  if (!contact) redirect("/people");
  return { s, contact };
}

export async function addNote(form: FormData): Promise<void> {
  const contactId = String(form.get("contactId"));
  const { s } = await ownContact(contactId);
  const label = String(form.get("label") ?? "").trim().slice(0, 40);
  const body = String(form.get("body") ?? "").trim().slice(0, 1000);
  if (body) {
    // 한 사람에게 메모는 LIMITS.notes개까지(넘으면 비었을 때처럼 그냥 넘어간다)
    const added = await s.tx(async (q) => {
      const n = await q.one<{ n: number }>("select count(*)::int as n from notes where contact_id = $1", [contactId]);
      if ((n?.n ?? 0) >= LIMITS.notes) return false;
      await q("insert into notes (author_id, contact_id, label, payload) values ($1, $2, $3, $4)", [s.user.id, contactId, label, JSON.stringify(sealNote(s.user.id, contactId, body))]);
      return true;
    });
    if (added) track("note_add", { userId: s.user.id });
  }
  revalidatePath(`/people/${contactId}`);
}

/** 이 사람이 보낸 답장 알림을 읽은 것으로(사람 화면을 열었을 때). 홈 위의 답장 카드가 사라진다 */
export async function seeAnswers(contactId: string): Promise<void> {
  if (typeof contactId !== "string" || !/^[0-9a-f-]{36}$/.test(contactId)) return;
  const s = await requireSession();
  await s.tx((q) => q("update notifications set read_at = now() where user_id = $1 and contact_id = $2 and kind = 'answered' and read_at is null", [s.user.id, contactId]));
  revalidatePath("/home");
}

export async function deleteNote(form: FormData): Promise<void> {
  const contactId = String(form.get("contactId"));
  const { s } = await ownContact(contactId);
  const noteId = String(form.get("noteId"));
  if (isUuid(noteId)) await s.tx((q) => q("delete from notes where id = $1::uuid and contact_id = $2::uuid", [noteId, contactId]));
  revalidatePath(`/people/${contactId}`);
}

/** 태그(내가 부르는 이름) 달기·고치기. 사람 화면 이름 밑에서 바로 저장한다(앱 사용자와 이어지지 않은 사람은 이게 이름) */
export async function setNickname(contactId: string, raw: string): Promise<{ ok: boolean; nickname: string }> {
  const s = await requireSession();
  const nickname = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!isUuid(contactId)) return { ok: false, nickname };
  const row = await s.tx((q) => q.one<{ id: string }>(
      // 이어지지 않은 사람은 태그가 곧 이름이라 비울 수 없다
      "update contacts set nickname = $2 where id = $1::uuid and ($2 <> '' or person_id is not null) returning id",
      [contactId, nickname],
    ));
  revalidatePeople(contactId);
  return { ok: !!row, nickname };
}

/** 사람 프로필(내가 꾸미는 얼굴과 부르는 말) 저장 → 사람 화면으로 */
export async function savePersonProfile(form: FormData): Promise<void> {
  const contactId = String(form.get("contactId") ?? "");
  const { s } = await ownContact(contactId);
  const nickname = String(form.get("name") ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  let avatar: AvatarConfig;
  try {
    avatar = sanitizeAvatar(JSON.parse(String(form.get("avatar") ?? "{}")));
  } catch {
    avatar = sanitizeAvatar({});
  }
  await s.tx((q) =>
    // 이어지지 않은 사람은 부르는 말이 곧 이름이라 비우면 예전 이름 그대로
    q("update contacts set avatar = $2, nickname = case when $3 = '' and person_id is null then nickname else $3 end where id = $1::uuid", [contactId, JSON.stringify(avatar), nickname]),
  );
  revalidatePeople(contactId);
  redirect(`/people/${contactId}`);
}

/** 주소록에서 빼기. 기록·메모·보낸 물어보기 링크도 같이 지워진다 */
export async function removeContact(form: FormData): Promise<void> {
  const contactId = String(form.get("contactId"));
  const { s } = await ownContact(contactId);
  await s.tx((q) => q("delete from contacts where id = $1", [contactId]));
  revalidatePath("/home");
  redirect("/people");
}

/**
 * 사람 목록에서 고른 여러 명을 한꺼번에 주소록에서 빼기. 기록·메모·보낸 물어보기 링크·폴더 소속이 같이 지워진다.
 * 내 사람만 지워지고(RLS + user_id), 실제로 지운 수를 돌려준다
 */
export async function removeContacts(contactIds: string[]): Promise<{ ok: boolean; removed: number }> {
  const s = await requireSession();
  const ids = cleanIds(contactIds);
  if (!ids.length) return { ok: false, removed: 0 };
  try {
    const gone = await s.tx((q) => q<{ id: string }>("delete from contacts where id = any($1::uuid[]) and user_id = $2 returning id", [ids, s.user.id]));
    revalidatePeople();
    return { ok: true, removed: gone.length };
  } catch {
    return { ok: false, removed: 0 };
  }
}

/** 오늘의 질문 카드를 한 번 처리했다고 센다(답하기·건너뛰기·물어보기·그만 묻기). 하루 두 번 처리하면 그날은 카드가 더 뜨지 않는다. 날이 바뀌면 1부터 */
async function spendQuestion(q: Q, s: Session): Promise<void> {
  await q(
    "update profiles set question_count = case when question_day = $2 then least(question_count + 1, 9) else 1 end, question_day = $2 where id = $1",
    [s.user.id, ymdKey(todayFor(s.profile))],
  );
}

/**
 * 오늘의 질문 답: 내가 등록한 그 사람의 기록 한 칸에 넣는다(내 사람만, 이미 적힌 칸은 그 위에 더하거나 바꾼다).
 * 끝나면 홈으로 돌아간다(오늘 두 번을 다 쓰지 않았으면 다음 질문이 뜬다)
 */
export async function answerAbout(form: FormData): Promise<void> {
  const contactId = String(form.get("contactId") ?? "");
  const id = String(form.get("id")) as DailyQuestion["id"];
  const value = String(form.get("value") ?? "").trim();
  if (!isUuid(contactId) || !QUESTIONS.some((x) => x.id === id) || !value) return;
  const s = await requireSession();
  // 이 사람 한 명의 기록만 읽는다(전체를 풀지 않는다)
  const person = await readPerson(s, contactId);
  if (!person) redirect("/home");
  await s.tx(async (q) => {
    for (const [section, data] of Object.entries(applyAnswer(person.card, id, value, s.profile.locale))) {
      if (isSection(section)) await writeContactSection(q, s.user.id, contactId, section, data);
    }
    await spendQuestion(q, s);
  });
  track("daily_answer", { userId: s.user.id, source: id.toLowerCase().replace(/[^a-z_]/g, "_").slice(0, 20) });
  // 오늘 한 질문 목록(홈의 '다 했어요' 체크 목록)에 적는다: 보기에서 골랐으면 그 보기의 이름으로
  const picked = QUESTIONS.find((x) => x.id === id)?.options.find((o) => o.value === value);
  await addQuestionLog(ymdKey(todayFor(s.profile)), { c: contactId, q: id, o: "a", v: picked ? picked.label[s.profile.locale] : value });
  revalidatePeople(contactId);
  redirect("/home?answered=1");
}

/** 오늘의 질문 건너뛰기: 모르는 건 넘어간다(오늘 한 번 쓴 것으로 센다) */
export async function skipAbout(form?: FormData): Promise<void> {
  const s = await requireSession();
  await s.tx((q) => spendQuestion(q, s));
  track("daily_skip", { userId: s.user.id });
  const contactId = String(form?.get("contactId") ?? "");
  const id = String(form?.get("id") ?? "");
  if (isUuid(contactId) && QUESTIONS.some((x) => x.id === id)) await addQuestionLog(ymdKey(todayFor(s.profile)), { c: contactId, q: id, o: "k" });
  revalidatePath("/home");
  redirect("/home");
}

/** 오늘의 질문 대신 그 사람에게 직접 물어보기: 그 사람을 고른 채, 그 질문 하나만 묻는 물어보기 화면으로(?q=질문 id) */
export async function askAbout(form: FormData): Promise<void> {
  const contactId = String(form.get("contactId") ?? "");
  const id = String(form.get("id")) as DailyQuestion["id"];
  const { s } = await ownContact(contactId);
  const known = QUESTIONS.some((x) => x.id === id);
  await s.tx((q) => spendQuestion(q, s));
  track("daily_ask", { userId: s.user.id, source: id.toLowerCase().replace(/[^a-z_]/g, "_").slice(0, 20) });
  if (QUESTIONS.some((x) => x.id === id)) await addQuestionLog(ymdKey(todayFor(s.profile)), { c: contactId, q: id, o: "w" });
  revalidatePath("/home");
  redirect(`/request?to=${contactId}${known ? `&q=${id}` : ""}`);
}

/** 이 사람에 대해 다시 묻지 않기: 오늘의 질문에서 뺀다(사람 화면에서 다시 켤 수 있다) */
export async function muteAbout(form: FormData): Promise<void> {
  const contactId = String(form.get("contactId") ?? "");
  const { s } = await ownContact(contactId);
  await s.tx(async (q) => {
    await q("update contacts set ask_off = true where id = $1::uuid", [contactId]);
    await spendQuestion(q, s);
  });
  track("daily_mute", { userId: s.user.id });
  const id = String(form.get("id") ?? "");
  if (QUESTIONS.some((x) => x.id === id)) await addQuestionLog(ymdKey(todayFor(s.profile)), { c: contactId, q: id, o: "m" });
  revalidatePeople(contactId);
  redirect("/home?muted=1");
}

/** 사람 화면에서 오늘의 질문을 다시 켜고 끄기 */
export async function setAskOff(contactId: string, off: boolean): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!isUuid(contactId)) return { ok: false };
  const row = await s.tx((q) => q.one<{ id: string }>("update contacts set ask_off = $2 where id = $1::uuid returning id", [contactId, off === true]));
  revalidatePeople(contactId);
  return { ok: !!row };
}

/** 사람 상세 화면을 열었다고 센다(하루에 한 번만): 자주 보는 사람에게만 질문하려고. 화면이 열린 뒤 브라우저가 부른다(미리 불러오기에는 세지 않는다) */
export async function noteView(contactId: string): Promise<void> {
  if (!isUuid(contactId)) return;
  const s = await requireSession();
  const day = ymdKey(todayFor(s.profile));
  await s.tx((q) =>
    q("update contacts set view_days = least(view_days + 1, 1000), viewed_on = $2::date where id = $1::uuid and viewed_on is distinct from $2::date", [contactId, day]),
  );
}

/** 사람 더하기: 주소록에 넣고 빈 기록을 만든 뒤 그 사람 화면으로 */
export async function createPerson(form: FormData): Promise<void> {
  const s = await requireSession();
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  // 홈 연말 카드에서 온 사람 추가(?xmas=1): 만든 뒤 곧바로 그 사람에게 받고 싶은 것을 물어보기로 이어 간다
  const xmas = form.get("xmas") === "1";
  const again = xmas ? "&xmas=1" : "";
  if (!name) redirect(`/people/new?error=name${again}`);
  // 프로필(얼굴): 화면이 보낸 것을 걸러서 받는다. 없거나 깨졌으면 비워 둔다(이니셜 원)
  let avatar: AvatarConfig | null = null;
  if (form.get("avatar")) {
    try {
      avatar = sanitizeAvatar(JSON.parse(String(form.get("avatar"))));
    } catch {
      avatar = null;
    }
  }
  const made = await s.tx(async (q) => {
    // 같은 사람이 동시에 두 번 보내도(두 번 누름) 한 줄씩만 지나가게 사람별로 줄 세운다
    await q("select pg_advisory_xact_lock(hashtext($1))", [`person:${s.user.id}`]);
    const cur = await q.one<{ n: number; dup: string | null }>(
      `select count(*)::int as n,
              (select id from contacts where user_id = $1 and nickname = $2 and created_at > now() - interval '5 seconds' order by created_at desc limit 1) as dup
         from contacts where user_id = $1`,
      [s.user.id, name],
    );
    // 방금(5초 안에) 같은 이름으로 만든 사람이 있으면 두 번 누른 것이니 그 사람으로
    if (cur?.dup) return { id: cur.dup, created: false };
    if ((cur?.n ?? 0) >= LIMITS.people) return null;
    const c = await q.one<{ id: string }>("insert into contacts (user_id, nickname, avatar) values ($1, $2, $3) returning id", [s.user.id, name, avatar ? JSON.stringify(avatar) : null]);
    await q("insert into contact_cards (contact_id, author_id) values ($1, $2)", [c!.id, s.user.id]);
    // 고른 폴더에 바로 넣는다(내 폴더만, DB가 확인). uuid 모양이 아니면 넣지 않는다
    const folder = String(form.get("folderId") ?? "");
    if (isUuid(folder)) await q("insert into contact_group_members (group_id, contact_id, user_id) values ($1, $2, $3)", [folder, c!.id, s.user.id]);
    return { id: c!.id, created: true };
  });
  // 사람 수 한도(LIMITS.people)를 넘으면 이름이 비었을 때처럼 입력 화면으로 되돌린다(화면은 error=name일 때만 문구를 보이니 새 문구는 없다)
  if (!made) redirect(`/people/new?error=limit${again}`);
  const contactId = made.id;
  if (made.created) track("person_add", { userId: s.user.id });
  revalidatePath("/people");
  revalidatePath("/home");
  redirect(xmas ? `/request?to=${contactId}&xmas=1` : `/people/${contactId}`);
}

/** 사람 기록의 항목 하나 저장(답받은 항목도 내가 고친다) */
export async function savePersonSection(_: SaveState, form: FormData): Promise<SaveState> {
  const s = await requireSession();
  const section = form.get("section");
  const contactId = String(form.get("contactId") ?? "");
  if (!isSection(section) || !contactId) return { saved: false, error: true };
  try {
    await s.tx((q) => writeContactSection(q, s.user.id, contactId, section as Section, json(form.get("data"))));
  } catch {
    return { saved: false, error: true };
  }
  track("record_save", { userId: s.user.id, source: section as string });
  revalidatePath(`/people/${contactId}`, "layout");
  revalidatePath("/people");
  revalidatePath("/home");
  return { saved: true, error: false };
}

// ── 폴더·즐겨찾기 ─────────────────────────────────

function cleanIds(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && isUuid(x)))].slice(0, 500) : [];
}

function cleanName(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
}

function revalidatePeople(contactId?: string) {
  revalidatePath("/people", "layout");
  revalidatePath("/home");
  if (contactId) revalidatePath(`/people/${contactId}`);
}

/** 즐겨찾기 켜고 끄기(사람들 맨 위에 고정) */
export async function setFavorite(contactId: string, on: boolean): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!isUuid(contactId)) return { ok: false };
  const row = await s.tx((q) => q.one<{ id: string }>("update contacts set favorite = $2 where id = $1::uuid returning id", [contactId, on === true]));
  if (row && on) track("favorite", { userId: s.user.id });
  revalidatePeople(contactId);
  return { ok: !!row };
}

/** 폴더 만들기(이름·모양·색). 같은 이름의 폴더가 있으면 그 폴더를 돌려준다 */
export async function createFolder(input: { name: string; icon: string; color: string }): Promise<{ id: string } | null> {
  const s = await requireSession();
  const name = cleanName(input?.name);
  if (!name) return null;
  const icon = isFolderIcon(input?.icon) ? input.icon : "star";
  const color = isFolderColor(input?.color) ? input.color : "lavender";
  const row = await s.tx(async (q) => {
    const same = await q.one<{ id: string }>("select id from contact_groups where user_id = $1 and builtin is null and name = $2", [s.user.id, name]);
    if (same) return same;
    // 직접 만든 폴더는 LIMITS.folders개까지
    const n = await q.one<{ n: number }>("select count(*)::int as n from contact_groups where user_id = $1 and builtin is null", [s.user.id]);
    if ((n?.n ?? 0) >= LIMITS.folders) return null;
    return (await q.one<{ id: string }>("insert into contact_groups (user_id, name, icon, color) values ($1, $2, $3, $4) returning id", [s.user.id, name, icon, color]));
  });
  if (row) track("folder_create", { userId: s.user.id });
  revalidatePeople();
  return row ? { id: String(row.id) } : null;
}

/** 폴더 고치기: 모양·색, 직접 만든 폴더는 이름도(기본 폴더 이름은 화면 언어로 붙으니 그대로) */
export async function updateFolder(id: string, input: { name?: string; icon: string; color: string }): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (typeof id !== "string" || !isUuid(id) || !isFolderIcon(input?.icon) || !isFolderColor(input?.color)) return { ok: false };
  const name = cleanName(input?.name);
  try {
    const row = await s.tx((q) =>
      q.one<{ id: string }>(
        "update contact_groups set icon = $2, color = $3, name = case when builtin is null and $4 <> '' then $4 else name end where id = $1::uuid returning id",
        [id, input.icon, input.color, name],
      ),
    );
    revalidatePeople();
    return { ok: !!row };
  } catch {
    return { ok: false };
  }
}

/** 직접 만든 폴더 지우기. 사람들은 그대로 남는다(기본 폴더는 DB가 막는다) */
export async function deleteFolder(id: string): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!isUuid(id)) return { ok: false };
  try {
    const row = await s.tx((q) => q.one<{ id: string }>("delete from contact_groups where id = $1::uuid and builtin is null returning id", [id]));
    revalidatePeople();
    return { ok: !!row };
  } catch {
    return { ok: false };
  }
}

/** 폴더에 든 사람을 이 목록으로 맞춘다(체크한 사람은 넣고, 뺀 사람은 뺀다). 내 사람만 들어간다(RLS) */
export async function setFolderMembers(folderId: string, contactIds: string[]): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!isUuid(folderId)) return { ok: false };
  const ids = cleanIds(contactIds);
  try {
    const ok = await s.tx(async (q) => {
      const f = await q.one<{ id: string }>("select id from contact_groups where id = $1::uuid", [folderId]);
      if (!f) return false;
      await q("delete from contact_group_members where group_id = $1 and contact_id <> all($2::uuid[])", [f.id, ids]);
      await q(
        "insert into contact_group_members (group_id, contact_id, user_id) select $1, c.id, $3 from contacts c where c.id = any($2::uuid[]) on conflict do nothing",
        [f.id, ids, s.user.id],
      );
      return true;
    });
    revalidatePeople();
    return { ok };
  } catch {
    return { ok: false };
  }
}

/** 사람 하나를 폴더에 넣기(사람들 목록에서 폴더 칸으로 끌어 놓을 때). 이미 있으면 그대로 */
export async function addToFolder(folderId: string, contactId: string): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!isUuid(folderId) || !isUuid(contactId)) return { ok: false };
  try {
    await s.tx((q) => q("insert into contact_group_members (group_id, contact_id, user_id) values ($1, $2, $3) on conflict do nothing", [folderId, contactId, s.user.id]));
    revalidatePeople(contactId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** 사람 하나를 이 폴더에서만 빼기(사람은 그대로, 다른 폴더도 그대로). 내 폴더·내 사람만 건드린다(RLS). 이미 없으면 그대로 성공 */
export async function removeFromFolder(folderId: string, contactId: string): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!isUuid(folderId) || !isUuid(contactId)) return { ok: false };
  try {
    await s.tx((q) => q("delete from contact_group_members where group_id = $1 and contact_id = $2", [folderId, contactId]));
    revalidatePeople(contactId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** 한 사람이 든 폴더를 이 목록으로 맞춘다(사람 화면의 폴더 고르기). 내 폴더만 들어간다(RLS) */
export async function setPersonFolders(contactId: string, folderIds: string[]): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!isUuid(contactId)) return { ok: false };
  const ids = cleanIds(folderIds);
  try {
    const ok = await s.tx(async (q) => {
      const c = await q.one<{ id: string }>("select id from contacts where id = $1::uuid", [contactId]);
      if (!c) return false;
      await q("delete from contact_group_members where contact_id = $1 and group_id <> all($2::uuid[])", [c.id, ids]);
      await q(
        "insert into contact_group_members (group_id, contact_id, user_id) select g.id, $1, $3 from contact_groups g where g.id = any($2::uuid[]) on conflict do nothing",
        [c.id, ids, s.user.id],
      );
      return true;
    });
    revalidatePeople(contactId);
    return { ok };
  } catch {
    return { ok: false };
  }
}
