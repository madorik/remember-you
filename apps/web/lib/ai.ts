import "server-only";
import type { Locale, YMD } from "@readme/core";
import { IMPORT_ITEMS_MAX, captureRequest, importImageRequest, importRequest, parseCapture, parseImportImage, parseTranscript, transcribeImageRequest, type CaptureItem, type CapturePerson, type ImageKind, type ImageReading, type ImageTranscript, type ImportScope } from "./capture-ai";

// 말로 적기: 한 문장을 (누구, 어느 칸, 값) 여러 개로 나눈다. OpenAI Responses API + JSON 스키마(구조화 출력). 요청 몸·응답 풀기는 capture-ai.ts.
// 키(OPENAI_API_KEY)가 없으면 기능을 숨긴다. 모델은 OPENAI_MODEL(기본 gpt-6-luna), 주소는 OPENAI_BASE_URL(기본 api.openai.com/v1, 시험용 가짜 서버로 바꿀 수 있다).

export type { CaptureItem, CapturePerson, ImageKind, ImageReading, ImageTranscript, ImportScope };

export function aiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** 말로 적기의 추론 강도: OPENAI_CAPTURE_EFFORT(none·low·medium·high). 기본 medium. 값싼 쪽(low)으로 내리려면 실제 문장으로 정확도를 견주어 본 뒤에 */
function captureEffort(): "none" | "low" | "medium" | "high" {
  const v = process.env.OPENAI_CAPTURE_EFFORT;
  return v === "none" || v === "low" || v === "medium" || v === "high" ? v : "medium";
}

/** 문장 하나를 나눈다. today는 사용자 시간대의 오늘('다음 주 토요일'을 날짜로 풀 기준, 없으면 한 번만 있는 일정은 만들지 않는다). 실패하면 throw */
export async function classifyCapture(text: string, people: CapturePerson[], locale: Locale, about: CapturePerson | null = null, mentioned: CapturePerson[] = [], today: YMD | null = null): Promise<CaptureItem[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("ai_off");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(captureRequest(text, people, locale, process.env.OPENAI_MODEL || "gpt-6-luna", captureEffort(), about, mentioned, today)),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`ai_http_${res.status}`);
  return parseCapture(await res.json(), new Date(), 12, today ?? undefined);
}

/** 메모 가져오기의 추론 강도: OPENAI_IMPORT_EFFORT(none·low·medium·high). 기본 low(긴 글을 조각마다 훑는 일이라 말로 적기보다 가볍게) */
function importEffort(): "none" | "low" | "medium" | "high" {
  const v = process.env.OPENAI_IMPORT_EFFORT;
  return v === "none" || v === "low" || v === "medium" || v === "high" ? v : "low";
}

/** 메모 한 조각을 읽는다(previous: 앞 조각의 끝, 누구 목록인지 알려 주는 용도). 실패하면 throw */
export async function classifyImport(text: string, previous: string, people: CapturePerson[], locale: Locale, scope: ImportScope): Promise<CaptureItem[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("ai_off");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(importRequest(text, previous, people, locale, scope, process.env.OPENAI_MODEL || "gpt-6-luna", importEffort())),
    // 조각들을 동시에 부르므로 한 조각이 늦어도 이만큼만 기다린다
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`ai_http_${res.status}`);
  return parseCapture(await res.json(), new Date(), IMPORT_ITEMS_MAX);
}

/**
 * 메모 사진 한 장을 읽는다(사진은 data URL, 저장하지 않는다). 읽을 수 없는 종류의 사진이면 accepted=false(항목 없음)로 돌려준다.
 * 사진 모델은 OPENAI_IMPORT_IMAGE_MODEL(없으면 OPENAI_MODEL). 실패하면 throw
 */
export async function classifyImportImage(dataUrl: string, people: CapturePerson[], locale: Locale, scope: ImportScope): Promise<ImageReading> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("ai_off");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_IMPORT_IMAGE_MODEL || process.env.OPENAI_MODEL || "gpt-6-luna";
  const res = await fetch(`${base}/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(importImageRequest(dataUrl, people, locale, scope, model, importEffort())),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`ai_http_${res.status}`);
  return parseImportImage(await res.json(), new Date(), IMPORT_ITEMS_MAX);
}

/**
 * 메모 사진 한 장의 글을 그대로 옮긴다(사진은 data URL, 저장하지 않는다). 메모가 아니거나 읽을 수 없는 사진이면 accepted=false(글 없음).
 * 같은 사진 모델·추론 강도를 쓴다(OPENAI_IMPORT_IMAGE_MODEL·OPENAI_IMPORT_EFFORT). 실패하면 throw
 */
export async function transcribeImage(dataUrl: string, locale: Locale): Promise<ImageTranscript> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("ai_off");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_IMPORT_IMAGE_MODEL || process.env.OPENAI_MODEL || "gpt-6-luna";
  const res = await fetch(`${base}/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(transcribeImageRequest(dataUrl, locale, model, importEffort())),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`ai_http_${res.status}`);
  return parseTranscript(await res.json());
}
