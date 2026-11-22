// 이용 기록에서 서버·화면이 같이 쓰는 것(서버 전용 아님): 기록 이름, 화면 주소 정리, 기능 이름(통계 화면용)

/** 화면에서 보내는 기록. visit = 이번 방문의 첫 화면(유입 경로를 함께) */
export const CLIENT_EVENTS = ["visit", "page_view", "page_time", "gift_click", "card_share", "review_ask"] as const;

/** 서버(액션)에서 남기는 기능 기록 */
export const SERVER_EVENTS = [
  "gift_picks_view",
  "gift_reroll",
  "card_open",
  "gift_done",
  "capture",
  "me_save",
  "daily_answer",
  "daily_skip",
  "daily_ask",
  "daily_mute",
  "onboarding_done",
  // 가입 직후 직접 해 보는 체험(말로·글로 적기 → 물어보기)
  "tour_view",
  "tour_capture",
  "tour_fail",
  "tour_ask",
  "tour_skip",
  "tour_done",
  "person_add",
  "record_save",
  "note_add",
  "ask_create",
  "ask_answer",
  // 내 기록을 링크로 보내고(share_create), 받은 사람이 자기 사람들에 저장한 것(share_claim)
  "share_create",
  "share_claim",
  // 메모 가져오기: 읽기 요청(import_draft)과 저장(import_save)
  "import_draft",
  "import_save",
  "favorite",
  "folder_create",
  "demo_start",
  "logout",
  "account_delete",
  "account_link",
  "app_get",
] as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[number];
export type ServerEvent = (typeof SERVER_EVENTS)[number];
export type EventName = ClientEvent | ServerEvent;

/** 통계 화면에 보일 기능 이름 */
export const FEATURE_LABEL: Record<string, string> = {
  capture: "말로·글로 적기",
  me_save: "내 기록 저장",
  daily_answer: "오늘의 질문 답",
  daily_skip: "오늘의 질문 건너뜀",
  daily_ask: "오늘의 질문 → 물어보기",
  daily_mute: "오늘의 질문 그만 묻기",
  onboarding_done: "온보딩 끝",
  tour_view: "체험 화면 봄",
  tour_capture: "체험: 말로·글로 적음",
  tour_fail: "체험: 적기 실패",
  tour_ask: "체험: 물어보기 링크 만듦",
  tour_skip: "체험 건너뜀",
  tour_done: "체험 마침",
  person_add: "사람 더하기",
  record_save: "사람 기록 저장",
  note_add: "메모",
  ask_create: "물어보기 링크 만들기",
  ask_answer: "물어보기에 답함",
  share_create: "내 기록 링크 만듦",
  share_claim: "받은 기록 저장",
  import_draft: "메모 가져오기 읽음",
  import_save: "메모 가져오기 저장",
  favorite: "즐겨찾기",
  folder_create: "폴더 만들기",
  demo_start: "데모로 둘러보기",
  logout: "로그아웃",
  account_delete: "계정 삭제",
  gift_picks_view: "선물 추천 봄",
  gift_reroll: "선물 다시 고르기",
  gift_click: "쿠팡 링크 누름",
  card_share: "가족에게 카드 보냄",
  card_open: "가족 카드 열림",
  gift_done: "선물 완료",
  app_get: "앱 받기 누름",
  review_ask: "스토어 리뷰 창 띄움",
};

/** 화면 이름(통계 화면용). 주소 모양 → 이름 */
export const PAGE_LABEL: Record<string, string> = {
  "/": "시작",
  "/login": "로그인",
  "/home": "챙길 날(홈)",
  "/calendar": "달력",
  "/people": "사람들",
  "/people/new": "사람 더하기",
  "/people/:id": "사람",
  "/people/:id/edit": "사람 기록 고치기",
  "/people/:id/edit/:section": "사람 기록 항목",
  "/people/:id/profile": "사람 이름·얼굴",
  "/people/:id/reminder": "선물 힌트(선물 고르기)",
  "/people/folder/:id": "폴더",
  "/me": "나",
  "/me/edit": "내 기록 고치기",
  "/privacy": "설정",
  "/request": "물어보기",
  "/voice": "말로·글로 적기",
  "/plan/gift": "같이 고르기 · 선물",
  "/plan/menu": "같이 고르기 · 메뉴",
  "/onboarding/avatar": "온보딩 1 · 얼굴",
  "/onboarding/food": "온보딩 2 · 음식",
  "/onboarding/birthday": "온보딩 3 · 생일",
  "/r/:token": "물어보기에 답하기",
  "/g/:token": "가족 카드",
  "/gifts": "선물 가이드",
  "/terms": "이용약관",
  "/privacy-policy": "개인정보 처리방침",
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** 화면 주소에서 사람 id·토큰·쿼리를 지운 모양. 통계에 남기지 않을 곳(/admin·/api)은 null */
export function normalizePath(pathname: string): string | null {
  let p = (pathname.split(/[?#]/)[0] ?? "/").replace(/\/+$/, "") || "/";
  if (/^\/(admin|api|_next|_vercel)(\/|$)/.test(p)) return null;
  p = p.replace(UUID, ":id");
  p = p.replace(/^\/(r|g)\/[^/]+/, "/$1/:token");
  p = p.replace(/^\/people\/:id\/edit\/[a-z]+$/, "/people/:id/edit/:section");
  p = p.slice(0, 80);
  return /^\/[A-Za-z0-9:/._-]{0,80}$/.test(p) ? p : null;
}

/** 화면 이름(없으면 주소 모양 그대로). 선물 가이드 하위는 묶는다 */
export function pageLabel(path: string): string {
  if (PAGE_LABEL[path]) return PAGE_LABEL[path]!;
  if (path.startsWith("/gifts/")) return `선물 가이드 · ${path.slice(7)}`;
  return path;
}

// ── 유입 경로·기기 ─────────────────────────────────────────

/** 유입 이름(통계 화면용) */
export const CHANNEL_LABEL: Record<string, string> = {
  direct: "직접(주소 입력·북마크·앱)",
  google: "구글 검색",
  naver: "네이버",
  daum: "다음·카카오 검색",
  bing: "빙",
  kakaotalk: "카카오톡",
  instagram: "인스타그램",
  facebook: "페이스북",
  threads: "스레드",
  x: "X(트위터)",
  youtube: "유튜브",
  band: "밴드",
  blog: "블로그",
  coupang: "쿠팡",
  other: "그 밖의 사이트",
};

const HOST_CHANNEL: [RegExp, string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)naver\.(com|me)$|(^|\.)naver\.net$/, "naver"],
  [/(^|\.)daum\.net$|(^|\.)kakao\.com$/, "daum"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "facebook"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)band\.us$/, "band"],
  [/(^|\.)(tistory\.com|blog\.me|brunch\.co\.kr|medium\.com|velog\.io)$/, "blog"],
  [/(^|\.)coupang\.com$/, "coupang"],
];

/** 어디서 왔는지: utm_source가 있으면 그것, 인앱 브라우저(카톡·인스타·페북)면 그 앱, 아니면 들어온 사이트, 없으면 직접 */
export function channelOf(opts: { referrer: string; url: string; ua: string; ownHost: string }): { source: string; ref: string | null; campaign: string | null } {
  let utmSource: string | null = null;
  let campaign: string | null = null;
  try {
    const u = new URL(opts.url);
    utmSource = u.searchParams.get("utm_source");
    campaign = u.searchParams.get("utm_campaign");
  } catch {
    /* 주소를 못 읽으면 없이 */
  }
  let ref: string | null = null;
  try {
    const host = opts.referrer ? new URL(opts.referrer).hostname.toLowerCase() : "";
    if (host && host !== opts.ownHost) ref = host.slice(0, 80);
  } catch {
    /* 잘못된 referrer */
  }
  const clean = (v: string | null, max: number, re: RegExp) => (v ? v.toLowerCase().replace(re, "_").slice(0, max) || null : null);
  const utm = clean(utmSource, 20, /[^a-z_]/g);
  const camp = campaign ? campaign.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 60) || null : null;
  if (utm) return { source: utm, ref, campaign: camp };
  if (/KAKAOTALK/i.test(opts.ua)) return { source: "kakaotalk", ref, campaign: camp };
  if (/Instagram/i.test(opts.ua)) return { source: "instagram", ref, campaign: camp };
  if (/FBAN|FBAV/i.test(opts.ua)) return { source: "facebook", ref, campaign: camp };
  if (/NAVER\(inapp/i.test(opts.ua)) return { source: "naver", ref, campaign: camp };
  if (!ref) return { source: "direct", ref: null, campaign: camp };
  const hit = HOST_CHANNEL.find(([re]) => re.test(ref!));
  return { source: hit ? hit[1] : "other", ref, campaign: camp };
}

/** 기기 OS·브라우저(인앱 포함). 앱 웹뷰는 browser = app */
export function uaInfo(ua: string | null): { os: "ios" | "android" | "windows" | "mac" | "linux" | "other"; browser: string } {
  const s = ua ?? "";
  const os = /iPhone|iPad|iPod/.test(s) ? "ios" : /Android/.test(s) ? "android" : /Windows/.test(s) ? "windows" : /Macintosh|Mac OS X/.test(s) ? "mac" : /Linux/.test(s) ? "linux" : "other";
  const browser = /ReadmeApp/.test(s)
    ? "app"
    : /KAKAOTALK/i.test(s)
      ? "kakaotalk"
      : /Instagram/i.test(s)
        ? "instagram"
        : /FBAN|FBAV/.test(s)
          ? "facebook"
          : /NAVER\(inapp/i.test(s)
            ? "naver_app"
            : /SamsungBrowser/.test(s)
              ? "samsung"
              : /Whale/.test(s)
                ? "whale"
                : /Edg\//.test(s)
                  ? "edge"
                  : /Firefox|FxiOS/.test(s)
                    ? "firefox"
                    : /CriOS|Chrome\//.test(s)
                      ? "chrome"
                      : /Safari\//.test(s)
                        ? "safari"
                        : "other";
  return { os, browser };
}

export const BROWSER_LABEL: Record<string, string> = {
  app: "기억해유 앱",
  kakaotalk: "카카오톡 안",
  instagram: "인스타그램 안",
  facebook: "페이스북 안",
  naver_app: "네이버 앱 안",
  samsung: "삼성 인터넷",
  whale: "웨일",
  edge: "엣지",
  firefox: "파이어폭스",
  chrome: "크롬",
  safari: "사파리",
  other: "그 밖",
};
