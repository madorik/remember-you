// 메모 가져오기 > '메모 앱에서': 휴대폰의 메모 앱을 열어 글을 고른 뒤 "공유 → 기억해유"로 돌아오게 한다(받은 글은 ShareInbox가 메모 화면으로 가져온다).
// 순수 자료·판단이라 화면(ImportMenu)·앱 다리(components/native.tsx)·시험이 같이 쓴다.
// 안드로이드는 아래 목록 중 설치된 앱만(ShareInboxPlugin.notesApps — 같은 아이디가 안드로이드 쪽 NOTES_APPS와 AndroidManifest <queries>에도 있어야 한다).
// iOS는 기본 메모 앱을 mobilenotes:// 로 연다(웹뷰가 커스텀 스킴으로 가면 Capacitor가 UIApplication.open에 넘긴다: WebViewDelegationHandler.decidePolicyFor)

export interface NotesApp {
  /** 안드로이드 패키지 이름 (iOS는 "apple-notes") */
  id: string;
  ko: string;
  en: string;
}

export const ANDROID_NOTES_APPS: readonly NotesApp[] = [
  { id: "com.samsung.android.app.notes", ko: "삼성 노트", en: "Samsung Notes" },
  { id: "com.google.android.keep", ko: "Keep 메모", en: "Google Keep" },
  { id: "com.nhn.android.navermemo", ko: "네이버 메모", en: "Naver Memo" },
  { id: "com.socialnmobile.dictapp.notepad.color.note", ko: "ColorNote", en: "ColorNote" },
  { id: "com.microsoft.office.onenote", ko: "OneNote", en: "OneNote" },
  { id: "com.evernote", ko: "Evernote", en: "Evernote" },
];

/** iOS 기본 메모 앱 */
export const APPLE_NOTES: NotesApp = { id: "apple-notes", ko: "메모", en: "Notes" };
export const APPLE_NOTES_URL = "mobilenotes://";

/** 앱이 알려 준 설치된 앱 아이디들 중 아는 것만, 목록 순서대로(중복·모르는 값은 버린다) */
export function installedNotesApps(ids: unknown): NotesApp[] {
  if (!Array.isArray(ids)) return [];
  const got = new Set(ids.filter((x): x is string => typeof x === "string"));
  return ANDROID_NOTES_APPS.filter((a) => got.has(a.id));
}

/** 설치된 앱 수에 따른 동작: 없으면 항목을 숨기고, 하나면 바로 열고, 여럿이면 고르게 한다 */
export type NotesChoice = "none" | "open" | "pick";
export function notesChoice(count: number): NotesChoice {
  return count <= 0 ? "none" : count === 1 ? "open" : "pick";
}

export const notesAppLabel = (a: NotesApp, locale: "ko" | "en"): string => (locale === "ko" ? a.ko : a.en);
