import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { IMAGE_LONG_SIDE, IMAGE_MAX_BYTES, checkJpegBytes, holidayKey, ko, lunarToSolar, nextHoliday, nextOccurrence, todayIn, yearEnd } from "@readme/core";
import { ADMIN_KEY, CRON_SECRET, onboard, signIn } from "./helpers";

// 흐름을 실제로 눌러 본다: 가입·온보딩 → 물어보기·앱 없이 답하기(답이 내 기록에) → 받은 답 고치기 → 다시 물어보기 → 로그인하고 답하기 → 영어
test.describe.configure({ mode: "serial" });

let askDadUrl = "";
// SHOTS=폴더 를 주면 주요 화면을 찍어 둔다(디자인 점검용)
const SHOTS = process.env.SHOTS;
async function shot(page: import("@playwright/test").Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
// 사람마다 로그인은 한 번만(데모 계정은 로그인할 때마다 새로 생긴다). 이후엔 세션을 재사용한다
const sessions: Record<string, Awaited<ReturnType<BrowserContext["storageState"]>>> = {};

async function newPage(browser: Browser) {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

async function as(browser: Browser, who: string) {
  const ctx = await browser.newContext({ storageState: sessions[who] });
  return ctx.newPage();
}

async function remember(who: string, ctx: BrowserContext) {
  sessions[who] = await ctx.storageState();
}

/** 사람 화면 오른쪽 위 ··· 메뉴에서 항목을 누른다(물어보기 · 선물 고르기 · 폴더 · 지우기) */
async function personMenu(page: import("@playwright/test").Page, item: "물어보기" | "선물 고르기" | "폴더" | "지우기") {
  await page.getByRole("button", { name: "더 보기", exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

/** 물어볼 항목을 모두 끄고 고른 것만 켠다 */
async function onlyTopics(page: import("@playwright/test").Page, names: string[]) {
  const on = page.locator("form button[aria-pressed=true]");
  while (await on.count()) await on.first().click();
  for (const name of names) await page.getByRole("button", { name, exact: true }).click();
}

/** 물어보기에서 새 사람: 찾기 칸에 이름을 적고 '○○ 새로'를 고른다(사람이 없는 계정은 칸 안내 글이 달라서 id로 찾는다. 아무와도 안 맞으면 따로 고르지 않아도 새 사람이지만 칩은 그대로 눌러 볼 수 있다) */
async function askNew(page: import("@playwright/test").Page, name: string) {
  await page.locator("#request-who").fill(name);
  await page.getByRole("button", { name: `${name} 새로` }).click();
}

/** 공유창이 없는 곳처럼 만든다(이 기기에 navigator.share가 있어도 머리말 공유 아이콘이 우리 공유 팝업을 연다) */
async function noOsShare(page: import("@playwright/test").Page) {
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
}

/** 물어보기 화면 머리말의 공유 아이콘(공유하기)을 눌러 링크를 만들고, 우리 공유 팝업의 '링크 복사'로 복사된 글에서 링크를 꺼낸 뒤 팝업을 닫는다(화면은 그대로이고 링크 칸은 없다) */
async function makeLink(page: import("@playwright/test").Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await noOsShare(page);
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "링크 복사", exact: true }).click();
  await expect(sheet.getByRole("button", { name: ko["common.copied"], exact: true })).toBeVisible();
  await expect(page.getByTestId("invite-url")).toHaveCount(0);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const url = /https?:\/\/\S+\/r\/[A-Za-z0-9_-]{40,}/.exec(copied)?.[0] ?? "";
  expect(url, copied).toMatch(/\/r\/[A-Za-z0-9_-]{40,}/);
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toHaveCount(0);
  return url;
}

test("가입하고 온보딩을 마치면 홈과 내 리드미가 보인다(음력 생일)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /사랑하는 사람들의/ })).toBeVisible();
  await shot(page, "01-start");
  await signIn(page);
  await onboard(page, { name: "지수", allergy: "새우", dislike: "오이", lunar: { month: 10, day: 12 } });
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole("heading", { name: "내 사람들" })).toBeVisible();
  // 챙길 사람이 아직 없으면 사람 기념일 대신 30일 안의 명절·챙기는 날(없으면 '새 친구 추가해 봐요')을 보이고, 그 안에서 바로 사람을 더하게 이끈다.
  // 연말(크리스마스 45일 전~당일)엔 크리스마스 트리 + '연말, 크리스마스' 문구로 바뀌고 물어보고 선물 챙기기로도 이끈다
  const upcoming = page.getByRole("region", { name: "다가오는 날" });
  const today = todayIn("Asia/Seoul");
  const holiday = nextHoliday(today);
  const yearEndNow = !!yearEnd(today);
  await expect(upcoming.getByText(yearEndNow ? ko["home.yearEnd"] : holiday ? ko[holidayKey(holiday.id)] : "새 친구 추가해 봐요")).toBeVisible();
  // 연말엔 사람이 아직 없으면 '받고 싶은 선물 물어보기' 대신 '챙기고 싶은 사람 추가하기'로 이끈다(사람 추가 화면으로)
  if (yearEndNow) {
    await expect(upcoming.getByRole("link", { name: ko["home.yearEndAdd"] })).toHaveAttribute("href", "/people/new?xmas=1");
    await expect(upcoming.getByRole("link", { name: ko["home.yearEndGift"] })).toHaveCount(0);
    await expect(upcoming.getByRole("link", { name: ko["home.yearEndAsk"] })).toHaveCount(0);
    await expect(upcoming.getByRole("link", { name: "사람 추가하기", exact: true })).toHaveCount(0);
  } else {
    await expect(upcoming.getByRole("link", { name: "사람 추가하기" })).toBeVisible();
  }
  await expect(upcoming.getByText("두 달 동안은 조용해요")).toHaveCount(0);
  // 오늘의 질문은 등록한 사람에 대한 것이라, 사람이 없으면 카드 자체가 없다
  await expect(page.getByRole("region", { name: "오늘의 질문" })).toHaveCount(0);

  await shot(page, "02-home-empty");
  // 크리스마스 물어보기(?xmas=1): 선물을 먼저 묻는 칸이 켜져 있다(같이 보낼 말 칸은 없다)
  await page.goto("/request?xmas=1");
  await expect(page.getByRole("button", { name: ko["request.topic.gifts"] })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: ko["request.topic.dates"] })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("textbox", { name: "같이 보낼 말" })).toHaveCount(0);
  await shot(page, "02a-request-xmas");
  await page.goto("/home");
  // 이번 주를 누르면 월별 달력, 앞뒤 달로 넘긴다
  await page.getByRole("link", { name: "달력 보기" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  const month = await page.getByRole("heading", { level: 1 }).textContent();
  await page.getByRole("button", { name: "다음 달" }).click();
  await expect(page).toHaveURL(/\/calendar\?m=\d{4}-\d{2}$/);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(month ?? "");
  await page.getByRole("button", { name: "이번 달로" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(month ?? "");
  await expect(page).toHaveURL(/\/calendar$/);
  await shot(page, "02b-calendar");
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "지수" })).toBeVisible();
  // 나는 적어 둔 것을 미리보기로 보여 준다(알레르기·못 먹는 것)
  const mine = page.getByRole("region", { name: "나에 대한 기록" });
  await expect(mine.getByText("새우", { exact: true })).toBeVisible();
  await expect(mine.getByText("오이")).toBeVisible();
  await shot(page, "03-me");
  // 연필을 누르면 고치기: 목록엔 적은 값 대신 고를 수 있는 것만. 미리보기·보내기 버튼은 없다
  await mine.getByRole("link", { name: "수정" }).click();
  await expect(page).toHaveURL(/\/me\/edit$/);
  await expect(page.getByRole("heading", { name: "나에 대한 기록" })).toBeVisible();
  await expect(page.getByText("새우", { exact: true })).toHaveCount(0);
  await expect(page.getByText("알레르기, 못 먹는 것, 식단, 꼭 알려 둘 말")).toBeVisible();
  await expect(page.getByRole("button", { name: /^문화생활\s*영화, 드라마, TV·예능·유튜브, 음악, 노래, 책/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^반려동물\s*이름, 종류, 품종, 좋아하는 간식/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "미리보기" })).toHaveCount(0);
  await shot(page, "03b-me-edit");
  // 고친 뒤 뒤로 가면 다시 미리보기
  await page.getByRole("link", { name: "뒤로" }).click();
  await expect(page).toHaveURL(/\/me$/);
  const res = await page.request.get("/api/export");
  const data = await res.json();
  expect(data.aboutMe.safety.allergens).toContain("shrimp");
  expect(data.aboutMe.dates.birthday).toMatchObject({ calendar: "lunar", month: 10, day: 12 });
  await remember("jisu", page.context());
});

test("물어보기(새 사람) → 앱 없이 웹에서 답하기 → 답이 내 기록에 들어간다", async ({ browser }) => {
  const page = await as(browser, "jisu");
  await page.goto("/request");
  await expect(page.getByRole("heading", { name: "물어보기" })).toBeVisible();
  await askNew(page, "아빠");
  askDadUrl = await makeLink(page);
  // 링크를 만들어도 화면은 그대로다: 물어볼 항목·머리말의 공유 아이콘이 남고 '준비 완료' 화면으로 바뀌지 않는다(아래에 붙은 단추는 없고, 링크 글자·같이 보낼 말 칸도 없다)
  await expect(page).toHaveURL(/\/request$/);
  await expect(page.getByText("무엇을 물어볼까요?")).toBeVisible();
  await expect(page.getByText("준비 완료")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "물어보기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "링크 복사", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "공유하기", exact: true })).toBeVisible();
  await expect(page.getByLabel("같이 보낼 말")).toHaveCount(0);
  await shot(page, "04-ask-after-copy");

  const dad = await newPage(browser);
  await dad.goto(askDadUrl);
  await expect(dad.getByText("설치 없이 답하는 중")).toBeVisible();
  await expect(dad.getByRole("heading", { name: "지수님이 3가지가 궁금하대요" })).toBeVisible();
  await shot(dad, "05-answer");
  // 한 화면에 한 항목씩, 중요한 것부터: 생일 → 음식과 알레르기 → 좋아하는 음식(건너뛰기). 첫 화면에는 보낸 사람만 볼 수 있다는 표시가 있고 로그인 링크는 없다
  await expect(dad.getByText("1/4")).toBeVisible();
  await expect(dad.getByText("지수님만 볼 수 있어요")).toBeVisible();
  await expect(dad.getByRole("link", { name: "로그인하고 답하기" })).toHaveCount(0);
  await dad.getByRole("radio", { name: "음력" }).click();
  await dad.getByLabel("월").selectOption("11");
  await dad.getByLabel("일").selectOption("3");
  await dad.getByRole("button", { name: "다음", exact: true }).click();
  await expect(dad.getByText("2/4")).toBeVisible();
  await dad.getByRole("button", { name: "굴", exact: true }).first().click();
  await dad.getByRole("button", { name: "다음", exact: true }).click();
  await expect(dad.getByText("3/4")).toBeVisible();
  // 비워 두고 '다음'만 누르면 그 항목은 보내지 않는다
  await dad.getByRole("button", { name: "다음", exact: true }).click();
  await expect(dad.getByRole("heading", { name: "거의 다 됐어요" })).toBeVisible();
  // 보내기 전에 무엇이 가는지 요약이 보인다
  await expect(dad.getByText("지수님께 보낼 것")).toBeVisible();
  // 답이 어디에 저장되는지 알려 주고, 건강 정보는 동의가 있어야 보낸다
  await expect(dad.getByText("보낸 답은 지수님이 기억해 두고, 그 뒤로는 지수님이 언제든 바꿀 수 있어요.")).toBeVisible();
  await expect(dad.getByRole("button", { name: "보내기", exact: true })).toBeDisabled();
  await dad.getByRole("button", { name: /알레르기 같은 건강 정보도 지수님께 전해져요/ }).click();
  await dad.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(dad.getByRole("heading", { name: "마음이 전해졌어요" })).toBeVisible();
  // 나도 물어보기 = 앱 받기(/get): 아이폰은 App Store(로그인 화면으로 가지 않는다), 안드로이드·PC는 Play가 공개되기 전엔 웹으로
  const askBack = dad.getByRole("link", { name: "앱에서 나도 물어보기" });
  await expect(askBack).toHaveAttribute("href", /^\/get\?from=answer&next=%2F%3Fnext%3D%252Frequest%253Fname%253D/);
  const store = async (ua: string) => (await dad.request.get("/get?from=answer&next=%2Frequest", { headers: { "user-agent": ua }, maxRedirects: 0 })).headers().location ?? "";
  expect(await store("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36")).toMatch(/\/request$/);
  expect(await store("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36")).toMatch(/\/request$/);
  expect(await store("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")).toBe("https://apps.apple.com/kr/app/id6834970170");
  // 안드로이드에서 누르면 앱이 있으면 앱 화면(kr.readme.app://request)을 열고, 없으면 같은 /get 주소로 가는 intent 주소로 간다
  await dad.evaluate(() => Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36" }));
  const cdp = await dad.context().newCDPSession(dad);
  await cdp.send("Page.enable");
  const requested: string[] = [];
  cdp.on("Page.frameRequestedNavigation", (e) => requested.push(e.url));
  await askBack.click();
  await expect.poll(() => requested.find((u) => u.startsWith("intent://")) ?? "").toMatch(/^intent:\/\/request\?name=.+#Intent;scheme=kr\.readme\.app;package=kr\.readme\.app;S\.browser_fallback_url=https?%3A%2F%2F.+%2Fget%3Ffrom%3Danswer%26next%3D.+;end$/);
  await cdp.detach();
  await shot(dad, "06-answer-done");

  // 같은 링크로 다시 답할 수 없다
  await dad.goto(askDadUrl);
  await expect(dad.getByText("이미 답하셨어요. 지수님이 받았어요.")).toBeVisible();
  await expect(dad.getByText("설치 없이 답하는 중")).toHaveCount(0);

  // 답장이 오면 홈 오른쪽 위 종에 새 알림 개수가 붙고, 누르면 종 아래 드롭다운에 알림이 모여 있다. 알림을 누르면 그 사람 화면, 열면 읽은 것으로 종의 숫자가 사라진다
  await page.goto("/home");
  const bell = page.getByRole("button", { name: "알림 1" });
  await bell.click();
  const list = page.getByRole("region", { name: "알림" });
  await expect(list).toBeVisible();
  // 드롭다운은 종 바로 아래에 붙는다(시트처럼 화면 맨 아래가 아니다)
  const bellBox = (await bell.boundingBox())!;
  const listBox = (await list.boundingBox())!;
  expect(listBox.y).toBeGreaterThanOrEqual(bellBox.y + bellBox.height - 1);
  expect(listBox.y).toBeLessThan(bellBox.y + bellBox.height + 24);
  // Esc로 닫히고 포커스는 종으로 돌아온다
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(bell).toBeFocused();
  await bell.click();
  const reply = page.getByRole("region", { name: "알림" }).getByRole("link", { name: /아빠가 답장을 보냈어요/ });
  await expect(reply).toBeVisible();
  await expect(reply).toContainText(/방금|분 전/);
  await shot(page, "07a-home-reply");
  await reply.click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: /알레르기와 못 먹는 음식/ })).toBeVisible();
  await expect.poll(async () => (await page.request.get("/home")).text().then((h) => h.includes('aria-label="알림 1"'))).toBe(false);

  // 아빠는 지수 사람들에 들어가 있고, 답한 항목에 받은 날이 붙는다
  await page.goto("/people");
  const today = todayIn("Asia/Seoul");
  const n = nextOccurrence({ calendar: "lunar", month: 11, day: 3 }, today)!;
  const solar = lunarToSolar(n.date.y, 11, 3)!;
  await expect(page.getByText(`${solar.m}.${solar.d}`).first()).toBeVisible();
  await page.getByRole("link", { name: /아빠/ }).click();
  // 굴은 '못 먹는 것'으로 답했다
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /알레르기와 못 먹는 음식/ }) }).getByText(/굴/)).toBeVisible();
  await shot(page, "07-person-answered");
  await page.goto("/home");
  // 다 읽었으니 종에는 숫자가 없고, 열어도 새 알림이 없다
  await expect(page.getByRole("button", { name: "알림", exact: true })).toBeVisible();
  // 홈은 챙길 날 위주(사람 줄은 없다): 이번 주 띠의 달력 링크가 보인다
  await expect(page.getByRole("link", { name: "달력 보기" })).toBeVisible();
  await shot(page, "08-home");
});

test("물어보기: 공유창이 막히면 화면은 그대로 두고 우리 공유 팝업이 뜨며, 팝업에서 바로 보낸다(링크는 한 번만 만든다)", async ({ browser }) => {
  const page = await as(browser, "jisu");
  // 누른 지 오래돼 브라우저가 공유창을 막은 것처럼: 첫 번째 공유는 NotAllowedError, 그다음은 열린다
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: { text?: string; url?: string }[] };
    w.__shared = [];
    let n = 0;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: { text?: string; url?: string }) => {
        if (n++ === 0) throw new DOMException("expired", "NotAllowedError");
        w.__shared.push(d);
      },
    });
  });
  const created: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) created.push(r.url());
  });
  await page.goto("/request");
  await askNew(page, "큰이모");
  created.length = 0;
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  // 화면은 그대로, 아래에서 공유 팝업이 올라온다(링크 글자는 없다)
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: /큰이모.*에게 물어보기/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "링크 복사", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/request$/);
  await expect(page.getByText("무엇을 물어볼까요?")).toBeVisible();
  await expect(page.getByTestId("invite-url")).toHaveCount(0);
  await shot(page, "04b-ask-share-sheet");
  // 팝업의 공유하기는 누르는 그 자리에서 열리니 새 링크 없이 공유창이 열리고, 팝업은 닫히고 '물어봤어요'만 알린다
  await sheet.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(1);
  const shared = await page.evaluate(() => (window as unknown as { __shared: { url?: string }[] }).__shared[0]!);
  expect(shared.url).toMatch(/\/r\/[A-Za-z0-9_-]{40,}/);
  await expect(page.getByRole("status").filter({ hasText: ko["request.asked"] })).toBeVisible();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText("무엇을 물어볼까요?")).toBeVisible();
  expect(created).toHaveLength(1);
  // 머리말 공유 아이콘을 다시 누르면 같은 링크를 다시 공유한다
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(2);
  expect(await page.evaluate(() => (window as unknown as { __shared: { url?: string }[] }).__shared[1]!.url)).toBe(shared.url);
  expect(created).toHaveLength(1);
  // 같은 링크를 복사로도 쓴다(다시 만들지 않는다): 공유창이 없는 곳처럼 바꾸면 머리말 아이콘이 우리 팝업을 열고 거기 '링크 복사'가 같은 링크를 복사한다
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await noOsShare(page);
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  await sheet.getByRole("button", { name: "링크 복사", exact: true }).click();
  await expect(sheet.getByRole("button", { name: ko["common.copied"], exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(shared.url!);
  expect(created).toHaveLength(1);
  await shot(page, "04c-ask-copied-toast");
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toHaveCount(0);
  // 물어볼 항목을 바꾸면 다음엔 새 링크를 만든다(앞 링크는 그대로 열린다)
  await page.getByRole("button", { name: "사이즈", exact: true }).click();
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect.poll(() => created.length).toBe(2);
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(page).toHaveURL(/\/request$/);
});

test("물어보기: 공유창이 없는 곳(PC)이면 머리말 공유 아이콘이 우리 공유 팝업을 연다 — 링크 복사 · 문자로 보내기, 링크 글자는 없다", async ({ browser }) => {
  const page = await as(browser, "jisu");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/request");
  await askNew(page, "고모부");
  // 머리말의 공유 아이콘: 눌러 링크를 만들고(공유창이 없으니) 우리 팝업을 연다
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: /고모부.*에게 물어보기/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "공유하기", exact: true })).toHaveCount(0);
  await expect(sheet.getByText(/\/r\//)).toHaveCount(0);
  // 문자로 보내기는 휴대폰에서만(이 테스트 기기는 휴대폰): 글과 링크가 문자 본문으로 간다
  expect(await sheet.getByRole("link", { name: "문자로 보내기" }).getAttribute("href")).toMatch(/^sms:\?&body=.+%2Fr%2F/);
  await sheet.getByRole("button", { name: "링크 복사", exact: true }).click();
  await expect(sheet.getByRole("button", { name: ko["common.copied"], exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/r\/[A-Za-z0-9_-]{40,}/);
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/request$/);
  await expect(page.getByText("무엇을 물어볼까요?")).toBeVisible();
});

test("물어보기: 아직 보낼 수 없으면 머리말 공유 아이콘이 까닭을 알리고(사람이 없으면 '누구에게' 칸으로) 링크는 만들지 않는다", async ({ browser }) => {
  const page = await as(browser, "jisu");
  const created: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) created.push(r.url());
  });
  await page.goto("/request");
  await expect(page.getByRole("button", { name: "물어보기", exact: true })).toHaveCount(0);
  // 아무도 안 골랐다: 눌러 보면 까닭이 아래에 잠깐 뜨고 '누구에게' 칸에 커서가 간다
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: ko["request.needName"] })).toBeVisible();
  await expect(page.locator("#request-who")).toBeFocused();
  await shot(page, "04d-ask-reason-toast");
  // 사람은 골랐지만 물어볼 것이 하나도 없다
  await askNew(page, "이모부");
  await onlyTopics(page, []);
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: ko["request.pickOne"] })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(created).toHaveLength(0);
});

test("하나만 물으면 답하는 화면도 하나: 진행 막대 없이 바로 보내기", async ({ browser }) => {
  const page = await as(browser, "jisu");
  await page.goto("/request");
  await askNew(page, "이모");
  await onlyTopics(page, ["생활·여행"]);
  const url = await makeLink(page);

  const aunt = await newPage(browser);
  await aunt.goto(url);
  await expect(aunt.getByRole("heading", { name: "지수님이 1가지가 궁금하대요" })).toBeVisible();
  await expect(aunt.getByText("1/2")).toHaveCount(0);
  await expect(aunt.getByRole("button", { name: "다음", exact: true })).toHaveCount(0);
  await aunt.getByRole("button", { name: "가을", exact: true }).click();
  await aunt.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(aunt.getByRole("heading", { name: "마음이 전해졌어요" })).toBeVisible();
});

test("답하기: 아무것도 적지 않고 '다음'만 눌러 가면 보낼 수 없고(빈 답이 저장·알림되지 않는다), 받고 싶은 선물을 적으면 그 사람 기록에 들어간다", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "하나" });
  await page.goto("/request");
  await askNew(page, "삼촌");
  await onlyTopics(page, ["좋아하는 음식", "선물"]);
  const url = await makeLink(page);

  const uncle = await newPage(browser);
  await uncle.goto(url);
  await expect(uncle.getByText("1/3")).toBeVisible();
  // 아무것도 적지 않고 '다음'만 눌러 끝까지 가면: 적은 게 없어서 보낼 수 없다
  await uncle.getByRole("button", { name: "다음", exact: true }).click();
  await expect(uncle.getByText("2/3")).toBeVisible();
  await uncle.getByRole("button", { name: "다음", exact: true }).click();
  await expect(uncle.getByRole("heading", { name: ko["answer.almost"] })).toBeVisible();
  await expect(uncle.getByText(ko["answer.needOne"])).toBeVisible();
  await expect(uncle.getByRole("button", { name: ko["answer.send"], exact: true })).toBeDisabled();
  // 선물 화면으로 돌아가 받고 싶은 것을 적으면 보낼 수 있다
  await uncle.getByRole("button", { name: ko["answer.prev"] }).click();
  await uncle.getByPlaceholder(ko["gift.wishPlaceholder"]).fill("따뜻한 목도리, 향초");
  await uncle.getByRole("button", { name: "다음", exact: true }).click();
  await expect(uncle.getByText(ko["answer.needOne"])).toHaveCount(0);
  await uncle.getByRole("button", { name: ko["answer.send"], exact: true }).click();
  await expect(uncle.getByRole("heading", { name: ko["answer.sent.title"] })).toBeVisible();

  // 받은 쪽: 알림이 오고, 적은 선물만 사람 화면에 있다(건드리지 않은 '좋아하는 음식'은 비어 있지 않은 척하지 않는다)
  await page.goto("/home");
  await page.getByRole("button", { name: "알림 1" }).click();
  await page.getByRole("region", { name: "알림" }).getByRole("link", { name: /삼촌이 답장을 보냈어요/ }).click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  // 사람 화면은 항목마다 적어 둔 값이 그대로 보인다('따뜻한 목도리', '향초')
  await expect(page.getByText(/따뜻한 목도리/)).toBeVisible();
  await expect(page.getByText(/향초/)).toBeVisible();
  await expect(page.getByRole("link", { name: /좋아하는 음식/ })).toHaveCount(0);

  // 항목을 건드리지 않았어도 '없어요'를 눌렀으면 그건 답이다(하나만 물은 링크)
  await page.goto("/request");
  await askNew(page, "고모");
  await onlyTopics(page, ["선물"]);
  const url2 = await makeLink(page);
  const aunt = await newPage(browser);
  await aunt.goto(url2);
  await expect(aunt.getByRole("button", { name: ko["answer.send"], exact: true })).toBeDisabled();
  await aunt.getByRole("button", { name: ko["answer.none"], exact: true }).click();
  await aunt.getByRole("button", { name: ko["answer.send"], exact: true }).click();
  await expect(aunt.getByRole("heading", { name: ko["answer.sent.title"] })).toBeVisible();
});

test("받은 답도 내가 고친다", async ({ browser }) => {
  const page = await as(browser, "jisu");
  await page.goto("/people");
  await page.getByRole("link", { name: /아빠/ }).click();
  await page.waitForURL(/\/people\/[0-9a-f-]{36}$/);
  const personUrl = new URL(page.url()).pathname;
  // 사람 화면은 적어 둔 것만 미리 보기. 항목을 누르면 수정 화면에서 그 항목이 펼쳐진 채로 열리고, 고르면 바로 저장된다
  await expect(page.getByRole("button", { name: /^사이즈/ })).toHaveCount(0);
  // 그 사람이 직접 답한 항목이어도 '○○가 알려 줌' 같은 표시는 없다
  await expect(page.getByText(/알려 줌/)).toHaveCount(0);
  await page.getByRole("link", { name: /알레르기와 못 먹는 음식/ }).click();
  await expect(page).toHaveURL(/\/edit\?open=safety$/);
  const safety = page.getByRole("button", { name: /^알레르기와 못 먹는 음식/ });
  await expect(safety).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "저장" })).toHaveCount(0);
  await page.getByRole("button", { name: "땅콩", exact: true }).first().click();
  await expect(page.getByText("저장했어요.", { exact: true })).toBeVisible();
  // 수정 화면에는 비어 있는 항목도 다 있다
  await expect(page.getByRole("button", { name: /^사이즈/ })).toBeVisible();
  await page.goto(personUrl);
  // 사람 화면은 항목마다 적어 둔 값이 그대로(알레르기는 붉은 알약)
  await expect(page.getByText(/땅콩/)).toBeVisible();
  await expect(page.getByText(/굴/)).toBeVisible();
  await personMenu(page, "선물 고르기");
  await shot(page, "09-reminder");
});

test("아는 사람에게 다시 물어보기: 내 기록 값이 미리 채워져 가고, 기다리는 동안 표시되며, 취소한 링크는 안 열린다", async ({ browser }) => {
  const page = await as(browser, "jisu");
  await page.goto("/people");
  await page.getByRole("link", { name: /아빠/ }).click();
  await page.waitForURL(/\/people\/[0-9a-f-]{36}$/);
  const personUrl = new URL(page.url()).pathname;
  await personMenu(page, "물어보기");
  await expect(page.getByRole("heading", { name: "아빠에게 물어보기" })).toBeVisible();
  await expect(page.getByText("누구에게 물어볼까요?")).toHaveCount(0);
  // 아직 안 적힌 항목이 먼저 골라져 있다(생일·알레르기는 적혀 있다)
  await expect(page.getByRole("button", { name: "사이즈", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "생일·기념일", exact: true })).toHaveAttribute("aria-pressed", "false");

  // 물어보기 첫 화면에서 찾아 골라도 같다: 아빠를 고르면 새로가 아니라 그 사람(아직 안 적힌 항목이 먼저), 다시 고르기로 되돌린다
  await page.goto("/request");
  await page.getByPlaceholder("이름이나 태그로 찾기").fill("아");
  await expect(page.getByRole("button", { name: "아 새로" })).toBeVisible();
  await page.getByPlaceholder("이름이나 태그로 찾기").fill("아빠");
  await expect(page.getByRole("button", { name: "아빠 새로" })).toHaveCount(0);
  await page.getByRole("button", { name: /아빠/ }).first().click();
  await expect(page.locator('input[name="to"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "사이즈", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "생일·기념일", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("같이 보낼 말")).toHaveCount(0);
  await page.getByRole("button", { name: "다시 고르기" }).click();
  await expect(page.getByPlaceholder("이름이나 태그로 찾기")).toBeVisible();
  // 다시 찾아 아빠를 골라 보낸다: 답은 아빠 기록에 들어간다(아래에서 확인)
  await page.getByPlaceholder("이름이나 태그로 찾기").fill("아빠");
  await page.getByRole("button", { name: /아빠/ }).first().click();
  await onlyTopics(page, ["생일·기념일"]);
  const url = await makeLink(page);

  await page.goto(personUrl);
  await expect(page.getByText("답장을 기다리고 있어요")).toBeVisible();
  await page.goto("/people");
  await expect(page.getByRole("link", { name: /아빠.*답장을 기다리고 있어요/ })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByText("아빠에게 물어본 것")).toBeVisible();

  const dad = await newPage(browser);
  await dad.goto(url);
  // 맞아요/달라요 없이 처음부터 질문지가 펼쳐지고, 보낸 사람이 아는 값이 채워져 있다
  await expect(dad.getByText("지수님이 알고 있는 걸 채워 뒀어요. 다르면 고쳐 주세요")).toBeVisible();
  await expect(dad.getByRole("button", { name: "맞아요" })).toHaveCount(0);
  // 하나만 물었으니 마지막 화면 없이 같은 화면에서 바로 보낸다
  await expect(dad.getByRole("heading", { name: "거의 다 됐어요" })).toHaveCount(0);
  await dad.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(dad.getByRole("heading", { name: "마음이 전해졌어요" })).toBeVisible();
  await page.goto(personUrl);
  await expect(page.getByText("답장을 기다리고 있어요")).toHaveCount(0);

  // 또 물어보고 사람 화면에서 취소하면, 링크가 더는 열리지 않는다
  await personMenu(page, "물어보기");
  await onlyTopics(page, ["선물"]);
  const canceled = await makeLink(page);
  await page.goto(personUrl);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${personUrl}$`));
  await expect(page.getByText("답장을 기다리고 있어요")).toHaveCount(0);
  await dad.goto(canceled);
  // 보낸 사람 이름이 들어간다(accept.canceledFrom)
  await expect(dad.getByText(/^.+님이 취소한 링크예요\.$/)).toBeVisible();
});

test("로그인하고 답하기: 내 리드미 값이 미리 채워지고, 내 리드미에도 저장되며, 물어본 사람 목록에 내 이름으로 보인다", async ({ browser }) => {
  const doyun = await newPage(browser);
  await doyun.goto("/");
  await signIn(doyun);
  await onboard(doyun, { name: "도윤", allergy: "땅콩", solar: { month: 2, day: 14 } });
  await expect(doyun).toHaveURL(/\/home/);
  await remember("doyun", doyun.context());

  const jisu = await as(browser, "jisu");
  await jisu.goto("/request");
  await askNew(jisu, "도윤이");
  await onlyTopics(jisu, ["생일·기념일", "사이즈"]);
  const url = await makeLink(jisu);

  await doyun.goto(url);
  await expect(doyun.getByRole("link", { name: "로그인하고 답하기" })).toHaveCount(0);
  // 생일(중요한 것부터): 내 리드미 값(양력 2월 14일)이 미리 들어 있다
  await expect(doyun.getByLabel("월").first()).toHaveValue("2");
  await expect(doyun.getByLabel("일").first()).toHaveValue("14");
  await doyun.getByRole("button", { name: "다음", exact: true }).click();
  // 사이즈: 지수도 모르고 내 리드미에도 없어서 직접 적는다
  await doyun.getByPlaceholder("예: 235").fill("235");
  await doyun.getByPlaceholder("예: 11").fill("11");
  await doyun.getByRole("button", { name: "다음", exact: true }).click();
  await expect(doyun.getByRole("button", { name: "나에 대한 기록에도 저장" })).toHaveAttribute("aria-pressed", "true");
  await doyun.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(doyun.getByRole("heading", { name: "마음이 전해졌어요" })).toBeVisible();
  await expect(doyun.getByRole("link", { name: "나도 물어보기" })).toHaveAttribute("href", /^\/get\?from=answer&next=%2Frequest%3Fname%3D/);
  await doyun.getByRole("link", { name: "기억해유 열기" }).click();
  await expect(doyun).toHaveURL(/\/me$/);
  const mine = await (await doyun.request.get("/api/export")).json();
  expect(mine.aboutMe.sizes.shoe).toBe(235);

  // 지수 쪽: 도윤의 앱 이름이 보이고, 내가 붙인 '도윤이'는 태그로
  await jisu.goto("/people");
  await jisu.getByRole("link", { name: /도윤/ }).first().click();
  await expect(jisu.getByRole("heading", { name: "도윤" })).toBeVisible();
  await expect(jisu.getByRole("button", { name: "태그 도윤이 수정" })).toBeVisible();
  await expect(jisu.getByText("235").first()).toBeVisible();
  // 태그는 이름 밑에서 바로 고친다
  await jisu.getByRole("button", { name: "태그 도윤이 수정" }).click();
  await jisu.getByRole("textbox", { name: "태그" }).fill("단짝");
  await jisu.getByRole("button", { name: "저장", exact: true }).click();
  await expect(jisu.getByRole("button", { name: "태그 단짝 수정" })).toBeVisible();
  await jisu.reload();
  await expect(jisu.getByRole("button", { name: "태그 단짝 수정" })).toBeVisible();
  await shot(jisu, "10-person-linked");

  // 도윤은 지수의 기록을 볼 수 없다(주소를 알아도)
  const personUrl = new URL(jisu.url()).pathname;
  await doyun.goto(personUrl);
  await expect(doyun.getByText("235")).toHaveCount(0);
});

test("영어로 보면 사이즈가 미국 사이즈로도 보인다", async ({ browser }) => {
  const jisu = await as(browser, "jisu");
  await jisu.goto("/privacy");
  await jisu.getByRole("button", { name: "English" }).click();
  await jisu.goto("/people");
  await jisu.getByRole("link", { name: /도윤/ }).first().click();
  // 사람 화면의 사이즈 항목 제목 줄을 누르면 고치는 화면에서 그 항목이 펼쳐지고, 미국 사이즈 환산은 거기서 본다
  await jisu.getByRole("link", { name: /^Sizes/ }).click();
  await expect(jisu.getByText("About US women's 6.5")).toBeVisible();
  await expect(jisu.getByText("About US 6")).toBeVisible();
  await shot(jisu, "11-person-en");
  await jisu.goto("/privacy");
  await jisu.getByRole("button", { name: "한국어" }).click();
  await expect(jisu.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
});

test("나만 보는 메모: 사람 화면에 남는다", async ({ browser }) => {
  const jisu = await as(browser, "jisu");
  await jisu.goto("/people");
  await jisu.getByRole("link", { name: /도윤/ }).first().click();
  // 프로필 카드의 메모 줄: 메모가 없으면 '+ 메모' 알약, 누르면 시트에서 보고 적는다(적어도 시트는 열린 채로).
  // 적으면 그 줄에 가장 최근 메모가 보이고 '+more'(메모 더 보기) 알약이 생긴다
  await jisu.getByRole("button", { name: "+ 메모", exact: true }).click();
  const sheet = jisu.getByRole("dialog", { name: "나만 보는 메모" });
  await sheet.getByLabel("메모", { exact: true }).fill("목도리 줬음. 잘 하고 다님");
  await sheet.getByRole("button", { name: "메모 추가" }).click();
  await expect(sheet.getByText("목도리 줬음. 잘 하고 다님")).toBeVisible();
  await expect(jisu.getByRole("button", { name: "메모 더 보기", exact: true })).toBeVisible();
});

test("생년월일: 태어난 해를 고르면 나이와 띠가 보인다", async ({ browser }) => {
  const jisu = await as(browser, "jisu");
  await jisu.goto("/me/edit/dates");
  await jisu.getByLabel("태어난 해").first().selectOption("1993");
  await expect(jisu.getByText(/이번 생일에 만 \d+세가 돼요 · 닭띠/)).toBeVisible();
  await jisu.getByRole("button", { name: "저장" }).click();
  await expect(jisu.getByText("저장했어요.", { exact: true })).toBeVisible();
  const data = await (await jisu.request.get("/api/export")).json();
  expect(data.aboutMe.dates.birthday.year).toBe(1993);
});

test("좋아하는 것들: 무늬·최애를 적으면 내 리드미에 저장된다", async ({ browser }) => {
  const jisu = await as(browser, "jisu");
  await jisu.goto("/me/edit/favorites");
  await jisu.getByRole("button", { name: "스트라이프" }).click();
  await jisu.getByLabel("최애 연예인·가수").fill("아이유");
  await jisu.getByRole("button", { name: "저장" }).click();
  await expect(jisu.getByText("저장했어요.", { exact: true })).toBeVisible();
  const data = await (await jisu.request.get("/api/export")).json();
  expect(data.aboutMe.favorites.idol).toBe("아이유");
  expect(data.aboutMe.favorites.patterns).toContain("stripe");
});

test("설정: 알림 받기를 끄면 언제 알릴지가 숨고, 다시 켜면 보인다", async ({ browser }) => {
  const doyun = await as(browser, "doyun");
  const push = doyun.getByRole("button", { name: "알림 받기" });
  await doyun.goto("/privacy");
  await expect(push).toHaveAttribute("aria-pressed", "true");
  await push.click();
  await expect(push).toHaveAttribute("aria-pressed", "false");
  await expect(doyun.locator("#reminders")).toHaveCount(0);
  await push.click();
  await expect(push).toHaveAttribute("aria-pressed", "true");
  await expect(doyun.locator("#reminders")).toBeVisible();
});

test("설정: 앱 공유하기는 다운로드 QR과 보내기·링크 복사를 보여 주고, 링크는 기기에 맞는 스토어로 간다", async ({ browser }) => {
  const doyun = await as(browser, "doyun");
  await doyun.goto("/privacy");
  await doyun.getByRole("button", { name: "앱 공유하기" }).click();
  const sheet = doyun.getByRole("dialog", { name: "앱 공유하기" });
  await expect(sheet.getByRole("img", { name: "앱 다운로드 QR 코드" })).toBeVisible();
  // QR 칸이 실제로 그려졌다(켜진 칸이 있는 경로)
  expect(await sheet.getByRole("img", { name: "앱 다운로드 QR 코드" }).locator("path").evaluate((p) => (p.getAttribute("d") ?? "").length)).toBeGreaterThan(500);
  // 링크 글자는 보이지 않고 보내기·링크 복사 단추만 있다
  await expect(sheet.getByRole("textbox")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "보내기" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "링크 복사" })).toBeVisible();
  await shot(doyun, "20-share-app");
  // 이 링크: 아이폰은 App Store, 안드로이드·PC는 Play가 공개되기 전엔 웹 첫 화면(막다른 길이 되지 않게)
  const store = async (ua: string) => (await doyun.request.get("/get?from=share", { headers: { "user-agent": ua }, maxRedirects: 0 })).headers().location ?? "";
  expect(await store("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")).toBe("https://apps.apple.com/kr/app/id6834970170");
  expect(await store("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36")).toMatch(/^(https?:\/\/[^/]+)?\/$/);
  // 링크 미리보기를 가져가는 로봇(카카오톡 등)에게는 스토어로 보내지 않고 제목·설명·이미지가 있는 페이지를 준다
  const scrape = await doyun.request.get("/get?from=share", { headers: { "user-agent": "facebookexternalhit/1.1;kakaotalk-scrap/1.0" }, maxRedirects: 0 });
  expect(scrape.status()).toBe(200);
  const preview = await scrape.text();
  expect(preview).toMatch(/<meta property="og:title" content="기억해유">/);
  expect(preview).toMatch(/<meta property="og:image" content="[^"]+\/og-v2\.png">/);
  expect(preview).toMatch(/<meta property="og:url" content="[^"]+\/get\?from=share">/);
  // 닫으면 설정 화면으로 돌아온다
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toHaveCount(0);
});

test("계정 삭제: 내 리드미는 지워지고, 나에게 물어본 사람의 기록은 그 사람 것이라 남는다", async ({ browser }) => {
  const doyun = await as(browser, "doyun");
  const res = await doyun.request.get("/api/export");
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.aboutMe.dates.birthday).toMatchObject({ calendar: "solar", month: 2, day: 14 });
  // 프로필 고치기에는 얼굴·이름만(로그아웃·계정 삭제 없음), 계정 삭제는 설정 맨 아래
  await doyun.goto("/me/avatar");
  await expect(doyun.getByRole("button", { name: "로그아웃" })).toHaveCount(0);
  await expect(doyun.getByRole("button", { name: "계정 삭제" })).toHaveCount(0);
  await doyun.goto("/privacy");
  await doyun.getByRole("button", { name: "계정 삭제" }).click();
  await doyun.getByRole("button", { name: "모두 지우기" }).click();
  await expect(doyun.getByRole("heading", { name: /사랑하는 사람들의/ })).toBeVisible();

  const jisu = await as(browser, "jisu");
  await jisu.goto("/people");
  // 앱 이름은 사라지고 내가 붙인 태그가 이름이 되며, 받은 답(사이즈)은 그대로
  await jisu.getByRole("link", { name: /단짝/ }).first().click();
  await expect(jisu.getByRole("heading", { name: "단짝" })).toBeVisible();
  await expect(jisu.getByText("235").first()).toBeVisible();
});

test("생일 알림 크론: 비밀값이 맞을 때만 돈다", async ({ request }) => {
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  const ok = await request.get("/api/cron/reminders", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.users).toBeGreaterThan(0);
});

test("언어는 설정에서 바꾸고, 내 리드미에는 내 정보만", async ({ browser }) => {
  const jisu = await as(browser, "jisu");
  await jisu.goto("/me");
  await expect(jisu.getByText("언어", { exact: true })).toHaveCount(0);
  // 프로필에는 얼굴과 이름만
  await jisu.getByRole("link", { name: "프로필 수정" }).click();
  await expect(jisu.getByRole("heading", { name: "내 프로필" })).toBeVisible();
  await expect(jisu.getByText("언어", { exact: true })).toHaveCount(0);
  // 언어는 설정 탭에서
  await jisu.goto("/me");
  await jisu.getByRole("link", { name: "설정" }).click();
  await expect(jisu.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
  await jisu.getByRole("button", { name: "English" }).click();
  await expect(jisu).toHaveURL(/\/privacy$/);
  await expect(jisu.getByText("Language", { exact: true })).toBeVisible();
  await expect(jisu.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  await jisu.getByRole("button", { name: "한국어" }).click();
  await expect(jisu.getByText("언어", { exact: true })).toBeVisible();
  await expect(jisu.getByRole("button", { name: "한국어" })).toHaveAttribute("aria-pressed", "true");
  await shot(jisu, "13-settings-language");
});

test("내 리드미: 고치기를 누르면 화면을 옮기지 않고 그 항목 아래에서 고치고, 고치면 바로 저장된다", async ({ browser }) => {
  const jisu = await as(browser, "jisu");
  // 예전 주소(/me?open=…)는 고치는 화면으로 옮겨 준다
  await jisu.goto("/me?open=taste");
  await expect(jisu).toHaveURL(/\/me\/edit\?open=taste$/);
  await jisu.goto("/me/edit");
  const sizes = jisu.getByRole("button", { name: /^사이즈/ });
  await expect(sizes).toHaveAttribute("aria-expanded", "false");
  await sizes.click();
  await expect(sizes).toHaveAttribute("aria-expanded", "true");
  // 펼친 항목은 주소에 적혀 새로고침해도 펼친 채로
  await expect(jisu).toHaveURL(/\/me\/edit\?open=sizes$/);
  await expect(jisu.getByRole("button", { name: "저장" })).toHaveCount(0);
  // 적는 칸은 칸을 벗어날 때 저장된다
  await jisu.getByPlaceholder("예: 235").fill("240");
  await expect(jisu.getByText("고르면 바로, 적은 건 칸을 벗어나면 저장돼요")).toHaveCount(0);
  await jisu.getByPlaceholder("예: 235").blur();
  await expect(jisu.getByText("저장했어요.", { exact: true })).toBeVisible();
  await jisu.reload();
  await expect(sizes).toHaveAttribute("aria-expanded", "true");
  await expect(jisu.getByPlaceholder("예: 235")).toHaveValue("240");
  await shot(jisu, "16-me-inline");
  // 접어도 목록에는 적은 값이 아니라 고를 수 있는 것(주제)만 보인다
  await sizes.click();
  await expect(sizes).toHaveAttribute("aria-expanded", "false");
  await expect(sizes).toContainText("상의, 하의, 신발, 반지");
  await expect(sizes).not.toContainText("240");
  // 고르는 것은 누르면 바로 저장된다(계절은 생활과 여행 항목)
  const favs = jisu.getByRole("button", { name: /^생활과 여행/ });
  await favs.click();
  const autumn = jisu.getByRole("button", { name: "가을", exact: true });
  await expect(autumn).toHaveAttribute("aria-pressed", "false");
  await autumn.click();
  await expect(autumn).toHaveAttribute("aria-pressed", "true");
  await expect(jisu.getByText("저장했어요.", { exact: true })).toBeVisible();
  await favs.click();
  await expect(favs).not.toContainText("가을");
  // 다시 펼쳐도(새로고침 없이) 고친 값 그대로
  await favs.click();
  await expect(jisu.getByRole("button", { name: "가을", exact: true })).toHaveAttribute("aria-pressed", "true");
  await jisu.reload();
  await expect(jisu.getByRole("button", { name: "가을", exact: true })).toHaveAttribute("aria-pressed", "true");
  // 뒤로 가면 미리보기에 고친 것이 보인다
  await jisu.getByRole("link", { name: "뒤로" }).click();
  await expect(jisu).toHaveURL(/\/me$/);
  const mine = jisu.getByRole("region", { name: "나에 대한 기록" });
  await expect(mine).toContainText("240");
  await expect(mine).toContainText("가을");
  // 미리보기 항목을 누르면 그 항목을 펼친 고치기 화면으로
  await mine.getByRole("link", { name: /^사이즈/ }).click();
  await expect(jisu).toHaveURL(/\/me\/edit\?open=sizes$/);
  await expect(jisu.getByRole("button", { name: /^사이즈/ })).toHaveAttribute("aria-expanded", "true");
});

test("사람들: 폴더(기본 3개 + 직접 만들기, 한 사람이 여러 폴더), 폴더 없는 사람만 목록에, 끌어서 폴더에 넣기, 찾기, 즐겨찾기", async ({ browser }) => {
  const jisu = await as(browser, "jisu");
  // 기본 폴더 셋(가족·친구들·회사, 이 순서)이 사람들 위에 보이고 연인 폴더는 없다. 새 폴더 단추는 글자 없이 아이콘만(폴더 옆)
  await jisu.goto("/people");
  for (const builtin of ["가족", "친구들", "회사"]) await expect(jisu.getByRole("link", { name: new RegExp(`^${builtin} `) })).toHaveCount(1);
  await expect(jisu.getByRole("link", { name: /^연인 / })).toHaveCount(0);
  expect(await jisu.getByRole("link", { name: /^(가족|친구들|회사) / }).allTextContents().then((l) => l.map((x) => x.replace(/\d+명$/, "").trim()))).toEqual(["가족", "친구들", "회사"]);
  await expect(jisu.getByRole("button", { name: "새 폴더", exact: true })).toBeVisible();
  await expect(jisu.getByRole("button", { name: "새 폴더", exact: true })).toHaveText("");

  // 단짝(탈퇴한 도윤, 태그가 이름이 됨): 사람 화면 폴더 시트에서 친구들에 넣고 즐겨찾기
  await jisu.getByRole("link", { name: /단짝/ }).first().click();
  await personMenu(jisu, "폴더");
  const sheet = jisu.getByRole("dialog");
  await sheet.getByRole("button", { name: /친구들/ }).click();
  await sheet.getByRole("button", { name: "완료" }).click();
  await expect(sheet).toHaveCount(0);
  // 프로필 카드에는 폴더 칩이 없다: ··· 메뉴의 폴더 시트를 다시 열면 친구들이 체크돼 있다
  await expect(jisu.getByRole("link", { name: "친구들", exact: true })).toHaveCount(0);
  await personMenu(jisu, "폴더");
  await expect(sheet.getByRole("button", { name: /친구들/ })).toHaveAttribute("aria-pressed", "true");
  await jisu.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  const star = jisu.getByRole("button", { name: "즐겨찾기" });
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");

  // 아빠: 시트에서 새 폴더 '본가'를 만들어 바로 넣고, 가족에도 넣는다(여러 폴더)
  await jisu.goto("/people");
  await jisu.getByRole("link", { name: /아빠/ }).first().click();
  await personMenu(jisu, "폴더");
  await sheet.getByRole("button", { name: "새 폴더" }).click();
  await sheet.getByRole("textbox", { name: "폴더 이름" }).fill("본가");
  await sheet.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(sheet.getByRole("button", { name: /본가/ })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: /가족/ }).click();
  await sheet.getByRole("button", { name: "완료" }).click();
  await expect(sheet).toHaveCount(0);
  await personMenu(jisu, "폴더");
  await expect(sheet.getByRole("button", { name: /가족/ })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: /본가/ })).toHaveAttribute("aria-pressed", "true");
  await jisu.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // 목록에는 아직 폴더에 없는 사람만(폴더에 넣은 단짝·아빠는 빠진다)
  await jisu.goto("/people");
  await expect(jisu.getByRole("link", { name: /^본가 / })).toContainText("1명");
  const unfiled = jisu.getByRole("region", { name: "폴더 없음" }).locator('li a[href^="/people/"]');
  await expect(unfiled.filter({ hasText: "아빠" })).toHaveCount(0);
  await expect(unfiled.filter({ hasText: "단짝" })).toHaveCount(0);

  // 즐겨찾기한 사람은 어느 폴더에 있든 폴더 위에 모여 보이고(단짝은 친구들 폴더에 있다), 제목을 누르면 접히고 다시 누르면 펴진다
  const fav = jisu.getByRole("region", { name: "즐겨찾기" });
  const favToggle = fav.getByRole("button", { name: /^즐겨찾기/ });
  await expect(fav.getByRole("link", { name: /단짝/ })).toBeVisible();
  await expect(fav.getByRole("link", { name: /아빠/ })).toHaveCount(0);
  await expect(favToggle).toHaveAttribute("aria-expanded", "true");
  await favToggle.click();
  await expect(favToggle).toHaveAttribute("aria-expanded", "false");
  await expect(fav.getByRole("link", { name: /단짝/ })).toHaveCount(0);
  await favToggle.click();
  await expect(fav.getByRole("link", { name: /단짝/ })).toBeVisible();

  // 끌어서 폴더에: 폴더 없는 첫 사람을 회사 칸에 놓으면 회사에 들어가고 목록에서 빠진다(새로 고쳐도 그대로).
  // 놓기만 보려고 화면을 길게(사람과 폴더가 한 화면에)
  await jisu.setViewportSize({ width: 390, height: 1400 });
  const first = unfiled.first();
  const href = await first.getAttribute("href");
  const work = jisu.getByRole("link", { name: /^회사 / });
  const from = await first.boundingBox();
  const to = await work.boundingBox();
  await jisu.mouse.move(from!.x + 60, from!.y + from!.height / 2);
  await jisu.mouse.down();
  await jisu.mouse.move(from!.x + 70, from!.y + from!.height / 2 - 10, { steps: 3 });
  await jisu.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
  await jisu.mouse.up();
  await expect(jisu).toHaveURL(/\/people$/);
  await expect(jisu.locator(`li a[href="${href}"]`)).toHaveCount(0);
  await expect(work).toContainText("1명");
  await jisu.reload();
  await expect(jisu.locator(`li a[href="${href}"]`)).toHaveCount(0);
  await expect(jisu.getByRole("link", { name: /^회사 / })).toContainText("1명");
  await shot(jisu, "18-people-folders");
  await jisu.setViewportSize({ width: 390, height: 664 });

  // 찾기: 폴더에 든 사람도 찾고(폴더 칸은 숨는다), 초성으로도 찾으며, 없으면 없다고
  const search = jisu.getByRole("searchbox", { name: "이름이나 태그로 찾기" });
  await search.fill("아빠");
  await expect(jisu.getByRole("link", { name: /^가족 / })).toHaveCount(0);
  await expect(jisu.getByRole("link", { name: /아빠/ })).toContainText("가족 · 본가");
  await search.fill("ㄷㅉ");
  await expect(jisu.getByRole("link", { name: /단짝/ })).toBeVisible();
  await search.fill("없는사람");
  await expect(jisu.getByText("찾는 사람이 없어요")).toBeVisible();
  await search.fill("");
  await expect(jisu.getByRole("link", { name: /^가족 / })).toBeVisible();

  // 폴더 안: 가족에 단짝도 넣는다
  // 찾기 칸을 비운 직후엔 목록이 다시 그려지는 중이라 첫 클릭이 빗나갈 수 있어, 폴더 화면이 열릴 때까지 다시 누른다
  await expect(async () => {
    if (!/\/people\/folder\//.test(jisu.url())) await jisu.getByRole("link", { name: /^가족 / }).click();
    await expect(jisu.getByRole("heading", { name: "가족" })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await expect(jisu.getByRole("link", { name: /아빠/ })).toBeVisible();
  await jisu.getByRole("link", { name: "사람 넣기" }).click();
  await jisu.getByRole("dialog").getByRole("button", { name: /단짝/ }).click();
  await jisu.getByRole("dialog").getByRole("button", { name: "완료" }).click();
  await expect(jisu.getByRole("dialog")).toHaveCount(0);
  await expect(jisu.getByRole("link", { name: /단짝/ })).toBeVisible();
  // 기본 폴더는 이름을 못 바꾸고 못 지운다
  await jisu.getByRole("link", { name: "폴더 고치기" }).click();
  await expect(jisu.getByRole("dialog").getByLabel("이름")).toBeDisabled();
  await expect(jisu.getByRole("dialog").getByRole("button", { name: "폴더 지우기" })).toHaveCount(0);
  await jisu.getByRole("dialog").getByRole("button", { name: "닫기" }).click();

  // 선택 중에는 폴더 칩으로 그 폴더 사람을 한 번에 고른다
  await jisu.goto("/people");
  await jisu.getByRole("button", { name: "선택" }).click();
  await jisu.getByRole("button", { name: "본가 모두 선택" }).click();
  await expect(jisu.getByRole("button", { name: /아빠 선택/ })).toHaveAttribute("aria-pressed", "true");
  await jisu.getByRole("button", { name: "취소" }).click();

  // 위쪽 '새 폴더'로 만들면 그 폴더에서 사람 넣기가 바로 열리고, 고치기에서 지운다(사람은 남는다)
  await jisu.getByRole("button", { name: "새 폴더" }).click();
  await jisu.getByRole("dialog").getByLabel("이름").fill("동창");
  await jisu.getByRole("dialog").getByRole("button", { name: "비행기" }).click();
  await jisu.getByRole("dialog").getByRole("button", { name: "만들기", exact: true }).click();
  await expect(jisu).toHaveURL(/\/people\/folder\/[0-9a-f-]{36}\?add=1$/);
  await expect(jisu.getByRole("dialog")).toContainText("동창");
  await jisu.getByRole("dialog").getByRole("button", { name: "닫기" }).click();
  await jisu.getByRole("link", { name: "폴더 고치기" }).click();
  jisu.once("dialog", (d) => d.accept());
  await jisu.getByRole("dialog").getByRole("button", { name: "폴더 지우기" }).click();
  await expect(jisu).toHaveURL(/\/people$/);
  await expect(jisu.getByRole("link", { name: /^동창 / })).toHaveCount(0);
});

test("챙길 날 오른쪽 위 내 얼굴: 내 프로필(닉네임·프로필 사진)과 로그아웃", async ({ browser }) => {
  const jisu = await as(browser, "jisu");
  await jisu.goto("/home");
  await jisu.getByRole("button", { name: "내 프로필 메뉴" }).click();
  await expect(jisu.getByRole("menuitem", { name: "로그아웃" })).toBeVisible();
  // '관리자'는 관리자 계정(ADMIN_EMAILS의 이메일로 로그인)에만 보인다. 일반 계정에는 없다
  await expect(jisu.getByRole("menuitem", { name: "관리자" })).toHaveCount(0);
  await jisu.getByRole("menuitem", { name: "내 프로필" }).click();
  await expect(jisu).toHaveURL(/\/me\/avatar$/);
  await expect(jisu.getByRole("heading", { name: "내 프로필" })).toBeVisible();
  await expect(jisu.getByText("닉네임", { exact: true })).toBeVisible();
  await expect(jisu.getByRole("heading", { name: "프로필 사진" })).toHaveCount(0);
  // 바깥을 누르면 메뉴가 닫힌다
  await jisu.goto("/home");
  await jisu.getByRole("button", { name: "내 프로필 메뉴" }).click();
  await jisu.mouse.click(20, 400);
  await expect(jisu.getByRole("menuitem", { name: "로그아웃" })).toHaveCount(0);
});

test("아래 탭 화면은 좌우로 밀어 옮긴다: 챙길 날 ↔ 사람들 ↔ 나 ↔ 설정, 끝에서는 그대로", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: sessions.jisu, hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // 화면 가운데 제목에서 손가락으로 밀기(누르고, 조금씩 옆으로 움직이고, 떼기)
  const swipe = (dir: "left" | "right") =>
    page.evaluate(async (d) => {
      const h = document.querySelector("h1") ?? document.body;
      const r = h.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const [x0, x1] = d === "left" ? [300, 90] : [90, 300];
      const target = document.elementFromPoint(x0, y) ?? document.body;
      const touch = (x: number) => new Touch({ identifier: 1, target, clientX: x, clientY: y });
      const fire = (type: string, x: number, end = false) =>
        target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: end ? [] : [touch(x)], changedTouches: [touch(x)] }));
      fire("touchstart", x0);
      for (let i = 1; i <= 8; i++) {
        await new Promise((ok) => setTimeout(ok, 16));
        fire("touchmove", x0 + ((x1 - x0) * i) / 8);
      }
      fire("touchend", x1, true);
    }, dir);
  await page.goto("/home");
  await swipe("right");
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/home$/);
  await swipe("left");
  await expect(page).toHaveURL(/\/people$/);
  await swipe("left");
  await expect(page).toHaveURL(/\/me$/);
  await swipe("left");
  await expect(page).toHaveURL(/\/privacy$/);
  await swipe("left");
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/privacy$/);
  await swipe("right");
  await expect(page).toHaveURL(/\/me$/);
  await ctx.close();
});

test("영어로 바꾸면 영어 화면", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: /cheat sheet/ })).toBeVisible();
  await page.getByRole("button", { name: "한국어" }).click();
  await expect(page.getByRole("heading", { name: /사랑하는 사람들의/ })).toBeVisible();
});

test("데모로 둘러보기: 샘플 사람들이 들어 있고, 데모 계정이라고 알려 준다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole("link", { name: /엄마/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /아내/ }).first()).toBeVisible();
  await expect(page.getByText("엄마 칠순")).toBeVisible();
  await shot(page, "12-demo-home");
  // 반려동물: 엄마 기록에 콩이(강아지 · 말티즈)와 좋아하는 간식. 홈의 큰 카드 얼굴을 누르면 사람 화면, 반려동물 칸은 고치기 화면의 항목에서 본다
  await page.getByRole("link", { name: "엄마", exact: true }).first().click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  await page.goto(`${new URL(page.url()).pathname}/edit?open=pets`);
  const pets = page.locator("#edit-pets");
  await expect(pets.locator("input").first()).toHaveValue("콩이");
  await expect(pets.getByLabel(/좋아하는 간식/)).toHaveValue(/닭가슴살 육포/);
  await shot(page, "12b-demo-pets");
  await page.goto("/home");
  await page.getByRole("link", { name: /아내/ }).first().click();
  await expect(page.getByRole("link", { name: /알레르기와 못 먹는 음식/ })).toBeVisible();
  await expect(page.getByText(/새우/)).toBeVisible();

  // 선물 고르기 → 이런 선물은 어때요: 가격대 넷, 아내(연인)는 5만원대가 먼저 열리고, 누르면 쿠팡 파트너스 링크
  await personMenu(page, "선물 고르기");
  // 날을 짚지 않고 열면 생일이라고 단정하지 않는다: 제목은 '○○에게 줄 선물'
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("아내에게 줄 선물");
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText("생일");
  const picks = page.locator("#picks");
  await expect(picks.getByRole("tab")).toHaveText(["1만원대", "3만원대", "5만원대", "10만원 이상"], { timeout: 45_000 });
  await expect(picks.getByRole("tab", { name: "5만원대" })).toHaveAttribute("aria-selected", "true");
  await expect(picks.getByRole("tabpanel").getByRole("link")).toHaveCount(5);
  // 가격대마다 추천 하나, 5만·10만원대는 강력추천도 하나(이 사람에게 가장 잘 맞는 것이 맨 위)
  const panel = picks.getByRole("tabpanel");
  await expect(panel.locator('[data-badge="top"]')).toHaveCount(1);
  await expect(panel.locator('[data-badge="pick"]')).toHaveCount(1);
  // 라벨은 상품 정보 안이 아니라 박스 모서리의 스티커(링크 바깥)
  await expect(panel.locator("li").first()).toContainText("강력추천");
  await expect(panel.locator("li").nth(1)).toContainText("추천");
  await expect(panel.getByRole("link").first()).not.toContainText("강력추천");
  for (const [name, top] of [["1만원대", 0], ["3만원대", 0], ["10만원 이상", 1]] as const) {
    await picks.getByRole("tab", { name }).click();
    await expect(panel.locator('[data-badge="pick"]')).toHaveCount(1);
    await expect(panel.locator('[data-badge="top"]')).toHaveCount(top);
  }
  await picks.getByRole("tab", { name: "5만원대" }).click();
  // 무엇을 보고 어떻게 골랐는지 풀어 쓴 한두 문장
  await expect(picks.locator("[data-note]")).toHaveText(/\S{2,}.*요\.?$/);
  await expect(picks.locator("[data-note]")).not.toContainText("아내");
  await expect(picks.getByText(/하나하나 떠올리며/)).toHaveCount(0);
  await shot(page, "13-picks-note");
  await picks.getByRole("tab", { name: "1만원대" }).click();
  await expect(picks.getByRole("tabpanel").getByRole("link").first()).toHaveAttribute("href", /^https:\/\/link\.coupang\.com\/a\//);
  await expect(picks.getByText(/쿠팡 파트너스 활동의 일환으로/)).toBeVisible();
  // 다시 고르기: 지난번 것을 빼고 다른 선물들
  const before = await picks.getByRole("tabpanel").getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  await picks.getByRole("link", { name: "다시 고르기" }).click();
  await expect(page).toHaveURL(/skip=/);
  await expect(picks.getByRole("tab", { name: "1만원대" })).toBeVisible({ timeout: 45_000 });
  await picks.getByRole("tab", { name: "1만원대" }).click();
  const after = await picks.getByRole("tabpanel").getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(after.some((h) => before.includes(h))).toBe(false);

  // 단추 줄(가족과 같이 준비·선물 완료)과 컨닝페이퍼는 뺐다
  for (const name of ["가족과 같이 준비", "선물 완료", "컨닝페이퍼"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await page.goto("/privacy");
  await expect(page.getByText(/데모 계정이에요/)).toBeVisible();
  await expect(page.getByRole("button", { name: "시스템" })).toHaveAttribute("aria-pressed", "true");
});

test("사람들 > 고르기: 사람을 고르면 알레르기를 빼고 메뉴를 고르고 선물 힌트를 보여 주며, 각 화면에서 공유한다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.getByRole("link", { name: "사람들" }).click();
  // 직접 적기는 오른쪽 위 사람+ 아이콘. 선택 중에는 숨는다
  await expect(page.getByRole("link", { name: "직접 적기" })).toBeVisible();
  await shot(page, "17-people-fab");
  await page.getByRole("button", { name: "선택" }).click();
  await expect(page.getByRole("link", { name: "직접 적기" })).toHaveCount(0);
  // 머리가 ✕ · N명 선택 · 전체 선택으로 바뀐다. 아무도 안 골랐으면 아래는 탭 막대 그대로(동작 막대 없음)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("0명 선택");
  await expect(page.getByRole("toolbar")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "사람들", exact: true })).toBeVisible();
  // 줄 어디를 눌러도 고른다(사람 화면으로 가지 않는다). 한 명이라도 고르면 탭 막대 자리에 동작 막대: 지우기 · 폴더에 넣기 · 메뉴 고르기
  await page.getByRole("button", { name: "아내 선택" }).click();
  await page.getByRole("button", { name: "단짝 선택" }).click();
  await expect(page).toHaveURL(/\/people\?.*pick=1/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2명 선택");
  const bar = page.getByRole("toolbar");
  await expect(bar.getByRole("button", { name: "지우기", exact: true })).toBeVisible();
  await expect(bar.getByRole("button", { name: "폴더에 넣기" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "메뉴 고르기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "선물 고르기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "사람들", exact: true })).toHaveCount(0);
  // 전체 선택은 보이는 사람 모두, 한 번 더 누르면(선택 해제) 모두 빠진다
  await page.getByRole("button", { name: "전체 선택" }).click();
  await expect(page.getByRole("button", { name: "선택 해제" })).toBeVisible();
  await page.getByRole("button", { name: "선택 해제" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("0명 선택");
  await expect(page.getByRole("toolbar")).toHaveCount(0);
  await page.getByRole("button", { name: "아내 선택" }).click();
  await page.getByRole("button", { name: "단짝 선택" }).click();
  await page.getByRole("link", { name: "메뉴 고르기" }).click();
  await expect(page.getByRole("heading", { name: "다 같이 먹을 메뉴" })).toBeVisible();
  await expect(page.getByText(/새우, 게, 땅콩은 빼 주세요/)).toBeVisible();
  await page.getByText("피해야 해요").click();
  await expect(page.getByText("마라탕·훠궈")).toBeVisible();
  // 공유하기는 메뉴 고르기 안에서(이름은 고를 때만)
  await expect(page.getByRole("button", { name: "공유하기" })).toBeVisible();
  await page.getByRole("button", { name: "이름도 같이" }).click();
  await expect(page.getByRole("button", { name: "이름도 같이" })).toHaveAttribute("aria-pressed", "true");
  await shot(page, "15-plan-menu");

  await page.getByRole("link", { name: "뒤로" }).click();
  await expect(page).toHaveURL(/\/people\?.*pick=1/);
  // 돌아와도 고른 사람이 그대로
  await expect(page.getByRole("button", { name: "아내 선택" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "단짝 선택" })).toHaveAttribute("aria-pressed", "true");
  // 선물 고르기는 선택 모드에 없다. 홈 기념일 카드에서 오면(?to=gift) 같은 자리의 큰 단추가 선물 고르기
  const giftUrl = new URL(page.url());
  giftUrl.searchParams.set("to", "gift");
  await page.goto(giftUrl.toString());
  await expect(page.getByRole("link", { name: "메뉴 고르기" })).toHaveCount(0);
  await page.getByRole("link", { name: "선물 고르기" }).click();
  await expect(page.getByText(/캠핑용 접이식 의자/)).toBeVisible();
  // 선물 힌트는 글로 내보내지 않는다: 공유하기가 없다(취향·사이즈 같은 사람 정보가 그대로 나가는 길이라 뺐다)
  await expect(page.getByRole("button", { name: "공유하기" })).toHaveCount(0);
  await expect(page.getByText("공유하기")).toHaveCount(0);
});

test("오늘의 질문: 가까운 사람의 빈 칸을 하나씩 묻고, 답하면 그 사람 기록에 들어가며, 하루 두 번을 쓰면 더 뜨지 않는다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  const card = page.getByRole("region", { name: "오늘의 질문" });
  await expect(card).toBeVisible();
  // 누구에 대한 질문인지 보인다: 이름 칩(눌러 그 사람 화면)과 그 이름이 든 질문
  const who = card.getByRole("link").first();
  const name = ((await who.textContent()) ?? "").trim();
  expect(name).toBeTruthy();
  const first = ((await card.getByRole("heading").textContent()) ?? "").trim();
  expect(first).toContain(name);
  // 건너뛰면 오늘 한 번 쓴 것으로 세고 다음 질문이 뜬다. 새로고침해도 처음 질문으로 돌아가지 않는다
  await card.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(card.getByRole("heading")).not.toHaveText(first);
  const second = ((await card.getByRole("heading").textContent()) ?? "").trim();
  await page.goto("/home");
  await expect(card.getByRole("heading")).toHaveText(second);
  // 답하면 그 사람 기록에 들어가고, 오늘 두 번을 다 썼으니 카드는 더 뜨지 않는다(새로고침해도)
  await card.locator('form button[name="value"]').first().click();
  await expect(page.getByRole("status").filter({ hasText: "기억해 둘게요" })).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.goto("/home");
  await expect(card).toHaveCount(0);
});

test("오늘의 질문: '물어보기'는 그 사람을 고른 채 그 질문 하나만 물어보기로 보내고, 오늘 한 번 쓴 것으로 센다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  const card = page.getByRole("region", { name: "오늘의 질문" });
  const href = (await card.getByRole("link").first().getAttribute("href")) ?? "";
  const id = href.split("/").pop()!;
  const first = ((await card.getByRole("heading").textContent()) ?? "").trim();
  // 물어보기는 위 단추 하나뿐(아래 '몰라요 → 물어보기' 줄은 없다)
  await expect(card.getByRole("link", { name: /^몰라요/ })).toHaveCount(0);
  await card.getByRole("button", { name: "물어보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/request\\?to=${id}&q=[A-Za-z]+$`));
  // 그 사람이 고정돼 있고 묻는 건 그 질문 하나뿐이다(항목을 고르는 칸은 없다)
  await expect(page.getByRole("heading", { name: "물어보기" })).toBeVisible();
  await expect(page.locator("form button[aria-pressed]")).toHaveCount(0);
  // 돌아오면 한 번 쓴 것으로 세서 다음 질문이 뜬다
  await page.goto("/home");
  await expect(card.getByRole("heading")).not.toHaveText(first);
});

test("오늘의 질문: '이 사람에 대해 다시 묻지 않기'를 하면 그 사람은 더 안 나오고, 사람 화면에서 다시 켤 수 있다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  const card = page.getByRole("region", { name: "오늘의 질문" });
  const href = (await card.getByRole("link").first().getAttribute("href")) ?? "";
  // ··· 메뉴를 열어 '이 사람에 대해 다시 묻지 않기'
  await card.getByRole("button", { name: "더 보기", exact: true }).click();
  await card.getByRole("button", { name: "이 사람에 대해 다시 묻지 않기" }).click();
  await expect(page).toHaveURL(/\/home\?muted=1$/);
  await expect(page.getByRole("status").filter({ hasText: "더 묻지 않을게요" })).toBeVisible();
  // 오늘 한 번 더 남았어도 그 사람 이야기는 아니다
  if (await card.count()) await expect(card.getByRole("link").first()).not.toHaveAttribute("href", href);
  // 그 사람 화면에서 다시 켠다
  await page.goto(href);
  await page.getByRole("button", { name: "오늘의 질문 다시 받기" }).click();
  await expect(page.getByRole("button", { name: "오늘의 질문 다시 받기" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "오늘의 질문 다시 받기" })).toHaveCount(0);
});

test("기기 언어가 영어면 처음부터 영어로, 직접 고른 언어가 우선", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /cheat sheet/ })).toBeVisible();
  await page.getByRole("button", { name: "한국어" }).click();
  await expect(page.getByRole("heading", { name: /사랑하는 사람들의/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /사랑하는 사람들의/ })).toBeVisible();
  await ctx.close();
});

test("검색·AI 답변: 선물 가이드는 로그인 없이 열리고 구조화 데이터·robots·sitemap·llms.txt가 있으며, 개인 화면은 검색에서 닫는다", async ({ page, request }) => {
  const hub = await request.get("/gifts");
  expect(hub.status()).toBe(200);
  expect(hub.headers()["x-robots-tag"]).toBeUndefined();
  await page.goto("/gifts");
  await expect(page.getByRole("heading", { name: "누구에게, 얼마로 줄까요?" })).toBeVisible();
  await page.getByRole("link", { name: "부모님 선물" }).first().click();
  await expect(page).toHaveURL(/\/gifts\/parents$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("부모님 선물 추천, 가격대별로 골랐어요");
  await expect(page.getByRole("heading", { name: "5만원대 부모님 선물" })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = ld.flatMap((s) => [JSON.parse(s)].flat().map((x: { "@type": string }) => x["@type"]));
  expect(types).toEqual(expect.arrayContaining(["BreadcrumbList", "ItemList", "FAQPage"]));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/gifts\/parents$/);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /people");
  expect(robots).toContain("Sitemap:");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/gifts/parents");
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(await llms.text()).toContain("# 기억해유");
  expect((await request.get("/people", { maxRedirects: 0 })).headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

test("통계: 이용 기록을 받고, 관리자 키로 들어가 기간을 바꿔 본다", async ({ page, request }) => {
  const ok = await request.post("/api/e", { data: { a: "testAnon12345678", e: [{ n: "visit", p: "/gifts", s: "naver" }, { n: "page_view", p: "/gifts" }, { n: "page_time", p: "/gifts", v: 4200 }] } });
  expect(ok.status()).toBe(204);
  expect((await request.post("/api/e", { data: { e: [{ n: "drop_table" }] } })).status()).toBe(400);

  const key = ADMIN_KEY;
  test.skip(!key, "ADMIN_KEY가 없는 개발 환경");
  await page.goto("/admin");
  await page.getByPlaceholder("관리자 키").fill("wrong");
  await page.getByRole("button", { name: "들어가기" }).click();
  await expect(page.getByText("키가 맞지 않아요")).toBeVisible();
  await page.getByPlaceholder("관리자 키").fill(key!);
  await page.getByRole("button", { name: "들어가기" }).click();
  // 한 번에 다 읽으면 DB 비용이 커서 탭으로 나눈다: 처음엔 요약·추이만, 탭을 누르면 그 탭의 구역만 보인다
  const headings = { "요약·추이": ["요약", "추이"], 유입: ["유입"], 퍼널: ["가입 퍼널"], 리텐션: ["리텐션"], 화면: ["화면별"], 기능: ["기능별 사용"], 기기: ["기기"], 선물: ["선물"], 누적: ["누적(기간과 상관없이 지금까지)"] } as Record<string, string[]>;
  const tabs = page.getByRole("navigation", { name: "탭" });
  await expect(tabs.getByRole("link", { name: "요약·추이" })).toHaveAttribute("aria-current", "page");
  // 위쪽에서 앱으로 돌아갈 수 있다
  await expect(page.getByRole("link", { name: "앱으로 이동하기" })).toHaveAttribute("href", "/home");
  for (const [tab, names] of Object.entries(headings)) {
    if (tab !== "요약·추이") {
      await tabs.getByRole("link", { name: tab, exact: true }).click();
      await expect(tabs.getByRole("link", { name: tab, exact: true })).toHaveAttribute("aria-current", "page");
    }
    for (const name of names) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.locator("main section")).toHaveCount(names.length);
  }
  // 기간을 바꿔도 보던 탭 그대로, 탭을 옮겨도 고른 기간 그대로
  await tabs.getByRole("link", { name: "선물", exact: true }).click();
  // 탭이 바뀐 뒤에 기간을 누른다(이동이 끝나기 전에 누르면 옛 탭 주소로 간다)
  await expect(tabs.getByRole("link", { name: "선물", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "7일", exact: true }).click();
  await expect(page).toHaveURL(/tab=gifts&range=7/);
  await expect(page.getByText(/\(7일\)/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "선물", exact: true })).toBeVisible();
  await tabs.getByRole("link", { name: "기기", exact: true }).click();
  await expect(page).toHaveURL(/tab=devices&range=7/);
});

test("말로 적기: 들어오면 누르라는 표시, 듣는 중 표시, 말이 멈추면 저장 없이 스스로 끄고 기억해 두기를 강조하며, 아무 말이 없으면 8초 뒤 다시 누르라는 표시", async ({ browser }) => {
  const page = await newPage(browser);
  // 브라우저 음성 인식 흉내: 시작·멈춤·받아 적은 말(중간 결과)을 테스트가 흘려 보낸다. 크로미움에는 진짜 SpeechRecognition이 있어 둘 다 바꾼다
  await page.addInitScript(() => {
    const log = { starts: 0, stops: 0, last: null as null | { onresult: ((e: unknown) => void) | null } };
    (window as unknown as { __sr: typeof log }).__sr = log;
    class Fake {
      running = false;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() {
        log.last = this;
      }
      start() {
        this.running = true;
        log.starts++;
        setTimeout(() => this.onstart?.(), 40);
      }
      stop() {
        if (!this.running) return;
        this.running = false;
        log.stops++;
        setTimeout(() => this.onend?.(), 60);
      }
    }
    Object.assign(window, { SpeechRecognition: Fake, webkitSpeechRecognition: Fake });
    (window as unknown as { __say: (t: string) => void }).__say = (t) => log.last!.onresult!({ results: [[{ transcript: t }]] });
  });
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "하나" });
  await page.goto("/voice");
  const cue = page.getByText("구슬을 누르고 말해 보세요");
  const stops = () => page.evaluate(() => (window as unknown as { __sr: { stops: number } }).__sr.stops);
  const say = (t: string) => page.evaluate((x) => (window as unknown as { __say: (t: string) => void }).__say(x), t);

  // 들어오면: 구슬 아래 한 줄과 맥박 고리
  await expect(cue).toBeVisible();
  expect(await page.locator(".cue-ring").count()).toBeGreaterThan(0);
  // 누르면: 표시가 사라지고 '듣고 있어요', 구슬·마이크가 멈추기(눌린 상태)로 바뀐다
  await page.getByRole("button", { name: "말하기" }).first().click();
  await expect(page.getByText("듣고 있어요")).toBeVisible();
  await expect(cue).toHaveCount(0);
  const stopBtns = page.getByRole("button", { name: "멈추기" });
  await expect(stopBtns).toHaveCount(2);
  await expect(stopBtns.nth(1)).toHaveAttribute("aria-pressed", "true");
  // 말하는 동안(결과가 계속 들어오는 동안)은 멈추지 않는다
  await say("와이프는");
  await page.waitForTimeout(1000);
  await say("와이프는 바닐라라떼를 좋아해");
  await expect(page.locator("textarea")).toHaveValue("와이프는 바닐라라떼를 좋아해");
  await page.waitForTimeout(1000);
  expect(await stops()).toBe(0);
  // 새 결과가 1.8초 없으면 스스로 끈다: 글은 그대로, 저장은 안 하고, 기억해 두기가 강조된다
  await expect(page.getByText("다 들었어요")).toBeVisible({ timeout: 6000 });
  expect(await stops()).toBe(1);
  const save = page.getByRole("button", { name: "기억해 두기" });
  await expect(save).toBeEnabled();
  await expect(save).toHaveClass(/save-ready/);
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name: "이렇게 기억해 둘게요" })).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveValue("와이프는 바닐라라떼를 좋아해");

  // 아무 말도 없으면 시작하고 8초 뒤 스스로 끄고, 다시 누르라는 표시
  await page.getByRole("button", { name: "지우기" }).click();
  await expect(cue).toBeVisible();
  await page.getByRole("button", { name: "말하기" }).first().click();
  await expect(page.getByText("듣고 있어요")).toBeVisible();
  await page.waitForTimeout(6000);
  await expect(page.getByText("듣고 있어요")).toBeVisible();
  await expect(cue).toBeVisible({ timeout: 6000 });
  expect(await stops()).toBe(2);
  await expect(page.getByRole("button", { name: "기억해 두기" })).toBeDisabled();
});

test("말로 적기: 정리하는 동안 단계 문구가 바뀌고, 나눈 결과는 저장 전에 값을 고치고 줄을 뺄 수 있으며, 저장해야 사람 화면에 고친 값이 들어간다", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "하나" });
  await page.goto("/voice");
  await page.getByRole("radio", { name: "글로" }).click();
  await page.getByRole("textbox", { name: /예:/ }).fill("엄마는 장미꽃을 좋아하고 아빠는 막걸리를 좋아해");
  // AI 나누기를 몇 초 늦춰 단계 문구를 본다
  let slow = true;
  await page.route("**/voice", async (route) => {
    if (slow && route.request().method() === "POST" && route.request().headers()["next-action"]) {
      slow = false;
      await new Promise((done) => setTimeout(done, 4000));
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "기억해 두기" }).click();
  const step = page.locator(".organize").getByRole("status");
  await expect(step).toHaveText("분류하고 있어요");
  await expect(step).toHaveText("적고 있어요");
  await expect(step).toHaveText("정리하고 있어요");
  await shot(page, "voice-organize");

  // 초안: 아직 저장 전. 엄마 값은 고치고, 아빠 줄은 뺀다
  await expect(page.getByRole("heading", { name: "이렇게 기억해 둘게요" })).toBeVisible({ timeout: 60_000 });
  const save = page.getByRole("button", { name: "저장", exact: true });
  await expect(save).toBeEnabled();
  const mom = page.getByRole("textbox", { name: /^엄마/ }).first();
  await expect(mom).toBeVisible();
  await mom.fill("수국");
  const dad = page.getByRole("button", { name: /^이 줄 빼기: 아빠/ });
  while (await dad.count()) await dad.first().click();
  await expect(page.getByRole("textbox", { name: /^아빠/ })).toHaveCount(0);
  await shot(page, "voice-draft");
  await save.click();
  // 한 사람 이야기뿐이면 그 사람 화면으로: 방금 적은 줄(새 사람이면 만들었다는 말)과 되돌리기가 보인다
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  await expect(page.getByText("엄마를 새로 만들었어요")).toBeVisible();
  await expect(page.getByRole("button", { name: "되돌리기" })).toBeVisible();

  // 저장한 것만 기록에 있다: 엄마는 고친 값(수국), 줄을 뺀 아빠는 사람으로도 만들지 않았다
  await page.goto("/people");
  await expect(page.getByRole("link", { name: /엄마/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /아빠/ })).toHaveCount(0);
  await page.getByRole("link", { name: /엄마/ }).first().click();
  await expect(page.getByText("수국").first()).toBeVisible();
  await expect(page.getByText("장미")).toHaveCount(0);
});

/**
 * 말로 적기 초안의 AI 나누기(draftCapture 서버 액션 응답)를 정해 둔 줄로 바꿔 끼운다. 저장·미리 보기 같은 다른 서버 액션은 그대로 서버로 간다.
 * 돌려주는 함수에 줄을 넘기면 다음 '기억해 두기'가 그 줄을 받는다
 */
interface FakeLine {
  spoken: string;
  target: { kind: "me" } | { kind: "person"; id: string } | { kind: "new"; name: string } | { kind: "pick" };
  key: string;
  field: string;
  text: string;
  candidates?: string[];
}
async function fakeDrafts(page: import("@playwright/test").Page) {
  let next: FakeLine[] = [];
  await page.route("**/voice", async (route) => {
    const req = route.request();
    const args = req.method() === "POST" && req.headers()["next-action"] ? (JSON.parse(req.postData() ?? "[]") as unknown[]) : null;
    // draftCapture만(첫 인자가 말한 글). saveCapture·previewCapture는 첫 인자가 항목 배열이다
    if (!args || typeof args[0] !== "string") return route.continue();
    const lines = next.map((l, idx) => {
      const name = l.target.kind === "new" ? l.target.name : l.spoken;
      const who = l.target.kind === "new" ? { type: "new", contactId: null, name } : l.target.kind === "person" ? { type: "existing", contactId: l.target.id, name: null } : l.target.kind === "me" ? { type: "me", contactId: null, name: null } : { type: "new", contactId: null, name };
      return {
        who: name,
        isNew: l.target.kind === "new",
        op: "add",
        field: l.field,
        value: l.text,
        href: "",
        item: { who, target: l.key, op: "add", text: l.text, codes: null, number: null, date: null, label: null },
        idx,
        target: l.target,
        spoken: l.spoken,
        candidates: l.candidates ?? [],
      };
    });
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/x-component" },
      body: `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify({ lines, error: null })}\n`,
    });
  });
  return (lines: FakeLine[]) => {
    next = lines;
  };
}

/** 글로 적고 '기억해 두기' → 초안이 뜰 때까지 */
async function draftText(page: import("@playwright/test").Page, text: string) {
  await page.goto("/voice");
  const toText = page.getByRole("radio", { name: "글로" });
  if (await toText.count()) await toText.click();
  await page.getByRole("textbox", { name: /예:/ }).fill(text);
  await page.getByRole("button", { name: "기억해 두기" }).click();
  await expect(page.getByRole("heading", { name: "이렇게 기억해 둘게요" })).toBeVisible({ timeout: 60_000 });
}

/** 사람들 화면(폴더가 없으면 목록)의 사람 id와 이름 줄 */
async function personLinks(page: import("@playwright/test").Page) {
  await page.goto("/people");
  const all = await page.locator('a[href^="/people/"]').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href") ?? "", text: a.textContent ?? "" })));
  return all.filter((a) => /^\/people\/[0-9a-f-]{36}$/.test(a.href)).map((a) => ({ id: a.href.split("/").pop()!, text: a.text }));
}

test("말로 적기: 같은 이름이 둘이면 고르기 전에는 저장할 수 없고(그 줄로 가서 칩이 반짝), 고르면 고른 사람에게만 들어간다", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "하나" });
  const fake = await fakeDrafts(page);
  const save = page.getByRole("button", { name: "저장", exact: true });

  // 같은 이름 두 명 만들기: 새 사람 줄의 칩에서 '새 사람으로'에 이름을 적는다(이미 있는 이름이어도 사람이 정한 대로 새로 만든다)
  for (const food of ["소고기", "국수"]) {
    fake([{ spoken: "처제", target: { kind: "new", name: "처제" }, key: "taste.likes", field: "좋아하는 음식", text: food }]);
    await draftText(page, `처제는 ${food}를 좋아해`);
    await page.getByRole("button", { name: /^처제 새로/ }).click();
    await page.locator("#capture-new-name").fill("지수");
    await page.getByRole("dialog").getByRole("button", { name: "새 사람으로" }).click();
    await expect(page.getByRole("button", { name: /^지수 새로/ })).toBeVisible();
    await save.click();
    await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  }
  const twins = (await personLinks(page)).filter((p) => /지수/.test(p.text));
  expect(twins).toHaveLength(2);
  const [first, second] = [twins[0]!.id, twins[1]!.id];

  // 같은 이름 '지수' 두 줄: AI가 누구인지 못 정했다(후보 둘)
  fake([
    { spoken: "지수", target: { kind: "pick" }, key: "favorites.flowers", field: "꽃", text: "수국", candidates: [first, second] },
    { spoken: "지수", target: { kind: "pick" }, key: "sizes.top", field: "상의", text: "M", candidates: [first, second] },
  ]);
  await draftText(page, "지수는 수국을 좋아하고 상의는 M");
  const chips = page.getByRole("button", { name: /^지수 같은 이름 2명/ });
  await expect(chips).toHaveCount(2);
  await shot(page, "target-4-pick");
  // 고르기 전 저장은 막힌다: 화면은 그대로고 첫 줄로 가서 칩이 반짝인다
  await save.click();
  await expect(page.getByRole("heading", { name: "이렇게 기억해 둘게요" })).toBeVisible();
  await expect(chips.first().locator("span").first()).toHaveClass(/chip-flash/);
  await expect(chips.first()).toBeFocused();
  await shot(page, "target-5-blocked");
  await page.getByRole("button", { name: "더 말하기" }).click();
  await expect(page.getByRole("heading", { name: "이렇게 기억해 둘게요" })).toBeVisible();

  // 시트: 후보 두 명이 위에, 같은 이름 줄은 함께 바뀐다(기본)
  await chips.first().click();
  const sheet = page.getByRole("dialog", { name: "누구 이야기예요?" });
  await expect(sheet.getByText("같은 이름 2명")).toBeVisible();
  const rows = sheet.locator("li button");
  await expect(rows.nth(0)).toContainText("소고기");
  await expect(rows.nth(1)).toContainText("국수");
  await shot(page, "target-6-candidates");
  await rows.nth(1).click();
  await expect(page.getByRole("button", { name: /같은 이름 2명/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^지수/ })).toHaveCount(2);
  await shot(page, "target-7-resolved");
  await save.click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);

  // 고른 사람(국수 지수)에게만 들어갔다
  await page.goto(`/people/${second}`);
  await expect(page.getByText("수국").first()).toBeVisible();
  await page.goto(`/people/${first}`);
  await expect(page.getByText("소고기").first()).toBeVisible();
  await expect(page.getByText("수국")).toHaveCount(0);
});

test("가입 직후 체험: 글로 사람을 적어 보고(예시 문장) 적힌 걸 본 뒤, 물어보기 링크까지 만들면 홈으로 끝난다", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "하나", intro: "stay" });
  // ① 말로·글로 적기: 예시 문장과 안내. 마이크가 있으면 '말로'가 먼저라 '글로'로 바꾼다
  const toText = page.getByRole("radio", { name: "글로" });
  if (await toText.count()) await toText.click();
  await expect(page.getByRole("heading", { name: "이렇게 써보세요" })).toBeVisible();
  await page.getByRole("textbox", { name: "엄마는 장미꽃을 좋아해" }).fill("엄마는 장미꽃을 좋아해");
  await page.getByRole("button", { name: "기억해 두기" }).click();
  // 나눈 결과는 저장 전 초안으로 보인다(엄마 · 새로 · 장미꽃). 값은 그 자리에서 고칠 수 있다. 값 글자는 AI가 나누는 거라 "장미"로 적힐 때도 있다
  await expect(page.getByRole("heading", { name: "이렇게 기억해 둘게요" })).toBeVisible({ timeout: 60_000 });
  const draft = page.getByRole("textbox", { name: /^엄마/ });
  await expect(draft.first()).toBeVisible();
  await expect(draft.first()).toHaveValue(/장미/);
  // 저장을 눌러야 기록에 들어가고, 체험은 방금 적은 엄마에게 물어보기로 이어진다(사람이 정해져 있다)
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/request\?tour=2&to=[0-9a-f-]{36}/);
  await expect(page.getByText("2 / 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: /엄마/ })).toBeVisible();
  await makeLink(page);
  // 링크를 만들었으면 시작하기로 마치고 홈으로. 엄마는 사람들에 남아 있다
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL(/\/home$/);
  // 날짜가 없는 엄마는 홈 카드에 안 뜨니 사람들에서 본다
  await page.goto("/people");
  await expect(page.getByRole("link", { name: /엄마/ }).first()).toBeVisible();
});

test("키보드가 화면을 줄이면(안드로이드 앱처럼) 하단 메뉴를 접고 아래 단추 줄이 키보드 바로 위에 온다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.goto("/import");
  const nav = page.locator("nav[data-tabbar]");
  const field = page.getByRole("textbox");
  await expect(nav).toBeVisible();
  // 칸을 누르면 키보드가 뜨며 화면 높이가 줄어든다: 메뉴는 적는 칸을 가리지 않게 접힌다
  await field.focus();
  await page.setViewportSize({ width: 360, height: 440 });
  await expect(nav).toBeHidden();
  const bar = await page.locator(".bottom-bar").boundingBox();
  expect(Math.round(bar!.y + bar!.height)).toBe(440);
  // 키보드가 내려가면 메뉴가 다시 보인다
  await page.setViewportSize({ width: 360, height: 780 });
  await field.blur();
  await expect(nav).toBeVisible();
});

test("연말엔 사람이 있어도 가까운 기념일이 없으면 크리스마스 카드가 그대로고, 그 물어보기는 누구를 골라도 선물을 먼저 묻는다", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "수아" });
  // 날짜 없는 사람 하나: 가까운 기념일이 없다
  await page.goto("/people/new");
  await page.getByLabel("이름이나 부르는 말").fill("할머니");
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "할머니" })).toBeVisible();
  // 사람이 생겼다고 '새 친구 추가해 봐요'로 돌아가지 않는다(연말이면)
  await page.goto("/home");
  if (yearEnd(todayIn("Asia/Seoul"))) {
    const upcoming = page.getByRole("region", { name: "다가오는 날" });
    await expect(upcoming.getByText(ko["home.yearEnd"])).toBeVisible();
    // 사람이 있으니 곧장 선물 고르기(한 명이면 그 사람의 선물 고르기 화면으로, 크리스마스용), '사람 추가하기'로 이끄는 쪽은 없다
    await expect(upcoming.getByRole("link", { name: ko["home.yearEndGift"] })).toHaveAttribute("href", /^\/people\/[0-9a-f-]{36}\/reminder\?xmas=1$/);
    await expect(upcoming.getByRole("link", { name: ko["home.yearEndAdd"] })).toHaveCount(0);
    await expect(upcoming.getByRole("link", { name: ko["home.yearEndAsk"] })).toHaveCount(0);
    await expect(page.getByText("새 친구 추가해 봐요")).toHaveCount(0);
  }
  // 있는 사람을 골라도 선물 쪽이 켜져 있다(그 사람의 빈 칸인 생일·기념일이 아니라)
  await page.goto("/request?xmas=1");
  await page.getByRole("button", { name: "할머니" }).click();
  await expect(page.getByRole("button", { name: ko["request.topic.gifts"] })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: ko["request.topic.dates"] })).toHaveAttribute("aria-pressed", "false");
});

test("연말 카드의 흐름: 사람이 없으면 추가 → 곧바로 물어보기 → 답이 오면 카드가 알려 주고 선물 고르기로 → 읽은 것으로", async ({ browser }) => {
  test.skip(!yearEnd(todayIn("Asia/Seoul")), "크리스마스 45일 전~당일에만 보이는 카드");
  const page = await newPage(browser);
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "수아" });
  await page.goto("/home");
  const upcoming = page.getByRole("region", { name: "다가오는 날" });
  await shot(page, "xmas-1-card-empty");

  // ① 사람이 없다: 챙기고 싶은 사람 추가하기 → 사람 추가(연말 표시, 만들면 곧바로 물어보기로)
  await upcoming.getByRole("link", { name: ko["home.yearEndAdd"] }).click();
  await expect(page).toHaveURL(/\/people\/new\?xmas=1$/);
  await page.getByLabel("이름이나 부르는 말").fill("엄마");
  await shot(page, "xmas-2-add");
  await page.getByRole("button", { name: ko["people.createAsk"] }).click();

  // ② 곧바로 그 사람에게 물어보기: 받고 싶은 것 쪽이 켜져 있다
  await expect(page).toHaveURL(/\/request\?to=[0-9a-f-]{36}&xmas=1$/);
  const id = /to=([0-9a-f-]{36})/.exec(page.url())![1]!;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("물어보기");
  await expect(page.getByRole("button", { name: ko["request.topic.gifts"] })).toHaveAttribute("aria-pressed", "true");
  await shot(page, "xmas-3-ask");
  const url = await makeLink(page);

  // ③ 사람이 생겼고 아직 답이 없다: 카드는 곧장 선물 고르기로 이끈다(알림도 아직 없다)
  await page.goto("/home");
  await expect(upcoming.getByRole("link", { name: ko["home.yearEndGift"] })).toHaveAttribute("href", `/people/${id}/reminder?xmas=1`);
  await expect(upcoming.getByText(ko["home.yearEndLine"].replace("\n", " "))).toBeVisible();
  await expect(page.getByRole("button", { name: "알림", exact: true })).toBeVisible();

  // ④ 엄마가 앱 없이 웹에서 답한다(좋아하는 것 하나, 나머지는 비워 두고 다음)
  const mom = await newPage(browser);
  await mom.goto(url);
  await mom.getByRole("button", { name: "분위기 맞춰", exact: true }).click();
  await mom.getByRole("button", { name: "다음", exact: true }).click();
  await mom.getByRole("button", { name: "다음", exact: true }).click();
  await mom.getByRole("button", { name: "다음", exact: true }).click();
  await mom.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(mom.getByRole("heading", { name: "마음이 전해졌어요" })).toBeVisible();

  // ⑤ 답이 오면 카드가 그 소식을 알려 주고(누가 답했는지), 같은 단추가 그 사람의 선물 고르기로 이끈다
  await page.goto("/home");
  await expect(page.getByRole("button", { name: "알림 1" })).toBeVisible();
  await expect(upcoming.getByText(/엄마.*답장을 보냈어요/)).toBeVisible();
  await shot(page, "xmas-4-card-answered");
  await upcoming.getByRole("link", { name: ko["home.yearEndGift"] }).click();
  // 그 사람의 선물 고르기 화면으로 바로(상세 정보와 목록이 같이 나오는 선물 힌트가 아니라): 제목이 크리스마스까지 남은 날, 고르는 카드가 있다
  await expect(page).toHaveURL(`/people/${id}/reminder?xmas=1`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/크리스마스까지 \d+일 남았어요|오늘은 크리스마스/);
  await expect(page.getByRole("heading", { name: "선물 힌트" })).toHaveCount(0);

  // ⑥ 선물 고르기를 열면 그 답장 알림은 읽은 것으로: 카드는 다시 감성 문구, 종에는 숫자가 없다
  await expect.poll(async () => (await page.request.get("/home")).text().then((h) => h.includes('aria-label="알림 1"'))).toBe(false);
  await page.goto("/home");
  await expect(page.getByRole("button", { name: "알림", exact: true })).toBeVisible();
  await expect(upcoming.getByText(/답장을 보냈어요/)).toHaveCount(0);
  await expect(upcoming.getByRole("link", { name: ko["home.yearEndGift"] })).toBeVisible();
});

test("연말 카드: 사람이 여럿이면 사람들에서 한 명을 고르면 그 사람의 크리스마스 선물 고르기로, 여럿을 고르면 같이 고르기로", async ({ browser }) => {
  test.skip(!yearEnd(todayIn("Asia/Seoul")), "크리스마스 45일 전~당일에만 보이는 카드");
  const page = await newPage(browser);
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "수아" });
  // 날짜 없는 사람 둘: 가까운 기념일이 없어 크리스마스 카드가 보인다
  for (const name of ["할머니", "고모"]) {
    await page.goto("/people/new");
    await page.getByLabel("이름이나 부르는 말").fill(name);
    await page.getByRole("button", { name: "만들기", exact: true }).click();
    await expect(page.getByRole("heading", { name: name })).toBeVisible();
  }
  await page.goto("/home");
  const gift = page.getByRole("region", { name: "다가오는 날" }).getByRole("link", { name: ko["home.yearEndGift"] });
  await expect(gift).toHaveAttribute("href", "/people?pick=1&me=0&to=gift&xmas=1");
  await gift.click();
  await expect(page).toHaveURL(/\/people\?.*pick=1/);
  // 한 명만 고르면 그 사람의 선물 고르기 화면(크리스마스용)
  await page.getByRole("button", { name: "고모 선택" }).click();
  await page.getByRole("link", { name: "선물 고르기" }).click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}\/reminder\?xmas=1$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/크리스마스까지 \d+일 남았어요|오늘은 크리스마스/);
  // 둘을 고르면 같이 고르기(선물 힌트)
  await page.goto("/people?pick=1&me=0&to=gift&xmas=1");
  await page.getByRole("button", { name: "고모 선택" }).click();
  await page.getByRole("button", { name: "할머니 선택" }).click();
  await page.getByRole("link", { name: "선물 고르기" }).click();
  await expect(page).toHaveURL(/\/plan\/gift\?with=/);
  await expect(page.getByRole("heading", { name: "선물 힌트" })).toBeVisible();
});

/** 크로미움 CDP로 손가락 밀기(가로): fromX에서 toX로 */
async function swipe(page: import("@playwright/test").Page, fromX: number, toX: number, y = 520) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fromX + ((toX - fromX) * i) / 8, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  // 넘어가거나 제자리로 돌아오는 움직임이 끝나기를 기다린다(움직이는 동안 다음 밀기는 받지 않는다)
  await page.waitForTimeout(450);
}

test("달력: 공휴일·연휴(대체공휴일 포함)가 보이고, 좌우로 밀면 달이 넘어간다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  // 2026년 9월: 추석(9/25) 연휴 9/24~9/27(일) 4일. 제목은 '2026년'은 작게 '9월'은 크게 나눠 그려서 읽어 주는 이름(aria-label)으로 본다
  await page.goto("/calendar?m=2026-09");
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveAttribute("aria-label", "2026년 9월");
  // 아래 '다가오는 날' 한 장에 공휴일·연휴가 날짜 순서로 있고, 위 달력 칸에도 이름이 붙는다
  const upcoming = page.getByRole("region", { name: "다가오는 날" });
  const grid = page.getByRole("region", { name: "2026년 9월" });
  await expect(grid.getByText("추석 연휴").first()).toBeVisible();
  await expect(grid.getByText("추석", { exact: true })).toBeVisible();
  await expect(upcoming.getByText("추석", { exact: true })).toBeVisible();
  await expect(upcoming.getByText(/4일 연휴/)).toBeVisible();
  // 오른쪽에서 왼쪽으로 밀면 다음 달(10월): 개천절(토) 대체공휴일 10/5, 한글날
  await swipe(page, 300, 60);
  await expect(title).toHaveAttribute("aria-label", "2026년 10월");
  await expect(page).toHaveURL(/\/calendar\?m=2026-10$/);
  await expect(upcoming.getByText("개천절", { exact: true })).toBeVisible();
  await expect(upcoming.getByText("대체공휴일", { exact: true })).toBeVisible();
  await expect(upcoming.getByText("한글날", { exact: true })).toBeVisible();
  // 조금만 밀면 제자리, 왼쪽에서 오른쪽으로 밀면 이전 달
  await swipe(page, 220, 190);
  await expect(title).toHaveAttribute("aria-label", "2026년 10월");
  await swipe(page, 60, 300);
  await expect(title).toHaveAttribute("aria-label", "2026년 9월");
  // 12월: 크리스마스(성탄절) 쉬는 날 + 크리스마스 이브, 선물 고르러 가는 길
  await page.goto("/calendar?m=2026-12");
  await expect(page.getByRole("region", { name: "2026년 12월" }).getByText("성탄절", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "2026년 12월" }).getByText("이브", { exact: true })).toBeVisible();
  await expect(upcoming.getByRole("link", { name: /크리스마스/ })).toHaveAttribute("href", "/people?pick=1&to=gift");
  // 2027년 설날(일요일 2/7): 연휴 2/6~2/9, 대체공휴일 2/9
  await page.goto("/calendar?m=2027-02");
  await expect(upcoming.getByText("설날", { exact: true })).toBeVisible();
  await expect(upcoming.getByText("대체공휴일", { exact: true })).toBeVisible();
  await expect(upcoming.getByText(/4일 연휴/).first()).toBeVisible();
});

test("내 기록 링크로 보내기: 글에는 정보가 없고, 받은 사람이 앱에서 저장할 곳과 있던 값 유지·덮어쓰기를 골라 저장한다", async ({ page, browser }) => {
  const base = test.info().project.use.baseURL!;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  // 나 화면 위쪽의 공유 버튼(사람 화면에는 없다)
  await page.goto("/me");
  const share = page.getByRole("button", { name: "기록 공유하기" });
  await expect(share).toBeVisible();
  expect((await share.boundingBox())!.y).toBeLessThan(120);
  await share.click();
  const dialog = page.getByRole("dialog", { name: "기록 공유" });
  await dialog.getByRole("button", { name: "링크 공유하기" }).click();
  // 공유창이 없는 환경이라 복사한다. 복사된 글에는 짧은 링크와 인사말뿐, 내 정보는 한 줄도 없다
  await expect(dialog.getByRole("button", { name: "링크를 복사했어요" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const path = /\/s\/[A-Za-z0-9]{10}/.exec(copied)?.[0];
  expect(path, copied).toBeTruthy();
  for (const secret of ["복숭아", "오이", "떡볶이", "생일"]) expect(copied).not.toContain(secret);
  await page.keyboard.press("Escape");

  // 보낸 사람이 자기 링크를 열면 받을 수 없다
  await page.goto(path!);
  await expect(page.getByText("내가 보낸 링크예요.")).toBeVisible();

  // 로그인 안 한 사람: 앱에서 열기·앱 받기·로그인만 보이고 내용은 보이지 않는다
  const anon = await browser.newContext({ baseURL: base, locale: "ko-KR" });
  const a = await anon.newPage();
  await a.goto(path!);
  await expect(a.getByText("정보가 도착했어요")).toBeVisible();
  await expect(a.getByRole("link", { name: "앱에서 열기" })).toHaveAttribute("href", `kr.readme.app://${path!.slice(1)}`);
  await expect(a.getByRole("link", { name: "로그인하고 받기" })).toBeVisible();
  await expect(a.getByText("복숭아")).toHaveCount(0);
  await a.goto("/s/ZZZZZZZZZZ");
  await expect(a.getByText("링크를 찾을 수 없어요")).toBeVisible();
  await anon.close();

  // 받는 사람(다른 계정): 받은 내용을 보고, 이미 있는 '엄마'에 저장하면서 덮어쓰기를 고른다
  const other = await browser.newContext({ baseURL: base, locale: "ko-KR" });
  const r = await other.newPage();
  await r.goto("/");
  await r.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(r).toHaveURL(/\/home/);
  await r.goto(path!);
  await expect(r.getByRole("heading", { name: /님이 보낸 정보/ })).toBeVisible();
  await expect(r.getByText("복숭아").first()).toBeVisible();
  // 이름이 다르면 처음에는 '새 사람으로 추가'가 골라져 있고, 물을 것이 없다
  await expect(r.getByRole("radio", { name: "새 사람으로 추가" })).toHaveAttribute("aria-checked", "true");
  await expect(r.getByText("이미 적어 둔 값이 있어요")).toHaveCount(0);
  await r.getByRole("radio", { name: /^엄마/ }).click();
  await expect(r.getByText("이미 적어 둔 값이 있어요")).toBeVisible();
  await expect(r.getByRole("radio", { name: /^있던 값은 그대로/ })).toHaveAttribute("aria-checked", "true");
  await r.getByRole("radio", { name: "받은 값으로 덮어쓰기" }).click();
  await r.getByRole("button", { name: "저장하기" }).click();
  await expect(r).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  await expect(r.getByText("복숭아").first()).toBeVisible();

  // 같은 링크로 새 사람으로도 저장된다(보낸 사람 이름으로)
  await r.goto(path!);
  await r.getByRole("radio", { name: "새 사람으로 추가" }).click();
  await r.getByRole("button", { name: "저장하기" }).click();
  await expect(r).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  await expect(r.getByRole("heading", { level: 1 }).first()).toContainText("데모");
  await other.close();
});

/** multipart 본문에서 파일 부분들의 바이트 */
function multipartFiles(buf: Buffer, contentType: string): Buffer[] {
  const boundary = "--" + (/boundary=(.+)$/.exec(contentType)?.[1] ?? "");
  const parts: Buffer[] = [];
  let pos = buf.indexOf(boundary);
  while (pos >= 0) {
    const next = buf.indexOf(boundary, pos + boundary.length);
    if (next < 0) break;
    const part = buf.subarray(pos + boundary.length, next);
    const head = part.indexOf("\r\n\r\n");
    if (head > 0 && /filename="/.test(part.subarray(0, head).toString("latin1"))) parts.push(part.subarray(head + 4, part.length - 2));
    pos = next;
  }
  return parts;
}

/**
 * 메모 가져오기의 AI 읽기(글 draftImport·사진 draftImportImages 서버 액션 응답)를 정해 둔 줄로 바꿔 끼운다(AI 키·비용 없이).
 * 저장·되돌리기는 그대로 서버로 간다. 돌려주는 함수에 {줄, 이름, error, skipped}를 넘기면 다음 '읽어 보기'가 그 답을 받는다.
 * 함수의 uploads에는 사진 읽기로 올라간 파일들(바이트)이 쌓인다
 */
async function fakeImport(page: import("@playwright/test").Page) {
  let next: { lines: FakeLine[]; name?: string; error?: string; skipped?: number } = { lines: [] };
  const uploads: Buffer[][] = [];
  await page.route("**/import**", async (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
    const type = req.headers()["content-type"] ?? "";
    let draft = false;
    if (type.startsWith("multipart/form-data")) {
      // 사진 읽기: 보낸 사람 한 장 이상 파일(image)이 든 본문. 로그인 같은 다른 폼 서버 액션은 그대로 보낸다
      const body = req.postDataBuffer();
      if (body && /name="_1_image"; filename=/.test(body.toString("latin1"))) {
        draft = true;
        uploads.push(multipartFiles(body, type));
      }
    } else {
      // 글 읽기: 첫 인자가 글, 둘째 인자가 범위. saveImport·undoCapture는 첫 인자가 배열이다
      const args = JSON.parse(req.postData() ?? "[]") as unknown[];
      draft = typeof args[0] === "string" && typeof args[1] === "string";
    }
    if (!draft) return route.continue();
    const lines = next.lines.map((l, idx) => {
      const name = l.target.kind === "new" ? l.target.name : l.spoken;
      const who = l.target.kind === "new" ? { type: "new", contactId: null, name } : l.target.kind === "person" ? { type: "existing", contactId: l.target.id, name: null } : l.target.kind === "me" ? { type: "me", contactId: null, name: null } : { type: "new", contactId: null, name };
      return {
        who: name,
        isNew: l.target.kind === "new",
        op: "add",
        field: l.field,
        value: l.text,
        href: "",
        item: { who, target: l.key, op: "add", text: l.text, codes: null, number: null, date: null, label: null },
        idx,
        target: l.target,
        spoken: l.spoken,
        candidates: l.candidates ?? [],
        ...(l.same ? { same: true } : {}),
      };
    });
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/x-component" },
      body: `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify({ lines, error: next.error ?? null, name: next.name ?? "", skipped: next.skipped ?? 0 })}\n`,
    });
  });
  const set = (v: { lines: (FakeLine & { same?: boolean })[]; name?: string; error?: string; skipped?: number }) => {
    next = v;
  };
  return Object.assign(set, { uploads });
}

/** 홈에 보이는 사람의 id(이름으로 시작하는 첫 링크) */
async function personId(page: import("@playwright/test").Page, name: string) {
  await page.goto("/home");
  const href = await page.getByRole("link", { name: new RegExp(`^${name}`) }).first().getAttribute("href");
  expect(href).toMatch(/^\/people\/[0-9a-f-]{36}$/);
  return href!.split("/").pop()!;
}

/** 시험용 사진: 화면을 찍은 PNG */
async function pngOf(browser: Browser, html: string, width: number, height: number): Promise<Buffer> {
  // 화면 배율 1(프로젝트 기본 기기의 배율 3을 따르면 사진 크기가 세 배가 된다)
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  const p = await ctx.newPage();
  await p.setContent(`<body style="margin:0;font-family:sans-serif">${html}</body>`);
  const png = await p.screenshot();
  await ctx.close();
  return png;
}

test("메모 가져오기: 구슬·사람 추가·편집에서 들어가고, 읽은 것을 사람별로 확인해 없는 것만 더하며, 되돌릴 수 있다", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  const mom = { id: await personId(page, "엄마") };

  // 세 곳의 들어가는 길: 가운데 구슬 화면, 사람 추가, 그 사람 편집
  await page.goto("/voice");
  await expect(page.getByRole("link", { name: "메모 가져오기" })).toHaveAttribute("href", "/import");
  await page.goto("/people/new");
  await expect(page.getByRole("link", { name: "메모 가져오기" })).toHaveAttribute("href", "/import?new=1");
  await page.goto(`/people/${mom.id}/edit`);
  await expect(page.getByRole("link", { name: "메모 가져오기" })).toHaveAttribute("href", `/import?to=${mom.id}`);

  // 넣기: 쓰기·말하기 방법을 고르고, 글이 없으면 읽을 수 없다
  const setDraft = await fakeImport(page);
  await page.goto("/import");
  await expect(page.getByRole("tab", { name: "쓰기" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "말하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "읽어 보기" })).toBeDisabled();
  setDraft({
    lines: [
      { spoken: "엄마", target: { kind: "person", id: mom.id }, key: "safety.allergens", field: "알레르기", text: "새우" },
      { spoken: "엄마", target: { kind: "person", id: mom.id }, key: "sizes.shoe", field: "신발(mm)", text: "235", same: true },
      { spoken: "김 과장님", target: { kind: "new", name: "김 과장님" }, key: "taste.drinks", field: "요즘 마시는 것", text: "아이스 아메리카노" },
    ],
  });
  await page.getByRole("textbox").fill("엄마\n- 새우 알레르기\n\n김 과장님\n커피는 아이스 아메리카노");
  await page.getByRole("button", { name: "읽어 보기" }).click();

  // 확인: 사람별 묶음, 이미 알고 있는 줄은 꺼져 있고, 새 사람 표시가 붙는다
  await expect(page.getByRole("heading", { name: "이렇게 적을까요?" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 3 })).toHaveText(["엄마", "김 과장님"]);
  const rowOf = (text: string) => page.getByRole("checkbox").filter({ hasText: text });
  await expect(rowOf("새우")).toHaveAttribute("aria-checked", "true");
  await expect(rowOf("235")).toHaveAttribute("aria-checked", "false");
  await expect(rowOf("235")).toBeDisabled();
  await expect(page.getByText("새로", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "2줄 적기" })).toBeVisible();
  // 줄을 빼면 저장 수가 줄어든다
  await rowOf("아이스 아메리카노").click();
  await expect(page.getByRole("button", { name: "1줄 적기" })).toBeVisible();
  await rowOf("아이스 아메리카노").click();
  await page.getByRole("button", { name: "2줄 적기" }).click();

  // 저장: 엄마에게 더해지고 새 사람이 생긴다(끝 화면에 두 사람으로 가는 링크)
  await expect(page.getByText("2줄을 적었어요")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "엄마" })).toBeVisible();
  await page.getByRole("link", { name: "김 과장님" }).click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("김 과장님");
  await page.goto(`/people/${mom.id}`);
  await expect(page.getByText("새우").first()).toBeVisible();

  // 되돌리기: 더한 것이 빠지고 새 사람이 사라진다
  await page.goto("/import");
  setDraft({ lines: [{ spoken: "엄마", target: { kind: "person", id: mom.id }, key: "life.hobbies", field: "취미", text: "뜨개질" }] });
  await page.getByRole("textbox").fill("엄마 취미 뜨개질");
  await page.getByRole("button", { name: "읽어 보기" }).click();
  await page.getByRole("button", { name: "1줄 적기" }).click();
  await expect(page.getByText("1줄을 적었어요")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByText("되돌렸어요")).toBeVisible({ timeout: 30_000 });
  await page.goto(`/people/${mom.id}`);
  await expect(page.getByText("뜨개질")).toHaveCount(0);
});

test("메모 가져오기: 사람 추가에서는 한 사람 이야기로 읽어 이름을 정해 새로 만들고, 편집에서는 그 사람 이야기뿐이라 누구인지 묻지 않는다", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  const setDraft = await fakeImport(page);

  // 사람 추가: 읽은 이름이 이름 칸에 들어가고, 비우면 저장할 수 없다
  await page.goto("/import?new=1");
  await expect(page.getByRole("textbox", { name: /한 사람에 대해/ })).toBeVisible();
  setDraft({
    name: "다은이",
    lines: [
      { spoken: "다은이", target: { kind: "new", name: "다은이" }, key: "safety.allergens", field: "알레르기", text: "땅콩" },
      { spoken: "다은이", target: { kind: "new", name: "다은이" }, key: "taste.drinks", field: "요즘 마시는 것", text: "라떼" },
    ],
  });
  await page.getByRole("textbox").fill("다은이 땅콩 알레르기, 라떼 좋아함");
  await page.getByRole("button", { name: "읽어 보기" }).click();
  await expect(page.getByRole("heading", { name: "이렇게 적을까요?" })).toBeVisible({ timeout: 30_000 });
  const name = page.getByLabel("이름이나 부르는 말");
  await expect(name).toHaveValue("다은이");
  await name.fill("");
  await page.getByRole("button", { name: "2줄 적기" }).click();
  await expect(page.getByText("이름을 적어 주세요")).toBeVisible();
  await name.fill("다은");
  await page.getByRole("button", { name: "2줄 적기" }).click();
  await expect(page.getByText("2줄을 적었어요")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("다은");
  await expect(page.getByText("땅콩").first()).toBeVisible();

  // 편집: 그 사람 이야기뿐(범위가 정해져 있어 같은 이름이 둘이어도 고르지 않는다)
  const wife = { id: await personId(page, "아내") };
  await page.goto(`/import?to=${wife.id}`);
  await expect(page.getByRole("textbox", { name: /아내에 대해/ })).toBeVisible();
  setDraft({ lines: [{ spoken: "아내", target: { kind: "person", id: wife.id }, key: "favorites.flowers", field: "꽃", text: "라넌큘러스" }] });
  await page.getByRole("textbox").fill("라넌큘러스 좋아함");
  await page.getByRole("button", { name: "읽어 보기" }).click();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText(["아내"]);
  await page.getByRole("button", { name: "1줄 적기" }).click();
  await expect(page.getByText("1줄을 적었어요")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${wife.id}$`));
  await expect(page.getByText("라넌큘러스").first()).toBeVisible();
});

test("메모 가져오기: 사진 — 이상한 파일은 올리기 전에 걸러 내고, 줄인 JPEG 파일만 보내며, 읽지 못한 사진은 안내하고, 읽은 것만 적는다", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  const mom = await personId(page, "엄마");
  const setDraft = await fakeImport(page);

  // 시험용 사진: 정상 메모(크게), 너무 작은 것, 빈 화면, 너무 긴 것
  const memo = await pngOf(browser, `<div style="padding:28px;background:#fffbe8;height:100%;font-size:30px;line-height:1.5"><b>가족 메모</b><br/>엄마<br/>- 새우 알레르기<br/>- 수국 좋아함</div>`, 2400, 1800);
  const tiny = await pngOf(browser, `<div style="font-size:9px">엄마 수국</div>`, 100, 100);
  const blank = await pngOf(browser, `<div style="background:#fff;height:100%"></div>`, 700, 700);
  const tall = await pngOf(browser, `<div style="padding:20px;font-size:28px">엄마 수국<br/>${"줄<br/>".repeat(60)}</div>`, 400, 2000);

  await page.goto("/import");
  await page.getByRole("tab", { name: "사진" }).click();
  // 개인정보 고지와 못 읽는 상태
  await expect(page.getByText("저장하지 않아요")).toBeVisible();
  await expect(page.getByRole("button", { name: "읽어 보기" })).toBeDisabled();
  const input = page.locator("input[type=file]");
  const problem = async (file: { name: string; mimeType: string; buffer: Buffer }, text: string) => {
    await input.setInputFiles(file);
    await expect(page.getByRole("alert").filter({ hasText: text })).toBeVisible();
    await expect(page.locator("ul img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "읽어 보기" })).toBeDisabled();
  };
  await problem({ name: "memo.png", mimeType: "image/png", buffer: Buffer.from("이건 사진이 아니에요") }, "사진을 열 수 없어요"); // 이름만 사진
  await problem({ name: "memo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") }, "JPG·PNG·WebP 사진만");
  await problem({ name: "tiny.png", mimeType: "image/png", buffer: tiny }, "너무 작아서");
  await problem({ name: "blank.png", mimeType: "image/png", buffer: blank }, "내용이 거의 없는");
  await problem({ name: "tall.png", mimeType: "image/png", buffer: tall }, "너무 길어요");

  // 정상 메모: 줄여서(긴 변 1600 이하, 크기 한도 안, 서버가 받는 JPEG) 한 장 담긴다
  await input.setInputFiles({ name: "memo.png", mimeType: "image/png", buffer: memo });
  await expect(page.locator("ul img")).toHaveCount(1);
  await expect(page.getByRole("alert").filter({ hasText: /사진/ })).toHaveCount(0);
  setDraft({
    skipped: 0,
    lines: [
      { spoken: "엄마", target: { kind: "person", id: mom }, key: "safety.allergens", field: "알레르기", text: "새우" },
      { spoken: "엄마", target: { kind: "person", id: mom }, key: "favorites.flowers", field: "꽃", text: "수국" },
    ],
  });
  await page.getByRole("button", { name: "읽어 보기" }).click();
  await expect(page.getByRole("heading", { name: "이렇게 적을까요?" })).toBeVisible({ timeout: 30_000 });
  expect(setDraft.uploads).toHaveLength(1);
  expect(setDraft.uploads[0]).toHaveLength(1);
  const sent = checkJpegBytes(new Uint8Array(setDraft.uploads[0]![0]!));
  expect(sent.ok).toBe(true);
  if (sent.ok) {
    expect(Math.max(sent.width, sent.height)).toBeLessThanOrEqual(IMAGE_LONG_SIDE);
    expect(sent.bytes).toBeLessThanOrEqual(IMAGE_MAX_BYTES);
    expect(Math.max(sent.width, sent.height)).toBeLessThan(2400); // 원본(2400)보다 줄었다
  }
  expect(setDraft.uploads[0]![0]!.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  // 저장: 읽은 두 줄만 적힌다
  await page.getByRole("button", { name: "2줄 적기" }).click();
  await expect(page.getByText("2줄을 적었어요")).toBeVisible({ timeout: 30_000 });
  await page.goto(`/people/${mom}`);
  await expect(page.getByText("새우").first()).toBeVisible();
});

test("메모 가져오기: 사진 — 읽는 사진이 아니면 아무것도 적지 않고 이유를 알려 주며, 사진은 세 장까지, 일부만 읽혔으면 건너뛴 수를 알려 준다", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  const mom = await personId(page, "엄마");
  const setDraft = await fakeImport(page);
  const note = await pngOf(browser, `<div style="padding:28px;background:#fffbe8;height:100%;font-size:30px">엄마<br/>- 수국 좋아함<br/>- 새우 알레르기</div>`, 720, 900);

  await page.goto("/import");
  await page.getByRole("tab", { name: "사진" }).click();
  const input = page.locator("input[type=file]");

  // 한 번에 네 장을 고르면 세 장까지만 담고 안내한다. 세 장이 차면 고르기 단추가 사라진다
  const four = [1, 2, 3, 4].map((n) => ({ name: `memo${n}.png`, mimeType: "image/png", buffer: note }));
  await input.setInputFiles(four);
  await expect(page.locator("ul img")).toHaveCount(3);
  await expect(page.getByText("사진은 3장까지")).toBeVisible();
  await expect(page.locator("button", { hasText: "사진 고르기" })).toHaveCount(0); // 파일 칸(input)은 접근성에서 단추로 잡혀서 button 태그만 센다
  await page.getByRole("button", { name: "사진 빼기 3" }).click();
  await page.getByRole("button", { name: "사진 빼기 2" }).click();
  await expect(page.locator("ul img")).toHaveCount(1);

  // 읽는 사진이 아니라고 AI가 답한 경우: 이유를 알려 주고, 사진은 그대로 두어 다른 사진으로 바꿀 수 있다
  for (const [error, text] of [
    ["not_memo", "메모나 대화, 문서 사진이 아니에요"],
    ["unreadable", "글씨를 읽을 수 없어요"],
    ["sensitive", "신분증·카드·결제 화면 같은 사진은 읽지 않아요"],
    ["bad_image", "받을 수 없는 사진이에요"],
  ] as const) {
    setDraft({ lines: [], error, skipped: 1 });
    await page.getByRole("button", { name: "읽어 보기" }).click();
    await expect(page.getByRole("alert").filter({ hasText: text })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("ul img")).toHaveCount(1);
  }

  // 두 장 중 한 장만 읽혔다: 읽은 것은 보이고 건너뛴 수를 알려 준다
  await input.setInputFiles({ name: "memo2.png", mimeType: "image/png", buffer: note });
  await expect(page.locator("ul img")).toHaveCount(2);
  setDraft({ skipped: 1, lines: [{ spoken: "엄마", target: { kind: "person", id: mom }, key: "favorites.flowers", field: "꽃", text: "수국" }] });
  await page.getByRole("button", { name: "읽어 보기" }).click();
  await expect(page.getByRole("heading", { name: "이렇게 적을까요?" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("읽지 못한 사진 1장은 건너뛰었어요")).toBeVisible();
  expect(setDraft.uploads.at(-1)).toHaveLength(2);
});

test("메모 가져오기: 말하기 — 마이크가 입력 칸 위에 있고, 누르면 듣고 받아 적은 글이 글 칸에 들어가며, 마이크를 못 쓰면 이유를 알려 준다", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
  // 브라우저 음성 인식을 흉내 낸다(시험 환경에는 마이크가 없다)
  await ctx.addInitScript(() => {
    class Fake {
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (window as unknown as { __rec: Fake }).__rec = this;
        const deny = (window as unknown as { __deny?: boolean }).__deny;
        setTimeout(() => (deny ? this.onerror?.({ error: "not-allowed" }) : this.onstart?.()), 10);
      }
      stop() {
        setTimeout(() => this.onend?.(), 10);
      }
      abort() {
        this.onend?.();
      }
    }
    // 표준 이름(SpeechRecognition)이 있는 브라우저는 그것을 먼저 쓴다: 둘 다 바꿔 끼운다
    (window as unknown as { webkitSpeechRecognition: typeof Fake; SpeechRecognition: typeof Fake }).webkitSpeechRecognition = Fake;
    (window as unknown as { SpeechRecognition: typeof Fake }).SpeechRecognition = Fake;
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.goto("/import");
  await page.getByRole("tab", { name: "말하기" }).click();
  const mic = page.getByRole("button", { name: /눌러서 말하기/ });
  const box = await page.getByRole("textbox").boundingBox();
  const micBox = await mic.boundingBox();
  const bar = await page.locator(".bottom-bar").boundingBox();
  // 작은 화면에서도 마이크가 입력 칸 위에, 아래 단추 줄에 가리지 않고 보인다
  expect(micBox!.y + micBox!.height).toBeLessThanOrEqual(box!.y);
  expect(micBox!.y + micBox!.height).toBeLessThanOrEqual(bar!.y);
  await mic.click();
  await expect(page.getByRole("button", { name: /듣고 있어요/ })).toBeVisible();
  // 말한 글이 글 칸에 들어가고(고칠 수 있다), 이어 말하면 앞의 글 뒤에 붙는다
  await page.evaluate(() => (window as unknown as { __rec: { onresult: (e: unknown) => void } }).__rec.onresult({ results: [[{ transcript: "엄마는 수국을 좋아해" }]] }));
  await expect(page.getByRole("textbox")).toHaveValue("엄마는 수국을 좋아해");
  await page.getByRole("button", { name: /듣고 있어요/ }).click();
  await expect(mic).toBeVisible();
  await expect(page.getByRole("button", { name: "읽어 보기" })).toBeEnabled();
  await mic.click();
  await page.evaluate(() => (window as unknown as { __rec: { onresult: (e: unknown) => void } }).__rec.onresult({ results: [[{ transcript: "아빠는 등산을 좋아해" }]] }));
  await expect(page.getByRole("textbox")).toHaveValue("엄마는 수국을 좋아해\n아빠는 등산을 좋아해");

  // 마이크 허락이 없으면: 이유를 알려 주고 글로 적게 한다(말하기 탭이 글 탭으로)
  await page.getByRole("button", { name: /듣고 있어요/ }).click();
  await page.evaluate(() => ((window as unknown as { __deny: boolean }).__deny = true));
  await page.getByRole("tab", { name: "말하기" }).click();
  await page.getByRole("button", { name: /눌러서 말하기/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "마이크와 음성 인식을 허락해 주세요" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "쓰기" })).toHaveAttribute("aria-selected", "true");
  await ctx.close();
});

test("설정: 명절·챙기는 날 알림 스위치(알림 받기가 켜져 있을 때만 보이고, 끄고 켤 수 있다)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.goto("/privacy", { waitUntil: "networkidle" });
  const sw = page.getByRole("button", { name: "명절·챙기는 날 알림" });
  await expect(sw).toHaveAttribute("aria-pressed", "true");
  // 저장 요청(서버 액션)이 끝난 뒤에 새로 고친다(끝나기 전에 새로 고치면 요청이 끊긴다)
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
  await sw.click();
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  await saved;
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "명절·챙기는 날 알림" })).toHaveAttribute("aria-pressed", "false");
  // 알림 받기를 끄면 이 줄도 숨는다
  await page.getByRole("button", { name: "알림 받기", exact: true }).click();
  await expect(page.getByRole("button", { name: "명절·챙기는 날 알림" })).toHaveCount(0);
});

