import assert from "node:assert/strict";
import test from "node:test";
import { webGate, webGateEnabled } from "../web-gate-core";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
// 아이패드 '데스크톱 웹사이트 요청' 모드는 맥으로 보인다
const IPAD_DESKTOP_MODE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const APP_IOS = `${IPHONE} ReadmeApp (ios)`;
const APP_ANDROID = `${ANDROID} ReadmeApp (android)`;

const PROD = { vercelEnv: "production", override: undefined, playPublic: false };

test("웹 막기: 운영에서만 켜진다(개발·미리보기 배포는 꺼짐), WEB_GATE로 덮어쓴다", () => {
  assert.equal(webGateEnabled({ vercelEnv: "production" }), true);
  assert.equal(webGateEnabled({ vercelEnv: "preview" }), false);
  assert.equal(webGateEnabled({ vercelEnv: undefined }), false);
  assert.equal(webGateEnabled({ vercelEnv: null, override: "" }), false);
  // on은 어디서든 켜고, off는 운영에서도 끈다(대소문자·공백은 봐준다)
  assert.equal(webGateEnabled({ vercelEnv: undefined, override: "on" }), true);
  assert.equal(webGateEnabled({ vercelEnv: "preview", override: " ON " }), true);
  assert.equal(webGateEnabled({ vercelEnv: "production", override: "off" }), false);
  // 모르는 값은 환경을 따른다
  assert.equal(webGateEnabled({ vercelEnv: "production", override: "1" }), true);
  assert.equal(webGateEnabled({ vercelEnv: undefined, override: "1" }), false);
});

test("웹 막기: 꺼진 환경에서는 어느 브라우저도 막지 않는다", () => {
  for (const ua of [IPHONE, ANDROID, WINDOWS, MAC, null, undefined, ""]) {
    assert.equal(webGate(ua, { vercelEnv: undefined, playPublic: true }), null);
    assert.equal(webGate(ua, { vercelEnv: "preview", playPublic: true }), null);
    assert.equal(webGate(ua, { vercelEnv: "production", override: "off", playPublic: true }), null);
  }
});

test("웹 막기: 아이폰·아이패드와 PC·맥 브라우저는 막는다", () => {
  assert.equal(webGate(IPHONE, PROD), "ios");
  assert.equal(webGate(IPAD, PROD), "ios");
  assert.equal(webGate(WINDOWS, PROD), "desktop");
  assert.equal(webGate(MAC, PROD), "desktop");
  assert.equal(webGate(IPAD_DESKTOP_MODE, PROD), "desktop");
  // UA가 비어도 PC로 본다(로그인한 사람의 요청이라 로봇이 아니다)
  assert.equal(webGate(null, PROD), "desktop");
  assert.equal(webGate("", PROD), "desktop");
});

test("웹 막기: 안드로이드 브라우저는 Play가 공개되기 전에는 막지 않고, 공개되면(PLAY_PUBLIC=1) 막는다", () => {
  assert.equal(webGate(ANDROID, PROD), null);
  assert.equal(webGate(ANDROID, { ...PROD, playPublic: true }), "android");
  // Play 공개 여부는 아이폰·PC에 영향이 없다
  assert.equal(webGate(IPHONE, { ...PROD, playPublic: true }), "ios");
  assert.equal(webGate(WINDOWS, { ...PROD, playPublic: true }), "desktop");
});

test("웹 막기: 앱 안(UA에 ReadmeApp)은 어떤 경우에도 막지 않는다", () => {
  for (const playPublic of [false, true]) {
    assert.equal(webGate(APP_IOS, { ...PROD, playPublic }), null);
    assert.equal(webGate(APP_ANDROID, { ...PROD, playPublic }), null);
    assert.equal(webGate(APP_IOS, { vercelEnv: undefined, override: "on", playPublic }), null);
  }
});

test("웹 막기: WEB_GATE=on이면 개발 환경에서도 같은 규칙으로 막는다", () => {
  const on = { vercelEnv: undefined, override: "on", playPublic: false };
  assert.equal(webGate(IPHONE, on), "ios");
  assert.equal(webGate(WINDOWS, on), "desktop");
  assert.equal(webGate(ANDROID, on), null);
  assert.equal(webGate(ANDROID, { ...on, playPublic: true }), "android");
});
