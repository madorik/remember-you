import { expect, test, type Page } from "@playwright/test";
import { SENSITIVE_SECTIONS, type Section } from "@readme/core";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { aad, sealWith } from "../lib/crypto-core";
import { fakeOrganize } from "./helpers";

// 사람들 '최근 본 사람' 줄 · 폴더 안 사람 빼기(×) 누르는 자리 · 메모 쓰기 칩 누르는 자리와 초안 이어 쓰기 · 물어보기 처음 고르는 항목(안 적은 것 먼저).
// 데모 계정(샘플 사람: 엄마·아내·아빠는 가족 폴더, 단짝은 친구들 폴더)으로 돈다. SHOTS=폴더 를 주면 390×844 화면 사진을 남긴다.

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

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

/** 샘플 사람이 든 데모 계정으로 들어간다 */
async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
}

/** 이름 → contactId(데모 계정의 내 사람들) */
async function ids(page: Page): Promise<Record<string, string>> {
  await page.goto("/people");
  const out: Record<string, string> = {};
  // 즐겨찾기·폴더 없음 칸에는 폴더에 든 사람이 보이지 않으니, 찾기로 모두에서 읽는다
  for (const name of ["엄마", "아빠", "아내", "단짝"]) {
    await page.getByRole("searchbox", { name: "이름이나 태그로 찾기" }).fill(name);
    const href = await page.getByRole("link", { name: new RegExp(`^${name}`) }).first().getAttribute("href");
    out[name] = href!.split("/people/")[1]!.split("?")[0]!;
  }
  return out;
}

const setViewed = (contactId: string, daysAgo: number | null, viewDays = 1) =>
  withDb((db) =>
    db.query("update contacts set viewed_on = case when $2::int is null then null else current_date - $2::int end, view_days = $3 where id = $1::uuid", [contactId, daysAgo, viewDays]),
  );

/** 사람 화면을 연 뒤 브라우저가 부르는 '열었다' 기록이 DB에 들어올 때까지(나중에 들어와 심어 둔 날짜를 덮어쓰지 않게) */
const waitViewed = (contactId: string) =>
  expect
    .poll(() => withDb(async (db) => (await db.query<{ v: boolean }>("select viewed_on is not null as v from contacts where id = $1::uuid", [contactId])).rows[0]?.v))
    .toBe(true);

test("사람들: 본 사람이 2명 미만이면 '최근 본 사람'이 없고, 2명 이상이면 늦게 본 순서로 둥근 얼굴 + 이름이 한 줄에(최대 6명) 뜨며 누르면 그 사람 화면, 고르기·찾는 중에는 숨는다", async ({ page }) => {
  test.skip(!DB_URL, "DATABASE_URL이 없다");
  test.setTimeout(180_000);
  await demo(page);
  const who = await ids(page);
  const row = page.getByRole("region", { name: "최근 본 사람" });

  // 처음엔 본 사람이 없다
  await page.goto("/people");
  await expect(page.getByRole("searchbox", { name: "이름이나 태그로 찾기" })).toBeVisible();
  await expect(row).toHaveCount(0);

  // 한 명만 보면 아직 숨긴다
  await setViewed(who["엄마"]!, 3);
  await page.goto("/people");
  await expect(page.getByRole("searchbox", { name: "이름이나 태그로 찾기" })).toBeVisible();
  await expect(row).toHaveCount(0);

  // 두 명 이상: 늦게 본 순(아빠 1일 전 → 단짝 2일 전 → 엄마 3일 전). 본 적 없는 아내는 없다
  await setViewed(who["아빠"]!, 1);
  await setViewed(who["단짝"]!, 2);
  await page.goto("/people");
  await expect(row).toBeVisible();
  await expect(row.getByRole("link")).toHaveText(["아빠", "단짝", "엄마"]);
  await expect(row.getByRole("link", { name: "아내" })).toHaveCount(0);
  // 폴더 칸 위(찾기 칸 바로 밑)에 있다
  const searchBox = await page.getByRole("searchbox", { name: "이름이나 태그로 찾기" }).boundingBox();
  const rowBox = await row.boundingBox();
  const folderBox = await page.getByRole("region", { name: "폴더", exact: true }).boundingBox();
  expect(rowBox!.y).toBeGreaterThan(searchBox!.y + searchBox!.height - 1);
  expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(folderBox!.y + 1);
  // 얼굴 + 이름이 누르는 자리 44px 이상
  const first = await row.getByRole("link").first().boundingBox();
  expect(first!.width).toBeGreaterThanOrEqual(44);
  expect(first!.height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "people-recent");

  // 찾는 중·고르는 중에는 숨는다
  await page.getByRole("searchbox", { name: "이름이나 태그로 찾기" }).fill("엄");
  await expect(row).toHaveCount(0);
  await page.getByRole("searchbox", { name: "이름이나 태그로 찾기" }).fill("");
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "취소" }).click();

  // 누르면 그 사람 화면
  await row.getByRole("link", { name: "단짝" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${who["단짝"]}`));
  await waitViewed(who["단짝"]!);

  // 새로 사람을 더해 모두 보면 6명까지만
  for (const name of ["하나", "둘리", "셋째"]) {
    await page.goto("/people/new");
    await page.getByLabel("이름이나 부르는 말").fill(name);
    await page.getByRole("button", { name: "만들기", exact: true }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    const id = new URL(page.url()).pathname.split("/people/")[1]!.split("/")[0]!;
    who[name] = id;
    await waitViewed(id);
  }
  const all = ["엄마", "아빠", "아내", "단짝", "하나", "둘리", "셋째"];
  for (const [i, name] of all.entries()) await setViewed(who[name]!, i + 1, 1);
  await page.goto("/people");
  await expect(row.getByRole("link")).toHaveCount(6);
  await expect(row.getByRole("link").first()).toHaveText("엄마");
  await expect(row.getByRole("link", { name: "셋째" })).toHaveCount(0);
});

test("폴더 안 사람 빼기(×): 누르는 자리가 44×44 이상이고 보이는 동그라미는 그대로, 눌러 빼면 되돌리기가 뜬다(동그라미 바로 옆 가장자리도 눌린다)", async ({ page }) => {
  test.setTimeout(120_000);
  await demo(page);
  await page.goto("/people");
  await page.locator('a[href^="/people/folder/"]').filter({ hasText: "가족" }).click();
  await expect(page).toHaveURL(/\/people\/folder\//);
  const x = page.getByRole("button", { name: "엄마 폴더에서 빼기" });
  await expect(x).toBeVisible();
  const box = await x.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  // 보이는 동그라미는 20px 안팎 그대로
  const dot = await x.locator("span").first().boundingBox();
  expect(dot!.width).toBeLessThan(24);
  // 날짜 글자와 동그라미 사이가 떨어져 있다
  const date = await page.getByRole("link", { name: /^엄마/ }).locator("span.num").first().boundingBox();
  expect(dot!.x - (date!.x + date!.width)).toBeGreaterThanOrEqual(8);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "folder-remove");

  // 동그라미 왼쪽 가장자리(예전엔 27px 칸 밖이라 줄 링크가 눌렸을 자리)도 빼기로 눌린다
  const edge = await x.boundingBox();
  await page.mouse.click(edge!.x + 4, edge!.y + edge!.height / 2);
  await expect(page.getByRole("link", { name: /^엄마/ })).toHaveCount(0);
  await expect(page).toHaveURL(/\/people\/folder\//);
  await expect(page.getByRole("status").getByRole("button", { name: "되돌리기" })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("link", { name: /^엄마/ })).toBeVisible();
});

test("메모 쓰기: 사람 칩·+·이름 칸·칩 ×는 누르는 자리가 44px(보이는 칩은 그대로), 쓰던 글은 같은 탭에서 다시 열면 같은 곳(?to)에서만 되살아나고 저장하거나 글을 지우면 사라진다", async ({ page }) => {
  test.setTimeout(150_000);
  await fakeOrganize(page); // 저장 뒤 정리는 진짜 AI 없이(더할 게 없었다)
  await demo(page);
  const who = await ids(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/voice");
  const body = page.getByRole("textbox", { name: "기억해 둘 것" });
  await expect(body).toBeVisible();

  // 누르는 자리: 보이는 칩(27px 안팎)의 위·아래 8px 밖을 눌러도 눌린다
  const chip = page.getByRole("button", { name: "엄마", exact: true });
  const cb = await chip.boundingBox();
  expect(cb!.height).toBeLessThan(34);
  await shot(page, "memo-chips");
  await page.mouse.click(cb!.x + cb!.width / 2, cb!.y - 7);
  const remove = page.getByRole("button", { name: "엄마 빼기" });
  await expect(remove).toBeVisible();
  // 칩 ×도 위아래로 길다: 칩 가운데 높이에서 위쪽 18px 밖은 아니지만 ×의 위 가장자리 바깥 9px은 눌린다
  const rb = await remove.boundingBox();
  await page.mouse.click(rb!.x + rb!.width / 2, rb!.y - 9);
  await expect(remove).toHaveCount(0);
  // '+' 도 위·아래 8px 밖이 눌려 이름 칸이 열린다
  const plus = page.getByRole("button", { name: "사람 추가하기" });
  const pb = await plus.boundingBox();
  await page.mouse.click(pb!.x + pb!.width / 2, pb!.y + pb!.height + 7);
  await expect(page.getByRole("combobox", { name: "이름" })).toBeVisible();
  await page.getByRole("combobox", { name: "이름" }).press("Escape");

  // 초안: 글과 칩을 남기고 다른 화면에 갔다 오면 되살아난다
  await page.getByRole("button", { name: "엄마", exact: true }).click();
  await body.fill("엄마는 수국을 좋아해");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("rm_memo_draft:free"))).toContain("엄마는 수국을 좋아해");
  await page.goto("/home");
  await page.goto("/voice");
  await expect(page.getByRole("textbox", { name: "기억해 둘 것" })).toHaveValue("엄마는 수국을 좋아해");
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();
  // 이 탭 저장소에만 남는다(localStorage·서버에는 없다)
  const keys = await page.evaluate(() => ({ session: Object.keys(sessionStorage).filter((k) => k.startsWith("rm_memo_draft")), local: Object.keys(localStorage).filter((k) => k.startsWith("rm_memo_draft")) }));
  expect(keys.session).toEqual(["rm_memo_draft:free"]);
  expect(keys.local).toEqual([]);

  // 다른 곳(?to=아빠)에서 열면 그 초안이 아니다. 거기서 쓴 글은 그곳에서만 되살아난다
  await page.goto(`/voice?to=${who["아빠"]}`);
  await expect(page.getByRole("textbox", { name: "아빠에 대해 기억해 둘 것" })).toHaveValue("");
  await page.getByRole("textbox", { name: "아빠에 대해 기억해 둘 것" }).fill("아빠는 낚시를 좋아해");
  await expect.poll(() => page.evaluate((k) => sessionStorage.getItem(k), `rm_memo_draft:to:${who["아빠"]}`)).toContain("아빠는 낚시를 좋아해");
  await page.goto("/voice");
  await expect(page.getByRole("textbox", { name: "기억해 둘 것" })).toHaveValue("엄마는 수국을 좋아해");
  await page.goto(`/voice?to=${who["아빠"]}`);
  await expect(page.getByRole("textbox", { name: "아빠에 대해 기억해 둘 것" })).toHaveValue("아빠는 낚시를 좋아해");

  // 글을 다 지우면 초안도 사라진다(새로 열어도 비어 있다)
  await page.getByRole("textbox", { name: "아빠에 대해 기억해 둘 것" }).fill("");
  await expect.poll(() => page.evaluate((k) => sessionStorage.getItem(k), `rm_memo_draft:to:${who["아빠"]}`)).toBeNull();
  await page.goto("/home");
  await page.goto(`/voice?to=${who["아빠"]}`);
  await expect(page.getByRole("textbox", { name: "아빠에 대해 기억해 둘 것" })).toHaveValue("");

  // 저장하면 초안이 사라진다
  await page.goto("/voice");
  await expect(page.getByRole("textbox", { name: "기억해 둘 것" })).toHaveValue("엄마는 수국을 좋아해");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog", { name: "엄마 메모장에 저장했어요" }).getByRole("button", { name: "엄마 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${who["엄마"]}`), { timeout: 30_000 });
  await page.goto("/voice");
  await expect(page.getByRole("textbox", { name: "기억해 둘 것" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toHaveCount(0);
});

test("물어보기: 처음 골라 두는 항목은 그 사람이 아직 안 적은 것부터(중요한 순서 3개), 이미 적은 것은 '더 물어볼 것'으로 가고, 주소로 정한 항목이 이긴다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(150_000);
  await demo(page);
  await page.goto("/people/new");
  await page.getByLabel("이름이나 부르는 말").fill("초롱이");
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "초롱이" })).toBeVisible();
  const contactId = new URL(page.url()).pathname.split("/people/")[1]!.split("/")[0]!;
  const author = await withDb(async (db) => (await db.query<{ user_id: string }>("select user_id from contacts where id = $1::uuid", [contactId])).rows[0]!.user_id);
  const put = async (section: Section, data: unknown) => {
    const payload = sealWith(Buffer.from(KEY_B64!, "base64"), data, aad.contact(author, contactId, section), SENSITIVE_SECTIONS.includes(section));
    await withDb((db) =>
      db.query(
        `insert into contact_cards (contact_id, author_id, sections) values ($1, $2, jsonb_build_object($3::text, $4::jsonb))
         on conflict (contact_id) do update set sections = contact_cards.sections || excluded.sections`,
        [contactId, author, section, JSON.stringify(payload)],
      ),
    );
  };
  const cards = (p: Page) => p.locator("ul > li > button[aria-pressed]");
  const picked = async (p: Page) => (await cards(p).evaluateAll((els) => els.map((e) => [e.getAttribute("aria-label"), e.getAttribute("aria-pressed")]))) as [string, string][];

  // 아무것도 안 적은 사람: 중요한 순서 3개(생일·기념일, 음식과 알레르기, 좋아하는 음식)
  await page.goto(`/request?to=${contactId}`);
  await expect(page.getByRole("heading", { name: "먼저 이 셋" })).toBeVisible();
  expect(await picked(page)).toEqual([["생일·기념일", "true"], ["음식과 알레르기", "true"], ["좋아하는 음식", "true"]]);

  // 생일과 알레르기를 적고 좋아하는 음식 칸은 비어 있는 사람: 적은 것은 빠지고(비어 있는 칸은 안 적은 것으로 센다) 중요한 3개(좋아하는 음식·선물·사이즈)
  await put("dates", { birthday: { calendar: "solar", month: 3, day: 9 }, anniversaries: [] });
  await put("safety", { allergens: ["땅콩"], allergyNote: "", dislikes: [], diets: [] });
  await put("taste", { likes: [], spicy: null, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } });
  await page.goto(`/request?to=${contactId}`);
  await expect(page.getByRole("heading", { name: "먼저 이 셋" })).toBeVisible();
  expect(await picked(page)).toEqual([["좋아하는 음식", "true"], ["선물", "true"], ["사이즈", "true"]]);
  // 이미 적은 항목은 '더 물어볼 것' 칩(눌리지 않은 채)으로
  await expect(page.getByRole("button", { name: "생일·기념일" })).toHaveAttribute("aria-pressed", "false");
  await shot(page, "ask-defaults");

  // 좋아하는 음식도 적으면 다음 항목이 올라온다
  await put("taste", { likes: ["마라탕"], spicy: null, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } });
  await page.goto(`/request?to=${contactId}`);
  expect(await picked(page)).toEqual([["선물", "true"], ["사이즈", "true"], ["좋아하는 것들", "true"]]);

  // 주소로 정한 항목(?topic=)이 이긴다
  await page.goto(`/request?to=${contactId}&topic=dates`);
  expect(await picked(page)).toEqual([["생일·기념일", "true"]]);

  // 사람을 고르지 않고 열면 기본 3개, 사람을 고르면 그 사람 기준으로 바뀐다
  await page.goto("/request");
  expect(await picked(page)).toEqual([["생일·기념일", "true"], ["음식과 알레르기", "true"], ["좋아하는 음식", "true"]]);
  await page.getByLabel("누구에게 물어볼까요?").fill("초롱이");
  await page.getByRole("button", { name: "초롱이" }).click();
  expect(await picked(page)).toEqual([["선물", "true"], ["사이즈", "true"], ["좋아하는 것들", "true"]]);
});
