import assert from "node:assert/strict";
import test from "node:test";
import { androidIntentUrl } from "../app-link";
import { APP_STORE_URL, playPublic, storeTarget } from "../store";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36";

test("앱 받기: Play가 공개되기 전에는 안드로이드·PC도 막다른 길 대신 웹(next)으로", () => {
  const before = process.env.PLAY_PUBLIC;
  delete process.env.PLAY_PUBLIC;
  try {
    assert.equal(playPublic(), false);
    assert.deepEqual(storeTarget(ANDROID, { source: "answer", next: "/request" }), { url: "/request", os: "android" });
    assert.deepEqual(storeTarget(PC, { source: "share", next: "/" }), { url: "/", os: "other" });
    // 아이폰은 어느 출처든 App Store(앱이 출시돼 있다): 답한 뒤 나도 물어보기가 로그인 화면으로 가던 버그. 주소를 따로 주면 그쪽
    assert.deepEqual(storeTarget(IPHONE, { source: "answer", next: "/request" }), { url: APP_STORE_URL, os: "ios" });
    assert.equal(storeTarget(IPHONE, { source: "share", next: "/" }).url, APP_STORE_URL);
    assert.equal(storeTarget(IPHONE, { source: "share_record", next: "/" }).url, APP_STORE_URL);
    assert.equal(storeTarget(IPHONE, { source: "share", next: "/", appStore: "https://apps.apple.com/kr/app/id1" }).url, "https://apps.apple.com/kr/app/id1");
  } finally {
    if (before === undefined) delete process.env.PLAY_PUBLIC;
    else process.env.PLAY_PUBLIC = before;
  }
});

test("앱 받기: PLAY_PUBLIC=1이면 안드로이드·PC는 Play 스토어(출처 utm 포함)", () => {
  const before = process.env.PLAY_PUBLIC;
  process.env.PLAY_PUBLIC = "1";
  try {
    assert.equal(playPublic(), true);
    const t = storeTarget(ANDROID, { source: "answer", next: "/request" });
    assert.equal(t.os, "android");
    assert.match(t.url, /^https:\/\/play\.google\.com\/store\/apps\/details\?id=kr\.readme\.app&referrer=utm_source%3Danswer/);
    assert.equal(storeTarget(PC, { source: "share", next: "/" }).os, "other");
  } finally {
    if (before === undefined) delete process.env.PLAY_PUBLIC;
    else process.env.PLAY_PUBLIC = before;
  }
});

test("안드로이드에서 앱 열기: 앱이 있으면 앱 화면으로, 없으면 /get 주소로(intent 주소)", () => {
  const url = androidIntentUrl("/request?name=%EC%A7%80%EC%88%98", "https://remember-you.watalabs.com/get?from=answer&next=%2F%3Fnext%3D%252Frequest");
  assert.equal(
    url,
    "intent://request?name=%EC%A7%80%EC%88%98#Intent;scheme=kr.readme.app;package=kr.readme.app;S.browser_fallback_url=https%3A%2F%2Fremember-you.watalabs.com%2Fget%3Ffrom%3Danswer%26next%3D%252F%253Fnext%253D%25252Frequest;end",
  );
  // 앞 슬래시는 한 번만(앱은 kr.readme.app://request 를 /request 로 읽는다), 가운데 ; 가 intent 구분자를 깨지 않는다
  assert.ok(androidIntentUrl("//request", "https://x.test/").startsWith("intent://request#Intent;"));
  const fallback = androidIntentUrl("/request", "https://x.test/a;b=c").match(/S\.browser_fallback_url=([^;]*);end$/)?.[1];
  assert.equal(decodeURIComponent(fallback ?? ""), "https://x.test/a;b=c");
});
