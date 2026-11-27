import { expect, test, type Page } from "@playwright/test";
import { SENSITIVE_SECTIONS, type NoteEffect, type Section } from "@readme/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { aad, openWith, sealWith } from "../lib/crypto-core";
import { packNote } from "../lib/note-core";

// 메모를 지울 때 그 메모가 사람 기록에 더한 것도 같이 지우기. AI 결과에 기대지 않는다:
// AI 정리가 메모 안에 남기는 '더한 것'과 사람 기록을 DB에 직접 심어 두고(진짜와 같은 암호화), 시트·서버 액션·되돌리기를 눌러 본다.

const ENV = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const DB_URL = /^DATABASE_URL=(.*)$/m.exec(ENV)?.[1]?.trim();
const KEY_B64 = /^DATA_ENCRYPTION_KEY=(.*)$/m.exec(ENV)?.[1]?.trim();

async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

const key = () => Buffer.from(KEY_B64 ?? "", "base64");

const likes = (...add: string[]): NoteEffect => ({ f: "taste.likes", t: "items", add });

/** 메모를 심는다(메모 글 + 더한 것을 한 암호문으로). minutesAgo가 클수록 오래된 메모 */
async function seedNote(author: string, contactId: string, body: string, effects: NoteEffect[], minutesAgo: number): Promise<string> {
  const payload = packNote(body, effects, (data) => sealWith(key(), data, aad.note(author, contactId), true));
  return withDb(async (db) => {
    const r = await db.query<{ id: string }>("insert into notes (author_id, contact_id, label, payload, created_at) values ($1, $2, '', $3::jsonb, now() - make_interval(mins => $4)) returning id", [author, contactId, JSON.stringify(payload), minutesAgo]);
    return r.rows[0]!.id;
  });
}

/** 사람 기록의 한 항목을 심는다 */
async function putSection(author: string, contactId: string, section: Section, data: unknown) {
  const payload = sealWith(key(), data, aad.contact(author, contactId, section), SENSITIVE_SECTIONS.includes(section));
  await withDb((db) =>
    db.query(
      `insert into contact_cards (contact_id, author_id, sections) values ($1, $2, jsonb_build_object($3::text, $4::jsonb))
       on conflict (contact_id) do update set sections = contact_cards.sections || excluded.sections`,
      [contactId, author, section, JSON.stringify(payload)],
    ),
  );
}

async function readSection<T>(author: string, contactId: string, section: Section): Promise<T | null> {
  return withDb(async (db) => {
    const r = await db.query<{ p: unknown }>("select sections -> $2::text as p from contact_cards where contact_id = $1", [contactId, section]);
    const p = r.rows[0]?.p;
    return p ? (openWith(key(), p, aad.contact(author, contactId, section)) as T | null) : null;
  });
}

const noteCount = (contactId: string, id: string) => withDb(async (db) => Number((await db.query("select count(*) as n from notes where id = $1::uuid and contact_id = $2::uuid", [id, contactId])).rows[0]?.n ?? 0));

/** 데모로 들어가 새 사람을 만들고 그 사람의 contactId와 (암호화 범위에 쓰는) 내 id를 돌려준다 */
async function newPerson(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
  await page.goto("/people/new");
  await page.getByLabel("이름이나 부르는 말").fill(name);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const contactId = new URL(page.url()).pathname.split("/people/")[1]!.split("/")[0]!;
  const author = await withDb(async (db) => (await db.query<{ user_id: string }>("select user_id from contacts where id = $1::uuid", [contactId])).rows[0]!.user_id);
  return { contactId, author };
}

const openNote = async (page: Page, body: string) => {
  await page.getByRole("button", { name: new RegExp(body) }).click();
  return page.getByRole("dialog");
};

test("메모 시트: 더한 것이 남아 있으면 '이 메모로 더해진 것'과 두 단추, 같이 지우면 기록도 되돌아가고 5초 안에 되돌리기로 둘 다 되살아난다(메모만 지우기·더한 것 없는 메모의 지우기도 바로 지우고 되돌릴 수 있다)", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  await putSection(author, contactId, "taste", { likes: ["마라탕"], spicy: null, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } });
  await putSection(author, contactId, "sizes", { top: "", bottom: "", shoe: 245, ring: null });
  const added = await seedNote(author, contactId, "마라탕 좋아함 신발 245", [likes("마라탕"), { f: "sizes.shoe", t: "one", next: 245, prev: 240 }], 20);
  await seedNote(author, contactId, "예전에 적은 메모", [], 40);
  await page.goto(`/people/${contactId}`);

  // 더한 것이 없는 메모(예전 메모)는 지우기 하나뿐
  let sheet = await openNote(page, "예전에 적은 메모");
  await expect(sheet.getByRole("button", { name: "지우기", exact: true })).toBeVisible();
  await expect(sheet.getByText("이 메모로 더해진 것")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "같이 지우기" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "닫기" }).click();

  // 더한 것이 있는 메모: 칸 이름 · 값(바뀐 값은 전 값 → 값)과 두 단추
  sheet = await openNote(page, "마라탕 좋아함 신발 245");
  await expect(sheet.getByText("이 메모로 더해진 것")).toBeVisible();
  await expect(sheet.getByText("좋아하는 음식", { exact: true })).toBeVisible();
  await expect(sheet.getByText("마라탕", { exact: true })).toBeVisible();
  await expect(sheet.getByText("신발(mm)", { exact: true })).toBeVisible();
  await expect(sheet.getByText("240 → 245")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "메모만 지우기" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "지우기", exact: true })).toHaveCount(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/memo-delete-sheet.png` });

  // 같이 지우기: 메모도, 더한 것도 사라진다
  await sheet.getByRole("button", { name: "같이 지우기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /마라탕 좋아함 신발 245/ })).toHaveCount(0);
  await expect.poll(() => noteCount(contactId, added)).toBe(0);
  await expect.poll(async () => (await readSection<{ likes: string[] }>(author, contactId, "taste"))?.likes).toEqual([]);
  expect((await readSection<{ shoe: number | null }>(author, contactId, "sizes"))?.shoe).toBe(240);
  await page.getByRole("tab", { name: "기억해 둔 것" }).click();
  await expect(page.getByRole("tabpanel").getByText("마라탕")).toHaveCount(0);
  await page.getByRole("tab", { name: /^메모장/ }).click();

  // 5초 안에 되돌리기: 메모(같은 글·같은 더한 것)와 기록이 그대로 돌아온다
  await page.getByRole("status").getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("button", { name: /마라탕 좋아함 신발 245/ })).toBeVisible();
  await expect.poll(() => noteCount(contactId, added)).toBe(1);
  await expect.poll(async () => (await readSection<{ likes: string[] }>(author, contactId, "taste"))?.likes).toEqual(["마라탕"]);
  expect((await readSection<{ shoe: number | null }>(author, contactId, "sizes"))?.shoe).toBe(245);
  sheet = await openNote(page, "마라탕 좋아함 신발 245");
  await expect(sheet.getByText("240 → 245")).toBeVisible(); // 더한 것도 되살아났다

  // 메모만 지우기: 메모만 바로 서버에서 지워지고 기록은 그대로, 5초 안에 되돌리면 메모가 돌아온다
  await sheet.getByRole("button", { name: "메모만 지우기" }).click();
  await expect(page.getByRole("button", { name: /마라탕 좋아함 신발 245/ })).toHaveCount(0);
  await expect.poll(() => noteCount(contactId, added)).toBe(0);
  expect((await readSection<{ likes: string[] }>(author, contactId, "taste"))?.likes).toEqual(["마라탕"]);
  expect((await readSection<{ shoe: number | null }>(author, contactId, "sizes"))?.shoe).toBe(245);
  await page.getByRole("status").getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("button", { name: /마라탕 좋아함 신발 245/ })).toBeVisible();
  await expect.poll(() => noteCount(contactId, added)).toBe(1);

  // 더한 것이 없는 메모의 지우기도 바로 서버에서 지우고(AI 정리가 끝나기 전에 지운 메모에는 아무것도 적히지 않게) 되돌리기로 돌아온다
  sheet = await openNote(page, "예전에 적은 메모");
  await sheet.getByRole("button", { name: "지우기", exact: true }).click();
  await expect(page.getByRole("button", { name: /예전에 적은 메모/ })).toHaveCount(0);
  await expect.poll(() => withDb(async (db) => Number((await db.query("select count(*) as n from notes where contact_id = $1::uuid", [contactId])).rows[0]?.n))).toBe(1);
  await page.getByRole("status").getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("button", { name: /예전에 적은 메모/ })).toBeVisible();
  await expect.poll(() => withDb(async (db) => Number((await db.query("select count(*) as n from notes where contact_id = $1::uuid", [contactId])).rows[0]?.n))).toBe(2);
});

test("메모 시트: 다른 메모가 뒷받침하는 것·그 뒤에 직접 고친 것은 더해진 것에 보이지 않는다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  await putSection(author, contactId, "taste", { likes: ["마라탕", "짜장면"], spicy: null, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } });
  await putSection(author, contactId, "sizes", { top: "", bottom: "", shoe: 250, ring: null });
  // 첫 메모는 마라탕·짜장면을 더했지만 둘째 메모가 마라탕을 다시 말했다 → 첫 메모의 더해진 것은 짜장면뿐, 둘째 메모는 더한 게 없다
  await seedNote(author, contactId, "마라탕 짜장면 좋아함", [likes("마라탕", "짜장면")], 30);
  await seedNote(author, contactId, "마라탕 또 먹었음", [{ f: "taste.likes", t: "items", add: [], known: ["마라탕"] }], 10);
  // 신발은 이 메모가 245로 적었지만 그 뒤에 250으로 직접 고쳤다 → 더해진 것이 아니다
  await seedNote(author, contactId, "신발 245로 바뀜", [{ f: "sizes.shoe", t: "one", next: 245, prev: 240 }], 50);
  await page.goto(`/people/${contactId}`);

  let sheet = await openNote(page, "마라탕 짜장면 좋아함");
  await expect(sheet.getByText("짜장면", { exact: true })).toBeVisible();
  await expect(sheet.getByText("마라탕", { exact: true })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "같이 지우기" })).toBeVisible();
  await sheet.getByRole("button", { name: "닫기" }).click();

  sheet = await openNote(page, "마라탕 또 먹었음");
  await expect(sheet.getByText("이 메모로 더해진 것")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "지우기", exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "닫기" }).click();

  sheet = await openNote(page, "신발 245로 바뀜");
  await expect(sheet.getByText("이 메모로 더해진 것")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "지우기", exact: true })).toBeVisible();
});
