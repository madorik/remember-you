import { emptySection, SENSITIVE_SECTIONS, type NoteEffect, type Section } from "@readme/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { aad, openWith, sealWith } from "../lib/crypto-core";
import { packNote, unpackNote } from "../lib/note-core";

// 시험이 로컬 DB에 직접 심고 읽는 도구(진짜와 같은 암호화). 사람 기록·메모(더한 것 포함)를 AI 없이 만들어 둔다

const ENV = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
export const DB_URL = /^DATABASE_URL=(.*)$/m.exec(ENV)?.[1]?.trim();
export const KEY_B64 = /^DATA_ENCRYPTION_KEY=(.*)$/m.exec(ENV)?.[1]?.trim();

export async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

const key = () => Buffer.from(KEY_B64 ?? "", "base64");

export const likes = (...add: string[]): NoteEffect => ({ f: "taste.likes", t: "items", add });
export const shoe = (next: number, prev: number): NoteEffect => ({ f: "sizes.shoe", t: "one", next, prev });
export const TASTE = (...list: string[]) => ({ ...emptySection("taste"), likes: list });

/** 메모의 글과 더한 것을 바꾼다(AI 정리가 끝나 메모에 적은 것처럼) */
export async function setEffects(author: string, contactId: string, noteId: string, body: string, effects: NoteEffect[]) {
  const payload = packNote(body, effects, (data) => sealWith(key(), data, aad.note(author, contactId), true));
  await withDb((db) => db.query("update notes set payload = $2::jsonb where id = $1::uuid", [noteId, JSON.stringify(payload)]));
}

export async function readNote(author: string, contactId: string, noteId: string) {
  return withDb(async (db) => {
    const r = await db.query<{ payload: unknown }>("select payload from notes where id = $1::uuid", [noteId]);
    const p = r.rows[0]?.payload;
    return p ? unpackNote(openWith(key(), p, aad.note(author, contactId))) : null;
  });
}

export async function putSection(author: string, contactId: string, section: Section, data: unknown) {
  const payload = sealWith(key(), data, aad.contact(author, contactId, section), SENSITIVE_SECTIONS.includes(section));
  await withDb((db) =>
    db.query(
      `insert into contact_cards (contact_id, author_id, sections) values ($1, $2, jsonb_build_object($3::text, $4::jsonb))
       on conflict (contact_id) do update set sections = contact_cards.sections || excluded.sections`,
      [contactId, author, section, JSON.stringify(payload)],
    ),
  );
}

export async function readSection<T>(author: string, contactId: string, section: Section): Promise<T | null> {
  return withDb(async (db) => {
    const r = await db.query<{ p: unknown }>("select sections -> $2::text as p from contact_cards where contact_id = $1", [contactId, section]);
    const p = r.rows[0]?.p;
    return p ? (openWith(key(), p, aad.contact(author, contactId, section)) as T | null) : null;
  });
}

/** 이 사용자의 AI 하루 한도를 다 쓴 것으로 만든다(60번이면 데모 계정 한도 5도 일반 한도 40도 넘는다). 서버가 한도 상태를 돌려주는 흐름을 시험할 때 쓴다 */
export const blockAi = (author: string) => withDb((db) => db.query("insert into ai_calls (user_id, kind) select $1, 'capture' from generate_series(1, 60)", [author]));

export const noteIdsOf = (contactId: string) => withDb(async (db) => (await db.query<{ id: string }>("select id from notes where contact_id = $1::uuid order by created_at", [contactId])).rows.map((r) => r.id));
