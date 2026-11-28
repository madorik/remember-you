import { expect, test, type Page } from "@playwright/test";
import { emptySection, SENSITIVE_SECTIONS, type Section } from "@readme/core";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { aad, sealWith } from "../lib/crypto-core";

// 사람 화면 프로필 카드의 '기억해 둔 것 작성률' 막대(app/(app)/people/[id]/CompletionBar.tsx).
// 분모는 오늘의 질문이 묻는 칸 11개 + 생일·알레르기·사이즈·반려동물 4칸 = 15(packages/core recordCompletion). 사람 기록은 DB에 직접 심는다(진짜와 같은 암호화).
// 생일·사이즈 같은 질문 밖 항목과 말풍선의 물어보기 링크는 person-book.spec.ts에서 시험한다.

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

async function putSection(author: string, contactId: string, section: Section, data: unknown) {
  const payload = sealWith(Buffer.from(KEY_B64 ?? "", "base64"), data, aad.contact(author, contactId, section), SENSITIVE_SECTIONS.includes(section));
  await withDb((db) =>
    db.query(
      `insert into contact_cards (contact_id, author_id, sections) values ($1, $2, jsonb_build_object($3::text, $4::jsonb))
       on conflict (contact_id) do update set sections = contact_cards.sections || excluded.sections`,
      [contactId, author, section, JSON.stringify(payload)],
    ),
  );
}

/** SHOTS=폴더 를 주면 화면을 그 폴더에 저장한다 */
async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

// 샘플 사람(엄마·아빠 …)이 든 데모 계정이라, 같은 이름을 만들면 있던 사람이 열리니 샘플에 없는 이름을 쓴다
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

const bar = (page: Page, pct: string) => page.getByRole("button", { name: `기억해 둔 것 ${pct}%` });
const bubble = (page: Page) => page.getByRole("group", { name: /^기억해 둔 것 \d+%$/ });

test("작성률 막대: 빈 사람은 0%, 눌러 말풍선을 열면 남은 항목 칩이 고치는 화면으로 가고, 채울수록 오르며 다 채우면 100%", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  await page.goto(`/people/${contactId}`);

  // 처음엔 0%: 막대는 진짜 단추이고 말풍선은 닫혀 있다
  await expect(bar(page, "0")).toHaveAttribute("aria-expanded", "false");
  await expect(bubble(page)).toBeHidden();

  // 터치로 누르면 열린다: 한 줄(앞 셋 + 외 n개)과 남은 항목 칩 전부
  await bar(page, "0").tap();
  await expect(bar(page, "0")).toHaveAttribute("aria-expanded", "true");
  await expect(bubble(page)).toBeVisible();
  await expect(bubble(page).getByText("생일·알레르기·음식 외 6개 항목 채우기가 남았어요")).toBeVisible();
  await expect(bubble(page).getByRole("link")).toHaveText(["생일", "알레르기", "음식", "선물", "사이즈", "취향", "문화", "생활", "반려동물", "물어보기"]);
  await expect(bubble(page).getByRole("link", { name: "선물" })).toHaveAttribute("href", `/people/${contactId}/edit?open=gifts`);
  // 화면 밖으로 나가지 않는다
  const vw = page.viewportSize()!.width;
  const box = (await bubble(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw);
  await shot(page, "rate-bubble-0");

  // 다시 누르면 닫히고, Esc·바깥을 누르면 닫힌다
  await bar(page, "0").tap();
  await expect(bubble(page)).toBeHidden();
  await bar(page, "0").tap();
  await expect(bubble(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toBeHidden();
  await bar(page, "0").tap();
  await expect(bubble(page)).toBeVisible();
  await page.touchscreen.tap(200, 560); // 메모장 빈 속지
  await expect(bubble(page)).toBeHidden();

  // 칩을 누르면 그 항목이 펼쳐진 고치는 화면으로
  await bar(page, "0").tap();
  await bubble(page).getByRole("link", { name: "취향" }).tap();
  await expect(page).toHaveURL(new RegExp(`/people/${contactId}/edit\\?open=favorites`));

  // 오늘의 질문과 같은 칸(음료·매운맛)에 답이 들어가면 오른다: 2 / 15 = 13%, 입맛은 다 차서 남은 항목에서 빠진다
  await putSection(author, contactId, "taste", { ...emptySection("taste"), drinks: "라떼", spicy: 2 });
  await page.goto(`/people/${contactId}`);
  await expect(bar(page, "13")).toBeVisible();
  await bar(page, "13").tap();
  await expect(bubble(page).getByText("생일·알레르기·선물 외 5개 항목 채우기가 남았어요")).toBeVisible();
  await expect(bubble(page).getByRole("link")).toHaveText(["생일", "알레르기", "선물", "사이즈", "취향", "문화", "생활", "반려동물", "물어보기"]);
  await shot(page, "rate-bubble-13");

  // '없어요'로 답한 칸도 채운 것이고, 모든 칸을 채우면 100%: 말풍선은 한 줄뿐
  await putSection(author, contactId, "gifts", { ...emptySection("gifts"), giftCard: "no" });
  await putSection(author, contactId, "life", { ...emptySection("life"), seasons: ["none"] });
  await putSection(author, contactId, "favorites", { ...emptySection("favorites"), scent: "없음", flowers: "없음", patterns: ["none"], metals: ["none"], styles: ["none"] });
  await putSection(author, contactId, "culture", { ...emptySection("culture"), musicGenres: ["none"], movieGenres: ["none"] });
  // 질문이 묻지 않는 항목도 채워야 100%: 생일 · 알레르기 없음 · 사이즈 · 반려동물 없음
  await putSection(author, contactId, "dates", { birthday: { calendar: "solar", month: 3, day: 14 }, anniversaries: [] });
  await putSection(author, contactId, "safety", { ...emptySection("safety"), allergens: ["none"] });
  await putSection(author, contactId, "sizes", { ...emptySection("sizes"), shoe: 245 });
  await putSection(author, contactId, "pets", { pets: [], none: true });
  await page.goto(`/people/${contactId}`);
  await expect(bar(page, "100")).toBeVisible();
  await bar(page, "100").tap();
  await expect(bubble(page)).toHaveText("다 채웠어요");
  await expect(bubble(page).getByRole("link")).toHaveCount(0);
  await shot(page, "rate-bubble-100");
});

test("작성률 막대: 마우스를 올리면 말풍선이 뜨고(칩으로 옮겨 갈 수 있다) 벗어나면 닫히며, 키보드 포커스로도 뜬다", async ({ browser }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false, isMobile: false, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await ctx.newPage();
  const { contactId } = await newPerson(page, "복실이");
  await page.goto(`/people/${contactId}`);
  await expect(bubble(page)).toBeHidden();

  await bar(page, "0").hover();
  await expect(bubble(page)).toBeVisible();
  // 막대에서 말풍선의 칩으로 옮겨 가도 닫히지 않는다
  const chip = bubble(page).getByRole("link", { name: "음식" });
  await chip.hover();
  await page.waitForTimeout(400);
  await expect(bubble(page)).toBeVisible();
  // 벗어나면 닫힌다
  await page.mouse.move(200, 760);
  await expect(bubble(page)).toBeHidden();

  // 키보드: 막대에 포커스가 가면 뜨고, Tab으로 칩에 가도 열려 있으며, Esc로 닫힌다
  await page.getByRole("button", { name: "더 보기" }).focus();
  for (let i = 0; i < 6 && !(await bar(page, "0").evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(bar(page, "0")).toBeFocused();
  await expect(bubble(page)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(bubble(page).getByRole("link", { name: "생일" })).toBeFocused(); // 맨 앞 칩(가장 중요한 남은 항목)
  await expect(bubble(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toBeHidden();
  await ctx.close();
});
