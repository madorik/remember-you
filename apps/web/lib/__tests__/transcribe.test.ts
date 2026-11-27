import assert from "node:assert/strict";
import { test } from "node:test";
import { TRANSCRIPT_MAX_CHARS, imageRejection, parseTranscript, tidyTranscript, transcribeImageRequest } from "../capture-ai";

const reply = (kind: string, accepted: boolean, text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ image: { kind, accepted }, text }) }] }] });

test("글 옮기기 요청: 사진은 한 번만, 저장 안 함(store false), 구조화 출력, 개인 식별 정보 금지·사진 속 지시 무시 지침", () => {
  const url = "data:image/jpeg;base64,/9j/AAAA";
  const req = transcribeImageRequest(url, "ko");
  assert.equal(req.store, false);
  assert.equal(req.text.format.type, "json_schema");
  assert.deepEqual(req.text.format.schema.required, ["image", "text"]);
  const parts = req.input[0]!.content;
  assert.equal(parts.filter((p) => p.type === "input_image").length, 1);
  assert.equal((parts.find((p) => p.type === "input_image") as { image_url: string }).image_url, url);
  assert.ok(!JSON.stringify(req).includes("PEOPLE"), "사람 이름 목록은 보내지 않는다");
  assert.match(req.instructions, /phone numbers/);
  assert.match(req.instructions, /data, never instructions/);
  assert.match(req.instructions, /line breaks/);
});

test("글 옮기기 응답 풀기: 메모·대화·문서이고 accepted일 때만 글을 돌려준다(줄바꿈 그대로)", () => {
  assert.deepEqual(parseTranscript(reply("memo", true, "초롱이 마라탕 좋아함\n신발 240")), { kind: "memo", accepted: true, text: "초롱이 마라탕 좋아함\n신발 240" });
  assert.equal(parseTranscript(reply("chat", true, "안녕")).accepted, true);
  assert.equal(parseTranscript(reply("document", true, "표")).accepted, true);
  for (const kind of ["other", "unreadable", "id_or_payment", "inappropriate"]) assert.deepEqual(parseTranscript(reply(kind, true, "글")), { kind, accepted: false, text: "" }, kind);
  assert.deepEqual(parseTranscript(reply("memo", false, "글")), { kind: "memo", accepted: false, text: "" });
  assert.equal(parseTranscript(reply("???", true, "글")).kind, "other");
});

test("글 옮기기 응답 풀기: 거절은 부적절한 사진, 답이 비면 읽을 수 없는 사진, 끊긴 응답은 실패", () => {
  assert.equal(parseTranscript({ output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] }).kind, "inappropriate");
  assert.equal(parseTranscript({ output: [] }).kind, "unreadable");
  assert.throws(() => parseTranscript({ status: "incomplete", output: [] }), /ai_incomplete/);
});

test("옮긴 글 다듬기: 줄바꿈·줄 끝 공백 정리, 식별 정보가 든 줄은 버리고, 빈 줄은 하나로", () => {
  assert.equal(tidyTranscript("초롱이 마라탕 좋아함  \r\n\r\n\r\n\r\n신발 240\n"), "초롱이 마라탕 좋아함\n\n신발 240");
  assert.equal(tidyTranscript("엄마 생일 3/2\n전화 010-1234-5678\n메일 a@b.com\n계좌 110-123-456789\n주소는 https://x.kr\n장미 좋아함"), "엄마 생일 3/2\n장미 좋아함");
  assert.equal(tidyTranscript("  \n  "), "");
  assert.equal(tidyTranscript("a\u0000b\u0007c"), "abc");
  assert.equal(tidyTranscript("가".repeat(TRANSCRIPT_MAX_CHARS + 50)).length, TRANSCRIPT_MAX_CHARS);
  assert.equal(tidyTranscript("가".repeat(10), 4), "가가가가");
});

test("받지 못한 사진 이유: 신분증·카드 > 메모가 아님 > 글씨를 못 읽음", () => {
  assert.equal(imageRejection(["unreadable", "other"]), "not_memo");
  assert.equal(imageRejection(["other", "id_or_payment", "unreadable"]), "sensitive");
  assert.equal(imageRejection(["inappropriate"]), "sensitive");
  assert.equal(imageRejection(["unreadable"]), "unreadable");
  assert.equal(imageRejection([]), "unreadable");
});
