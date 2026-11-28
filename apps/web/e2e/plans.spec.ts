import { expect, test, type Page } from "@playwright/test";
import { SENSITIVE_SECTIONS, addDays, todayIn, type NoteEffect, type Section } from "@readme/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { aad, openWith, sealWith } from "../lib/crypto-core";
import { packNote } from "../lib/note-core";

// 메모에 적은 날짜가 챙길 날이 되는 것(한 번만 있는 날). AI 결과에 기대지 않는다:
// AI 정리가 남기는 기록(기념일 한 줄 + 메모 안에 남긴 '더한 것')을 DB에 직접 심어 두고(진짜와 같은 암호화) 홈·달력·사람 화면·같이 지우기를 확인한다.

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

type Anniversary = { label: string; spec: { calendar: "solar"; month: number; day: number; year: number }; once?: true };

async function readAnniversaries(author: string, contactId: string): Promise<Anniversary[]> {
  return withDb(async (db) => {
    const r = await db.query<{ p: unknown }>("select sections -> 'dates' as p from contact_cards where contact_id = $1", [contactId]);
    const p = r.rows[0]?.p;
    return p ? ((openWith(key(), p, aad.contact(author, contactId, "dates")) as { anniversaries: Anniversary[] } | null)?.anniversaries ?? []) : [];
  });
}

async function seedNote(author: string, contactId: string, body: string, effects: NoteEffect[]): Promise<string> {
  const payload = packNote(body, effects, (data) => sealWith(key(), data, aad.note(author, contactId), true));
  return withDb(async (db) => (await db.query<{ id: string }>("insert into notes (author_id, contact_id, label, payload) values ($1, $2, '', $3::jsonb) returning id", [author, contactId, JSON.stringify(payload)])).rows[0]!.id);
}

/** 데모로 들어가 새 사람을 만든다(샘플 사람이 든 데모 계정이라 샘플에 없는 이름) */
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

const spec = (d: { y: number; m: number; d: number }) => ({ calendar: "solar" as const, month: d.m, day: d.d, year: d.y });

test("한 번만 있는 날: 홈·달력에는 그 하루에 D-day로 뜨고 지난 일정은 빠지며, 사람 화면에는 남고, 메모를 같이 지우면 그 일정만 되돌아온다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  const today = todayIn("Asia/Seoul");
  const plan: Anniversary = { label: "집들이", spec: spec(addDays(today, 1)), once: true };
  const past: Anniversary = { label: "지난 모임", spec: spec(addDays(today, -1)), once: true };
  const yearly: Anniversary = { label: "결혼기념일", spec: { calendar: "solar", month: 5, day: 3, year: 2015 } };
  await putSection(author, contactId, "dates", { birthday: null, anniversaries: [yearly, plan, past] });
  const noteId = await seedNote(author, contactId, "내일 집들이", [{ f: "dates.plan", t: "one", next: plan, prev: null }]);

  // 홈: 가장 가까운 챙길 날(내일 집들이)이 큰 카드의 제목으로, 지난 일정은 어디에도 없다
  await page.goto("/home");
  const upcoming = page.getByRole("region", { name: "다가오는 날" });
  await expect(upcoming.getByRole("heading", { name: "초롱이 집들이" })).toBeVisible();
  await expect(page.getByText("지난 모임")).toHaveCount(0);
  // 약속은 선물과 상관없으니 큰 카드의 단추가 선물 힌트가 아니라 그 사람 메모장으로 간다
  await expect(upcoming.getByRole("link", { name: "초롱이 메모장 보기" })).toHaveAttribute("href", `/people/${contactId}`);
  await expect(upcoming.getByRole("link", { name: /선물 힌트/ })).toHaveCount(0);

  // 달력: 다가오는 날 목록에 D-1로, 지난 일정은 목록에 없다
  await page.goto("/calendar");
  const list = page.getByRole("region", { name: "다가오는 날" });
  const row = list.getByRole("listitem").filter({ hasText: "초롱이 집들이" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("D-1");
  await expect(row.getByRole("link")).toHaveAttribute("href", `/people/${contactId}`);
  await expect(list.getByRole("listitem").filter({ hasText: "초롱이 지난 모임" })).toHaveCount(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/plans-calendar.png` });

  // 사람 화면의 기억해 둔 것: 약속은 날짜 순으로(다가오는 것 먼저), 지난 약속은 D-day 없이 맨 뒤에 남는다
  await page.goto(`/people/${contactId}`);
  await page.getByRole("tab", { name: "기억해 둔 것" }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText("집들이", { exact: true })).toBeVisible();
  await expect(panel.getByText("지난 모임", { exact: true })).toBeVisible();
  await expect(panel.getByText("D-1", { exact: true })).toHaveCount(1);
  await expect(panel.getByText("결혼기념일", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /^메모장/ }).click();

  // 같이 지우기: 메모가 더한 일정만 기록에서 사라진다(다른 기념일·지난 약속은 그대로)
  await page.getByRole("button", { name: /내일 집들이/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("이 메모로 더해진 것")).toBeVisible();
  await expect(sheet.getByText("챙길 날", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "같이 지우기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(async () => (await readAnniversaries(author, contactId)).map((a) => a.label).sort()).toEqual(["결혼기념일", "지난 모임"]);

  // 5초 안에 되돌리기: 일정이 한 번만 있는 날 그대로 돌아온다
  await page.getByRole("status").getByRole("button", { name: "되돌리기" }).click();
  await expect.poll(async () => (await readAnniversaries(author, contactId)).find((a) => a.label === "집들이")).toMatchObject({ once: true, spec: plan.spec });
  void noteId;
});
