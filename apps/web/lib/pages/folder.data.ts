import type { AvatarConfig, Locale } from "@readme/core";
import type { PersonRow } from "@/components/PersonRow";
import type { FolderView } from "@/lib/folders";

// 폴더 하나 화면 데이터(lib/pages/folder.ts가 만들고 components/pages/FolderView가 그린다). 타입만 둔다

export interface FolderData {
  locale: Locale;
  folder: FolderView;
  /** 든 사람 줄(고른 순서로 세운 것) */
  rows: PersonRow[];
  /** 주소 ?sort=name: 이름순(아니면 생일 가까운 순) */
  byName: boolean;
  /** 든 사람(사람들 목록 순서). 몇 명인지와 정렬 칩을 보일지에 쓴다 */
  memberIds: string[];
  /** 사람 넣기 시트에 보일 내 사람들 */
  people: { contactId: string; name: string; tag: string; avatar: AvatarConfig | null }[];
  /** 주소 ?edit=1 · ?add=1: 열어 둘 시트 */
  open: "edit" | "add" | null;
}
