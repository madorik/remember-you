import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import type { NoteEffect } from "@readme/core";
import { aad, openWith, sealWith } from "../crypto-core";
import { NOTE_PAYLOAD_MAX, packNote, unpackNote } from "../note-core";

const key = randomBytes(32);
const scope = aad.note("u1", "c1");
const seal = (data: unknown) => sealWith(key, data, scope, true);
const open = (payload: unknown) => unpackNote(openWith(key, payload, scope));

const likes = (text: string): NoteEffect => ({ f: "taste.likes", t: "items", add: [text] });

test("예전 메모({ body }뿐)는 더한 것이 없는 메모로 읽힌다", () => {
  const old = seal({ body: "엄마는 장미꽃을 좋아해" });
  assert.deepEqual(open(old), { body: "엄마는 장미꽃을 좋아해", effects: [] });
});

test("메모 글과 더한 것은 한 암호문으로 저장되고, 밖에서는 아무 글도 보이지 않는다", () => {
  const effects: NoteEffect[] = [likes("마라탕"), { f: "sizes.shoe", t: "one", next: 245, prev: 240 }];
  const sealed = packNote("마라탕 좋아함, 신발 245", effects, seal);
  const text = JSON.stringify(sealed);
  assert.ok(!text.includes("마라탕") && !text.includes("245") && !text.includes("shoe"));
  assert.deepEqual(open(sealed), { body: "마라탕 좋아함, 신발 245", effects });
  // 더한 것이 없으면 예전과 같은 모양({ body })
  assert.deepEqual(openWith(key, packNote("글", [], seal), scope), { body: "글" });
  // 다른 사람·다른 사람 행으로 옮기면 안 풀린다
  assert.equal(unpackNote(openWith(key, sealed, aad.note("u2", "c1"))), null);
});

test("망가진 내용은 null", () => {
  for (const bad of [null, "x", 3, {}, { body: 3 }, { fx: [] }]) assert.equal(unpackNote(bad), null);
  assert.deepEqual(unpackNote({ body: "글", fx: "nope" }), { body: "글", effects: [] });
  assert.deepEqual(unpackNote({ body: "글", fx: [{ f: "nope", t: "items", add: ["a"] }, likes("마라탕")] }), { body: "글", effects: [likes("마라탕")] });
});

test("저장 한도: 가장 긴 글(한글·이모지 1000자)과 더한 것이 가득 차도 한도 안에 들어가고, 넘치면 뒤의 것부터 덜어 낸다", () => {
  const big = (n: number): NoteEffect[] => Array.from({ length: n }, (_, i) => ({ f: "taste.likes", t: "items", add: [`${"가".repeat(70)}${i}`, `${"나".repeat(70)}${i}`], known: [`${"다".repeat(70)}${i}`] }));
  for (const body of ["가".repeat(1000), "😀".repeat(1000), "a".repeat(1000), "짧은 글"]) {
    const effects = big(24);
    const sealed = packNote(body, effects, seal);
    const size = Buffer.byteLength(JSON.stringify(sealed));
    assert.ok(size <= NOTE_PAYLOAD_MAX, `${size}`);
    assert.ok(size < 8192, "notes.payload 한도(pg_column_size < 8192)");
    const got = open(sealed)!;
    assert.equal(got.body, body, "메모 글은 그대로");
    assert.deepEqual(got.effects, effects.slice(0, got.effects.length), "앞에서부터 남는다");
    assert.ok(got.effects.length >= 1, "가장 긴 글이어도 하나는 들어간다");
  }
  // 보통의 더한 것(짧은 값 24개)은 짧은 글에 다 들어가고, 가장 긴 글에도 들어간다
  const small = Array.from({ length: 24 }, (_, i) => likes(`음식${i}`));
  assert.equal(open(packNote("짧은 글", small, seal))!.effects.length, 24);
  assert.equal(open(packNote("가".repeat(1000), small, seal))!.effects.length, 24);
  // 글만으로 꽉 찬 경우에도 글은 저장된다
  assert.equal(open(packNote("😀".repeat(1000), big(3), seal))!.body.length, 2000);
});
