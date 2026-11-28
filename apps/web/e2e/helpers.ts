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

/** 저장 직후 정리(organizeSaved) 서버 동작이 돌려줄 값 */
export interface OrganizeFake {
  state: "ok" | "known" | "nothing" | "ai_off" | "limit" | "failed";
  /** 사람마다 더한 것의 줄(없으면 요청한 메모마다 빈 줄) */
  people?: { contactId: string; noteId: string; lines: { section: string; label: string; value: string; prev?: string }[] }[];
  /** 답을 늦게 준다(정리하는 중 모습을 볼 시간) */
  delayMs?: number;
}

/**
 * 메모를 저장하면 화면이 이어서 부르는 정리 서버 동작(organizeSaved)의 응답을 정해 둔 값으로 바꿔 끼운다(진짜 AI를 부르지 않는다: 서버까지 가지 않는다).
 * 메모 쓰기·온보딩 화면에서 저장하는 시험은 이걸 먼저 달아 둔다. answer는 요청한 메모들(사람 contactId·메모 id)을 받아 돌려줄 값을 정한다(기본: 더할 게 없었다).
 * 돌려주는 calls에는 부른 요청들이 쌓인다
 */
export async function fakeOrganize(page: Page, answer: (notes: { contactId: string; noteId: string }[]) => OrganizeFake | Promise<OrganizeFake> = () => ({ state: "nothing" })) {
  const calls: { contactId: string; noteId: string }[][] = [];
  await page.route(/\/(voice|onboarding)(\?|$)/, async (route) => {
    const req = route.request();
    const data = req.postData() ?? "";
    // 정리 요청만(저장 같은 다른 서버 동작·화면은 그대로): 서버 동작 헤더가 있고 본문에 메모 id가 든다
    if (req.method() !== "POST" || !req.headers()["next-action"] || !data.includes('"noteId"')) return route.fallback();
    const notes = (JSON.parse(data) as [{ contactId: string; noteId: string }[]])[0];
    calls.push(notes);
    const a = await answer(notes);
    if (a.delayMs) await new Promise((r) => setTimeout(r, a.delayMs));
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/x-component" },
      body: `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify({ state: a.state, people: a.people ?? notes.map((n) => ({ ...n, lines: [] })) })}\n`,
    });
  });
  return { calls };
}
