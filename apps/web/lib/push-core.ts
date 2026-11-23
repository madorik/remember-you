// FCM(HTTP v1) 응답 해석(순수 함수)

type Detail = { errorCode?: unknown; fieldViolations?: { field?: unknown }[] };

/**
 * 이 기기 토큰이 더는 못 쓰는 것이라고 FCM이 말한 응답인지.
 * 404(UNREGISTERED)이거나, 400인데 오류 상세가 UNREGISTERED이거나 '등록 토큰'이 틀렸다고 짚은 INVALID_ARGUMENT일 때만 true.
 * 그 밖의 400(알림 내용·데이터 모양 오류 등)은 토큰이 멀쩡한 것이니 지우면 안 된다
 */
export function fcmTokenGone(status: number, body: unknown): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;
  const error = (body as { error?: { message?: unknown; details?: unknown } } | null)?.error;
  const details = Array.isArray(error?.details) ? (error.details as Detail[]) : [];
  if (details.some((d) => d?.errorCode === "UNREGISTERED")) return true;
  if (!details.some((d) => d?.errorCode === "INVALID_ARGUMENT")) return false;
  // 어느 칸이 틀렸는지가 토큰(message.token)이거나, 메시지가 등록 토큰을 말할 때만
  const onToken = details.some((d) => Array.isArray(d?.fieldViolations) && d.fieldViolations.some((f) => typeof f?.field === "string" && /(^|\.)token$/.test(f.field)));
  return onToken || (typeof error?.message === "string" && /registration token/i.test(error.message));
}

// ── APNs(애플 푸시) 직접 보내기 ─────────────────────────────────
// iOS 앱이 Firebase Messaging 없이 푸시를 등록하면 받는 토큰은 APNs 기기 토큰(16진수 글)이다. Firebase를 붙인 앱은 FCM 토큰(콜론이 든 글)을 받는다.
// 서버는 글 모양으로 가려서, APNs 토큰이면 애플에 직접, 아니면 FCM으로 보낸다.

/** APNs 기기 토큰 모양인가(16진수 64자 이상). FCM 등록 토큰은 ':'가 들어 있어 아니다 */
export function looksLikeApnsToken(token: string): boolean {
  return /^[0-9a-f]{64,}$/i.test(token.trim());
}

/** 애플이 이 기기 토큰은 더 못 쓴다고 한 응답인가: 410(Unregistered)이거나 사유가 BadDeviceToken·Unregistered·DeviceTokenNotForTopic일 때만. 그 밖의 오류(인증·한도·서버)는 토큰이 멀쩡하니 지우면 안 된다 */
export function apnsTokenGone(status: number, reason: unknown): boolean {
  if (status === 410) return true;
  return status === 400 && (reason === "BadDeviceToken" || reason === "Unregistered" || reason === "DeviceTokenNotForTopic");
}

/** 보이는 알림 하나의 APNs 본문(눌렀을 때 열 앱 안 주소는 path) */
export function apnsPayload(title: string, body: string, path: string): { aps: { alert: { title: string; body: string }; sound: string }; path: string } {
  return { aps: { alert: { title, body }, sound: "default" }, path };
}
