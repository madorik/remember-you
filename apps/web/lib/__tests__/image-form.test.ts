import assert from "node:assert/strict";
import { test } from "node:test";
import { jpegDataUrls } from "../image-form";

/** 가로·세로 400의 머리(SOF0)만 있는 아주 작은 JPEG 모양 바이트(검사는 시작·끝 표시와 머리의 크기만 본다) */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x90, 0x01, 0x90, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);

const form = (...parts: (Blob | string)[]) => {
  const f = new FormData();
  parts.forEach((p, i) => (typeof p === "string" ? f.append("image", p) : f.append("image", p, `p${i}.jpg`)));
  return f;
};
const jpeg = () => new Blob([JPEG], { type: "image/jpeg" });

test("사진 폼: 앱이 줄여 만든 JPEG 한 장 이상 세 장까지를 data URL로 바꾼다", async () => {
  const one = await jpegDataUrls(form(jpeg()));
  assert.equal(one?.length, 1);
  assert.equal(one![0], `data:image/jpeg;base64,${Buffer.from(JPEG).toString("base64")}`);
  assert.equal((await jpegDataUrls(form(jpeg(), jpeg(), jpeg())))?.length, 3);
});

test("사진 폼: 없거나 넷 이상, 파일이 아닌 값, 깨진·너무 큰 파일, 폼이 아닌 것은 AI에 보내기 전에 거절한다(null)", async () => {
  assert.equal(await jpegDataUrls(new FormData()), null);
  assert.equal(await jpegDataUrls(form(jpeg(), jpeg(), jpeg(), jpeg())), null);
  assert.equal(await jpegDataUrls(form("글자")), null);
  assert.equal(await jpegDataUrls(form(new Blob([JPEG.slice(0, 20)], { type: "image/jpeg" }))), null, "끝 표시가 없는 깨진 파일");
  assert.equal(await jpegDataUrls(form(new Blob([new Uint8Array(1_000_000)], { type: "image/jpeg" }))), null, "크기 한도(900KB) 넘음");
  assert.equal(await jpegDataUrls(form(jpeg(), "글자")), null, "한 장이라도 걸리면 모두");
  assert.equal(await jpegDataUrls({ getAll: () => [] }), null);
  assert.equal(await jpegDataUrls(null), null);
});
