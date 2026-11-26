// 공유 링크에 쓰는 주소. 운영에서는 NEXT_PUBLIC_SITE_URL을 실제 도메인으로
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3200").replace(/\/+$/, "");

/** 운영 주소. 예전 주소 readme.watalabs.com은 2026-11-26에 뗐다 */
export const PRODUCTION_ORIGINS = ["https://remember-you.watalabs.com"];

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** 로그인 뒤 돌아갈 곳. 같은 사이트 안의 경로만 허용한다(다른 사이트로 튀는 것을 막는다) */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
