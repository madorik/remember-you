import assert from "node:assert/strict";
import { test } from "node:test";
import { describeEffect, revertEffects, type NoteEffect, type PartialCard } from "@readme/core";
import { effectsAfterRevert } from "../note-revert";

const likes = (add: string[], known?: string[]): NoteEffect => ({ f: "taste.likes", t: "items", add, ...(known ? { known } : {}) });

test("되돌린 뒤 남기는 것: 더한 것은 지우고 '다시 말했다' 표시만 남긴다", () => {
  assert.deepEqual(effectsAfterRevert([]), []);
  assert.deepEqual(effectsAfterRevert([likes(["마라탕"])]), []);
  assert.deepEqual(effectsAfterRevert([likes(["마라탕"], ["짜장면"])]), [likes([], ["짜장면"])]);
  assert.deepEqual(effectsAfterRevert([{ f: "sizes.shoe", t: "one", next: 245, prev: 240 }]), []);
  const again: NoteEffect = { f: "sizes.shoe", t: "one", next: 245, ok: 1 };
  assert.deepEqual(effectsAfterRevert([again, { f: "sizes.top", t: "one", next: "M", prev: null }]), [again]);
});

test("남은 표시는 메모 시트의 '더해진 것'에 보이지 않고, 다른 메모를 같이 지울 때 그 값을 뒷받침한다", () => {
  const card: PartialCard = { taste: { likes: ["짜장면"], spicy: null, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } } };
  const kept = effectsAfterRevert([likes(["마라탕"], ["짜장면"])]);
  // 이 메모를 다시 되돌려도 더해진 것이 없다
  assert.deepEqual(revertEffects(card, kept, []).undone, []);
  assert.deepEqual(kept.map((e) => describeEffect(e, "ko")).filter(Boolean), []);
  // 짜장면을 처음 더한 다른 메모를 같이 지워도, 이 메모가 다시 말했으니 짜장면은 남는다
  const first = revertEffects(card, [likes(["짜장면"])], kept);
  assert.deepEqual(first.undone, []);
});
