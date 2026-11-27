import { inviteStatus, isSection, sanitizeSections } from "@readme/core";
import { NextResponse } from "next/server";
import { aad, open } from "@/lib/crypto";
import { displayName, listFolders, listPeople, readCard, getSession, type Note } from "@/lib/data";
import type { Q } from "@/lib/db";

// 내 정보 내려받기: 내 리드미, 내 사람들(이름·폴더·즐겨찾기·기록, 항목별로 받은 답이면 받은 때), 내가 쓴 메모,
// 내가 보낸 물어보기 기록(링크 주소·코드는 빼고), 알림·언어 설정, 지금 키로 풀지 못한 항목 수

const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/** 메모·물어보기·암호 해독 확인용 원본을 한 번에(트랜잭션 하나) 읽는다. 사람마다 따로 열지 않는다 */
async function readRaw(q: Q, me: string) {
  const sections = await q<{ section: string; payload: unknown }>("select section, payload from card_sections where owner_id = $1", [me]);
  const cards = await q<{ contact_id: string; sections: unknown }>("select contact_id, sections from contact_cards where author_id = $1", [me]);
  const notes = await q<{ id: string; contact_id: string; label: string; payload: unknown; created_at: Date }>(
    "select id, contact_id, label, payload, created_at from notes where author_id = $1 order by created_at desc",
    [me],
  );
  // token_hash·code·prefill은 읽지도 않는다
  const invites = await q<{ contact_id: string; recipient_name: string; sections: unknown; message: string; created_at: Date; expires_at: Date; used_at: Date | null; canceled_at: Date | null }>(
    "select contact_id, recipient_name, sections, message, created_at, expires_at, used_at, canceled_at from invites where inviter_id = $1 order by created_at desc",
    [me],
  );
  return { sections, cards, notes, invites };
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const me = s.user.id;
  const [{ card, folders, raw }, people] = await Promise.all([
    s.tx(async (q) => ({ card: (await readCard(q, me)).card, folders: await listFolders(q, me), raw: await readRaw(q, me) })),
    listPeople(s),
  ]);
  // 기본 폴더는 코드(family·work·partner·friends), 직접 만든 폴더는 이름
  const foldersOf = (ids: string[]) => folders.filter((f) => ids.includes(f.id)).map((f) => f.builtin ?? f.name);

  // 지금 키로 풀지 못한 항목(기록 항목·메모) 수: 조용히 빠지지 않고 내려받기에서 보이게
  let undecryptable = 0;
  for (const r of raw.sections) if (isSection(r.section) && open(r.payload, aad.card(me, r.section)) == null) undecryptable++;
  for (const c of raw.cards) {
    if (!c.sections || typeof c.sections !== "object") continue;
    for (const [section, payload] of Object.entries(c.sections as Record<string, unknown>)) {
      if (isSection(section) && open(payload, aad.contact(me, c.contact_id, section)) == null) undecryptable++;
    }
  }

  const notesByContact = new Map<string, Omit<Note, "effects">[]>();
  for (const n of raw.notes) {
    const body = open(n.payload, aad.note(me, n.contact_id)) as { body?: unknown } | null;
    if (typeof body?.body !== "string") undecryptable++;
    const list = notesByContact.get(n.contact_id) ?? [];
    list.push({ id: n.id, label: n.label, body: typeof body?.body === "string" ? body.body : "", createdAt: iso(n.created_at)! });
    notesByContact.set(n.contact_id, list);
  }
  const notes = people.map((p) => ({ person: displayName(p), notes: notesByContact.get(p.contactId) ?? [] }));
  const nameOf = new Map(people.map((p) => [p.contactId, displayName(p)]));

  const data = {
    exportedAt: new Date().toISOString(),
    profile: { name: s.profile.displayName, email: s.user.email, locale: s.profile.locale, timeZone: s.profile.timeZone, avatar: s.profile.avatar, reminderOffsets: s.profile.reminderOffsets },
    // 언어는 직접 고른 것(null이면 기기 언어를 따른다)과 기기 언어를 나눠서, 알림 받을 날·앱 잠금·알림 받기까지
    settings: {
      localeChoice: s.profile.localeChoice,
      systemLocale: s.profile.systemLocale,
      timeZone: s.profile.timeZone,
      reminderOffsets: s.profile.reminderOffsets,
      appLock: s.profile.appLock,
      pushEnabled: s.profile.pushEnabled,
    },
    aboutMe: card,
    people: people.map((p) => ({ name: displayName(p), folders: foldersOf(p.folderIds), favorite: p.favorite, record: p.card, answered: p.answered })),
    folders: folders.filter((f) => !f.builtin).map((f) => ({ name: f.name, icon: f.icon, color: f.color })),
    myNotes: notes.filter((n) => n.notes.length),
    // 내가 보낸 물어보기(누구에게·무엇을·어떻게 됐는지)
    asks: raw.invites.map((i) => ({
      person: nameOf.get(i.contact_id) ?? null,
      recipientName: i.recipient_name,
      sections: sanitizeSections(i.sections),
      status: inviteStatus({ expires_at: iso(i.expires_at)!, used_at: iso(i.used_at), canceled_at: iso(i.canceled_at) }),
      message: i.message,
      createdAt: iso(i.created_at),
      expiresAt: iso(i.expires_at),
      answeredAt: iso(i.used_at),
      canceledAt: iso(i.canceled_at),
    })),
    undecryptable,
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="remember-you-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
