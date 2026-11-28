// 사람 화면 메모장의 메모 찾기: 이미 받아 온 메모 글에서 글자를 찾는다(대소문자 구분 없이 포함되면 맞는 것). 서버를 부르지 않는다.

/** 찾는 말(앞뒤 공백은 걷는다). 빈 글이면 아무것도 찾지 않는 것(전부 보인다) */
export function searchNeedle(query: string | null | undefined): string {
  return (query ?? "").trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 이 글에 찾는 말이 들어 있나(찾는 말이 비었으면 늘 맞다) */
export function noteMatches(body: string, query: string | null | undefined): boolean {
  const needle = searchNeedle(query);
  return !needle || new RegExp(escapeRe(needle), "iu").test(body);
}

export interface NotePart {
  text: string;
  /** 찾는 말과 맞는 조각(형광펜을 칠한다) */
  hit: boolean;
}

/** 글을 찾는 말과 맞는 조각·아닌 조각으로 가른다(이어 붙이면 원래 글). 찾는 말이 비었으면 한 조각 */
export function noteParts(body: string, query: string | null | undefined): NotePart[] {
  const needle = searchNeedle(query);
  if (!needle) return [{ text: body, hit: false }];
  const parts: NotePart[] = [];
  let at = 0;
  for (const m of body.matchAll(new RegExp(escapeRe(needle), "giu"))) {
    const i = m.index ?? 0;
    if (i > at) parts.push({ text: body.slice(at, i), hit: false });
    parts.push({ text: m[0], hit: true });
    at = i + m[0].length;
  }
  if (at < body.length) parts.push({ text: body.slice(at), hit: false });
  return parts.length ? parts : [{ text: body, hit: false }];
}
