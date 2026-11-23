// 사람 화면 주소에서 그 사람(contactId)을 알아낸다(서버·화면이 같이 쓴다)

/** /people/<id>와 그 안쪽 화면(/people/<id>/edit …)이면 그 사람의 contactId. 폴더(/people/folder/…)·새 사람(/people/new)·목록은 null */
export function personOf(path: string): string | null {
  return /^\/people\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$)/i.exec(path)?.[1] ?? null;
}
