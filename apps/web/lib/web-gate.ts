import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { webGateFor } from "./web-gate-core";

// 웹은 로그인·가입만(lib/web-gate-core.ts): 로그인한 사람이 웹 브라우저로 앱 화면을 열면 앱 받기 화면(/app)으로 보낸다.
// 막는 곳: (app) 레이아웃 · 온보딩 · 받은 기록(/s) 로그인 뒤 화면. 로그인 없이 열리는 곳(시작·/r·/gifts·약관·/admin …)과 API는 막지 않는다

export { webGateFor };

/** 웹 브라우저(막는 환경)면 앱 받기 화면으로 보낸다. 앱 안이거나 막지 않는 환경이면 그대로 */
export async function enforceWebGate(): Promise<void> {
  if (webGateFor((await headers()).get("user-agent"))) redirect("/app");
}
