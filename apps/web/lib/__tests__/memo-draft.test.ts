import assert from "node:assert/strict";
import { test } from "node:test";
import { NEW_PEOPLE_MAX } from "../capture-target";
import { clearAllDrafts, clearDraft, draftKey, parseDraft, readDraft, serializeDraft, writeDraft, type DraftStore } from "../memo-draft";

const fake = (): DraftStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
};

test("메모 초안 열쇠: 온보딩 · 사람 화면에서 온 것 · 그냥 연 것이 서로 섞이지 않는다", () => {
  const keys = [draftKey({ onboarding: true, to: null }), draftKey({ onboarding: true, to: "a" }), draftKey({ onboarding: false, to: null }), draftKey({ onboarding: false, to: "a" }), draftKey({ onboarding: false, to: "b" })];
  assert.equal(keys[0], keys[1], "온보딩은 ?to와 상관없이 하나");
  assert.equal(new Set(keys).size, 4);
});

test("메모 초안: 글과 칩을 적었다가 그대로 읽는다", () => {
  const store = fake();
  const key = draftKey({ onboarding: false, to: "a" });
  const draft = { text: "엄마는 장미를 좋아해", tags: [{ kind: "person" as const, id: "a" }, { kind: "new" as const, name: "이모" }], dropped: ["b"] };
  writeDraft(store, key, draft);
  assert.deepEqual(readDraft(store, key, 1000), draft);
  assert.equal(readDraft(store, draftKey({ onboarding: true, to: null }), 1000), null, "다른 열쇠의 초안은 없다");
});

test("메모 초안: 본문이 비면(공백만이어도) 지운다, 저장에 성공하면 지운다", () => {
  const store = fake();
  const key = draftKey({ onboarding: false, to: null });
  writeDraft(store, key, { text: "적는 중", tags: [], dropped: [] });
  assert.ok(store.map.has(key));
  writeDraft(store, key, { text: "  \n ", tags: [{ kind: "person", id: "a" }], dropped: [] });
  assert.equal(store.map.has(key), false, "글을 다 지우면 칩만 남기지 않는다");
  assert.equal(serializeDraft({ text: "", tags: [], dropped: [] }), null);
  writeDraft(store, key, { text: "또 적는 중", tags: [], dropped: [] });
  clearDraft(store, key);
  assert.equal(store.map.size, 0);
});

test("메모 초안: 깨진 값·모양이 다른 값은 버리고, 글은 한도까지, 칩은 맞는 것만", () => {
  assert.equal(parseDraft(null, 1000), null);
  assert.equal(parseDraft("{깨진", 1000), null);
  assert.equal(parseDraft(JSON.stringify({ text: 3 }), 1000), null);
  assert.equal(parseDraft(JSON.stringify({ text: "   ", tags: [] }), 1000), null);
  assert.equal(parseDraft(JSON.stringify({ text: "abcdef", tags: [] }), 3)?.text, "abc");
  const mixed = parseDraft(
    JSON.stringify({ text: "x", tags: [{ kind: "person", id: "" }, { kind: "person", id: 5 }, { kind: "new", name: "  " }, { kind: "new", name: "  이  모 " }, null, "x", { kind: "other" }], dropped: ["k", 1] }),
    1000,
  );
  assert.deepEqual(mixed, { text: "x", tags: [{ kind: "new", name: "이 모" }], dropped: ["k"] });
  // 칩이 없는 옛 모양도 읽힌다
  assert.deepEqual(parseDraft(JSON.stringify({ text: "x" }), 1000), { text: "x", tags: [], dropped: [] });
  // 새 사람은 한 번에 NEW_PEOPLE_MAX명까지
  const many = Array.from({ length: NEW_PEOPLE_MAX + 3 }, (_, i) => ({ kind: "new", name: `사람${i}` }));
  assert.equal(parseDraft(JSON.stringify({ text: "x", tags: many }), 1000)?.tags.length, NEW_PEOPLE_MAX);
});

test("메모 초안: 저장소가 없거나 던져도 조용히 건너뛴다", () => {
  const broken: DraftStore = {
    length: 1,
    key: () => {
      throw new Error("blocked");
    },
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  const key = draftKey({ onboarding: false, to: null });
  assert.equal(readDraft(null, key, 1000), null);
  assert.equal(readDraft(broken, key, 1000), null);
  assert.doesNotThrow(() => writeDraft(broken, key, { text: "x", tags: [], dropped: [] }));
  assert.doesNotThrow(() => writeDraft(null, key, { text: "x", tags: [], dropped: [] }));
  assert.doesNotThrow(() => clearDraft(broken, key));
  assert.doesNotThrow(() => clearAllDrafts(broken));
  assert.doesNotThrow(() => clearAllDrafts(null));
});

test("메모 초안: 로그아웃하면 모든 초안을 지우고 다른 저장값은 건드리지 않는다", () => {
  const store = fake();
  writeDraft(store, draftKey({ onboarding: false, to: null }), { text: "a", tags: [], dropped: [] });
  writeDraft(store, draftKey({ onboarding: false, to: "x" }), { text: "b", tags: [], dropped: [] });
  writeDraft(store, draftKey({ onboarding: true, to: null }), { text: "c", tags: [], dropped: [] });
  store.setItem("rm_organizing", "keep");
  clearAllDrafts(store);
  assert.deepEqual([...store.map.keys()], ["rm_organizing"]);
});
