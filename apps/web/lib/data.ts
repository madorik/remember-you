import "server-only";
import {
  DEFAULT_OFFSETS,
  inviteStatus,
  isLocale,
  isSection,
  liftGiftTastes,
  sanitizeAvatar,
  sanitizeOffsets,
  sanitizeSection,
  sanitizeSections,
  todayIn,
  type AvatarConfig,
  type CardData,
  type InviteStatus,
  type Locale,
  type PartialCard,
  type ReminderOffset,
  type Section,
  type YMD,
} from "@readme/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";
import { aad, open, seal, sealSection } from "./crypto";
import { isLockedPayload } from "./data-core";
import { isUuid } from "./uuid";
import { asUser, type Q, type Row } from "./db";
import { detectLocale, type T } from "./i18n";
import { isFolderColor, isFolderIcon, type FolderColor, type FolderIcon, type FolderView } from "./folders";

export interface Profile {
  id: string;
  displayName: string;
  /** 화면에 쓰는 언어(직접 고른 언어, 없으면 기기 언어) */
  locale: Locale;
  /** 직접 고른 언어. null이면 시스템 언어를 따른다 */
  localeChoice: Locale | null;
  systemLocale: Locale;
  timeZone: string;
  avatar: AvatarConfig;
  reminderOffsets: ReminderOffset[];
  appLock: boolean;
  /** 설정 > 알림 받기 */
  pushEnabled: boolean;
  /** 설정 > 명절·챙기는 날 알림(설날·추석·크리스마스 …) */
  holidayReminders: boolean;
  /** 오늘의 질문 카드를 처리한 날(그 사람 시간대 YYYY-MM-DD)과 그날 처리한 횟수 */
  questionDay: string | null;
  questionCount: number;
  isDemo: boolean;
  onboardedAt: string | null;
}

function iso(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function toProfile(row: Row, detected: Locale): Profile {
  const choice = isLocale(row.locale) ? row.locale : null;
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? ""),
    locale: choice ?? detected,
    localeChoice: choice,
    systemLocale: isLocale(row.system_locale) ? row.system_locale : "ko",
    timeZone: String(row.time_zone ?? "Asia/Seoul"),
    avatar: sanitizeAvatar(row.avatar),
    reminderOffsets: Array.isArray(row.reminder_offsets) ? sanitizeOffsets(row.reminder_offsets) : DEFAULT_OFFSETS,
    appLock: row.app_lock === true,
    pushEnabled: row.push_enabled !== false,
    holidayReminders: row.holiday_reminders !== false,
    questionDay: typeof row.question_day === "string" ? row.question_day : null,
    questionCount: typeof row.question_count === "number" ? row.question_count : 0,
    isDemo: row.is_demo === true,
    onboardedAt: iso(row.onboarded_at),
  };
}

export interface Session {
  user: { id: string; email: string; emailVerified: boolean; isAnonymous: boolean };
  profile: Profile;
  /** 이 사람 권한(RLS)으로 트랜잭션 하나 */
  tx: <T>(fn: (q: Q) => Promise<T>) => Promise<T>;
}

/** 요청마다 한 번만 확인한다 */
export const getSession = cache(async (): Promise<Session | null> => {
  const h = await headers();
  const s = await getAuth().api.getSession({ headers: h });
  if (!s?.user) return null;
  const uid = s.user.id;
  const row = await asUser(uid, (q) => q.one("select * from profiles where id = $1", [uid]));
  if (!row) return null;
  const detected = await detectLocale();
  return {
    user: { id: uid, email: s.user.email, emailVerified: s.user.emailVerified === true, isAnonymous: (s.user as { isAnonymous?: boolean | null }).isAnonymous === true },
    profile: toProfile(row, detected),
    tx: (fn) => asUser(uid, fn),
  };
});

export async function requireSession(opts: { onboarding?: boolean } = {}): Promise<Session> {
  const s = await getSession();
  // ?next를 붙여 보낸다: 낡은 세션 쿠키가 남은 사람이 /로 가면 proxy가 다시 /home으로 보내는데, ?next가 있으면 그러지 않아서 돌고 돌지 않는다
  if (!s) redirect("/?next=%2Fhome");
  if (!opts.onboarding && !s.profile.onboardedAt) redirect("/onboarding/avatar");
  return s;
}

export function todayFor(profile: Pick<Profile, "timeZone">): YMD {
  return todayIn(profile.timeZone);
}

// ── 리드미 읽기·쓰기 ─────────────────────────────

function openSection(section: Section, payload: unknown, scope: string): CardData[Section] | null {
  const data = open(payload, scope);
  return data == null ? null : sanitizeSection(section, data);
}

export async function readCard(q: Q, ownerId: string, lock = false): Promise<{ card: PartialCard; updatedAt: string | null }> {
  const rows = await q<{ section: string; payload: unknown; updated_at: Date }>(`select section, payload, updated_at from card_sections where owner_id = $1${lock ? " for update" : ""}`, [ownerId]);
  const card: PartialCard = {};
  let updatedAt: string | null = null;
  for (const row of rows) {
    if (!isSection(row.section)) continue;
    const value = openSection(row.section, row.payload, aad.card(ownerId, row.section));
    if (value) (card as Record<string, unknown>)[row.section] = value;
    const at = iso(row.updated_at);
    if (at && (!updatedAt || at > updatedAt)) updatedAt = at;
  }
  return { card, updatedAt };
}

export async function writeSection<S extends Section>(q: Q, ownerId: string, section: S, input: unknown): Promise<CardData[S]> {
  const clean = sanitizeSection(section, input);
  const scope = aad.card(ownerId, section);
  const payload = sealSection(section, clean, scope);
  // 이미 있는 값이 지금 키로 안 풀리면(키가 다른 환경) 덮어쓰지 않는다. 진짜 기록이 사라지지 않게
  const old = await q.one<{ payload: unknown }>("select payload from card_sections where owner_id = $1 and section = $2", [ownerId, section]);
  if (old && isLockedPayload(old.payload, (p) => open(p, scope))) throw new Error("undecryptable");
  await q(
    `insert into card_sections (owner_id, section, payload) values ($1, $2, $3)
     on conflict (owner_id, section) do update set payload = excluded.payload`,
    [ownerId, section, JSON.stringify(payload)],
  );
  return clean;
}

/** 사람 기록(contact_cards.sections) 풀기 */
export function openContactSections(authorId: string, contactId: string, sections: unknown): PartialCard {
  const card: PartialCard = {};
  if (!sections || typeof sections !== "object") return card;
  for (const [section, payload] of Object.entries(sections as Record<string, unknown>)) {
    if (!isSection(section)) continue;
    const value = openSection(section, payload, aad.contact(authorId, contactId, section));
    if (value) (card as Record<string, unknown>)[section] = value;
  }
  return card;
}

export function sealContactSections(authorId: string, contactId: string, card: PartialCard): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [section, value] of Object.entries(card)) {
    if (!isSection(section) || value == null) continue;
    out[section] = sealSection(section, sanitizeSection(section, value), aad.contact(authorId, contactId, section));
  }
  return out;
}

/** 사람 기록의 항목 하나 저장(다른 항목은 그대로 둔다). 내가 고친 항목은 '답한 때' 표시를 지운다. RLS가 내 주소록 칸인지 확인한다 */
export async function writeContactSection<S extends Section>(q: Q, authorId: string, contactId: string, section: S, input: unknown): Promise<CardData[S]> {
  const clean = sanitizeSection(section, input);
  const scope = aad.contact(authorId, contactId, section);
  const payload = sealSection(section, clean, scope);
  // 이미 있는 항목이 지금 키로 안 풀리면 덮어쓰지 않는다(RLS가 내 기록만 돌려준다)
  const old = await q.one<{ payload: unknown }>("select sections -> $2::text as payload from contact_cards where contact_id = $1", [contactId, section]);
  if (old && isLockedPayload(old.payload, (p) => open(p, scope))) throw new Error("undecryptable");
  const row = await q.one(
    `insert into contact_cards as cc (contact_id, author_id, sections) values ($1, $2, jsonb_build_object($3::text, $4::jsonb))
     on conflict (contact_id) do update set sections = cc.sections || excluded.sections, answered = cc.answered - $3::text
     where cc.author_id = $2 returning contact_id`,
    [contactId, authorId, section, JSON.stringify(payload)],
  );
  if (!row) throw new Error("not_your_contact");
  return clean;
}

/** 물어볼 때 미리 채워 보내는 값(내 기록에서). 토큰을 아는 사람만 풀 수 있게 토큰 해시 범위로 잠근다 */
export function sealPrefill(tokenHash: string, card: PartialCard): unknown {
  return seal({ card }, aad.prefill(tokenHash));
}

export function openPrefill(tokenHash: string, payload: unknown): PartialCard {
  const raw = open(payload, aad.prefill(tokenHash)) as { card?: unknown } | null;
  const card: PartialCard = {};
  if (raw?.card && typeof raw.card === "object") {
    // 0015 전에 보낸 물어보기: 선물 칸의 향·꽃을 취향 칸으로
    for (const [section, value] of Object.entries(liftGiftTastes(raw.card as Record<string, unknown>))) {
      if (isSection(section)) (card as Record<string, unknown>)[section] = sanitizeSection(section, value);
    }
  }
  return card;
}

// ── 내 사람들 ─────────────────────────────────────

/** 물어보기 하나의 상태(가장 최근 것) */
export interface Asking {
  inviteId: string;
  state: InviteStatus;
  /** 보낸 때(답을 기다린 날수를 센다) */
  createdAt: string;
  expiresAt: string;
  sections: Section[];
}

export interface Person {
  contactId: string;
  /** 물어보기에 로그인하고 답해서 이어진 앱 사용자(얼굴·이름만 쓴다) */
  personId: string | null;
  /** 그 사람이 정한 이름(이어진 사람만, 없으면 내가 부르는 말) */
  name: string;
  /** 내가 부르는 말(아내, 아빠). 이어지지 않은 사람은 이게 이름 */
  nickname: string;
  avatar: AvatarConfig | null;
  /** 내 기록: 내가 적은 것 + 물어봐서 받은 답. 언제든 내가 고친다 */
  card: PartialCard;
  /** 항목별로 상대가 답한 때(ISO). 내가 고치면 빠진다 */
  answered: Partial<Record<Section, string>>;
  updatedAt: string | null;
  /** 가장 최근 물어보기 */
  asking: Asking | null;
  /** 들어 있는 폴더(contact_groups.id, 여러 개) */
  folderIds: string[];
  /** 즐겨찾기(사람들 맨 위에 고정) */
  favorite: boolean;
  /** '이 사람에 대해 다시 묻지 않기'(오늘의 질문에서 뺀다) */
  askOff: boolean;
  /** 사람 상세 화면을 연 날 수 */
  viewDays: number;
  /** 주소록에 더한 때(ISO). 방금 더한 사람을 오늘의 질문에 올리는 데 쓴다 */
  createdAt: string;
}

/** 사람 한 줄(주소록 + 이어진 사람 프로필 + 내 기록 + 가장 최근 물어보기 + 든 폴더) */
type PersonRow = {
  id: string;
  person_id: string | null;
  nickname: string;
  favorite: boolean;
  ask_off: boolean;
  view_days: number;
  created_at: Date;
  avatar: unknown;
  p_id: string | null;
  p_display_name: string | null;
  p_avatar: unknown;
  cc_sections: unknown;
  cc_answered: unknown;
  cc_updated_at: Date | null;
  a_id: string | null;
  a_sections: unknown;
  a_created_at: Date | null;
  a_expires_at: Date | null;
  a_used_at: Date | null;
  a_canceled_at: Date | null;
  folder_ids: string[] | null;
};

/**
 * opts.contactId: 그 사람 한 명만. opts.cards=false: 기록(card)은 풀지 않고 빈 객체로(이름·폴더·물어보기 상태만 필요한 곳 — 암호문을 가져오지도, 풀지도 않는다)
 */
async function loadPeople(q: Q, me: string, opts: { contactId?: string; cards?: boolean } = {}): Promise<Person[]> {
  const withCards = opts.cards !== false;
  // 한 클라이언트(트랜잭션)에서 Promise.all로 여러 쿼리를 보내도 pg가 줄 세워 하나씩 보내므로, 왕복 한 번짜리 쿼리 하나로 모은다.
  // 물어보기는 사람마다 가장 최근 한 줄, 폴더는 들어간 순서대로. RLS는 조인한 표마다 그대로 적용된다
  const rows = await q<PersonRow>(
    `select c.id, c.person_id, c.nickname, c.favorite, c.ask_off, c.view_days, c.created_at, c.avatar,
            p.id as p_id, p.display_name as p_display_name, p.avatar as p_avatar,
            ${withCards ? "cc.sections" : "null::jsonb"} as cc_sections, cc.answered as cc_answered, cc.updated_at as cc_updated_at,
            a.id as a_id, a.sections as a_sections, a.created_at as a_created_at, a.expires_at as a_expires_at, a.used_at as a_used_at, a.canceled_at as a_canceled_at,
            (select array_agg(m.group_id::text order by m.created_at) from contact_group_members m where m.contact_id = c.id and m.user_id = $1) as folder_ids
       from contacts c
       left join profiles p on p.id = c.person_id
       left join contact_cards cc on cc.contact_id = c.id
       left join lateral (
         select i.id, i.sections, i.created_at, i.expires_at, i.used_at, i.canceled_at from invites i where i.contact_id = c.id order by i.created_at desc limit 1
       ) a on true
      where c.user_id = $1 and ($2::uuid is null or c.id = $2::uuid)
      order by c.created_at`,
    [me, opts.contactId ?? null],
  );

  return rows.map((c) => {
    const nickname = String(c.nickname ?? "");
    const answered: Partial<Record<Section, string>> = {};
    if (c.cc_answered && typeof c.cc_answered === "object") {
      for (const [k, v] of Object.entries(c.cc_answered as Record<string, unknown>)) if (isSection(k) && typeof v === "string") answered[k] = v;
    }
    return {
      contactId: c.id,
      personId: c.person_id,
      name: String(c.p_display_name || nickname),
      nickname,
      // 내가 꾸민 얼굴이 먼저, 없으면 이어진 사람이 정한 얼굴
      avatar: c.avatar ? sanitizeAvatar(c.avatar) : c.p_id !== null ? sanitizeAvatar(c.p_avatar) : null,
      card: c.cc_sections ? openContactSections(me, c.id, c.cc_sections) : {},
      answered,
      updatedAt: iso(c.cc_updated_at),
      asking: c.a_id
        ? {
            inviteId: String(c.a_id),
            state: inviteStatus({ expires_at: iso(c.a_expires_at)!, used_at: iso(c.a_used_at), canceled_at: iso(c.a_canceled_at) }),
            createdAt: iso(c.a_created_at)!,
            expiresAt: iso(c.a_expires_at)!,
            sections: sanitizeSections(c.a_sections),
          }
        : null,
      folderIds: c.folder_ids ?? [],
      favorite: c.favorite === true,
      askOff: c.ask_off === true,
      viewDays: Number(c.view_days) || 0,
      createdAt: iso(c.created_at) ?? new Date(0).toISOString(),
    };
  });
}

/** 요청 하나 안에서는 한 번만 읽는다(레이아웃의 알림 예약과 화면이 같이 쓴다) */
export const listPeople = cache((s: Session) => s.tx((q) => loadPeople(q, s.user.id)));

/**
 * 사람 목록인데 기록(card)을 안 푼 것(card는 늘 {}): 이름으로 사람을 찾거나 누구인지만 알면 되는 곳(말로 적기 대상 찾기 등)에서, 모든 사람의 기록을 복호화하는 비용을 아낀다.
 * 기록이 필요하면 readPerson·readContactCard로 필요한 사람만 읽는다
 */
export const listPeopleLite = cache((s: Session) => s.tx((q) => loadPeople(q, s.user.id, { cards: false })));

/** 사람 한 명(기록까지). 내 사람이 아니면 null. contactId는 uuid 모양이어야 한다 */
export async function readPerson(s: Session, contactId: string): Promise<Person | null> {
  if (!isUuid(contactId)) return null;
  return (await s.tx((q) => loadPeople(q, s.user.id, { contactId })))[0] ?? null;
}

/** 내 사람 한 명의 기록만(풀어서). lock이면 다른 쓰기가 끝날 때까지 기다리고 그 사이 못 고치게 잠근다(읽고 합쳐 쓰는 저장 때). 없으면 빈 기록 */
export async function readContactCard(q: Q, me: string, contactId: string, lock = false): Promise<PartialCard> {
  const r = await q.one<{ sections: unknown }>(`select sections from contact_cards where contact_id = $1 and author_id = $2${lock ? " for update" : ""}`, [contactId, me]);
  return r?.sections ? openContactSections(me, contactId, r.sections) : {};
}

// 부를 이름은 화면(토스 번들)도 쓰므로 lib/person에 둔다
export { displayName } from "./person";

// ── 메모 ─────────────────────────────────────────

export interface Note {
  id: string;
  label: string;
  body: string;
  createdAt: string;
}

/** 아직 안 본 답장(물어보기에 답이 온 것). 사람 화면을 열면 읽은 것으로 바뀐다(seeAnswers) */
export interface UnreadAnswer {
  id: string;
  contactId: string;
  /** 물어볼 때 적은 이름 */
  label: string;
  at: string;
  /** 몇 분 전에 왔는지 */
  minutes: number;
}

export async function unreadAnswers(q: Q, me: string, contactId?: string): Promise<UnreadAnswer[]> {
  const rows = await q<{ id: string; contact_id: string; label: string; created_at: Date; minutes: number }>(
    `select id, contact_id, label, created_at, floor(extract(epoch from now() - created_at) / 60)::int as minutes from notifications
     where user_id = $1 and kind = 'answered' and read_at is null and contact_id is not null and ($2::uuid is null or contact_id = $2::uuid)
     order by created_at desc limit 30`,
    [me, contactId ?? null],
  );
  return rows.map((r) => ({ id: r.id, contactId: r.contact_id, label: r.label, at: iso(r.created_at)!, minutes: Math.max(0, Number(r.minutes) || 0) }));
}

export async function listNotes(q: Q, me: string, contactId: string): Promise<Note[]> {
  const rows = await q<{ id: string; label: string; payload: unknown; created_at: Date }>(
    "select id, label, payload, created_at from notes where contact_id = $1 order by created_at desc",
    [contactId],
  );
  return rows.map((n) => {
    const body = open(n.payload, aad.note(me, contactId)) as { body?: string } | null;
    return { id: n.id, label: n.label, body: typeof body?.body === "string" ? body.body : "", createdAt: iso(n.created_at)! };
  });
}

export function sealNote(me: string, contactId: string, body: string): unknown {
  return seal({ body }, aad.note(me, contactId));
}

// ── 폴더 ─────────────────────────────────────────

/** 기본 폴더(사람마다 처음부터 있고, 이름은 화면 언어로). 이 순서로 보인다 */
// 기본 폴더 셋(가족·친구들·회사, 이 순서로 보인다). 예전에 있던 연인 폴더(builtin = partner)는 0032 이관으로 지웠다
export const BUILTIN_GROUPS = ["family", "friends", "work"] as const;
export type BuiltinGroup = (typeof BUILTIN_GROUPS)[number];

export interface Folder {
  id: string;
  builtin: BuiltinGroup | null;
  /** 직접 만든 폴더의 이름(기본 폴더는 빈칸) */
  name: string;
  icon: FolderIcon;
  color: FolderColor;
}

type FolderRow = { id: string; builtin: string | null; name: string; icon: string; color: string };

const selectFolders = (q: Q, me: string) =>
  q<FolderRow>("select id, builtin, name, icon, color from contact_groups where user_id = $1 order by array_position($2::text[], builtin) nulls last, created_at", [me, [...BUILTIN_GROUPS]]);

const hasAllBuiltins = (rows: { builtin: string | null }[]) => BUILTIN_GROUPS.every((b) => rows.some((r) => r.builtin === b));

const insertBuiltinFolders = (q: Q, me: string) =>
  q(
    `insert into contact_groups (user_id, builtin, icon, color)
     select $1, b, case b when 'family' then 'home' when 'work' then 'work' else 'star' end,
            case b when 'family' then 'mango' when 'work' then 'sky' else 'mint' end
     from unnest($2::text[]) b on conflict (user_id, builtin) do nothing`,
    [me, [...BUILTIN_GROUPS]],
  );

/** 기본 폴더 셋이 없으면 만든다(가족 집·망고, 친구들 별·민트, 회사 가방·하늘). 이미 다 있으면 읽기만 한다 */
export async function ensureBuiltinFolders(q: Q, me: string): Promise<void> {
  const have = await q<{ builtin: string }>("select builtin from contact_groups where user_id = $1 and builtin is not null", [me]);
  if (!hasAllBuiltins(have)) await insertBuiltinFolders(q, me);
}

/** 내 폴더. 기본 폴더는 처음 부를 때 만든다. 순서: 기본 폴더 → 만든 순서 */
export async function listFolders(q: Q, me: string): Promise<Folder[]> {
  let rows = await selectFolders(q, me);
  // 기본 폴더가 다 있으면(거의 항상) 읽기 한 번으로 끝. 없을 때만 만들고 다시 읽는다
  if (!hasAllBuiltins(rows)) {
    await insertBuiltinFolders(q, me);
    rows = await selectFolders(q, me);
  }
  // 예전 연인 폴더(builtin = partner)는 0032가 지우지만, 그 전에 남은 행은 이름이 비어 있어 보이지 않게 건너뛴다
  return rows.filter((r) => r.builtin !== "partner").map((r) => ({
    id: String(r.id),
    builtin: (BUILTIN_GROUPS as readonly string[]).includes(r.builtin ?? "") ? (r.builtin as BuiltinGroup) : null,
    name: String(r.name ?? ""),
    icon: isFolderIcon(r.icon) ? r.icon : "star",
    color: isFolderColor(r.color) ? r.color : "lavender",
  }));
}

/** 화면에 보일 폴더 이름 */
export function folderName(g: Pick<Folder, "builtin" | "name">, t: T): string {
  return g.builtin ? t(`group.${g.builtin}` as "group.family") : g.name;
}

/** 화면에 넘길 폴더들(이름은 화면 언어로, 들어 있는 사람은 사람들 목록 순서로) */
export function folderViews(folders: Folder[], people: Person[], t: T): FolderView[] {
  return folders.map((f) => ({
    id: f.id,
    name: folderName(f, t),
    icon: f.icon,
    color: f.color,
    builtin: !!f.builtin,
    memberIds: people.filter((p) => p.folderIds.includes(f.id)).map((p) => p.contactId),
  }));
}

/** 아직 아무도 안 연 물어보기 링크(퍼지면 아무나 답할 수 있으니 취소할 곳) */
export interface OpenInvite {
  id: string;
  contactId: string;
  recipientName: string;
  expiresAt: string;
}

export async function listOpenInvites(q: Q): Promise<OpenInvite[]> {
  const rows = await q(
    `select id, contact_id, recipient_name, expires_at from invites
      where used_at is null and canceled_at is null and expires_at > now() order by created_at desc`,
  );
  return rows.map((i) => ({
    id: String(i.id),
    contactId: String(i.contact_id),
    recipientName: String(i.recipient_name ?? ""),
    expiresAt: iso(i.expires_at)!,
  }));
}
