import { expect, test, type Locator, type Page } from "@playwright/test";
import { onboard, signIn } from "./helpers";

// 사람 줄 꾹 누르기 → 지우기 메뉴. 사람들 목록(폴더 없음·즐겨찾기·찾은 사람)과 폴더 안 사람 줄에서:
// 꾹 누르면(500ms) 줄 밑에 메뉴, 짧게 누르면 예전처럼 사람 화면, 움직이면 취소, 마우스 오른쪽 단추·Shift+F10도 같은 메뉴,
// 지우기 → 확인 시트 → 서버에서 지우고 줄이 사라진다. 선택 모드·최근 본 사람 줄에는 메뉴가 없다.
// SHOTS=폴더를 주면 열린 메뉴를 390×844로 찍어 둔다.

const SHOTS = process.env.SHOTS;
const HOLD_WAIT = 700;

/** 데모로 들어가(빈 계정) 사람들을 만든다 */
async function start(page: Page, names: string[]) {
  await page.goto("/");
  await signIn(page);
  await onboard(page, { name: "수아" });
  for (const name of names) {
    await page.goto("/people/new");
    await page.getByLabel("이름이나 부르는 말").fill(name);
    await page.getByRole("button", { name: "만들기", exact: true }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
}

const menu = (page: Page) => page.getByRole("menu");
const rowLink = (page: Page, name: string) => page.getByRole("region", { name: "폴더 없음" }).getByRole("link", { name: new RegExp(name) });

async function center(el: Locator) {
  const box = (await el.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** 마우스로 꾹 누른다(떼지는 않는다) */
async function mouseHold(page: Page, el: Locator, ms = HOLD_WAIT) {
  const { x, y } = await center(el);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
}

/** 손가락으로 꾹 누른다(CDP 터치. 떼지는 않는다). moveBy를 주면 누른 뒤 곧바로 그만큼 움직인다 */
async function touchHold(page: Page, el: Locator, opts: { ms?: number; moveBy?: number; after?: number } = {}) {
  const { x, y } = await center(el);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  if (opts.moveBy) {
    await page.waitForTimeout(opts.after ?? 0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + opts.moveBy }] });
  }
  await page.waitForTimeout(opts.ms ?? HOLD_WAIT);
  return { end: () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }) };
}

test("사람들 목록: 꾹 누르면 지우기 메뉴, 짧게 누르면 사람 화면, 움직이면 취소, 지우기는 확인을 거쳐 줄이 사라진다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // 창 크기가 바뀌면 메뉴가 닫히니 처음에 정해 둔다
  await start(page, ["하나", "둘", "셋"]);
  await page.goto("/people");
  await expect(page.getByRole("region", { name: "폴더 없음" })).toBeVisible();

  // 마우스로 꾹: 메뉴가 줄 밑에 뜨고(포커스는 메뉴 안), 떼도 사람 화면으로 가지 않는다
  await mouseHold(page, rowLink(page, "둘"));
  await expect(menu(page)).toBeVisible();
  await expect(menu(page)).toHaveAccessibleName("둘");
  const item = menu(page).getByRole("menuitem", { name: "지우기" });
  await expect(item).toBeFocused();
  await expect(item).toHaveCSS("color", "rgb(200, 40, 58)");
  const rowBox = (await rowLink(page, "둘").boundingBox())!;
  const menuBox = (await menu(page).boundingBox())!;
  expect(menuBox.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height); // 줄 밑
  await page.mouse.up();
  await page.waitForTimeout(150);
  await expect(page).toHaveURL(/\/people$/);
  await expect(menu(page)).toBeVisible();

  // Esc로 닫고 포커스는 그 줄로
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(rowLink(page, "둘")).toBeFocused();

  // 바깥을 누르면 닫는다
  await mouseHold(page, rowLink(page, "둘"));
  await expect(menu(page)).toBeVisible();
  await page.mouse.up();
  await page.mouse.click(10, 300);
  await expect(menu(page)).toHaveCount(0);

  // 짧게 누르면(클릭) 예전처럼 사람 화면
  await rowLink(page, "셋").click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "셋" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/people$/);

  // 움직이면 취소: 누르고 20px 끌면(끌기가 시작된다) 메뉴는 안 뜬다
  const link = rowLink(page, "하나");
  const { x, y } = await center(link);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 20, { steps: 4 });
  await page.waitForTimeout(HOLD_WAIT);
  await expect(menu(page)).toHaveCount(0);
  await page.mouse.up();
  await expect(menu(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/people$/);

  // 손가락으로 꾹: 메뉴가 뜨고, 뗀 뒤에도 사람 화면으로 가지 않는다
  const held = await touchHold(page, rowLink(page, "하나"));
  await expect(menu(page)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/row-menu-people.png` });
  await held.end();
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/people$/);
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);

  // 손가락을 누르고 움직이면(스크롤·끌기) 메뉴가 안 뜬다
  const moved = await touchHold(page, rowLink(page, "하나"), { moveBy: 24, after: 40 });
  await expect(menu(page)).toHaveCount(0);
  await moved.end();
  await expect(menu(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/people$/);

  // 마우스 오른쪽 단추: 같은 메뉴(기본 메뉴 대신)
  await rowLink(page, "하나").click({ button: "right" });
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);

  // 키보드: 줄에 포커스를 두고 Shift+F10(또는 메뉴 키)
  await rowLink(page, "하나").focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitem", { name: "지우기" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(rowLink(page, "하나")).toBeFocused();
  await page.keyboard.press("ContextMenu");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Tab"); // Tab은 닫고 줄로
  await expect(menu(page)).toHaveCount(0);
  await expect(rowLink(page, "하나")).toBeFocused();

  // 지우기 → 확인 시트(취소면 그대로)
  await page.keyboard.press("Shift+F10");
  await menu(page).getByRole("menuitem", { name: "지우기" }).click();
  await expect(menu(page)).toHaveCount(0);
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("하나를 지울까요?");
  await expect(sheet).toContainText("하나의 메모장과 기억해 둔 것");
  await expect(sheet.getByRole("button", { name: "취소" })).toBeFocused();
  await sheet.getByRole("button", { name: "취소" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(rowLink(page, "하나")).toBeVisible();
  await expect(rowLink(page, "하나")).toBeFocused(); // 취소하면 포커스는 그 줄로

  // 지우기 확인: 서버에서 지우고 줄이 사라지며 짧은 알림이 뜬다(새로 고쳐도 없다). 다른 사람은 그대로
  await mouseHold(page, rowLink(page, "하나"));
  await page.mouse.up();
  await menu(page).getByRole("menuitem", { name: "지우기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "지우기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rowLink(page, "하나")).toHaveCount(0);
  await expect(page.getByRole("status").getByText("1명을 지웠어요")).toBeVisible();
  await page.reload();
  await expect(rowLink(page, "하나")).toHaveCount(0);
  await expect(rowLink(page, "둘")).toBeVisible();
  await expect(rowLink(page, "셋")).toBeVisible();
});

test("사람들 목록: 즐겨찾기 줄·찾은 사람 줄에서도 되고, 선택 모드와 최근 본 사람 줄에는 없다", async ({ page }) => {
  await start(page, ["가나", "다라", "마바"]);
  // 즐겨찾기 하나
  await page.goto("/people");
  await rowLink(page, "다라").click();
  await page.getByRole("button", { name: "즐겨찾기", exact: true }).click();
  await expect(page.getByRole("button", { name: "즐겨찾기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/people");

  const fav = page.getByRole("region", { name: "즐겨찾기" });
  await mouseHold(page, fav.getByRole("link", { name: /다라/ }));
  await expect(menu(page)).toBeVisible();
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);

  // 최근 본 사람(둥근 얼굴 줄)에는 메뉴가 없다
  const recent = page.getByRole("region", { name: "최근 본 사람" });
  await expect(recent).toBeVisible();
  await recent.getByRole("link").first().click({ button: "right" });
  await expect(menu(page)).toHaveCount(0);
  await mouseHold(page, recent.getByRole("link").first());
  await expect(menu(page)).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.goto("/people");

  // 찾은 사람 줄
  await page.getByRole("searchbox", { name: "이름이나 태그로 찾기" }).fill("마바");
  const found = page.getByRole("link", { name: /마바/ });
  await expect(found).toBeVisible();
  await mouseHold(page, found);
  await expect(menu(page)).toBeVisible();
  await page.mouse.up();
  await page.waitForTimeout(150);
  await expect(page).toHaveURL(/\/people$/);
  await page.keyboard.press("Escape");
  await page.getByRole("searchbox", { name: "이름이나 태그로 찾기" }).fill("");

  // 선택 모드: 줄은 체크 단추라 꾹 눌러도 메뉴가 없고, 누르면 체크가 바뀐다(예전 그대로)
  await page.getByRole("button", { name: "선택", exact: true }).click();
  const pick = page.getByRole("button", { name: /가나 선택/ });
  await mouseHold(page, pick);
  await expect(menu(page)).toHaveCount(0);
  await page.mouse.up();
  await expect(pick).toHaveAttribute("aria-pressed", "true"); // 꾹 눌러도 그냥 누른 것: 체크가 바뀐다
  await pick.click({ button: "right" });
  await expect(menu(page)).toHaveCount(0);
  await expect(pick).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("toolbar")).toBeVisible();
});

test("폴더 안 사람 줄: 꾹 누르면 지우기 메뉴, 지우면 줄이 사라진다('−'는 폴더에서만 빼기 그대로)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, ["나무", "바다"]);
  await page.goto("/people");
  // 가족 폴더에 두 사람을 넣는다
  await page.getByRole("link", { name: /^가족 / }).click();
  await expect(page.getByRole("heading", { name: "가족" })).toBeVisible();
  await page.getByRole("link", { name: "사람 넣기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /나무/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /바다/ }).click();
  // 비어 있던 폴더라 단추가 'N명 넣기'(이미 사람이 있으면 '완료')
  await page.getByRole("dialog").getByRole("button", { name: /^(2명 넣기|완료)$/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const row = (name: string) => page.getByRole("link", { name: new RegExp(name) });
  await expect(row("나무")).toBeVisible();
  await expect(row("바다")).toBeVisible();

  // 꾹 누르기(손가락): 메뉴가 뜨고 사람 화면으로 가지 않는다
  const held = await touchHold(page, row("나무"));
  await expect(menu(page)).toBeVisible();
  await held.end();
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/people\/folder\//);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/row-menu-folder.png` });
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);

  // 줄 끝 '−'를 꾹 눌러도 메뉴는 안 뜬다(그 단추만 따로)
  const minus = page.getByRole("button", { name: /바다.*빼기/ });
  await mouseHold(page, minus);
  await expect(menu(page)).toHaveCount(0);
  await page.mouse.move(5, 5); // 단추 밖에서 떼면 눌린 게 아니다(바다가 폴더에서 빠지지 않는다)
  await page.mouse.up();
  await page.waitForTimeout(150);
  await expect(row("바다")).toBeVisible();

  // 짧게 누르면 사람 화면
  await row("바다").click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}/);
  await page.goBack();
  await expect(row("나무")).toBeVisible();

  // 마우스 오른쪽 단추 → 지우기 → 확인
  await row("나무").click({ button: "right" });
  await expect(menu(page)).toBeVisible();
  await menu(page).getByRole("menuitem", { name: "지우기" }).click();
  await expect(page.getByRole("dialog")).toContainText("나무를 지울까요?");
  await page.getByRole("dialog").getByRole("button", { name: "지우기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row("나무")).toHaveCount(0);
  await expect(row("바다")).toBeVisible();
  await expect(page.getByRole("status").getByText("1명을 지웠어요")).toBeVisible();
  await expect(page).toHaveURL(/\/people\/folder\//);

  // 사람이 정말 지워졌다(목록에도 없다)
  await page.goto("/people");
  await expect(page.getByRole("link", { name: /나무/ })).toHaveCount(0);
});

test("끌어서 폴더에 넣기는 그대로: 손가락(꾹 눌러 준비 → 움직여 끌기)·마우스로 끌어 놓으면 들어가고, 끌었다고 메뉴가 뜨지는 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, ["봄", "겨울"]);
  await page.goto("/people");
  const folder = page.getByRole("link", { name: /^회사 / });
  await expect(folder).toContainText("0명");

  // 손가락: 꾹(350ms 진동 준비) 눌렀다가 500ms 전에 움직여 끌어다 놓는다
  const a = await center(rowLink(page, "봄"));
  const to = await center(folder);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
  await page.waitForTimeout(430);
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x + ((to.x - a.x) * i) / 6, y: a.y + ((to.y - a.y) * i) / 6 }] });
    await page.waitForTimeout(40);
  }
  await expect(menu(page)).toHaveCount(0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(rowLink(page, "봄")).toHaveCount(0);
  await expect(folder).toContainText("1명");
  await expect(menu(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/people$/);

  // 마우스: 6px 넘게 끌면 집고, 놓으면 들어간다
  const b = await center(rowLink(page, "겨울"));
  const to2 = await center(folder);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(b.x + 10, b.y - 10, { steps: 3 });
  await page.mouse.move(to2.x, to2.y, { steps: 12 });
  await page.mouse.up();
  await expect(rowLink(page, "겨울")).toHaveCount(0);
  await expect(folder).toContainText("2명");
  await expect(menu(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/people$/);
});
