import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// 검색·AI 답변용 공개 화면: 시작 화면의 자주 묻는 질문·선물 가이드 링크, 가이드의 업데이트 날짜·글 구조화 데이터, 사이트맵 수정일.
// 로그인 없이 보는 화면이라 서로 이어진 흐름이 없다(단독으로 돌려도 된다)

type Ld = { "@type": string; [k: string]: unknown };

async function ldOf(page: import("@playwright/test").Page): Promise<Ld[]> {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  return raw.flatMap((s) => [JSON.parse(s)].flat() as Ld[]);
}

test("시작 화면: 자주 묻는 질문(접힌 답도 HTML에 있다)과 선물 가이드 링크, 질문과 같은 글의 FAQPage", async ({ page }) => {
  await page.goto("/");
  const faq = page.getByRole("region", { name: "자주 묻는 질문" });
  await expect(faq).toBeVisible();
  const questions = faq.locator("summary");
  expect(await questions.count()).toBeGreaterThanOrEqual(5);
  // 접혀 있어도 답은 DOM에 있고, 눌러서 펼치면 보인다
  const first = faq.locator("details").first();
  await expect(first.locator("p")).toBeHidden();
  await questions.first().click();
  await expect(first.locator("p")).toBeVisible();
  // 아직 공개 전인 안드로이드 앱을 적지 않는다
  await expect(faq).not.toContainText(/안드로이드|Android/);

  // 선물 가이드로 이어지는 안쪽 길
  const guides = page.getByRole("navigation", { name: "선물 가이드" });
  await expect(guides.getByRole("link", { name: "부모님 선물" })).toHaveAttribute("href", "/gifts/parents");
  await expect(guides.getByRole("link", { name: "모아 보기" })).toHaveAttribute("href", "/gifts");

  // 구조화 데이터: 눈에 보이는 질문과 같은 글, 앱의 설치 주소와 수정일
  const ld = await ldOf(page);
  const faqLd = ld.find((x) => x["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] } | undefined;
  expect(faqLd).toBeTruthy();
  const shown = await questions.allTextContents();
  expect(faqLd!.mainEntity.map((q) => q.name)).toEqual(shown.map((s) => s.trim()));
  const answers = await faq.locator("details p").allTextContents();
  expect(faqLd!.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(answers.map((s) => s.trim()));
  const app = ld.find((x) => x["@type"] === "MobileApplication");
  expect(String(app?.installUrl)).toMatch(/^https:\/\/apps\.apple\.com\//);
  expect(String(app?.dateModified)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("시작 화면: 영어 화면은 영어 질문만(선물 가이드는 한국어 글이라 링크를 두지 않는다)", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto("/");
  const faq = page.getByRole("region", { name: "FAQ" });
  await expect(faq).toBeVisible();
  await expect(faq.locator("summary").first()).toHaveText("What is Remember You?");
  await expect(page.getByRole("navigation", { name: "선물 가이드" })).toHaveCount(0);
  const faqLd = (await ldOf(page)).find((x) => x["@type"] === "FAQPage");
  expect(faqLd?.inLanguage).toBe("en");
  await ctx.close();
});

test("앱 안(UA에 ReadmeApp)에서는 로그인 화면 하나로 두고 질문·가이드 링크·그 구조화 데이터를 내지 않는다", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ReadmeApp (ios)" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /컨닝페이퍼/ }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "자주 묻는 질문" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "선물 가이드" })).toHaveCount(0);
  expect((await ldOf(page)).some((x) => x["@type"] === "FAQPage")).toBe(false);
  await ctx.close();
});

test("선물 가이드: 업데이트 날짜가 보이고, 글 구조화 데이터에 작성·수정일이 있다", async ({ page }) => {
  await page.goto("/gifts/parents");
  const time = page.locator("time[datetime]").first();
  await expect(time).toHaveText(/^\d{4}년 \d{1,2}월 \d{1,2}일 업데이트$/);
  const modified = await time.getAttribute("datetime");
  const ld = await ldOf(page);
  const article = ld.find((x) => x["@type"] === "Article");
  expect(article).toBeTruthy();
  expect(article!.dateModified).toBe(modified);
  expect(String(article!.datePublished)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(String(article!.datePublished) <= String(article!.dateModified)).toBe(true);
  expect((article!.author as { name: string }).name).toBeTruthy();
  // 예전 구조화 데이터와 질문 칸은 그대로
  expect(ld.map((x) => x["@type"])).toEqual(expect.arrayContaining(["BreadcrumbList", "ItemList", "FAQPage"]));
  await expect(page.getByRole("region", { name: "자주 묻는 질문" }).locator("summary").first()).toBeVisible();
});

test("사이트맵: 수정일이 실제 내용을 고친 날이고, 가이드 허브·시작 화면도 들어 있다", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const entries = [...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => ({ loc: m[1]!, lastmod: m[2]! }));
  expect(entries.length).toBeGreaterThanOrEqual(10);
  for (const e of entries) expect(e.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}/);
  const byPath = (p: string) => entries.find((e) => new URL(e.loc).pathname === p);
  expect(byPath("/")).toBeTruthy();
  expect(byPath("/gifts")).toBeTruthy();
  // 가이드 수정일은 처음 낸 날(2026-11-16)에 묶여 있지 않다
  expect(byPath("/gifts/parents")!.lastmod > "2026-11-16").toBe(true);
});

test("IndexNow 키 파일은 로그인 없이 열리고 키와 같은 글이다(로그인해야 보이는 화면은 여전히 막힌다)", async ({ request }) => {
  const key = readFileSync(new URL("../../../scripts/indexnow.mjs", import.meta.url), "utf8").match(/const KEY = "([0-9a-f]{32})"/)?.[1];
  expect(key).toBeTruthy();
  const res = await request.get(`/${key}.txt`, { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect((await res.text()).trim()).toBe(key);
  // 로그인해야 보이는 화면은 그대로 시작 화면으로
  expect((await request.get("/home", { maxRedirects: 0 })).status()).toBe(307);
});
