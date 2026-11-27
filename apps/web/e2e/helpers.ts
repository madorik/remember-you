import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [m[1]!, m[2]!]),
);

export const CRON_SECRET = env.CRON_SECRET!;
export const ADMIN_KEY = env.ADMIN_KEY;

/** 데모 로그인(샘플 없이 빈 계정). 지금 화면에 로그인 버튼이 있어야 한다. ?demo=empty는 개발 서버에서만 먹는다 */
export async function signIn(page: Page) {
  const url = new URL(page.url());
  url.searchParams.set("demo", "empty");
  await page.goto(url.toString());
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await page.waitForURL((u) => !u.searchParams.has("demo"));
}

/**
 * 가입 직후의 온보딩(첫 메모 화면)은 건너뛰고 홈으로, 그 뒤 테스트가 쓸 내 기록(이름 · 알레르기 · 안 먹는 것 · 생일)은 내 화면에서 직접 채운다.
 * 첫 메모를 쓰는 흐름은 따로 시험한다(flows.spec.ts의 "가입 직후 첫 메모")
 */
export async function onboard(page: Page, opts: { name: string; allergy?: string; dislike?: string; lunar?: { month: number; day: number }; solar?: { month: number; day: number } }) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page).toHaveURL(/\/home$/);

  // 이름(내 프로필)
  await page.goto("/me/avatar");
  await page.getByLabel("닉네임").fill(opts.name);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/me$/);

  // 알레르기 · 안 먹는 것
  if (opts.allergy || opts.dislike) {
    await page.goto("/me/edit/safety");
    if (opts.allergy) await page.getByRole("button", { name: opts.allergy, exact: true }).first().click();
    if (opts.dislike) await page.getByRole("button", { name: opts.dislike, exact: true }).first().click();
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("저장했어요.", { exact: true })).toBeVisible();
  }

  // 생일(음력이면 음력으로)
  const date = opts.lunar ?? opts.solar;
  if (date) {
    await page.goto("/me/edit/dates");
    if (opts.lunar) await page.getByRole("radio", { name: "음력" }).click();
    await page.getByLabel("월").selectOption(String(date.month));
    await page.getByLabel("일").selectOption(String(date.day));
    if (opts.lunar) await expect(page.getByText(/올해는 양력/)).toBeVisible();
    if (process.env.SHOTS && opts.lunar) await page.screenshot({ path: `${process.env.SHOTS}/00-birthday.png`, fullPage: true });
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("저장했어요.", { exact: true })).toBeVisible();
  }
  await page.goto("/home");
}
