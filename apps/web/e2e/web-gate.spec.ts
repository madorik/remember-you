import { expect, test, type Browser, type Page } from "@playwright/test";
import { ko } from "@readme/core";
import { ADMIN_KEY, signIn } from "./helpers";

// 웹은 로그인·가입만(lib/web-gate-core.ts): 웹 브라우저로 로그인하면 앱 화면 대신 앱 받기 화면(/app)으로 간다.
// 개발 서버는 기본으로 막지 않으니 이 파일은 WEB_GATE=on으로 띄운 서버에서만 돈다. 예:
//   WEB_GATE=on NEXT_PUBLIC_SITE_URL=http://localhost:3202 npx next dev --port 3202 --webpack
//   WEB_GATE=on E2E_BASE_URL=http://localhost:3202 npx playwright test e2e/web-gate.spec.ts
// (Play 공개 전이라 PLAY_PUBLIC은 비워 둔다: 안드로이드 브라우저는 막지 않는다)
test.skip(process.env.WEB_GATE !== "on", "WEB_GATE=on으로 띄운 서버에서만");

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const APP_UA = `${IPHONE_UA} ReadmeApp (ios)`;
const SHOTS = process.env.SHOTS;
const DESKTOP = { userAgent: DESKTOP_UA, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 } as const;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/** 시작 화면에서 데모로 로그인한다(웹 브라우저면 곧바로 앱 받기 화면으로 보내진다) */
async function login(page: Page) {
  await page.goto("/");
  await signIn(page);
}

/** 앱 받기 화면의 아래가 아래 막대·화면 끝에 잘리지 않는다: 맨 아래 링크가 화면 안에 있고 그 아래 여유가 있다 */
async function expectBottomClear(page: Page, safeBottom = 0) {
  const link = page.getByRole("link", { name: "계정 삭제 안내" });
  await link.scrollIntoViewIfNeeded();
  const box = (await link.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y + box.height).toBeLessThanOrEqual(vh - safeBottom - 11);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

test.describe("아이폰 브라우저", () => {
  // 아이폰 화면 한 장(390×844)
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 } });

  test("로그인하면 앱 받기 화면으로 가고, 앱 화면은 모두 거기로 돌려보낸다", async ({ page, request }) => {
    await login(page);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: ko["webGate.title"] })).toBeVisible();
    // 아이폰은 큰 App Store 단추 하나(/get이 기기에 맞는 스토어로 보낸다), QR·Play는 없다
    const store = page.getByRole("link", { name: ko["webGate.appStore"] });
    await expect(store).toHaveAttribute("href", "/get?from=web_gate");
    expect((await store.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    await expect(page.getByRole("img", { name: ko["privacy.shareAppQr"] })).toHaveCount(0);
    await expect(page.getByRole("link", { name: ko["webGate.googlePlay"] })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
    await expect(page.getByRole("link", { name: "계정 삭제 안내" })).toHaveAttribute("href", "/delete-account");
    // 관리자 계정이 아니라 관리자 링크는 없다
    await expect(page.getByRole("link", { name: "관리자" })).toHaveCount(0);
    await expectBottomClear(page);
    // 아래 홈 막대(안전 영역 34px)가 있어도 맨 아래 링크가 가려지지 않는다
    await page.evaluate(() => document.documentElement.style.setProperty("--safe-area-inset-bottom", "34px"));
    await expectBottomClear(page, 34);
    await page.evaluate(() => document.documentElement.style.removeProperty("--safe-area-inset-bottom"));
    await shot(page, "ios-app");
    // 단추는 아이폰이면 App Store로 이어진다
    const go = await request.get("/get?from=web_gate", { headers: { "user-agent": IPHONE_UA }, maxRedirects: 0 });
    expect(go.headers().location).toMatch(/^https:\/\/apps\.apple\.com\//);

    // 앱 화면·온보딩은 어디로 들어가도 앱 받기 화면으로
    for (const path of ["/home", "/people", "/people/new", "/voice", "/onboarding", "/onboarding/avatar", "/me", "/privacy", "/calendar", "/request", "/import"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/app$/);
      await expect(page.getByRole("heading", { name: ko["webGate.title"] })).toBeVisible();
    }
    // 로그인한 채 시작 화면을 열어도 앱 받기 화면으로(홈을 거치지 않는다)
    await page.goto("/");
    await expect(page).toHaveURL(/\/app$/);

    // 로그아웃하면 시작 화면
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /사랑하는 사람들의/ })).toBeVisible();
    // 로그인 전에 /app을 열면 시작 화면(로그인하고 오면 다시 여기)
    await page.goto("/app");
    await expect(page).toHaveURL(/\/\?next=%2Fapp$/);
  });

  test.describe("영어", () => {
    test.use({ locale: "en-US" });
    test("영어로 나온다", async ({ page }) => {
      // 영어 화면의 데모 단추 이름은 'Try the demo'라 직접 누른다
      await page.goto("/?demo=empty");
      await page.getByRole("button", { name: "Try the demo" }).click();
      await page.waitForURL((u) => !u.searchParams.has("demo"));
      await expect(page).toHaveURL(/\/app$/);
      await expect(page.getByRole("heading", { name: "Remember You lives in the app" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Get it on the App Store" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByRole("link", { name: "How to delete your account" })).toBeVisible();
      await shot(page, "ios-app-en");
    });
  });

  test("로그인 없이 열리는 곳은 그대로 열린다(선물 가이드·약관·삭제 안내·지원·받은 기록·통계)", async ({ page, request }) => {
    for (const [path, name] of [
      ["/gifts", /줄까요/],
      ["/privacy-policy", /개인정보/],
      ["/terms", /이용약관/],
      ["/delete-account", /계정 삭제/],
      ["/support", /./],
    ] as const) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page, path).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 }).first(), path).toContainText(name);
    }
    // 받은 기록 링크는 로그인 전에 앱 열기·앱 받기·로그인을 보여 주는 화면이다(없는 링크도 막다른 길이 아니라 안내 글)
    const share = await page.goto("/s/ABCDEFGHJK");
    expect(share?.status()).toBe(200);
    await expect(page).toHaveURL(/\/s\/ABCDEFGHJK$/);
    // 통계는 관리자 키 화면
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByPlaceholder("관리자 키")).toBeVisible();
    for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/llms.txt"]) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
    }
  });

  test("가입 직후 로그인한 사람도 선물 가이드·통계(관리자 키)·로그인 화면은 그대로 열린다", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/gifts");
    await expect(page).toHaveURL(/\/gifts$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByPlaceholder("관리자 키")).toBeVisible();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("물어보기 링크(/r)는 웹에서 로그인 없이 답할 수 있다", async ({ browser }) => {
    const url = await makeAskLink(browser);
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(url);
    await expect(guest).toHaveURL(/\/r\//);
    await expect(guest.getByText("설치 없이 답하는 중")).toBeVisible();
    await expect(guest.getByRole("heading", { name: /궁금하대요/ })).toBeVisible();
    await guest.close();
  });
});

test.describe("PC 브라우저", () => {
  test.use(DESKTOP);

  test("QR과 스토어 링크가 있는 앱 받기 화면", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: ko["webGate.title"] })).toBeVisible();
    // 폰 카메라로 찍는 QR(/get?from=web_gate)과 한 줄 안내, App Store 링크(Play는 공개 전이라 없다)
    const qr = page.getByRole("img", { name: ko["privacy.shareAppQr"] });
    await expect(qr).toBeVisible();
    expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(200);
    await expect(page.getByText(ko["webGate.scan"])).toBeVisible();
    await expect(page.getByRole("link", { name: ko["webGate.appStore"] })).toHaveAttribute("href", /^https:\/\/apps\.apple\.com\//);
    await expect(page.getByRole("link", { name: ko["webGate.googlePlay"] })).toHaveCount(0);
    await expectBottomClear(page);
    await shot(page, "desktop-app");
    await page.goto("/home");
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("통계(/admin)는 PC에서 관리자 키로 그대로 들어간다", async ({ page }) => {
    test.skip(!ADMIN_KEY, "ADMIN_KEY가 없는 개발 환경");
    await page.goto("/admin");
    await page.getByPlaceholder("관리자 키").fill(ADMIN_KEY!);
    await page.getByRole("button", { name: "들어가기" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "앱으로 이동하기" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "요약", exact: true })).toBeVisible();
  });
});

test.describe("안드로이드 브라우저(Play 공개 전)", () => {
  test.use({ userAgent: ANDROID_UA });

  test("막지 않는다: 가입하면 평소처럼 온보딩으로, /app은 홈으로", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("button", { name: "건너뛰기" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await page.goto("/people");
    await expect(page).toHaveURL(/\/people$/);
  });
});

test.describe("앱 안(ReadmeApp)", () => {
  test.use({ userAgent: APP_UA });

  test("어떤 경우에도 막지 않는다", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("button", { name: "건너뛰기" }).click();
    await expect(page).toHaveURL(/\/home$/);
    for (const path of ["/people", "/voice", "/me", "/privacy"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(new RegExp(`${path}$`));
    }
    // 앱 받기 화면은 앱 안에서는 쓸 일이 없어 홈으로
    await page.goto("/app");
    await expect(page).toHaveURL(/\/home$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/home$/);
  });
});

/** 앱 안(막지 않는 곳)에서 새 사람에게 물어보기 링크를 만든다(웹 브라우저로는 물어보기 화면에 못 들어가서) */
async function makeAskLink(browser: Browser): Promise<string> {
  const ctx = await browser.newContext({ userAgent: APP_UA });
  const page = await ctx.newPage();
  await page.goto("/");
  await signIn(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/request");
  await page.locator("#request-who").fill("아빠");
  await page.getByRole("button", { name: "아빠 새로" }).click();
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "링크 복사", exact: true }).click();
  await expect(sheet.getByRole("button", { name: ko["common.copied"], exact: true })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const url = /https?:\/\/\S+\/r\/[A-Za-z0-9_-]{40,}/.exec(copied)?.[0] ?? "";
  expect(url, copied).toMatch(/\/r\/[A-Za-z0-9_-]{40,}/);
  await ctx.close();
  return url;
}
