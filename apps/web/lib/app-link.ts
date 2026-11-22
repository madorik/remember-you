import { ANDROID_APP_ID } from "./store";

// 웹 화면에서 '앱 열기'(서버 전용 아님). 앱 주소 kr.readme.app://<화면>은 이미 깔려 있는 앱에도 있다(안드로이드 매니페스트·iOS Info.plist, 앱 안에서는 NativeBridge가 그 화면으로 보낸다)
export const APP_SCHEME = "kr.readme.app";

/**
 * 안드로이드 Chrome·삼성 인터넷·카카오톡 등이 이 앱을 찾아 열고, 앱이 없으면 fallbackUrl로 가는 intent 주소.
 * appPath는 앱 안 화면 주소(/request?name=…), fallbackUrl은 앱이 없을 때 갈 절대 주소(/get…)
 */
export function androidIntentUrl(appPath: string, fallbackUrl: string): string {
  const path = appPath.replace(/^\/+/, "");
  return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_APP_ID};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}
