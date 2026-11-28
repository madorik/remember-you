import { expect, test, type Locator, type Page } from "@playwright/test";
import { emptySection, SENSITIVE_SECTIONS, type NoteEffect, type Section } from "@readme/core";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { aad, openWith, sealWith } from "../lib/crypto-core";
import { packNote, unpackNote } from "../lib/note-core";

// 사람 화면(바인더)의 묶음 개선: 처음 여는 칸 규칙 · 작성률(생일·사이즈·알레르기·반려동물까지) · 말풍선의 물어보기 · 메모 고치기 · 메모 찾기 ·
// 정리 결과 알림(토스트)과 되돌리기. AI 결과에 기대지 않는다: 사람 기록과 메모(더한 것 포함)를 DB에 직접 심는다(진짜와 같은 암호화).
// SHOTS=폴더 를 주면 화면을 그 폴더에 저장한다

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

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

const likes = (...add: string[]): NoteEffect => ({ f: "taste.likes", t: "items", add });
const shoe = (next: number, prev: number): NoteEffect => ({ f: "sizes.shoe", t: "one", next, prev });

/** 메모를 심는다(메모 글 + 더한 것을 한 암호문으로). minutesAgo가 클수록 오래된 메모 */
async function seedNote(author: string, contactId: string, body: string, effects: NoteEffect[] = [], minutesAgo = 0): Promise<string> {
  const payload = packNote(body, effects, (data) => sealWith(key(), data, aad.note(author, contactId), true));
  return withDb(async (db) => {
    const r = await db.query<{ id: string }>("insert into notes (author_id, contact_id, label, payload, created_at) values ($1, $2, '', $3::jsonb, now() - make_interval(mins => $4)) returning id", [author, contactId, JSON.stringify(payload), minutesAgo]);
    return r.rows[0]!.id;
  });
}

/** 심어 둔 메모의 더한 것을 바꾼다(AI 정리가 끝나 메모에 적은 것처럼) */
async function setEffects(author: string, contactId: string, noteId: string, body: string, effects: NoteEffect[]) {
  const payload = packNote(body, effects, (data) => sealWith(key(), data, aad.note(author, contactId), true));
  await withDb((db) => db.query("update notes set payload = $2::jsonb where id = $1::uuid", [noteId, JSON.stringify(payload)]));
}

async function readNote(author: string, contactId: string, noteId: string) {
  return withDb(async (db) => {
    const r = await db.query<{ payload: unknown }>("select payload from notes where id = $1::uuid", [noteId]);
    const p = r.rows[0]?.payload;
    return p ? unpackNote(openWith(key(), p, aad.note(author, contactId))) : null;
  });
}

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

/**
 * 이 사용자의 AI 하루 한도를 다 쓴 것으로 만든다: 메모를 고치면 서버가 응답 뒤에 AI로 다시 정리하는데(organizeNote), 시험이 진짜 AI(OpenAI)를 부르거나 그 결과에 기대지 않게
 * (한도에 막히면 AI를 부르지 않고 정리만 건너뛴다). AI가 한 일은 DB에 직접 심어 흉내 낸다.
 * 60번이면 데모 계정 한도(5)도 일반 한도(40)도 넘는다(많이 넣으면 서비스 전체 한도(3000)까지 쌓여 다른 시험이 막힌다)
 */
const blockAi = (author: string) => withDb((db) => db.query("insert into ai_calls (user_id, kind) select $1, 'capture' from generate_series(1, 60)", [author]));

const noteCount = (contactId: string) => withDb(async (db) => Number((await db.query("select count(*) as n from notes where contact_id = $1::uuid", [contactId])).rows[0]?.n ?? 0));

const TASTE = (...list: string[]) => ({ ...emptySection("taste"), likes: list });
const BIRTHDAY = { birthday: { calendar: "solar", month: 3, day: 14 }, anniversaries: [] };

/** 데모로 들어가 새 사람을 만들고 그 사람의 contactId와 (암호화 범위에 쓰는) 내 id를 돌려준다. 샘플 사람에 없는 이름을 쓴다 */
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

/** 누를 자리의 최소 크기(44px, 소수 계산 오차를 허용) */
const MIN_TAP = 43.9;

/** 누를 자리의 크기: 보이는 크기에 ::before로 넓힌 만큼을 더한다(앱의 작은 단추는 ::before로 44px 이상을 맞춘다) */
async function tapSize(l: Locator): Promise<{ w: number; h: number }> {
  return l.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const b = getComputedStyle(el, "::before");
    const n = (v: string) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
    const wide = b.content !== "none" && b.position === "absolute";
    return { w: wide ? r.width - n(b.left) - n(b.right) : r.width, h: wide ? r.height - n(b.top) - n(b.bottom) : r.height };
  });
}

const bar = (page: Page, pct: string) => page.getByRole("button", { name: `기억해 둔 것 ${pct}%` });
const bubble = (page: Page) => page.getByRole("group", { name: /^기억해 둔 것 \d+%$/ });
const memoTab = (page: Page) => page.getByRole("tab", { name: /^메모장/ });
const rememberedTab = (page: Page) => page.getByRole("tab", { name: "기억해 둔 것" });
/** 메모를 눌러 시트를 연다(화면이 새로 그려지는 틈에 누른 것이 사라져도 시트가 열릴 때까지 다시 누른다) */
const openNote = async (page: Page, body: string | RegExp) => {
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole("button", { name: body }).click({ timeout: 5000 });
    await expect(dialog).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 40_000 });
  return dialog;
};

/** 정리 표시를 남긴다(메모 저장 직후 화면이 하는 일과 같다) */
const markOrganizing = (page: Page, contactId: string) => page.evaluate((id) => sessionStorage.setItem("rm_organizing", JSON.stringify({ ids: [id], at: Date.now() })), contactId);

test("처음 여는 칸: 메모가 없고 적어 둔 항목이 있으면 기억해 둔 것, 항목이 셋 이상이면 메모가 둘까지, 그 밖에는 메모장이고 주소의 tab이 먼저다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(180_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  const url = `/people/${contactId}`;

  // 메모도 기록도 없다 → 메모장
  await page.goto(url);
  await expect(memoTab(page)).toHaveAttribute("aria-selected", "true");

  // 메모 0개 + 항목 1개 → 기억해 둔 것. 주소의 tab이 있으면 그것이 먼저
  await putSection(author, contactId, "taste", TASTE("마라탕"));
  await page.goto(url);
  await expect(rememberedTab(page)).toHaveAttribute("aria-selected", "true");
  await page.goto(`${url}?tab=memo`);
  await expect(memoTab(page)).toHaveAttribute("aria-selected", "true");
  // 메모를 막 저장하고 온 화면이면(저장 표시) 기본이 기억해 둔 것이어도 방금 쓴 메모가 보이게 메모장을 연다
  await markOrganizing(page, contactId);
  await page.goto(url);
  await expect(memoTab(page)).toHaveAttribute("aria-selected", "true");
  await page.evaluate(() => sessionStorage.removeItem("rm_organizing"));
  // 기본이 아닌 칸(메모장)을 고르면 주소에 남고, 기본 칸으로 돌아오면 지워진다
  await page.goto(url);
  await expect(rememberedTab(page)).toHaveAttribute("aria-selected", "true");
  await memoTab(page).click();
  await expect(page).toHaveURL(/[?&]tab=memo/);
  await rememberedTab(page).click();
  await expect(page).not.toHaveURL(/tab=/);

  // 메모 1개 + 항목 1개 → 메모장
  await seedNote(author, contactId, "첫 메모", [], 30);
  await page.goto(url);
  await expect(memoTab(page)).toHaveAttribute("aria-selected", "true");
  await memoTab(page).click();
  await expect(page).not.toHaveURL(/tab=/);

  // 메모 1개 + 항목 3개 → 기억해 둔 것, 메모 3개가 되면 항목이 많아도 메모장
  await putSection(author, contactId, "sizes", { ...emptySection("sizes"), shoe: 245 });
  await putSection(author, contactId, "dates", BIRTHDAY);
  await page.goto(url);
  await expect(rememberedTab(page)).toHaveAttribute("aria-selected", "true");
  await seedNote(author, contactId, "둘째 메모", [], 20);
  await page.goto(url);
  await expect(rememberedTab(page)).toHaveAttribute("aria-selected", "true"); // 메모 2개까지
  await seedNote(author, contactId, "셋째 메모", [], 10);
  await page.goto(url);
  await expect(memoTab(page)).toHaveAttribute("aria-selected", "true");
  await page.goto(`${url}?tab=remembered`);
  await expect(rememberedTab(page)).toHaveAttribute("aria-selected", "true");
});

test("작성률: 사이즈·생일·알레르기·반려동물을 적어 두면 질문에 답하지 않아도 오르고, 말풍선에는 남은 항목 칩 끝에 물어보기 링크가 있다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  const url = `/people/${contactId}`;

  // 사이즈(신발)와 생일 → 2 / 15 = 13%. 생일·사이즈 칩은 빠진다
  await putSection(author, contactId, "sizes", { ...emptySection("sizes"), shoe: 245 });
  await putSection(author, contactId, "dates", BIRTHDAY);
  await page.goto(url);
  await expect(bar(page, "13")).toBeVisible();
  await bar(page, "13").tap();
  await expect(bubble(page).getByText("알레르기·음식·선물 외 4개 항목 채우기가 남았어요")).toBeVisible();
  await expect(bubble(page).getByRole("link")).toHaveText(["알레르기", "음식", "선물", "취향", "문화", "생활", "반려동물", "물어보기"]);
  // 물어보기: 이 사람으로, 남은 항목 중 가장 중요한 하나(알레르기)를 미리 골라 연다
  const ask = bubble(page).getByRole("link", { name: "물어보기" });
  await expect(ask).toHaveAttribute("href", `/request?to=${contactId}&topic=safety`);
  // 44px 이상의 누를 자리
  expect((await tapSize(ask)).h).toBeGreaterThanOrEqual(MIN_TAP);
  const vw = page.viewportSize()!.width;
  const box = (await bubble(page).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(vw);
  await shot(page, "completion-bubble-ask");

  // 알레르기 '없어요'(코드 none)와 반려동물 '키우지 않아요'도 답이다: 4 / 15 = 27%
  await putSection(author, contactId, "safety", { ...emptySection("safety"), allergens: ["none"] });
  await putSection(author, contactId, "pets", { pets: [], none: true });
  await page.goto(url);
  await expect(bar(page, "27")).toBeVisible();
  await bar(page, "27").tap();
  await expect(bubble(page).getByRole("link")).toHaveText(["음식", "선물", "취향", "문화", "생활", "물어보기"]);
  await expect(bubble(page).getByRole("link", { name: "물어보기" })).toHaveAttribute("href", `/request?to=${contactId}&topic=taste`);

  // 누르면 물어보기 화면이 이 사람으로 열린다
  await bubble(page).getByRole("link", { name: "물어보기" }).tap();
  await expect(page).toHaveURL(new RegExp(`/request\\?to=${contactId}&topic=taste`));
});

test("메모 고치기: 시트에서 글을 고쳐 저장하면 목록·시트가 바로 바뀌고 더해진 것은 그대로이며, 취소하면 그대로이고, 빈 글은 저장할 수 없다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  await blockAi(author);
  await putSection(author, contactId, "taste", TASTE("마라탕"));
  const id = await seedNote(author, contactId, "마라탕 좋아함", [likes("마라탕")], 20);
  await seedNote(author, contactId, "다른 메모", [], 40);
  await page.goto(`/people/${contactId}?tab=memo`);

  let sheet = await openNote(page, /마라탕 좋아함/);
  await expect(sheet.getByText("이 메모로 더해진 것")).toBeVisible();
  // 고치기: 글 그대로 든 칸이 열리고, 저장·취소 단추가 아래에 나온다(지우기 단추는 가려진다)
  expect((await tapSize(sheet.getByRole("button", { name: "고치기" }))).h).toBeGreaterThanOrEqual(MIN_TAP);
  await sheet.getByRole("button", { name: "고치기" }).click();
  const area = sheet.getByRole("textbox", { name: "고치기" });
  await expect(area).toHaveValue("마라탕 좋아함");
  await expect(sheet.getByRole("button", { name: "같이 지우기" })).toHaveCount(0);
  await expect(sheet.getByText("이 메모로 더해진 것")).toHaveCount(0);

  // 취소: 고친 글은 버리고 그대로
  await area.fill("버릴 글");
  await sheet.getByRole("button", { name: "취소" }).click();
  await expect(sheet.getByText("마라탕 좋아함", { exact: true })).toBeVisible();
  expect((await readNote(author, contactId, id))?.body).toBe("마라탕 좋아함");

  // 빈 글은 저장할 수 없다
  await sheet.getByRole("button", { name: "고치기" }).click();
  await sheet.getByRole("textbox", { name: "고치기" }).fill("   ");
  await expect(sheet.getByRole("button", { name: "저장" })).toBeDisabled();

  // 저장: 앞뒤 공백은 걷고, 시트는 닫히며 목록이 새 글로 바뀐다. 더한 것은 그대로
  await sheet.getByRole("textbox", { name: "고치기" }).fill("  마라탕 정말 좋아함, 매운 맛 3단계  ");
  if (process.env.SHOTS) await shot(page, "memo-edit");
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /마라탕 정말 좋아함, 매운 맛 3단계/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^\d+ 마라탕 좋아함$/ })).toHaveCount(0);
  await expect.poll(async () => (await readNote(author, contactId, id))?.body).toBe("마라탕 정말 좋아함, 매운 맛 3단계");
  expect((await readNote(author, contactId, id))?.effects).toEqual([likes("마라탕")]);
  expect((await readSection<{ likes: string[] }>(author, contactId, "taste"))?.likes).toEqual(["마라탕"]);
  expect(await noteCount(contactId)).toBe(2);
  // 다시 열어도 새 글이고 더해진 것은 그대로
  sheet = await openNote(page, /마라탕 정말 좋아함/);
  await expect(sheet.getByText("마라탕 정말 좋아함, 매운 맛 3단계", { exact: true })).toBeVisible();
  await expect(sheet.getByText("이 메모로 더해진 것")).toBeVisible();
  await sheet.getByRole("button", { name: "닫기" }).click();
  // 다시 정리를 시작했다는 표시(AI가 켜져 있을 때): 이 사람 화면이 곧 새로 받는다(고친 메모 · 그때 남은 일 1개 · 이미 보이던 줄)
  if (await page.getByRole("link", { name: "초롱이 이야기 적기" }).count()) {
    const mark = JSON.parse((await page.evaluate(() => sessionStorage.getItem("rm_organizing"))) ?? "null") as { ids: string[]; edit: { note: string; base: number; seen: string[] } };
    expect(mark.ids).toEqual([contactId]);
    expect(mark.edit).toMatchObject({ note: id, base: 1 });
    expect(mark.edit.seen).toHaveLength(1);
  }

  // 새로 받아도(새로 고침) 새 글이다. 다시 열어 고치기를 누르면 새 글이 든다
  await page.reload();
  sheet = await openNote(page, /마라탕 정말 좋아함/);
  await sheet.getByRole("button", { name: "고치기" }).click();
  await expect(sheet.getByRole("textbox", { name: "고치기" })).toHaveValue("마라탕 정말 좋아함, 매운 맛 3단계");
  // 글자 수 한도: 1000자까지만 받는다
  expect(await sheet.getByRole("textbox", { name: "고치기" }).getAttribute("maxlength")).toBe("1000");
});

test("메모 찾기: 돋보기로 찾는 칸을 열어 메모를 글자로 거르고(대소문자 구분 없이) 맞는 글자에 형광펜, 없으면 한 줄, Esc·✕로 닫으면 비워진다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  await seedNote(author, contactId, "마라탕 좋아함, 마라샹궈도", [], 10);
  await seedNote(author, contactId, "Latte 마시는 날이 많음", [], 20);
  await seedNote(author, contactId, "신발은 245", [], 30);
  await page.goto(`/people/${contactId}?tab=memo`);

  const find = page.getByRole("searchbox", { name: "메모 찾기" });
  const toggle = page.getByRole("button", { name: "메모 찾기" });
  await expect(find).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // 누를 자리 44px 이상
  const tb = await tapSize(toggle);
  expect(tb.w).toBeGreaterThanOrEqual(MIN_TAP);
  expect(tb.h).toBeGreaterThanOrEqual(MIN_TAP);

  await toggle.click();
  await expect(find).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect((await find.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await tapSize(page.getByRole("searchbox", { name: "메모 찾기" }).locator("xpath=following-sibling::button"))).h).toBeGreaterThanOrEqual(MIN_TAP);

  // 거르기 + 형광펜(맞는 글자마다)
  await find.fill("마라");
  await expect(page.getByRole("button", { name: /마라탕 좋아함/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Latte/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /신발은/ })).toHaveCount(0);
  await expect(page.locator("mark")).toHaveText(["마라", "마라"]);
  await shot(page, "memo-search");

  // 대소문자 구분 없이
  await find.fill("LATTE");
  await expect(page.getByRole("button", { name: /Latte/ })).toBeVisible();
  await expect(page.locator("mark")).toHaveText(["Latte"]);
  await expect(page.getByRole("button", { name: /마라탕/ })).toHaveCount(0);

  // 맞는 메모가 없으면 한 줄
  await find.fill("없는글");
  await expect(page.getByText("찾는 메모가 없어요", { exact: true })).toBeVisible();
  await expect(page.locator("mark")).toHaveCount(0);
  await shot(page, "memo-search-empty");

  // 거른 목록에서도 메모를 눌러 연다
  await find.fill("신발");
  await page.getByRole("button", { name: /신발은 245/ }).click();
  await expect(page.getByRole("dialog").getByText("신발은 245", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();

  // Esc: 닫히고 비워져 메모가 다 보인다. 다시 열면 빈 칸
  await find.press("Escape");
  await expect(find).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Latte/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /마라탕/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /신발은/ })).toBeVisible();
  await toggle.click();
  await expect(find).toHaveValue("");

  // ✕: 닫는다
  await find.fill("마라");
  await expect(page.getByRole("button", { name: /Latte/ })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "메모 찾기" }).locator("xpath=following-sibling::button").click();
  await expect(find).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Latte/ })).toBeVisible();

  // 기억해 둔 것 칸에서는 돋보기가 없다
  await rememberedTab(page).click();
  await expect(toggle).toHaveCount(0);
});

test("정리 알림: 저장한 메모에 정리 결과가 생기면 한 번만 알리고(여럿이면 외 n개), 되돌리기는 그 메모가 더한 것만 되돌리고 메모는 둔다, 더한 게 없으면 알리지 않는다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(240_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  const url = `/people/${contactId}`;
  const toast = page.getByRole("status").getByText(/넣었어요/);

  // ① 저장 표시를 남기고 화면을 연 뒤 AI 정리가 끝난 것처럼 더한 것을 심으면, 새로 받은 화면에서 알림이 뜬다(둘이면 첫 줄 + 외 1개)
  const first = await seedNote(author, contactId, "마라탕 좋아함 신발 245", []);
  await markOrganizing(page, contactId);
  await page.goto(url);
  await expect(page.getByRole("button", { name: /마라탕 좋아함 신발 245/ })).toBeVisible();
  await expect(toast).toHaveCount(0);
  await putSection(author, contactId, "taste", TASTE("마라탕"));
  await putSection(author, contactId, "sizes", { ...emptySection("sizes"), shoe: 245 });
  await setEffects(author, contactId, first, "마라탕 좋아함 신발 245", [likes("마라탕"), shoe(245, 240)]);
  await expect(toast).toHaveText("좋아하는 음식에 마라탕 넣었어요 외 1개", { timeout: 35_000 });
  await expect(page.getByRole("status").getByRole("button", { name: "되돌리기" })).toBeVisible();
  // 아래 토스트 자리: 하단 메뉴 위
  const tb = (await toast.boundingBox())!;
  expect(tb.y + tb.height).toBeLessThanOrEqual(page.viewportSize()!.height - 60);
  await shot(page, "toast-undo");

  // 한 번만: 사라진 뒤 같은 표시로 다시 열어도(새로 고침) 같은 메모로는 뜨지 않는다
  await expect(toast).toHaveCount(0, { timeout: 12_000 });
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(toast).toHaveCount(0);

  // ② 새 메모(짜장면)에 더한 것이 생기면 그 메모로 알리고, 되돌리기는 그 메모가 더한 것만 되돌린다
  const second = await seedNote(author, contactId, "짜장면도 좋아함", []);
  await markOrganizing(page, contactId);
  await page.reload();
  await expect(page.getByRole("button", { name: /짜장면도 좋아함/ })).toBeVisible();
  await putSection(author, contactId, "taste", TASTE("마라탕", "짜장면"));
  await setEffects(author, contactId, second, "짜장면도 좋아함", [likes("짜장면")]);
  await expect(toast).toHaveText("좋아하는 음식에 짜장면 넣었어요", { timeout: 35_000 });
  await page.getByRole("status").getByRole("button", { name: "되돌리기" }).click();
  await expect.poll(async () => (await readSection<{ likes: string[] }>(author, contactId, "taste"))?.likes).toEqual(["마라탕"]);
  // 메모는 그대로이고 더한 것은 비워졌다. 다른 메모가 더한 것은 그대로
  expect((await readNote(author, contactId, second))?.body).toBe("짜장면도 좋아함");
  expect((await readNote(author, contactId, second))?.effects).toEqual([]);
  expect((await readNote(author, contactId, first))?.effects).toEqual([likes("마라탕"), shoe(245, 240)]);
  expect((await readSection<{ shoe: number | null }>(author, contactId, "sizes"))?.shoe).toBe(245);
  expect(await noteCount(contactId)).toBe(2);
  // 메모 시트에는 더는 '더해진 것'도 '같이 지우기'도 없다(지우기 하나뿐)
  await page.waitForTimeout(500);
  const sheet = await openNote(page, /짜장면도 좋아함/);
  await expect(sheet.getByText("이 메모로 더해진 것")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "같이 지우기" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "지우기", exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "닫기" }).click();
  await page.getByRole("tab", { name: "기억해 둔 것" }).click();
  await expect(page.getByRole("tabpanel").getByText("짜장면")).toHaveCount(0);
  await expect(page.getByRole("tabpanel").getByText("마라탕")).toBeVisible();

  // ③ 정리가 아무것도 더하지 않았으면(더한 것 없음) 알리지 않는다
  await seedNote(author, contactId, "그냥 적어 둔 메모", []);
  await markOrganizing(page, contactId);
  await page.goto(`${url}?tab=memo`);
  await expect(page.getByRole("button", { name: /그냥 적어 둔 메모/ })).toBeVisible();
  await page.waitForTimeout(6000); // 첫 새로 받기(3.5초) 뒤까지
  await expect(toast).toHaveCount(0);
});

test("정리 알림: 저장 표시가 없으면(나중에 들른 사람) 더해진 것이 있어도 알리지 않는다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  await putSection(author, contactId, "taste", TASTE("마라탕"));
  await seedNote(author, contactId, "마라탕 좋아함", [likes("마라탕")]);
  await page.goto(`/people/${contactId}?tab=memo`);
  await expect(page.getByRole("button", { name: /마라탕 좋아함/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("status").getByText(/넣었어요/)).toHaveCount(0);
});

test("메모 고치기 뒤 다시 정리: 이미 열린 화면이 새로 받아 새로 더해진 것만 알리고, 되돌리기는 새로 붙은 일만 되돌려 전에 더해진 것은 그대로 둔다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(180_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  await blockAi(author); // 서버의 다시 정리는 한도에 막혀 아무것도 안 하고, AI가 한 일은 아래에서 DB에 심는다
  await putSection(author, contactId, "taste", TASTE("마라탕"));
  const id = await seedNote(author, contactId, "마라탕 좋아함", [likes("마라탕")]);
  await page.goto(`/people/${contactId}?tab=memo`);
  test.skip((await page.getByRole("link", { name: "초롱이 이야기 적기" }).count()) === 0, "AI가 꺼져 있다(메모 쓰기가 닫혀 있어 다시 정리 표시를 남기지 않는다)");
  const toast = page.getByRole("status").getByText(/넣었어요/);

  // 글을 고쳐 저장한다 → 시트가 닫히고, 이 화면이 새로 받을 준비를 한다. 전에 더해진 '마라탕'은 이미 보이던 줄이라 알림에 들어가지 않는다
  const sheet = await openNote(page, /마라탕 좋아함/);
  await sheet.getByRole("button", { name: "고치기" }).click();
  await sheet.getByRole("textbox", { name: "고치기" }).fill("마라탕 좋아함, 신발 245");
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /마라탕 좋아함, 신발 245/ })).toBeVisible();
  await expect(toast).toHaveCount(0);

  // 서버가 다시 정리해 새 일(신발)이 이 메모의 일 뒤에 붙은 것처럼 심으면, 새로 받은 화면이 새 줄만 알린다
  await putSection(author, contactId, "sizes", { ...emptySection("sizes"), shoe: 245 });
  await setEffects(author, contactId, id, "마라탕 좋아함, 신발 245", [likes("마라탕"), shoe(245, 240)]);
  await expect(toast).toHaveText("신발(mm)에 240 대신 245 넣었어요", { timeout: 35_000 });
  await expect(page.getByRole("status").getByRole("button", { name: "되돌리기" })).toBeVisible();

  // 되돌리기: 새로 붙은 신발만 되돌아가고, 전에 더해진 마라탕과 메모는 그대로
  await page.getByRole("status").getByRole("button", { name: "되돌리기" }).click();
  await expect.poll(async () => (await readSection<{ shoe: number | null }>(author, contactId, "sizes"))?.shoe).toBe(240);
  expect((await readSection<{ likes: string[] }>(author, contactId, "taste"))?.likes).toEqual(["마라탕"]);
  const note = await readNote(author, contactId, id);
  expect(note?.body).toBe("마라탕 좋아함, 신발 245");
  expect(note?.effects).toEqual([likes("마라탕")]);
  expect(await noteCount(contactId)).toBe(1);

  // 한 번만: 같은 표시로 다시 열어도 같은 고치기로는 뜨지 않는다
  await expect(toast).toHaveCount(0, { timeout: 12_000 });
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(toast).toHaveCount(0);
});
