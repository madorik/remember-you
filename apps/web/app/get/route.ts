import { BRAND, type Locale } from "@readme/core";
import { type NextRequest, NextResponse } from "next/server";
import { OG_IMAGE, siteDescription } from "@/lib/og";
import { absoluteUrl, safeNext } from "@/lib/site";
import { APP_STORE_URL, playPublic, playUrl, storeTarget } from "@/lib/store";
import { isBot, platformOf, track } from "@/lib/track";

// 앱 받기 주소(/get?from=answer&next=/request): 기기에 맞는 스토어로 보낸다(lib/store). 누른 것은 이용 기록으로(어디서 눌렀는지·기기)
// 아이폰은 어느 출처(앱 공유하기 share, 받은 기록 share_record, 답한 뒤 나도 물어보기 answer …)에서 눌렀든 App Store로 보낸다(APP_STORE_URL 환경변수로 다른 주소를 줄 수 있다).
// 안드로이드·PC는 Play가 공개된 뒤(PLAY_PUBLIC=1)에 Play 스토어로, 그 전에는 웹 next로 이어 쓴다
// 링크 미리보기(카카오톡·메신저 등)를 가져가는 로봇은 스토어로 보내면 미리보기가 비므로(Play는 비공개 테스트 중), 제목·설명·이미지만 있는 짧은 페이지를 준다

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** 링크 미리보기 로봇에게 주는 페이지(같은 주소를 사람은 스토어 이동으로 받으므로 캐시하면 안 된다): 앱 소개(제목·설명·이미지)와 스토어 두 곳 링크. 사람은 이 페이지를 거치지 않고 바로 스토어로 간다 */
function sharePreview(request: NextRequest): NextResponse {
  const locale: Locale = /^en/i.test(request.headers.get("accept-language") ?? "") ? "en" : "ko";
  const title = BRAND[locale].title;
  const description = siteDescription(locale);
  const url = absoluteUrl("/get?from=share");
  const image = absoluteUrl(OG_IMAGE.url);
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${escape(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escape(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escape(BRAND[locale].name)}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(url)}">
<meta property="og:locale" content="${locale === "ko" ? "ko_KR" : "en_US"}">
<meta property="og:image" content="${escape(image)}">
<meta property="og:image:width" content="${OG_IMAGE.width}">
<meta property="og:image:height" content="${OG_IMAGE.height}">
<meta property="og:image:alt" content="${escape(BRAND[locale].title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${escape(image)}">
</head><body><p><a href="${escape(APP_STORE_URL)}">App Store</a>${playPublic() ? ` · <a href="${escape(playUrl("share"))}">Google Play</a>` : ""}</p></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", vary: "User-Agent" } });
}

export function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent");
  const q = request.nextUrl.searchParams;
  const from = q.get("from") ?? "";
  const source = /^[a-z_]{2,20}$/.test(from) ? from : "link";
  if (source === "share" && isBot(ua)) return sharePreview(request);
  const { url, os } = storeTarget(ua, { source, next: safeNext(q.get("next"), "/"), appStore: process.env.APP_STORE_URL || undefined });
  if (!isBot(ua)) track("app_get", { source, os, platform: platformOf(ua) });
  return NextResponse.redirect(new URL(url, request.url), 302);
}
