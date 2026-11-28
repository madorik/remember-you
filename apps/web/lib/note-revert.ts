import type { NoteEffect } from "@readme/core";

/**
 * 메모 하나의 '더한 것'을 되돌린 뒤 그 메모에 남겨 둘 것. 더한 것(add·drop·바꾼 값)은 이제 이 메모 일이 아니라 지우고,
 * '이 메모도 이 값을 뒷받침한다'는 표시(known, ok)는 메모 글이 여전히 그렇게 말하니 남긴다 — 다른 메모를 같이 지울 때 그 값이 같이 지워지지 않게.
 * 남길 게 없으면 빈 목록(메모 시트에 '이 메모로 더해진 것'이 더는 보이지 않는다)
 */
export function effectsAfterRevert(effects: readonly NoteEffect[]): NoteEffect[] {
  return effects.flatMap((e): NoteEffect[] => {
    if (e.t === "items") return e.known?.length ? [{ f: e.f, t: "items", add: [], known: e.known }] : [];
    return e.ok ? [e] : [];
  });
}
