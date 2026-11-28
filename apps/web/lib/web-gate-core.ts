import { playPublic } from "./store";

// 웹은 로그인·가입만, 그 뒤는 앱 받기 화면(/app)으로: 어느 기기의 브라우저를 막을지 정하는 순수 함수(서버 코드 없음, 시험에서 바로 돌린다).
// · 앱 안(웹뷰, UA에 'ReadmeApp')은 절대 막지 않는다
// · 아이폰·아이패드(ios)와 PC·맥(desktop) 브라우저는 막는다
// · 안드로이드(android) 브라우저는 Play가 공개되기 전에는 막지 않는다(막으면 받을 곳이 없다). Play가 공개되면(PLAY_PUBLIC=1) 같이 막는다
// · 운영(VERCEL_ENV=production)에서만 켠다. WEB_GATE=on이면 어디서든 켜고(로컬 시험), off면 운영에서도 끈다. 개발 서버·e2e·미리보기 배포는 기본으로 꺼져 있다

export type WebGateKind = "ios" | "desktop" | "android";

export interface WebGateEnv {
  /** process.env.VERCEL_ENV */
  vercelEnv?: string | null;
  /** process.env.WEB_GATE ("on" 켬, "off" 끔, 그 밖은 환경을 따른다) */
  override?: string | null;
  /** lib/store playPublic() */
  playPublic: boolean;
}

/** 이 환경에서 문을 닫는지 */
export function webGateEnabled(env: Pick<WebGateEnv, "vercelEnv" | "override">): boolean {
  const o = (env.override ?? "").trim().toLowerCase();
  if (o === "on") return true;
  if (o === "off") return false;
  return env.vercelEnv === "production";
}

/** 이 브라우저(UA)를 막아야 하면 어느 쪽인지, 아니면 null */
export function webGate(userAgent: string | null | undefined, env: WebGateEnv): WebGateKind | null {
  if (!webGateEnabled(env)) return null;
  const ua = userAgent ?? "";
  if (/ReadmeApp/.test(ua)) return null;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return env.playPublic ? "android" : null;
  return "desktop";
}

/** 지금 서버 환경(VERCEL_ENV·WEB_GATE·PLAY_PUBLIC)으로 이 브라우저(UA)를 막아야 하는지. proxy·서버 화면이 쓴다 */
export function webGateFor(userAgent: string | null | undefined): WebGateKind | null {
  return webGate(userAgent, { vercelEnv: process.env.VERCEL_ENV, override: process.env.WEB_GATE, playPublic: playPublic() });
}
