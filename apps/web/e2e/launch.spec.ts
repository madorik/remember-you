import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// 앱(Capacitor 웹뷰, UA에 ReadmeApp)을 처음 켤 때만 서버가 첫 HTML에 움직이는 로딩 덮개를 그린다(components/LaunchOverlay.tsx).
// 웹 브라우저에는 없고, 앱이어도 한 번 보여 준 뒤(전체 새로고침·화면 이동)에는 다시 안 보이며, 사라진 뒤에는 정상으로 눌린다
const APP_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ReadmeApp (ios)";

/** 화면 스크립트를 잠깐 늦춰 덮개가 보이는 구간을 만든다(hydrate가 늦어지는 느린 네트워크) */
async function slowScripts(page: Page, ms: number) {
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

test.describe("앱 첫 실행 로딩 덮개", () => {
  test.use({ userAgent: APP_UA });

  test("처음 켜면 보였다가 사라지고, 그 뒤 새로고침·화면 이동에는 안 보이며, 조작이 막히지 않는다", async ({ page }) => {
    await slowScripts(page, 1500);
    await page.goto("/", { waitUntil: "commit" });
    const boot = page.getByRole("status", { name: "불러오는 중" });
    await expect(boot).toBeVisible();
    // 로고 말고 글자는 없다(스크린리더용 이름만)
    await expect(boot).toHaveText(/^기억해$/);
    // 앱이 hydrate되면 걷힌다
    await expect(boot).toHaveCount(0, { timeout: 20_000 });
    await page.unroute("**/_next/static/**/*.js");

    // 사라진 뒤에는 눌러진다(데모 가입 → 온보딩)
    await signIn(page);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.locator(".ry-boot")).toHaveCount(0);

    // 전체 새로고침해도 이 앱 실행 중에는 처음부터 숨겨져 있다
    await page.reload({ waitUntil: "commit" });
    await expect(page.locator("html")).toHaveClass(/ry-seen/);
    await expect(page.locator(".ry-boot")).toBeHidden();
    await expect(page.getByRole("button", { name: "건너뛰기" })).toBeVisible();
  });
});

test.describe("영어 앱", () => {
  test.use({ userAgent: APP_UA, locale: "en-US" });

  test("스크린리더 이름과 로고 글자가 영어로 나온다", async ({ page }) => {
    await slowScripts(page, 1200);
    await page.goto("/", { waitUntil: "commit" });
    const boot = page.getByRole("status", { name: "Loading" });
    await expect(boot).toBeVisible();
    await expect(boot).toHaveText(/^Remember$/);
    await expect(boot).toHaveCount(0, { timeout: 20_000 });
  });
});

test("웹 브라우저에는 로딩 덮개가 없다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ry-boot")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "불러오는 중" })).toHaveCount(0);
});
