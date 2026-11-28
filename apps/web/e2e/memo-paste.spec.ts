import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fakeOrganize, signIn } from "./helpers";

// 메모 쓰기·온보딩 첫 메모의 '복사한 글 붙여 넣기' 알약(app/(app)/voice/PastePill.tsx):
// 메모 앱에서 글을 복사하고 돌아오면 본문 첫 줄에 알약이 뜨고, 누르면 클립보드 글이 본문 뒤에 붙는다.
// 진짜 기기 대신 네이티브 다리·클립보드를 흉내 낸다(addInitScript로만, 운영 코드에 시험용 분기 없음). 나갔다 옴은 visibilitychange(+앱의 appStateChange)를 쏴서 흉내 낸다

/** SHOTS=폴더 를 주면 화면을 그 폴더에 저장한다 */
async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

interface Clip {
  has: boolean;
  /** 클립보드가 바뀔 때마다 달라지는 값 */
  stamp: number;
  text: string | null;
}

interface NativeOptions {
  platform: "android" | "ios";
  apps?: string[];
  /** 앱 안쪽에 클립보드 확인·읽기(hasClipboardText·readClipboard)가 있는 새 빌드 */
  clipboard?: boolean;
  /** 앱 안쪽 클립보드(clipboard 빌드만 쓴다) */
  clip?: Clip;
}

/** 네이티브 다리 흉내: 플랫폼, ShareInbox 플러그인(메모 앱 열기 · 클립보드), App 상태 알림. 부른 메서드는 window.__calls, 클립보드는 window.__clip, 알림은 window.__fire(플러그인, 이벤트, 값) */
async function fakeNative(page: Page, o: NativeOptions) {
  await page.addInitScript((opts) => {
    const w = window as unknown as Record<string, unknown>;
    const calls: { plugin: string; method: string }[] = [];
    const listeners: Record<string, ((d: unknown) => void)[]> = {};
    w.__calls = calls;
    w.__clip = opts.clip ?? { has: false, stamp: 0, text: null };
    w.__fire = (plugin: string, event: string, data: unknown) => (listeners[`${plugin}.${event}`] ?? []).forEach((cb) => cb(data ?? {}));
    if (opts.platform === "android") w.androidBridge = {};
    else w.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
    const promise = (name: string) => ({ name, rtype: "promise" });
    const shareMethods = [promise("take"), promise("notesApps"), promise("openApp"), ...(opts.clipboard ? [promise("hasClipboardText"), promise("readClipboard")] : []), { name: "addListener", rtype: "none" }, { name: "removeListener", rtype: "none" }];
    w.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => opts.platform,
      PluginHeaders: [
        { name: "ShareInbox", methods: shareMethods },
        { name: "App", methods: [promise("getInfo"), { name: "addListener", rtype: "none" }, { name: "removeListener", rtype: "none" }] },
      ],
      nativePromise: (plugin: string, method: string) => {
        calls.push({ plugin, method });
        const clip = w.__clip as { has: boolean; stamp: number; text: string | null };
        if (plugin === "ShareInbox" && method === "take") return Promise.resolve({ text: null });
        if (plugin === "ShareInbox" && method === "notesApps") return Promise.resolve({ apps: (opts.apps ?? []).map((id: string) => ({ id })) });
        if (plugin === "ShareInbox" && method === "openApp") return Promise.resolve({ opened: true });
        if (plugin === "ShareInbox" && method === "hasClipboardText") return Promise.resolve({ has: clip.has, stamp: clip.stamp });
        if (plugin === "ShareInbox" && method === "readClipboard") return Promise.resolve({ text: clip.text });
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

type ReadMode = "text" | "empty" | "fail";

/** 웹의 navigator.clipboard.readText를 정해 둔 값으로(읽은 횟수는 window.__reads) */
async function fakeReadText(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __read: { mode: string; text: string }; __reads: number };
    w.__read = { mode: "text", text: "" };
    w.__reads = 0;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () => {
          w.__reads += 1;
          if (w.__read.mode === "fail") return Promise.reject(new DOMException("denied", "NotAllowedError"));
          return Promise.resolve(w.__read.mode === "empty" ? "" : w.__read.text);
        },
      },
    });
  });
}

const setRead = (page: Page, mode: ReadMode, text = "") => page.evaluate(([m, t]) => void ((window as unknown as { __read: object }).__read = { mode: m, text: t }), [mode, text] as const);
const reads = (page: Page) => page.evaluate(() => (window as unknown as { __reads: number }).__reads);
const setClip = (page: Page, clip: Clip) => page.evaluate((c) => void ((window as unknown as { __clip: Clip }).__clip = c), clip);
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls: { plugin: string; method: string }[] }).__calls);

/** 이 화면을 떠났다(앱 내림·다른 앱·탭 바꿈) / 돌아왔다 */
const setVisible = (page: Page, visible: boolean) =>
  page.evaluate((v) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (v ? "visible" : "hidden") });
    document.dispatchEvent(new Event("visibilitychange"));
    (window as unknown as { __fire?: (p: string, e: string, d: unknown) => void }).__fire?.("App", "appStateChange", { isActive: v });
  }, visible);
const leaveAndReturn = async (page: Page) => {
  await setVisible(page, false);
  await setVisible(page, true);
};

const importTrigger = (page: Page) => page.getByRole("button", { name: "메모 가져오기" });
const pill = (page: Page) => page.getByRole("button", { name: "복사한 글 붙여 넣기" });

/** '메모 앱에서'를 눌러 메모 앱을 열러 나갔다 돌아온다 */
async function hopAndReturn(page: Page) {
  await importTrigger(page).click();
  await page.getByRole("menuitem", { name: "메모 앱에서" }).click();
  await leaveAndReturn(page);
}

async function demo(browser: Browser, setup: (page: Page) => Promise<void>) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await setup(page);
  // 저장 뒤 정리는 진짜 AI 없이(더할 게 없었다)
  await fakeOrganize(page);
  await page.goto("/");
  await page.getByRole("button", { name: "데모로 둘러보기" }).click();
  await expect(page).toHaveURL(/\/home/);
  return page;
}

const body = (page: Page) => page.locator("textarea");

test("복사한 글 붙여 넣기(iOS 앱·예전 빌드): 메모 앱을 열고 돌아왔을 때만 알약이 뜨고, 누르면 쓰던 글 뒤에 빈 줄을 띄워 붙으며 고른 사람은 그대로, 한 번 쓰면 걷힌다", async ({ browser }) => {
  const page = await demo(browser, async (p) => {
    await fakeNative(p, { platform: "ios" });
    await fakeReadText(p);
  });
  await page.goto("/home");
  const href = await page.getByRole("link", { name: /^엄마/ }).first().getAttribute("href");
  const id = href!.split("/").pop()!;
  await page.goto(`/voice?to=${id}`);
  await page.setViewportSize({ width: 390, height: 844 });
  const field = page.getByRole("textbox", { name: "엄마에 대해 기억해 둘 것" });
  await field.fill("쓰던 글");
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();

  // 메모 앱을 열지 않고 탭만 바꿨다 온 것에는 보이지 않는다(클립보드를 미리 볼 수 없는 빌드)
  await leaveAndReturn(page);
  await page.waitForTimeout(600);
  await expect(pill(page)).toHaveCount(0);

  // 메모 앱을 열고 나갔다 오면 본문 첫 줄에 뜬다(웹뷰가 두 신호를 다 보내도 한 번만)
  await setRead(page, "text", "삼성 노트에서 복사한 글\n신발 240");
  await hopAndReturn(page);
  await expect(pill(page)).toBeVisible();
  await expect(pill(page)).toHaveCount(1);
  await shot(page, "paste-pill-ios");
  // 보기만 해서는 클립보드를 읽지 않는다
  expect(await reads(page)).toBe(0);

  // 누르면 그제서야 읽어 쓰던 글 뒤에 빈 줄 하나 띄우고 붙는다. 고른 사람은 그대로, 알약은 걷힌다
  await pill(page).click();
  await expect(field).toHaveValue("쓰던 글\n\n삼성 노트에서 복사한 글\n신발 240");
  await expect(page.getByRole("button", { name: "엄마 빼기" })).toBeVisible();
  await expect(pill(page)).toHaveCount(0);
  expect(await reads(page)).toBe(1);

  // 한 번 열고 나간 길은 한 번만: 그냥 다시 나갔다 오면 또 뜨지 않는다
  await leaveAndReturn(page);
  await expect(pill(page)).toHaveCount(0);

  // 그대로 저장하면 엄마 메모장에 한 덩이로 남는다
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog", { name: "엄마 메모장에 저장했어요" }).getByRole("button", { name: "엄마 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}\\?tab=memo$`));
  await expect(page.getByText("삼성 노트에서 복사한 글")).toBeVisible();
});

test("복사한 글 붙여 넣기: 복사한 글이 없으면 알리고, 못 읽으면 길게 눌러 붙이라 알리며 본문에 커서를 두고, 글을 치기 시작하면 걷히고, 합쳐 1000자를 넘으면 앞부분만 담는다", async ({ browser }) => {
  const page = await demo(browser, async (p) => {
    await fakeNative(p, { platform: "ios" });
    await fakeReadText(p);
  });
  await page.goto("/voice");
  const field = body(page);
  await field.fill("쓰던 글");

  // 비어 있다
  await setRead(page, "empty");
  await hopAndReturn(page);
  await pill(page).click();
  await expect(page.getByRole("status").filter({ hasText: "복사한 글이 없어요" })).toBeVisible();
  await expect(field).toHaveValue("쓰던 글");
  await expect(pill(page)).toHaveCount(0);
  await shot(page, "paste-empty");

  // 못 읽는다(권한·지원 없음): 길게 눌러 붙여 넣으라고 알리고 본문에 커서
  await setRead(page, "fail");
  await hopAndReturn(page);
  await pill(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "본문을 길게 눌러 붙여 넣어 주세요" })).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("쓰던 글");
  await expect(pill(page)).toHaveCount(0);

  // 알약이 떠 있을 때 글을 치기 시작하면 걷힌다
  await hopAndReturn(page);
  await expect(pill(page)).toBeVisible();
  await field.pressSequentially("!");
  await expect(pill(page)).toHaveCount(0);
  await expect(field).toHaveValue("쓰던 글!");

  // 합쳐 1000자를 넘으면 앞에서부터 1000자만 담고 알린다(공유로 받은 글과 같다)
  await setRead(page, "text", "나".repeat(1500));
  await hopAndReturn(page);
  await pill(page).click();
  await expect(page.getByText("앞부분 1000자만 담았어요")).toBeVisible();
  expect((await field.inputValue()).length).toBe(1000);
  expect((await field.inputValue()).startsWith("쓰던 글!\n\n나")).toBe(true);
});

test("복사한 글 붙여 넣기(안드로이드·앱 안쪽 읽기가 없는 예전 빌드): 웹뷰가 클립보드 읽기를 막아서 눌러도 안 되는 알약은 보이지 않는다", async ({ browser }) => {
  const page = await demo(browser, async (p) => {
    await fakeNative(p, { platform: "android", apps: ["com.samsung.android.app.notes"] });
    await fakeReadText(p);
  });
  await page.goto("/voice");
  await hopAndReturn(page);
  // 신호를 처리할 시간을 주고도 없다. 웹의 클립보드 읽기도 부르지 않는다
  await page.waitForTimeout(600);
  await expect(pill(page)).toHaveCount(0);
  expect(await reads(page)).toBe(0);
});

test("복사한 글 붙여 넣기(안드로이드·새 빌드): 앱 안쪽이 클립보드를 읽지 않고 봐서 이 화면을 연 뒤 새로 복사한 글이 있을 때만 뜨고(메모 앱을 안 열었어도), 누르면 앱 안쪽 읽기로 붙으며, 2분 뒤 걷힌다", async ({ browser }) => {
  const page = await demo(browser, async (p) => {
    await fakeNative(p, { platform: "android", apps: ["com.samsung.android.app.notes"], clipboard: true, clip: { has: true, stamp: 100, text: "예전에 복사해 둔 글" } });
    await fakeReadText(p);
  });
  await page.goto("/voice");
  // 이 화면을 열 때 이미 있던 클립보드는 새로 복사한 글이 아니다(열 때 한 번 본다)
  await expect.poll(async () => (await calls(page)).filter((c) => c.method === "hasClipboardText").length).toBeGreaterThan(0);
  await leaveAndReturn(page);
  await page.waitForTimeout(600);
  await expect(pill(page)).toHaveCount(0);

  // 나가 있는 동안 새로 복사했다: 메모 앱을 열고 나간 게 아니어도 뜬다
  await setClip(page, { has: true, stamp: 200, text: "삼성 노트에서 복사한 글\n둘째 줄" });
  await leaveAndReturn(page);
  await expect(pill(page)).toBeVisible();
  await shot(page, "paste-pill-android");
  // 보기만 해서는 글을 읽지 않는다(글을 읽는 건 누른 때뿐)
  expect((await calls(page)).filter((c) => c.method === "readClipboard")).toHaveLength(0);
  await pill(page).click();
  await expect(body(page)).toHaveValue("삼성 노트에서 복사한 글\n둘째 줄");
  // 앱 안쪽 읽기로 읽었고 웹의 읽기는 부르지 않았다
  expect((await calls(page)).filter((c) => c.method === "readClipboard")).toHaveLength(1);
  expect(await reads(page)).toBe(0);
  await expect(pill(page)).toHaveCount(0);

  // 이미 붙인 같은 글은 다시 권하지 않고, 글이 없어진 클립보드에도 뜨지 않는다
  await leaveAndReturn(page);
  await page.waitForTimeout(600);
  await expect(pill(page)).toHaveCount(0);
  await setClip(page, { has: false, stamp: 250, text: null });
  await leaveAndReturn(page);
  await page.waitForTimeout(600);
  await expect(pill(page)).toHaveCount(0);

  // 새로 복사하면 다시 뜨고, 안 쓰면 2분 뒤 걷힌다(시계를 앞으로 돌린다)
  await page.clock.install();
  await setClip(page, { has: true, stamp: 300, text: "또 복사한 글" });
  await leaveAndReturn(page);
  await expect(pill(page)).toBeVisible();
  await page.clock.fastForward("01:50");
  await expect(pill(page)).toBeVisible();
  await page.clock.fastForward("00:20");
  await expect(pill(page)).toHaveCount(0);
});

test("복사한 글 붙여 넣기(온보딩 첫 메모): 앱 안쪽이 새로 복사한 글을 보면 알약이 뜨고, 눌러 붙인 뒤 사람을 고르고 저장할 수 있다", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await fakeNative(page, { platform: "android", clipboard: true, clip: { has: false, stamp: 0, text: null } });
  await fakeOrganize(page);
  await page.goto("/");
  await signIn(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "첫 메모" })).toBeVisible();
  await expect(pill(page)).toHaveCount(0);

  await setClip(page, { has: true, stamp: 7, text: "엄마는 장미꽃을 좋아해" });
  await leaveAndReturn(page);
  await expect(pill(page)).toBeVisible();
  await shot(page, "paste-pill-onboarding");
  await pill(page).click();
  await expect(body(page)).toHaveValue("엄마는 장미꽃을 좋아해");
  await expect(pill(page)).toHaveCount(0);

  // 이어서 평소처럼: 바로 고르는 이름(엄마)을 고르고 저장하면 그 사람 화면에 메모가 남는다
  await page.getByRole("button", { name: "엄마", exact: true }).click();
  await expect(body(page)).toHaveValue("엄마는 장미꽃을 좋아해");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog", { name: "엄마 메모장에 저장했어요" }).getByRole("button", { name: "엄마 보기" }).click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}\?(welcome=1&)?tab=memo$/);
  await expect(page.getByText("엄마는 장미꽃을 좋아해")).toBeVisible();
});
