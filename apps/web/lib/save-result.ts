// 메모를 저장하고 AI가 기억해 둔 것으로 정리하는 동안 보이는 카드(app/(app)/voice/SaveCard.tsx)가 쓰는 순수 함수들: 결과를 사람별로 묶고, 문구·갈 곳을 정한다.
import type { EffectLine, NoteEffect } from "@readme/core";

/** 이번에 메모가 들어간 사람 한 명과 그 사람에게 남긴 메모 */
export interface SavedPerson {
  id: string;
  name: string;
  noteId: string;
}

/** 정리가 어떻게 끝났나(서버 organizeSaved의 state + 기다리다 지친 timeout) */
export type OrganizeState = "ok" | "known" | "nothing" | "ai_off" | "limit" | "failed" | "timeout";

/** 서버가 돌려준, 사람마다 이번에 더한 것의 줄 */
export interface PersonLines {
  contactId: string;
  noteId: string;
  lines: EffectLine[];
}

/** 카드에 보일 한 사람의 결과 */
export interface PersonResult {
  person: SavedPerson;
  lines: EffectLine[];
}

/** 이 정리가 '실제로 더한' 일인가: 목록은 새로 든 것이 있을 때, 한 칸짜리는 '이미 그 값이었다(다시 말했을 뿐)'가 아닐 때 */
export const isAdded = (e: NoteEffect): boolean => (e.t === "items" ? e.add.length > 0 : !e.ok);

/** 저장한 사람 순서대로 결과를 묶는다(결과에 없는 사람은 빈 줄) */
export function groupResults(saved: readonly SavedPerson[], people: readonly PersonLines[]): PersonResult[] {
  return saved.map((person) => ({ person, lines: people.find((p) => p.noteId === person.noteId)?.lines ?? [] }));
}

/** 줄 하나를 글로: "좋아하는 음식 · 마라탕", 바꾼 것은 "신발(mm) · 240 → 245" */
export function lineText(l: Pick<EffectLine, "label" | "value" | "prev">): string {
  return l.prev ? `${l.label} · ${l.prev} → ${l.value}` : `${l.label} · ${l.value}`;
}

/** 한 사람 화면으로 가는 주소: 더한 것이 있으면 '기억해 둔 것' 칸, 없으면 메모장 칸. 온보딩이면 환영 표시를 붙인다 */
export function personHref(id: string, added: boolean, welcome = false): string {
  return `/people/${id}?${welcome ? "welcome=1&" : ""}tab=${added ? "remembered" : "memo"}`;
}

/** 결과 한 줄 문구의 종류(더한 게 있으면 added, 없으면 이유): SaveCardLabels의 같은 이름 문구를 쓴다 */
export type ResultKind = "added" | "nothing" | "known" | "failed" | "limit";

export function resultKind(state: OrganizeState, added: boolean): ResultKind {
  if (added) return "added";
  if (state === "nothing") return "nothing";
  if (state === "known") return "known";
  if (state === "limit") return "limit";
  // ok인데 줄이 없는 경우(그 사이 되돌렸거나 보일 값이 없다)는 더할 게 없던 것으로
  if (state === "ok") return "nothing";
  return "failed";
}
