// 메모 쓰기의 이름 칸('+'): 이름을 치고 칸을 벗어나면(포커스 아웃) 고르지 않았어도 그 이름을 칩으로 만든다. 무엇이 될지 정하는 순수 함수(화면이 부른다).
import { NEW_PEOPLE_MAX, nameKey, tidyName } from "./capture-target";
import { exactPeople, tagKey, type MentionPerson, type MentionTag } from "./mention";

/**
 * - tag: 더할 칩(이미 있는 사람이면 person, 아니면 새 사람 new)
 * - dup: 이미 고른 사람·이름이라 칩은 그대로(친 글만 비운다)
 * - full: 새 사람 한도(NEW_PEOPLE_MAX)에 닿아 더하지 않는다(친 글은 둔다)
 * - none: 비었거나 같은 부름이 둘 이상이라 못 정했다(친 글은 둔다: 목록에서 직접 고르게)
 */
export type NameCommit = { kind: "tag"; tag: MentionTag } | { kind: "dup" } | { kind: "full" } | { kind: "none" };

/**
 * 이름 칸에 친 글(typed)을 어떻게 할까. 이름·부름이 똑같은 내 사람(people)이 한 명이면 그 사람, 없으면 새 사람 칩(저장할 때 글에서 @이름을 찾는 tagsForSave와 같은 부름 맞추기: 띄어쓰기·대소문자 무시).
 * tags는 지금 고른 칩들
 */
export function decideNameCommit(typed: string, people: readonly MentionPerson[], tags: readonly MentionTag[]): NameCommit {
  const name = tidyName(typed);
  if (!name) return { kind: "none" };
  const have = new Set(tags.map(tagKey));
  const hits = exactPeople(name, people);
  if (hits.length > 1) return { kind: "none" };
  if (hits.length === 1) {
    const tag: MentionTag = { kind: "person", id: hits[0]! };
    return have.has(tagKey(tag)) ? { kind: "dup" } : { kind: "tag", tag };
  }
  if (!nameKey(name)) return { kind: "none" };
  const tag: MentionTag = { kind: "new", name };
  if (have.has(tagKey(tag))) return { kind: "dup" };
  if (tags.filter((t) => t.kind === "new").length >= NEW_PEOPLE_MAX) return { kind: "full" };
  return { kind: "tag", tag };
}

/** 칸을 벗어난 뒤 이만큼 기다렸다가 정한다(같은 때 누른 목록 항목·한글 조합 끝의 마지막 글자가 먼저 자리 잡게) */
export const NAME_BLUR_MS = 160;
