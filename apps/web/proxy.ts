import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { webGateFor } from "@/lib/web-gate-core";

// 로그인해야 보이는 화면은 세션 쿠키가 없으면 시작 화면으로 보낸다(진짜 확인은 각 화면의 getSession이 한다).
// 로그인 없이 열리는 곳: 시작·로그인·물어보기에 답하기(/r)·가족에게 보낸 선물 카드(/g)·링크로 받은 기록(/s, 화면이 로그인을 직접 확인한다)·선물 가이드(/gifts)·우리 통계(/admin, 관리자 키로 화면에서 막는다)
// ·이용 기록 받기(/api/e)·로그인 API·앱 로그인 넘기기·크론·약관류·robots·sitemap·llms.txt·앱 링크 확인 파일·IndexNow 키 파일(public/<32자>.txt)
const PUBLIC = [
  /^\/$/,
  /^\/login/,
  /^\/r\//,
  /^\/g\//,
  /^\/s\//,
  /^\/get$/,
  /^\/gifts(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/api\/e$/,
  /^\/(robots\.txt|sitemap\.xml|llms\.txt)$/,
  /^\/[0-9a-f]{32}\.txt$/,
  /^\/api\/auth\//,
  /^\/auth\//,
  /^\/api\/cron\//,
  /^\/privacy-policy/,
  /^\/terms/,
  /^\/delete-account/,
  /^\/support$/,
  /^\/\.well-known\//,
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);
  if (hasSession && pathname === "/" && !request.nextUrl.searchParams.has("next")) {
    // 로그인한 채로 앱을 열면 시작 화면을 그리지(세션 확인 DB 왕복) 않고 바로 홈으로. 온보딩 전이면 홈이 온보딩으로 보낸다.
    // 쿠키가 낡았으면 홈이 /?next=…로 돌려보내고, ?next가 있으면 여기서 다시 튕기지 않으니 돌고 돌지 않는다
    const home = request.nextUrl.clone();
    // 웹은 로그인·가입만이라 막는 브라우저는 앱 받기 화면으로(앱 안은 그대로 홈). 거기서도 쿠키가 낡았으면 /?next=…로 돌려보내 돌고 돌지 않는다
    home.pathname = webGateFor(request.headers.get("user-agent")) ? "/app" : "/home";
    home.search = "";
    return NextResponse.redirect(home);
  }
  if (PUBLIC.some((p) => p.test(pathname)) || hasSession) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // _vercel: Vercel 웹 분석 스크립트·보내기(로그인 없이 연 화면에서도 모여야 한다)
  matcher: ["/((?!_next/static|_next/image|_vercel|fonts/|favicon|icon|apple-icon|manifest|robots|sw\\.js|og(?:-v\\d+)?\\.png|char-sprite-v\\d+\\.webp).*)"],
};
