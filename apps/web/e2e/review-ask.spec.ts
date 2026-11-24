import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

// 스토어 리뷰 부탁: 앱(Capacitor) 안에서만, 며칠 써 본 사람에게, 좋은 순간(답장 확인·기록 저장 뒤 홈)에 한 번.
// 진짜 기기 대신 네이티브 다리를 흉내 낸다(안드로이드 모양 + InAppReview 플러그인 헤더). 부른 플러그인 메서드는 window.__native에 쌓인다.
// 흉내는 이 파일에서 addInitScript로만 넣는다(운영 코드에 시험용 분기를 두지 않는다)

const DB_URL = /^DATABASE_URL=(.*)$/m.exec(readFileSync(resolve(process.cwd(), ".env.local"), "utf8"))?.[1]?.trim();
const REVIEW = "InAppReview.requestReview";

/** plugin=false면 리뷰 플러그인이 안 들어간 예전 앱 */
async function fakeApp(page: Page, plugin = true) {
  await page.addInitScript((withPlugin) => {
    const calls: string[] = [];
    const w = window as unknown as Record<string, unknown>;
    w.__native = calls;
    w.androidBridge = {};
    // GTM이 켜진 모양(dataLayer + google_tag_manager): 화면이 보낸 GTM 이벤트가 여기 쌓인다
    w.dataLayer = [];
    w.google_tag_manager = {};
    w.Capacitor = {
      // 진짜 앱에서는 네이티브 다리가 이 둘을 준다(앱 안인지 알아보는 데 쓴다)
      isNativePlatform: () => true,
      getPlatform: () => "android",
      PluginHeaders: withPlugin ? [{ name: "InAppReview", methods: [{ name: "requestReview", rtype: "promise" }] }] : [],
      nativePromise: (plugin: string, method: string) => {
        calls.push(`${plugin}.${method}`);
        return Promise.resolve();
      },
    };
  }, plugin);
}

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
}

/** 이 기기의 리뷰 기록(며칠 열었는지·언제 물었는지)과 '방금 저장했다' 표시를 심는다 */
async function seed(page: Page, o: { days: number; asked?: number[]; savedAgoMs?: number }) {
  await page.evaluate(({ days, asked, savedAgoMs }) => {
    const old = Array.from({ length: days }, (_, i) => `2026-10-${String(10 + i).padStart(2, "0")}`);
    localStorage.setItem("rm_review", JSON.stringify({ days: old, asked: asked ?? [] }));
    sessionStorage.removeItem("rm_saved");
    if (savedAgoMs != null) sessionStorage.setItem("rm_saved", String(Date.now() - savedAgoMs));
  }, o);
}

/** 우리 통계에 남은 '리뷰 창 띄움' 기록 수(화면에서 보낸 기록이 서버에 실제로 들어갔는지 DB에서 본다) */
async function reviewEvents(source: string): Promise<number> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const r = await db.query<{ n: string }>("select count(*) as n from app_events where name = 'review_ask' and source = $1", [source]);
    return Number(r.rows[0]?.n ?? 0);
  } finally {
    await db.end();
  }
}

const nativeCalls = (page: Page) => page.evaluate(() => (window as unknown as { __native?: string[] }).__native ?? []);
/** GTM(dataLayer)으로 간 review_ask 이벤트의 from 값들 */
const gtmReviewAsks = (page: Page) =>
  page.evaluate(() => ((window as unknown as { dataLayer?: { event?: string; from?: string }[] }).dataLayer ?? []).filter((e) => e.event === "review_ask").map((e) => e.from));
const daysCount = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("rm_review") ?? "{}").days ?? []).length as number);
const askedCount = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("rm_review") ?? "{}").asked ?? []).length as number);

// 부탁이 가는 데 걸리는 시간(홈 2.5초, 답장 4초)보다 길게 기다려도 안 가는지 본다
const QUIET_MS = 4_500;

test("앱에서 며칠 써 본 사람이 기록을 저장하고 홈에 돌아오면 리뷰 창을 한 번만 부탁한다", async ({ page }) => {
  test.skip(!DB_URL, "DATABASE_URL이 없다");
  test.setTimeout(120_000);
  await fakeApp(page);
  await demo(page);
  await seed(page, { days: 2, savedAgoMs: 1_000 });
  const before = await reviewEvents("saved");
  await page.goto("/home");
  await expect.poll(() => nativeCalls(page), { timeout: 15_000 }).toContain(REVIEW);
  await expect.poll(() => reviewEvents("saved"), { timeout: 15_000 }).toBe(before + 1);
  expect(await gtmReviewAsks(page)).toEqual(["saved"]);
  expect(await askedCount(page)).toBe(1);
  // 표시는 한 번 쓰면 지운다
  expect(await page.evaluate(() => sessionStorage.getItem("rm_saved"))).toBeNull();
  // 오늘 연 날도 적혔다(2 + 오늘)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rm_review") ?? "{}").days.length as number)).toBe(3);

  // 90일 안에는 같은 조건이어도 다시 부탁하지 않는다
  await page.evaluate(() => sessionStorage.setItem("rm_saved", String(Date.now())));
  await page.reload();
  await page.waitForTimeout(QUIET_MS);
  expect(await nativeCalls(page)).toEqual([]);
  expect(await askedCount(page)).toBe(1);
});

test("3일을 못 써 봤으면 묻지 않는다", async ({ page }) => {
  test.setTimeout(120_000);
  await fakeApp(page);
  await demo(page);
  await seed(page, { days: 1, savedAgoMs: 1_000 });
  await page.goto("/home");
  await page.waitForTimeout(QUIET_MS);
  // 앱으로 알아봤고(오늘이 적혔다) 2일뿐이라 묻지 않았다
  expect(await daysCount(page)).toBe(2);
  expect(await nativeCalls(page)).toEqual([]);
  expect(await askedCount(page)).toBe(0);
});

test("방금 저장한 게 아니면(표시가 없거나 오래됐으면) 홈에 와도 묻지 않는다", async ({ page }) => {
  test.setTimeout(120_000);
  await fakeApp(page);
  await demo(page);
  await seed(page, { days: 5 });
  await page.goto("/home");
  await page.waitForTimeout(QUIET_MS);
  expect(await daysCount(page)).toBe(6);
  expect(await nativeCalls(page)).toEqual([]);
  await seed(page, { days: 5, savedAgoMs: 5 * 60_000 });
  await page.goto("/home");
  await page.waitForTimeout(QUIET_MS);
  expect(await nativeCalls(page)).toEqual([]);
  expect(await askedCount(page)).toBe(0);
});

test("웹 브라우저에서는 아무 일도 하지 않는다", async ({ page }) => {
  test.setTimeout(120_000);
  await demo(page);
  await seed(page, { days: 5, savedAgoMs: 1_000 });
  await page.goto("/home");
  await page.waitForTimeout(QUIET_MS);
  expect(await askedCount(page)).toBe(0);
  // 앱이 아니면 표시를 쓰지도 않는다
  expect(await page.evaluate(() => sessionStorage.getItem("rm_saved"))).not.toBeNull();
});

test("물어본 답장을 확인하면 리뷰 창을 부탁한다", async ({ page }) => {
  test.skip(!DB_URL, "DATABASE_URL이 없다");
  test.setTimeout(150_000);
  await fakeApp(page);
  await demo(page);
  // 홈의 큰 카드 얼굴(이름은 글자가 아니라 읽어 주는 이름)이 그 사람 화면으로 가는 링크
  const mom = page.getByRole("link", { name: "엄마", exact: true }).first();
  const contactId = /\/people\/([0-9a-f-]{36})/.exec((await mom.getAttribute("href")) ?? "")?.[1];
  expect(contactId).toBeTruthy();
  // 그 사람에게서 아직 안 읽은 답장 알림이 온 상태로 만든다
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query(
      `insert into notifications (user_id, kind, contact_id, label) select user_id, 'answered', id, '엄마' from contacts where id = $1 on conflict do nothing`,
      [contactId],
    );
  } finally {
    await db.end();
  }
  await seed(page, { days: 4 });
  const before = await reviewEvents("answer");
  await page.goto(`/people/${contactId}`);
  await expect.poll(() => nativeCalls(page), { timeout: 20_000 }).toContain(REVIEW);
  await expect.poll(() => reviewEvents("answer"), { timeout: 15_000 }).toBe(before + 1);
  expect(await gtmReviewAsks(page)).toEqual(["answer"]);
  expect(await askedCount(page)).toBe(1);
});

test("리뷰 플러그인이 없는 예전 앱이면 조용히 넘어가고 물어봤다고 적지 않는다", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fakeApp(page, false);
  await demo(page);
  await seed(page, { days: 5, savedAgoMs: 1_000 });
  await page.goto("/home");
  await page.waitForTimeout(QUIET_MS);
  // 앱으로 알아봤고(오늘이 적혔다) 부탁은 시도했지만 플러그인이 없어 실패했다 → 아무것도 안 불렸고 적지도 않았다
  expect(await daysCount(page)).toBe(6);
  expect(await nativeCalls(page)).toEqual([]);
  expect(await askedCount(page)).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem("rm_saved"))).toBeNull();
  // 못 띄웠으니 GTM에도 안 보낸다
  expect(await gtmReviewAsks(page)).toEqual([]);
  // 화면이 멀쩡하다
  await expect(page.getByRole("link", { name: "달력 보기" })).toBeVisible();
  expect(errors.filter((m) => /InAppReview|review/i.test(m))).toEqual([]);
});
