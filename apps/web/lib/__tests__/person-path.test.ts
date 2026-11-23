import assert from "node:assert/strict";
import { test } from "node:test";
import { personOf } from "../person-path";

const ID = "244c4124-b1fe-4e6d-8d6c-f600b43aacef";

test("personOf: 사람 화면과 그 안쪽 화면은 그 사람의 contactId", () => {
  assert.equal(personOf(`/people/${ID}`), ID);
  assert.equal(personOf(`/people/${ID}/edit`), ID);
  assert.equal(personOf(`/people/${ID}/profile`), ID);
  assert.equal(personOf(`/people/${ID}/reminder`), ID);
});

test("personOf: 목록·새 사람·폴더·다른 화면은 null", () => {
  assert.equal(personOf("/people"), null);
  assert.equal(personOf("/people/new"), null);
  assert.equal(personOf(`/people/folder/${ID}`), null);
  assert.equal(personOf("/home"), null);
  assert.equal(personOf(`/voice?to=${ID}`), null);
  assert.equal(personOf(`/people/${ID}x`), null);
});
