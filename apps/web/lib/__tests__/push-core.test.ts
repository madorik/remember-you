import assert from "node:assert/strict";
import { test } from "node:test";
import { apnsPayload, apnsTokenGone, fcmTokenGone, looksLikeApnsToken } from "../push-core";

const fcm = (errorCode: string, extra: Record<string, unknown> = {}) => ({ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode, ...extra });

test("404는 더 못 쓰는 토큰", () => {
  assert.equal(fcmTokenGone(404, null), true);
  assert.equal(fcmTokenGone(404, { error: { status: "NOT_FOUND", details: [fcm("UNREGISTERED")] } }), true);
});

test("400 + UNREGISTERED는 더 못 쓰는 토큰", () => {
  assert.equal(fcmTokenGone(400, { error: { code: 400, details: [fcm("UNREGISTERED")] } }), true);
});

test("400 + INVALID_ARGUMENT가 등록 토큰(message.token)을 짚으면 못 쓰는 토큰", () => {
  const body = {
    error: {
      code: 400,
      status: "INVALID_ARGUMENT",
      message: "The registration token is not a valid FCM registration token",
      details: [{ "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: [{ field: "message.token" }] }, fcm("INVALID_ARGUMENT")],
    },
  };
  assert.equal(fcmTokenGone(400, body), true);
  // 필드 정보 없이 메시지만 토큰을 말해도
  assert.equal(fcmTokenGone(400, { error: { message: "The registration token is not a valid FCM registration token", details: [fcm("INVALID_ARGUMENT")] } }), true);
});

test("400이라도 알림 내용·데이터 오류는 멀쩡한 토큰이니 지우지 않는다", () => {
  const payload = {
    error: {
      code: 400,
      status: "INVALID_ARGUMENT",
      message: "Invalid value at 'message.data[0].value'",
      details: [{ "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: [{ field: "message.data[0].value" }] }, fcm("INVALID_ARGUMENT")],
    },
  };
  assert.equal(fcmTokenGone(400, payload), false);
  assert.equal(fcmTokenGone(400, null), false);
  assert.equal(fcmTokenGone(400, {}), false);
  assert.equal(fcmTokenGone(400, { error: { details: "x" } }), false);
});

test("그 밖의 상태(401·403·429·5xx)는 토큰 문제가 아니다", () => {
  for (const status of [401, 403, 429, 500, 503]) assert.equal(fcmTokenGone(status, { error: { details: [fcm("UNREGISTERED")] } }), false);
});

test("APNs 토큰 모양: 16진수 64자 이상만, FCM 등록 토큰(콜론)은 아니다", () => {
  assert.equal(looksLikeApnsToken("a".repeat(64)), true);
  assert.equal(looksLikeApnsToken("0123456789ABCDEF".repeat(4)), true);
  assert.equal(looksLikeApnsToken("a".repeat(63)), false);
  assert.equal(looksLikeApnsToken(`${"d".repeat(22)}:APA91bH${"x".repeat(100)}`), false);
  assert.equal(looksLikeApnsToken(""), false);
});

test("APNs: 410이나 못 쓰는 토큰 사유만 토큰을 지운다", () => {
  assert.equal(apnsTokenGone(410, "Unregistered"), true);
  assert.equal(apnsTokenGone(410, undefined), true);
  assert.equal(apnsTokenGone(400, "BadDeviceToken"), true);
  assert.equal(apnsTokenGone(400, "DeviceTokenNotForTopic"), true);
  // 인증·내용·한도·서버 오류는 토큰이 멀쩡하다
  assert.equal(apnsTokenGone(403, "InvalidProviderToken"), false);
  assert.equal(apnsTokenGone(400, "PayloadEmpty"), false);
  assert.equal(apnsTokenGone(429, "TooManyRequests"), false);
  assert.equal(apnsTokenGone(500, "InternalServerError"), false);
});

test("APNs 본문: 제목·내용은 aps.alert, 열 주소는 맨 위 path", () => {
  assert.deepEqual(apnsPayload("엄마님이 답했어요", "열어 보세요", "/people/abc"), { aps: { alert: { title: "엄마님이 답했어요", body: "열어 보세요" }, sound: "default" }, path: "/people/abc" });
});
