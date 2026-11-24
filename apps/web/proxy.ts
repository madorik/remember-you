import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { LEGACY_HOSTS, SITE_URL } from "@/lib/site";

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

/**
 * 예전 주소(readme.watalabs.com)로 온 브라우저는 지금 주소로 옮긴다(운영 주소가 바뀐 뒤에만).
 * 예전 주소를 띄우는 이미 깔린 앱(웹뷰, 'ReadmeApp')·앱 링크 확인 파일·API는 그대로 둔다
 */
function legacyRedirect(request: NextRequest): NextResponse | null {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!LEGACY_HOSTS.includes(host) || !SITE_URL.startsWith("https://") || new URL(SITE_URL).host === host) return null;
  const { pathname, search } = request.nextUrl;
  if (/ReadmeApp/.test(request.headers.get("user-agent") ?? "") || pathname.startsWith("/api/") || pathname.startsWith("/.well-known/")) return null;
  return NextResponse.redirect(new URL(pathname + search, SITE_URL), 308);
}

export function proxy(request: NextRequest) {
  const moved = legacyRedirect(request);
  if (moved) return moved;
  const { pathname, search } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);
  if (hasSession && pathname === "/" && !request.nextUrl.searchParams.has("next")) {
    // 로그인한 채로 앱을 열면 시작 화면을 그리지(세션 확인 DB 왕복) 않고 바로 홈으로. 온보딩 전이면 홈이 온보딩으로 보낸다.
    // 쿠키가 낡았으면 홈이 /?next=…로 돌려보내고, ?next가 있으면 여기서 다시 튕기지 않으니 돌고 돌지 않는다
    const home = request.nextUrl.clone();
    home.pathname = "/home";
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
