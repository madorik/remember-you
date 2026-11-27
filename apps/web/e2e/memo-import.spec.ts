import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// 메모 쓰기 화면의 '메모 가져오기' 메뉴(app/(app)/voice/ImportMenu.tsx):
// - 웹에는 '사진에서'만, 앱(안드로이드 설치된 메모 앱·iOS 기본 메모)에서는 '메모 앱에서'도. 앱은 진짜 기기 대신 네이티브 다리를 흉내 낸다(addInitScript로만, 운영 코드에 시험용 분기 없음)
// - 사진에서: 고른 사진을 줄여(JPEG) 서버 동작(transcribeMemoImages)에 보내 글만 읽어 오고 본문 뒤에 붙인다. 서버 동작 응답은 정해 둔 값으로 바꿔 끼운다(AI 키·비용 없이)

/** SHOTS=폴더 를 주면 화면을 그 폴더에 저장한다 */
async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

async function demo(browser: Browser, setup?: (page: Page) => Promise<void>) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await setup?.(page);
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  return page;
}

/** 시험용 사진: 화면을 찍은 PNG(글이 보이는 메모 모양) */
async function memoPng(browser: Browser): Promise<Buffer> {
  const ctx = await browser.newContext({ viewport: { width: 600, height: 700 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  const p = await ctx.newPage();
  await p.setContent(`<body style="margin:0;background:#fffbe6;font:bold 44px sans-serif;padding:40px;line-height:1.6">초롱이 마라탕 좋아함<br>신발 240<br>알레르기 새우</body>`);
  const png = await p.screenshot();
  await ctx.close();
  return png;
}

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

interface Answer {
  text?: string;
  error?: string | null;
  skipped?: number;
  /** 답을 늦게 준다(읽는 중 모습을 볼 시간) */
  delayMs?: number;
}

/** 사진 글 읽기 서버 동작(transcribeMemoImages)의 응답을 정해 둔 값으로. 돌려주는 함수에 다음 답을 넘기고, uploads에는 올라간 파일들이 쌓인다 */
async function fakeTranscribe(page: Page) {
  let next: Answer = { text: "" };
  const uploads: Buffer[][] = [];
  await page.route("**/voice**", async (route) => {
    const req = route.request();
    const type = req.headers()["content-type"] ?? "";
    if (req.method() !== "POST" || !req.headers()["next-action"] || !type.startsWith("multipart/form-data")) return route.continue();
    const body = req.postDataBuffer();
    // 사진 읽기: image 파일이 든 본문. 저장 같은 다른 서버 동작은 그대로 보낸다
    if (!body || !/name="[^"]*image"; filename=/.test(body.toString("latin1"))) return route.continue();
    uploads.push(multipartFiles(body, type));
    if (next.delayMs) await new Promise((r) => setTimeout(r, next.delayMs));
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/x-component" },
      body: `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify({ text: next.text ?? "", error: next.error ?? null, skipped: next.skipped ?? 0 })}\n`,
    });
  });
  return Object.assign(
    (a: Answer) => {
      next = a;
    },
    { uploads },
  );
}

interface NativeOptions {
  platform: "android" | "ios";
  /** 안드로이드에 깔린 메모 앱 패키지 */
  apps?: string[];
  /** false면 메모 앱 열기를 넣기 전의 예전 앱 빌드(notesApps·openApp 메서드가 없다) */
  notes?: boolean;
}

/** 네이티브 다리 흉내: 플랫폼, ShareInbox(받은 편지함) 플러그인 헤더·응답. 부른 메서드는 window.__calls, 달아 둔 알림은 window.__fire(이벤트)로 울린다 */
async function fakeNative(page: Page, o: NativeOptions) {
  await page.addInitScript((opts) => {
    const w = window as unknown as Record<string, unknown>;
    const calls: { plugin: string; method: string; options: unknown }[] = [];
    const listeners: Record<string, ((d: unknown) => void)[]> = {};
    let shared: string | null = null;
    w.__calls = calls;
    w.__share = (t: string) => {
      shared = t;
    };
    w.__fire = (plugin: string, event: string) => (listeners[`${plugin}.${event}`] ?? []).forEach((cb) => cb({}));
    if (opts.platform === "android") w.androidBridge = {};
    else w.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
    const promise = (name: string) => ({ name, rtype: "promise" });
    const shareMethods = [promise("take"), ...(opts.notes === false ? [] : [promise("notesApps"), promise("openApp")]), { name: "addListener", rtype: "none" }, { name: "removeListener", rtype: "none" }];
    w.Capacitor = {
      // 진짜 앱에서는 네이티브 다리가 이 둘을 준다(앱 안인지 알아보는 데 쓴다)
      isNativePlatform: () => true,
      getPlatform: () => opts.platform,
      PluginHeaders: [
        { name: "ShareInbox", methods: shareMethods },
        { name: "App", methods: [promise("getInfo"), { name: "addListener", rtype: "none" }, { name: "removeListener", rtype: "none" }] },
      ],
      nativePromise: (plugin: string, method: string, options: unknown) => {
        calls.push({ plugin, method, options });
        if (plugin === "ShareInbox" && method === "take") {
          const text = shared;
          shared = null;
          return Promise.resolve({ text });
        }
        if (plugin === "ShareInbox" && method === "notesApps") return Promise.resolve({ apps: (opts.apps ?? []).map((id: string) => ({ id })) });
        if (plugin === "ShareInbox" && method === "openApp") return Promise.resolve({ opened: true });
        if (plugin === "App" && method === "getInfo") return Promise.resolve({ build: "1" });
        return Promise.resolve({});
      },
      nativeCallback: (plugin: string, method: string, options: { eventName?: string }, cb: (d: unknown) => void) => {
        if (method === "addListener" && options?.eventName) (listeners[`${plugin}.${options.eventName}`] ??= []).push(cb);
        return `cb-${Math.random()}`;
      },
    };
  }, o);
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls: { plugin: string; method: string; options: unknown }[] }).__calls);
const menu = (page: Page) => page.getByRole("menu", { name: "메모 가져오기" });
const trigger = (page: Page) => page.getByRole("button", { name: "메모 가져오기" });

test("메모 가져오기 메뉴(웹): 사진에서만 보이고, 사진을 고르면 줄인 JPEG만 보내 읽은 글을 본문 뒤에 붙이며, 읽지 못하면 이유를 알린다", async ({ browser }) => {
  const page = await demo(browser);
  const set = await fakeTranscribe(page);
  const png = await memoPng(browser);
  await page.goto("/voice");

  // 눌러야 열리고, 웹에는 '사진에서'뿐(메모 앱 열기는 앱 안에서만). 바깥을 누르거나 Esc로 닫힌다
  await expect(menu(page)).toHaveCount(0);
  await trigger(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitem")).toHaveText(["사진에서"]);
  await expect(page.getByRole("menuitem", { name: "메모 앱에서" })).toHaveCount(0);
  await shot(page, "web-menu-empty");
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await trigger(page).click();
  await page.getByRole("textbox", { name: "기억해 둘 것" }).click({ position: { x: 20, y: 20 } });
  await expect(menu(page)).toHaveCount(0);

  // 글을 적으면 알약이 아이콘 단추로 바뀌어도 같은 메뉴가 열린다
  const field = page.getByRole("textbox", { name: "기억해 둘 것" });
  await field.fill("쓰던 글");
  await trigger(page).click();
  await expect(menu(page).getByRole("menuitem")).toHaveText(["사진에서"]);
  await shot(page, "web-menu-with-text");
  await page.keyboard.press("Escape");

  // 사진을 고른다(고르는 창은 파일 칸이 연다): 글 읽는 동안 작은 표시, 다 읽으면 쓰던 글 뒤에 빈 줄을 띄우고 붙는다
  const picker = page.locator('input[type="file"]');
  await expect(picker).toHaveAttribute("accept", "image/*");
  await expect(picker).not.toHaveAttribute("capture", /.*/);
  set({ text: "초롱이 마라탕 좋아함\n신발 240", delayMs: 1200 });
  await picker.setInputFiles({ name: "memo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("status").filter({ hasText: "사진을 읽고 있어요" })).toBeVisible();
  await expect(trigger(page)).toBeDisabled();
  await shot(page, "web-reading");
  await expect(field).toHaveValue("쓰던 글\n\n초롱이 마라탕 좋아함\n신발 240");
  await expect(page.getByRole("status").filter({ hasText: "사진을 읽고 있어요" })).toHaveCount(0);
  await expect(trigger(page)).toBeEnabled();
  // 서버에는 줄여서 다시 만든 JPEG 한 장이 파일로 갔다(원본 PNG가 아니다)
  expect(set.uploads).toHaveLength(1);
  expect(set.uploads[0]).toHaveLength(1);
  expect([...set.uploads[0]![0]!.subarray(0, 2)]).toEqual([0xff, 0xd8]);

  // 읽지 못한 이유는 알림으로 알리고 본문은 그대로
  for (const [error, text] of [
    ["not_memo", "메모나 대화, 문서 사진이 아니에요"],
    ["unreadable", "글씨를 읽을 수 없어요"],
    ["sensitive", "신분증·카드·결제 화면 같은 사진은 읽지 않아요"],
    ["limit", "오늘은 메모 가져오기를 다 썼어요"],
    ["failed", "지금은 메모를 읽지 못했어요"],
  ] as const) {
    set({ error });
    await picker.setInputFiles({ name: "memo.png", mimeType: "image/png", buffer: png });
    await expect(page.getByRole("alert").filter({ hasText: text })).toBeVisible();
    await expect(field).toHaveValue("쓰던 글\n\n초롱이 마라탕 좋아함\n신발 240");
  }
  await shot(page, "web-error");

  // 사진이 아닌 파일·너무 작은 사진은 서버에 보내기 전에 걸린다(서버 동작을 부르지 않는다)
  const before = set.uploads.length;
  await picker.setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("글") });
  await expect(page.getByRole("alert").filter({ hasText: "JPG·PNG·WebP 사진만 올릴 수 있어요" })).toBeVisible();
  expect(set.uploads.length).toBe(before);

  // 한도(1000자)를 넘으면 앞부분만 담고 알린다
  set({ text: "나".repeat(1500) });
  await picker.setInputFiles({ name: "memo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("앞부분 1000자만 담았어요")).toBeVisible();
  expect((await field.inputValue()).length).toBe(1000);

  // 읽어 온 글도 평소처럼 사람을 골라 저장하면 그 사람 메모장에 남는다
  await field.fill("");
  set({ text: "마라탕 좋아함\n신발 240" });
  await picker.setInputFiles({ name: "memo.png", mimeType: "image/png", buffer: png });
  await expect(field).toHaveValue("마라탕 좋아함\n신발 240");
  await page.getByRole("button", { name: "엄마", exact: true }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  await expect(page.getByText("마라탕 좋아함")).toBeVisible();
});

test("메모 가져오기 메뉴(앱): 안드로이드는 깔린 메모 앱만 보여 하나면 바로 열고 여럿이면 고르며, 예전 앱 빌드·메모 앱이 없으면 사진에서뿐이다", async ({ browser }) => {
  // 하나: '메모 앱에서'를 누르면 바로 그 앱을 연다(고르는 목록 없이)
  let page = await demo(browser, (p) => fakeNative(p, { platform: "android", apps: ["com.samsung.android.app.notes"] }));
  await page.goto("/voice");
  await trigger(page).click();
  await expect(menu(page).getByRole("menuitem")).toHaveText(["메모 앱에서", "사진에서"]);
  await page.getByRole("menuitem", { name: "메모 앱에서" }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect.poll(async () => (await calls(page)).filter((c) => c.method === "openApp")).toEqual([{ plugin: "ShareInbox", method: "openApp", options: { id: "com.samsung.android.app.notes" } }]);

  // 여럿(목록 순서대로): 같은 메뉴 안에서 고른다. 모르는 앱은 보이지 않는다
  page = await demo(browser, (p) => fakeNative(p, { platform: "android", apps: ["com.evernote", "com.google.android.keep", "evil.app", "com.samsung.android.app.notes"] }));
  await page.goto("/voice");
  await trigger(page).click();
  await expect(menu(page).getByRole("menuitem")).toHaveText(["메모 앱에서", "사진에서"]);
  await shot(page, "native-menu");
  await page.getByRole("menuitem", { name: "메모 앱에서" }).click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitem")).toHaveText(["메모 앱에서", "삼성 노트", "Keep 메모", "Evernote"]);
  await shot(page, "native-chooser");
  // 뒤로 → 처음 메뉴
  await menu(page).getByRole("menuitem").first().click();
  await expect(menu(page).getByRole("menuitem")).toHaveText(["메모 앱에서", "사진에서"]);
  await page.getByRole("menuitem", { name: "메모 앱에서" }).click();
  await page.getByRole("menuitem", { name: "Keep 메모" }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect.poll(async () => (await calls(page)).filter((c) => c.method === "openApp")).toEqual([{ plugin: "ShareInbox", method: "openApp", options: { id: "com.google.android.keep" } }]);

  // 메모 앱이 하나도 없다 · 메모 앱 열기를 넣기 전의 예전 앱 빌드: 사진에서뿐
  for (const o of [
    { platform: "android" as const, apps: [] },
    { platform: "android" as const, apps: ["com.evernote"], notes: false },
  ]) {
    page = await demo(browser, (p) => fakeNative(p, o));
    await page.goto("/voice");
    await trigger(page).click();
    await expect(menu(page).getByRole("menuitem")).toHaveText(["사진에서"]);
    // 예전 앱 빌드는 없는 메서드를 부르지도 않고, 메모 앱이 없으면 열기는 부르지 않는다
    const used = (await calls(page)).filter((c) => c.method === "notesApps" || c.method === "openApp");
    expect(used.some((c) => c.method === "openApp")).toBe(false);
    expect(used.length > 0).toBe(o.notes !== false);
  }
});

test("메모 가져오기 메뉴(iOS 앱): 새 앱 코드 없이 기본 메모 앱 하나를 연다(메모 앱에서 · 사진에서)", async ({ browser }) => {
  const page = await demo(browser, (p) => fakeNative(p, { platform: "ios", notes: false }));
  await page.goto("/voice");
  await trigger(page).click();
  await expect(menu(page).getByRole("menuitem")).toHaveText(["메모 앱에서", "사진에서"]);
  await shot(page, "ios-menu");
  // 누르면 메뉴가 닫힌다(웹뷰가 mobilenotes:// 로 가려 하면 Capacitor가 휴대폰에 넘긴다. 시험 브라우저는 그 주소를 열 곳이 없어 화면이 그대로다)
  await page.getByRole("menuitem", { name: "메모 앱에서" }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/voice$/);
});

test("메모 앱에서 공유로 돌아오면 쓰던 글·고른 사람이 그대로고 받은 글이 뒤에 붙는다(?to=로 열었어도 그 사람 그대로)", async ({ browser }) => {
  const page = await demo(browser, (p) => fakeNative(p, { platform: "android", apps: ["com.samsung.android.app.notes"] }));
  await page.goto("/home");
  const href = await page.getByRole("link", { name: /^엄마/ }).first().getAttribute("href");
  const id = href!.split("/").pop()!;
  await page.goto(`/voice?to=${id}`);
  const field = page.getByRole("textbox", { name: "엄마에 대해 기억해 둘 것" });
  await field.fill("엄마 생신 선물 고민");
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();

  // 메모 앱을 열러 나갔다가(웹 화면은 그대로 두고) 공유로 글이 들어온다
  await trigger(page).click();
  await page.getByRole("menuitem", { name: "메모 앱에서" }).click();
  await page.evaluate(() => {
    const w = window as unknown as { __share: (t: string) => void; __fire: (p: string, e: string) => void };
    w.__share("삼성 노트에서 가져온 글");
    w.__fire("ShareInbox", "shared");
  });
  await expect(field).toHaveValue("엄마 생신 선물 고민\n\n삼성 노트에서 가져온 글");
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();
  // 받은 글 표시(shared)는 지워지고 ?to=는 남는다: 닫으면 그 사람 화면으로
  await expect(page).toHaveURL(new RegExp(`/voice\\?to=${id}$`));
  await expect(page.getByRole("link", { name: "닫기" })).toHaveAttribute("href", `/people/${id}`);
  expect(await page.evaluate(() => sessionStorage.getItem("rm_shared_memo"))).toBeNull();

  // 그대로 저장하면 엄마 메모장에 한 덩이로 남는다
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}$`));
  await expect(page.getByText("삼성 노트에서 가져온 글")).toBeVisible();
});

test("사람 화면 ··· 메뉴의 '메모 가져오기': 그 사람으로 메모 화면이 열리고 가져오기 메뉴가 열려 있으며, 주소에서 import=1이 지워져 새로고침하면 닫혀 있다", async ({ browser }) => {
  const page = await demo(browser);
  await page.goto("/home");
  const href = await page.getByRole("link", { name: /^엄마/ }).first().getAttribute("href");
  const id = href!.split("/").pop()!;
  await page.goto(`/people/${id}`);

  await page.getByRole("button", { name: "더 보기" }).click();
  const items = page.getByRole("menu", { name: "더 보기" }).getByRole("menuitem");
  // 물어보기 · 선물 고르기 바로 다음, 폴더 · 지우기 앞
  const names = await items.allTextContents();
  expect(names.indexOf("메모 가져오기")).toBe(names.indexOf("선물 고르기") + 1);
  expect(names.indexOf("폴더")).toBe(names.indexOf("메모 가져오기") + 1);
  await shot(page, "person-menu");
  await page.getByRole("menuitem", { name: "메모 가져오기" }).click();

  // 그 사람 그대로(칩) + 메뉴가 열려 있다. import=1은 지워지고 to=는 남는다
  await expect(page).toHaveURL(new RegExp(`/voice\\?to=${id}$`));
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitem", { name: "사진에서" })).toBeVisible();
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "닫기" })).toHaveAttribute("href", `/people/${id}`);
  await shot(page, "person-menu-opened-import");

  // 새로고침하면 다시 열리지 않는다(사람은 그대로)
  await page.reload();
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
});
