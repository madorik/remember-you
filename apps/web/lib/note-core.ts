import { clip, parseEffects, type NoteEffect } from "@readme/core";

// 메모 한 줄의 암호화된 내용: { body, fx? }. body는 메모 글, fx는 이 메모가 사람 기록에 더한 것(AI 정리가 나중에 채운다).
// 예전 메모는 { body }뿐이라 fx가 없으면 더한 것이 없는 메모로 읽는다. 열쇠가 필요한 일은 data.ts가 하고, 여기엔 순수한 부분만 둔다(시험 가능).

/** 암호화한 내용(JSON으로 쓴 길이)의 한도. notes.payload는 pg_column_size 8192바이트 미만이라 여유를 둔다 */
export const NOTE_PAYLOAD_MAX = 7000;

export interface NoteContent {
  body: string;
  effects: NoteEffect[];
}

/** 푼 내용을 읽는다. 모양이 틀리면(풀리지 않은 것 포함) null */
export function unpackNote(data: unknown): NoteContent | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { body?: unknown; fx?: unknown };
  if (typeof d.body !== "string") return null;
  return { body: d.body, effects: parseEffects(d.fx) };
}

/**
 * 메모를 저장 모양으로 싼다. seal은 열쇠를 쥔 암호화 함수.
 * 저장 한도를 넘으면 더한 것을 뒤에서부터 덜어 내고(메모 글은 그대로), 하나도 안 들어가면 글만 싼다. 메모 글은 1000자까지라 글만으로는 늘 들어간다
 */
export function packNote(body: string, effects: readonly NoteEffect[], seal: (data: unknown) => unknown): unknown {
  const text = clip(body, 1000);
  for (let n = effects.length; n > 0; n--) {
    const sealed = seal({ body: text, fx: effects.slice(0, n) });
    if (JSON.stringify(sealed).length <= NOTE_PAYLOAD_MAX) return sealed;
  }
  return seal({ body: text });
}
