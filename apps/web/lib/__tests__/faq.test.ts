import assert from "node:assert/strict";
import { test } from "node:test";
import { LANDING_UPDATED_ON, START_FAQ } from "../faq";
import { GUIDES_PUBLISHED, GUIDES_UPDATED, koDate } from "../guides";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

test("시작 화면 질문: 한국어·영어가 같은 개수이고 빈 칸이 없으며 질문이 겹치지 않는다", () => {
  assert.equal(START_FAQ.ko.length, START_FAQ.en.length);
  for (const locale of ["ko", "en"] as const) {
    const qs = START_FAQ[locale].map((f) => f.q);
    assert.equal(new Set(qs).size, qs.length, `${locale} 질문 중복`);
    for (const f of START_FAQ[locale]) {
      assert.ok(f.q.trim().endsWith("?"), `${locale} 질문은 물음표로 끝난다: ${f.q}`);
      assert.ok(f.a.trim().length >= 20, `${locale} 답이 너무 짧다: ${f.q}`);
    }
  }
});

test("시작 화면 질문에는 아직 공개 전인 안드로이드 앱을 적지 않는다", () => {
  const all = [...START_FAQ.ko, ...START_FAQ.en].map((f) => f.a).join(" ");
  assert.doesNotMatch(all, /안드로이드|Android|Google Play|구글 플레이/i);
});

test("수정일은 날짜 모양이고 처음 낸 날보다 앞서지 않는다", () => {
  for (const d of [GUIDES_PUBLISHED, GUIDES_UPDATED, LANDING_UPDATED_ON]) assert.match(d, YMD);
  assert.ok(GUIDES_UPDATED >= GUIDES_PUBLISHED);
});

test("날짜를 한국어로 쓴다", () => {
  assert.equal(koDate("2026-11-21"), "2026년 11월 21일");
  assert.equal(koDate("2026-01-05"), "2026년 1월 5일");
});
