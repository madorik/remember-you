import assert from "node:assert/strict";
import { test } from "node:test";
import { ANDROID_NOTES_APPS, APPLE_NOTES, APPLE_NOTES_URL, installedNotesApps, notesAppLabel, notesChoice } from "../notes-apps";

test("메모 앱 목록: 삼성 노트·Keep·네이버 메모·ColorNote·OneNote·Evernote의 패키지 이름", () => {
  assert.deepEqual(
    ANDROID_NOTES_APPS.map((a) => a.id),
    ["com.samsung.android.app.notes", "com.google.android.keep", "com.nhn.android.navermemo", "com.socialnmobile.dictapp.notepad.color.note", "com.microsoft.office.onenote", "com.evernote"],
  );
  assert.equal(notesAppLabel(ANDROID_NOTES_APPS[0]!, "ko"), "삼성 노트");
  assert.equal(notesAppLabel(ANDROID_NOTES_APPS[0]!, "en"), "Samsung Notes");
  assert.equal(notesAppLabel(ANDROID_NOTES_APPS[1]!, "ko"), "Keep 메모");
});

test("설치된 메모 앱: 아는 것만, 목록 순서대로, 중복·이상한 값은 버린다", () => {
  assert.deepEqual(
    installedNotesApps(["com.evernote", "com.samsung.android.app.notes", "com.evernote", "evil.app", 3, null]).map((a) => a.id),
    ["com.samsung.android.app.notes", "com.evernote"],
  );
  assert.deepEqual(installedNotesApps(undefined), []);
  assert.deepEqual(installedNotesApps("com.evernote"), []);
  assert.deepEqual(installedNotesApps([]), []);
});

test("메모 앱 동작: 없으면 숨기고, 하나면 바로 열고, 여럿이면 고른다", () => {
  assert.equal(notesChoice(0), "none");
  assert.equal(notesChoice(1), "open");
  assert.equal(notesChoice(2), "pick");
  assert.equal(notesChoice(6), "pick");
});

test("iOS 메모 앱은 mobilenotes:// 로 연다", () => {
  assert.equal(APPLE_NOTES_URL, "mobilenotes://");
  assert.equal(APPLE_NOTES.id, "apple-notes");
});
