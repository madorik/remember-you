import { expect, test, type Page } from "@playwright/test";
import { emptySection } from "@readme/core";
import { mkdirSync } from "node:fs";
import { DB_URL, KEY_B64, TASTE, blockAi, likes, noteIdsOf, putSection, readNote, readSection, setEffects, shoe, withDb } from "./db";
import { fakeOrganize, signIn, type OrganizeFake } from "./helpers";

// 메모 저장 경험(app/(app)/voice/MemoPad.tsx · SaveCard.tsx):
// - 이름 칸('+')에 이름을 치고 칸을 벗어나면 고르지 않아도 칩이 된다(있는 이름은 그 사람, 없는 이름은 새 사람). 목록 항목을 누를 때 따로 칩이 생기지 않고, 저장을 누를 때도 쳐 둔 이름이 들어간다
// - 저장하면 카드가 뜬다: 저장했어요 ✓ → 기억해 둔 것으로 정리하는 중 → 결과(항목 아이콘과 한 줄씩) · 되돌리기 · {이름} 보기 · 계속 쓰기
// AI 결과에 기대지 않는다: 정리 서버 동작(organizeSaved)의 응답을 정해 둔 값으로 바꿔 끼운다(helpers fakeOrganize). 서버가 한 일은 DB에 직접 심어 흉내 낸다. 진짜 AI로 한 번 보려면 E2E_REAL_AI=1
// SHOTS=폴더 를 주면 카드 화면을 그 폴더에 저장한다

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
}

/** 데모로 들어가 새 사람을 만들고 그 사람의 contactId와 (암호화 범위에 쓰는) 내 id를 돌려준다 */
async function newPerson(page: Page, name: string) {
  await demo(page);
  await page.goto("/people/new");
  await page.getByLabel("이름이나 부르는 말").fill(name);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const contactId = new URL(page.url()).pathname.split("/people/")[1]!.split("/")[0]!;
  const author = await withDb(async (db) => (await db.query<{ user_id: string }>("select user_id from contacts where id = $1::uuid", [contactId])).rows[0]!.user_id);
  return { contactId, author };
}

/** 데모 계정의 내 사람 한 명의 contactId */
async function idOf(page: Page, name: string) {
  await page.goto("/home");
  const href = await page.getByRole("link", { name: new RegExp(`^${name}`) }).first().getAttribute("href");
  return href!.split("/").pop()!;
}

const body = (page: Page) => page.getByRole("textbox", { name: /기억해 둘 것/ });
const plus = (page: Page) => page.getByRole("button", { name: "사람 추가하기" });
const nameBox = (page: Page) => page.getByRole("combobox", { name: "이름" });
const save = (page: Page) => page.getByRole("button", { name: "저장", exact: true });
const card = (page: Page, saved: string) => page.getByRole("dialog", { name: `${saved} 메모장에 저장했어요` });
const rememberedTab = (page: Page) => page.getByRole("tab", { name: "기억해 둔 것" });

test("이름 칸: 친 이름은 칸을 벗어나면 칩이 된다 — 있는 이름은 그 사람, 없는 이름은 새 사람, 이미 고른 이름·빈 칸은 더하지 않는다", async ({ page }) => {
  await demo(page);
  await page.goto("/voice");

  // 있는 이름(엄마): 본문을 눌러 칸을 벗어나면 그 사람 칩(새로 표시 없음), 이름 칸은 닫힌다
  await plus(page).click();
  await nameBox(page).fill("엄마");
  await body(page).click();
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();
  await expect(page.getByText("새로", { exact: true })).toHaveCount(0);
  await expect(nameBox(page)).toHaveCount(0);

  // 없는 이름: 새 사람 칩('새로' 표시)
  await plus(page).click();
  await nameBox(page).fill("초롱이");
  await body(page).click();
  await expect(page.getByRole("button", { name: "초롱이 빼기" })).toBeVisible();
  await expect(page.getByText("새로", { exact: true })).toHaveCount(1);
  await expect(nameBox(page)).toHaveCount(0);

  // 이미 고른 이름: 칩이 늘지 않고 칸만 닫힌다
  await plus(page).click();
  await nameBox(page).fill("엄마");
  await body(page).click();
  await expect(nameBox(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toHaveCount(1);

  // 빈 칸: 아무것도 더하지 않는다(칸은 잠깐 뒤 닫힌다)
  await plus(page).click();
  await nameBox(page).fill("   ");
  await body(page).click();
  await expect(nameBox(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /빼기$/ })).toHaveCount(2);
});

test("이름 목록의 항목을 누르면 칩이 한 번만 생긴다(칸을 벗어난 것으로 치다 만 글이 따로 칩이 되지 않는다), 엔터도 한 번", async ({ page }) => {
  await demo(page);
  await page.goto("/voice");
  const settle = () => page.waitForTimeout(700); // 칸을 벗어난 뒤 정하는 시간(NAME_BLUR_MS)보다 길게

  // 누른 항목(엄마)만: '엄' 새 사람이 따로 생기지 않는다
  await plus(page).click();
  await nameBox(page).fill("엄");
  await page.getByRole("listbox", { name: "사람" }).getByRole("option").first().click();
  await settle();
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "엄 빼기" })).toHaveCount(0);
  await expect(page.getByText("새로", { exact: true })).toHaveCount(0);

  // 손가락으로 눌러도(터치): '새로 추가' 항목은 한 번만
  await plus(page).click();
  await nameBox(page).fill("민지");
  await page.getByRole("option", { name: "'민지' 새로 추가" }).tap();
  await settle();
  await expect(page.getByRole("button", { name: "민지 빼기" })).toHaveCount(1);
  await expect(page.getByText("새로", { exact: true })).toHaveCount(1);

  // 엔터로 고른 것도 한 번
  await plus(page).click();
  await nameBox(page).fill("아빠");
  await nameBox(page).press("Enter");
  await settle();
  await expect(page.getByRole("button", { name: "아빠 빼기" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /빼기$/ })).toHaveCount(3);
});

test("이름 칸에 치다 만 이름이 있는 채로 저장을 눌러도 그 사람 메모로 저장된다", async ({ page }) => {
  await fakeOrganize(page);
  await demo(page);
  await page.goto("/voice");
  await body(page).fill("마라탕 좋아함");
  await plus(page).click();
  await nameBox(page).fill("초롱이");
  await save(page).click();
  const saved = card(page, "초롱이");
  await expect(saved).toBeVisible();
  await saved.getByRole("button", { name: "초롱이 보기" }).click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}\?tab=memo$/);
  await expect(page.getByRole("heading", { name: "초롱이" })).toBeVisible();
  await expect(page.getByText("마라탕 좋아함")).toBeVisible();
});

test("온보딩의 처음부터 열린 이름 칸도 칸을 벗어나면 친 이름이 새 사람 칩이 된다", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await nameBox(page).fill("초롱이");
  await page.getByRole("textbox", { name: "엄마는 장미꽃을 좋아해" }).click(); // 온보딩 본문 칸은 예시 문장이 이름이다
  await expect(page.getByRole("button", { name: "초롱이 빼기" })).toBeVisible();
  await expect(page.getByText("새로", { exact: true })).toBeVisible();
  await expect(nameBox(page)).toHaveCount(0);
});

const LINES = [
  { section: "taste", label: "좋아하는 음식", value: "마라탕" },
  { section: "sizes", label: "신발(mm)", value: "245", prev: "240" },
];

/** AI가 정리한 것처럼 사람 기록과 메모의 더한 것을 심는다(진짜 서버가 하는 일) */
async function seedOrganized(author: string, contactId: string, noteId: string, text: string) {
  await putSection(author, contactId, "taste", TASTE("마라탕"));
  await putSection(author, contactId, "sizes", { ...emptySection("sizes"), shoe: 245 });
  await setEffects(author, contactId, noteId, text, [likes("마라탕"), shoe(245, 240)]);
}

test("저장하면 카드가 저장했어요 → 정리하는 중 → 결과(항목 아이콘과 한 줄씩)를 보이고, '초롱이 보기'는 새로 고침 없이 기억해 둔 것에 새 값을 보인다", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  const text = "마라탕 좋아함, 신발 245";
  const org = await fakeOrganize(page, async (notes) => {
    await seedOrganized(author, contactId, notes[0]!.noteId, text);
    return { state: "ok", delayMs: 1500, people: [{ ...notes[0]!, lines: LINES }] };
  });
  await page.goto(`/voice?to=${contactId}`);
  await body(page).fill(text);
  await save(page).click();

  // ① 저장했어요 ✓ ② 정리하는 중(아직 결과가 없다: 단추도 없다)
  const saved = card(page, "초롱이");
  await expect(saved).toBeVisible();
  await expect(saved.getByRole("status").getByText("기억해 둔 것으로 정리하는 중")).toBeVisible();
  await expect(saved.getByRole("button")).toHaveCount(0);
  await shot(page, "01-progress");

  // ③ 결과: 항목 아이콘과 한 줄씩
  await expect(saved.getByText("기억해 둔 것에 더했어요")).toBeVisible();
  await expect(saved.getByText("좋아하는 음식 · 마라탕")).toBeVisible();
  await expect(saved.getByText("신발(mm) · 240 → 245")).toBeVisible();
  await expect(saved.locator("li")).toHaveCount(2);
  await expect(saved.getByRole("button")).toHaveText(["초롱이 보기", "되돌리기", "계속 쓰기"]);
  await shot(page, "02-result");
  // 정리 요청은 방금 저장한 그 메모 하나로 한 번
  expect(org.calls).toEqual([[{ contactId, noteId: (await noteIdsOf(contactId))[0]! }]]);

  // 보기: 더한 것이 있으니 기억해 둔 것 칸이 열리고, 새로 고치지 않았는데 새 값이 보인다
  await saved.getByRole("button", { name: "초롱이 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${contactId}\\?tab=remembered$`));
  await expect(rememberedTab(page)).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText("마라탕")).toBeVisible();
  await expect(panel.getByText("245")).toBeVisible();
  // 예전의 저장 표시는 남기지 않는다(다시 받아 오기·알림이 겹치지 않게)
  expect(await page.evaluate(() => sessionStorage.getItem("rm_organizing"))).toBeNull();
  await expect(page.getByRole("status").getByText(/넣었어요/)).toHaveCount(0);
});

test("카드의 되돌리기: 이 정리가 더한 것만 되돌리고(메모는 그대로) 카드가 '되돌렸어요'로 바뀐다. 그 뒤 보기는 메모장 칸으로", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  const text = "마라탕 좋아함, 신발 245";
  await fakeOrganize(page, async (notes) => {
    await seedOrganized(author, contactId, notes[0]!.noteId, text);
    return { state: "ok", people: [{ ...notes[0]!, lines: LINES }] };
  });
  await page.goto(`/voice?to=${contactId}`);
  await body(page).fill(text);
  await save(page).click();
  const saved = card(page, "초롱이");
  await expect(saved.getByText("좋아하는 음식 · 마라탕")).toBeVisible();
  const noteId = (await noteIdsOf(contactId))[0]!;

  await saved.getByRole("button", { name: "되돌리기" }).click();
  await expect(saved.getByText("되돌렸어요")).toBeVisible();
  await expect(saved.locator("li")).toHaveCount(0);
  await expect(saved.getByRole("button", { name: "되돌리기" })).toHaveCount(0);
  await expect(saved.getByRole("button")).toHaveText(["초롱이 보기", "계속 쓰기"]);
  await shot(page, "04-reverted");
  // 서버가 되돌렸다: 목록에서 마라탕이 빠지고 신발은 전 값, 메모는 그대로이고 더한 것은 비었다
  expect((await readSection<{ likes: string[] }>(author, contactId, "taste"))?.likes ?? []).toEqual([]);
  expect((await readSection<{ shoe: number | null }>(author, contactId, "sizes"))?.shoe).toBe(240);
  const note = await readNote(author, contactId, noteId);
  expect(note?.body).toBe(text);
  expect(note?.effects).toEqual([]);

  // 되돌린 뒤의 보기는 더한 게 없으니 메모장 칸
  await saved.getByRole("button", { name: "초롱이 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${contactId}\\?tab=memo$`));
  await expect(page.getByText(text)).toBeVisible();
});

test("정리 결과가 없을 때의 말: 새로 더할 건 없었어요 · 이미 알고 있던 내용 · 정리하지 못했어요 · 오늘 정리 한도. 되돌리기는 없고 계속 쓰기는 메모지를 비우되 그 사람은 붙여 둔다", async ({ page }) => {
  let next: OrganizeFake["state"] = "nothing";
  await fakeOrganize(page, () => ({ state: next }));
  await demo(page);
  const mom = await idOf(page, "엄마");
  await page.goto(`/voice?to=${mom}`);
  const cases: [OrganizeFake["state"], string][] = [
    ["nothing", "새로 더할 건 없었어요"],
    ["known", "이미 알고 있던 내용이에요"],
    ["failed", "정리하지 못했어요 · 메모는 저장됐어요"],
    ["ai_off", "정리하지 못했어요 · 메모는 저장됐어요"],
    ["limit", "오늘 정리는 다 썼어요 · 메모는 저장됐어요"],
  ];
  for (const [state, line] of cases) {
    next = state;
    await body(page).fill(`엄마 메모 ${state}`);
    await save(page).click();
    const saved = card(page, "엄마");
    await expect(saved.getByText(line)).toBeVisible();
    await expect(saved.getByRole("button", { name: "되돌리기" })).toHaveCount(0);
    await expect(saved.getByRole("button")).toHaveText(["엄마 보기", "계속 쓰기"]);
    if (state === "nothing") await shot(page, "03-nothing");
    // 계속 쓰기: 카드가 닫히고 메모지는 비며 이 화면에 남는다. 엄마는 그대로 붙어 있다
    await saved.getByRole("button", { name: "계속 쓰기" }).click();
    await expect(saved).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/voice\\?to=${mom}$`));
    await expect(body(page)).toHaveValue("");
    await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();
  }
  // 보기: 더한 게 없으면 메모장 칸으로(방금 쓴 메모가 보인다)
  next = "nothing";
  await body(page).fill("엄마 마지막 메모");
  await save(page).click();
  await card(page, "엄마").getByRole("button", { name: "엄마 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${mom}\\?tab=memo$`));
  await expect(page.getByText("엄마 마지막 메모")).toBeVisible();
});

test("여러 사람: 카드는 사람별로 더한 것을 보이고 사람마다 보기 단추가 있다(더한 사람은 기억해 둔 것, 아닌 사람은 메모장), 계속 쓰기는 모두 비운다", async ({ page }) => {
  await demo(page);
  const mom = await idOf(page, "엄마");
  const dad = await idOf(page, "아빠");
  await fakeOrganize(page, (notes) => ({
    state: "ok",
    people: notes.map((n) => ({ ...n, lines: n.contactId === dad ? [{ section: "taste", label: "좋아하는 음식", value: "막걸리" }] : [] })),
  }));

  const write = async () => {
    await page.goto("/voice");
    await page.getByRole("button", { name: "엄마", exact: true }).click();
    await plus(page).click();
    await page.getByRole("button", { name: "아빠", exact: true }).click();
    await body(page).fill("부모님 막걸리 좋아하심");
    await save(page).click();
    return card(page, "엄마, 아빠");
  };
  let saved = await write();
  await expect(saved.getByText("기억해 둔 것에 더했어요")).toBeVisible();
  await expect(saved.getByText("좋아하는 음식 · 막걸리")).toBeVisible();
  // 더한 사람(아빠) 이름 밑에만 줄이 있다
  await expect(saved.locator("li")).toHaveCount(1);
  await expect(saved.getByText("아빠", { exact: true })).toBeVisible();
  await expect(saved.getByRole("button")).toHaveText(["엄마 보기", "아빠 보기", "되돌리기", "계속 쓰기"]);
  await shot(page, "05-multi");

  // 계속 쓰기: 모두 비운다(칩도)
  await saved.getByRole("button", { name: "계속 쓰기" }).click();
  await expect(saved).toHaveCount(0);
  await expect(body(page)).toHaveValue("");
  await expect(page.getByRole("button", { name: /빼기$/ })).toHaveCount(0);

  // 엄마 보기(더한 게 없다) → 메모장 칸
  saved = await write();
  await saved.getByRole("button", { name: "엄마 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${mom}\\?tab=memo$`));
  // 아빠 보기(더했다) → 기억해 둔 것 칸
  saved = await write();
  await saved.getByRole("button", { name: "아빠 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${dad}\\?tab=remembered$`));
});

test("정리가 20초가 넘으면 카드가 '정리하지 못했어요'와 단추를 보이고, 서버 일이 늦게 끝나면 카드가 그 결과로 바뀐다", async ({ page }) => {
  test.setTimeout(120_000);
  await demo(page);
  const mom = await idOf(page, "엄마");
  await fakeOrganize(page, (notes) => ({ state: "ok", delayMs: 23_000, people: notes.map((n) => ({ ...n, lines: [{ section: "taste", label: "좋아하는 음식", value: "홍삼" }] })) }));
  await page.goto(`/voice?to=${mom}`);
  await body(page).fill("엄마는 홍삼을 좋아해");
  await save(page).click();
  const saved = card(page, "엄마");
  await expect(saved.getByText("기억해 둔 것으로 정리하는 중")).toBeVisible();
  // 20초 뒤: 못 했다고 알리고 단추가 나온다(메모는 이미 저장됐다)
  await expect(saved.getByText("정리하지 못했어요 · 메모는 저장됐어요")).toBeVisible({ timeout: 25_000 });
  await expect(saved.getByRole("button")).toHaveText(["엄마 보기", "계속 쓰기"]);
  // 늦게 온 결과: 카드가 바뀐다
  await expect(saved.getByText("좋아하는 음식 · 홍삼")).toBeVisible({ timeout: 15_000 });
  await expect(saved.getByRole("button")).toHaveText(["엄마 보기", "되돌리기", "계속 쓰기"]);
});

test("움직임 줄이기: 정리하는 동안 캐릭터가 흔들리지 않는다(켜 두지 않았을 때만 흔들린다)", async ({ page }) => {
  await fakeOrganize(page, () => ({ state: "nothing", delayMs: 3000 }));
  await demo(page);
  const mom = await idOf(page, "엄마");
  const animation = () => page.getByRole("dialog").locator("span[class*='save-bob']").evaluate((el) => getComputedStyle(el).animationName);
  const dots = () => page.getByRole("dialog").locator(".organize-dots i").first().evaluate((el) => getComputedStyle(el).animationName);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/voice?to=${mom}`);
  await body(page).fill("엄마 메모");
  await save(page).click();
  await expect(page.getByRole("dialog").getByText("기억해 둔 것으로 정리하는 중")).toBeVisible();
  expect(await animation()).toBe("save-bob");
  expect(await dots()).toBe("organize-dot");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await animation()).toBe("none");
  expect(await dots()).toBe("none");
});

test("서버: 정리를 안 하는 저장은 메모만 남기고, 하루 한도에 닿았으면 카드가 한도를 알리며 메모는 저장된다(AI를 부르지 않는다)", async ({ page }) => {
  test.skip(!DB_URL || !KEY_B64, "DATABASE_URL·DATA_ENCRYPTION_KEY가 없다");
  test.setTimeout(120_000);
  const { contactId, author } = await newPerson(page, "초롱이");
  await blockAi(author);
  await page.goto(`/voice?to=${contactId}`);
  test.skip(!(await body(page).count()), "AI가 꺼져 있다(메모 쓰기가 닫혀 있다)");
  await body(page).fill("마라탕 좋아함");
  await save(page).click();
  const saved = card(page, "초롱이");
  // 진짜 서버가 organizeSaved를 했다: 한도라 AI 없이 한도 문구
  await expect(saved.getByText("오늘 정리는 다 썼어요 · 메모는 저장됐어요")).toBeVisible({ timeout: 30_000 });
  await expect(saved.getByRole("button")).toHaveText(["초롱이 보기", "계속 쓰기"]);
  const ids = await noteIdsOf(contactId);
  expect(ids).toHaveLength(1);
  expect((await readNote(author, contactId, ids[0]!))?.effects).toEqual([]);
  await saved.getByRole("button", { name: "초롱이 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${contactId}\\?tab=memo$`));
  await expect(page.getByText("마라탕 좋아함")).toBeVisible();
});

test("진짜 AI로: '마라탕 좋아함'을 저장하면 카드가 몇 초 안에 결과 한 줄을 보이고, 초롱이 보기에 새로 고침 없이 마라탕이 있다(E2E_REAL_AI=1)", async ({ page }) => {
  test.skip(!process.env.E2E_REAL_AI, "진짜 AI를 부르는 시험이라 E2E_REAL_AI=1일 때만 돈다");
  test.setTimeout(120_000);
  const { contactId } = await newPerson(page, "초롱이");
  await page.goto(`/voice?to=${contactId}`);
  await body(page).fill("마라탕 좋아함");
  await save(page).click();
  const saved = card(page, "초롱이");
  await expect(saved.getByText("좋아하는 음식 · 마라탕")).toBeVisible({ timeout: 25_000 });
  await saved.getByRole("button", { name: "초롱이 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${contactId}\\?tab=remembered$`));
  await expect(page.getByRole("tabpanel").getByText("마라탕")).toBeVisible();
});
