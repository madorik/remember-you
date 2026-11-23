import type { AvatarConfig, DateSpec, Locale, YMD } from "@readme/core";
import type { FolderView } from "@/lib/folders";

// 사람 프로필 화면 데이터(lib/pages/person-profile.ts가 만들고 components/pages/PersonProfileView가 그린다). 타입만 둔다

export interface PersonProfileData {
  locale: Locale;
  today: YMD;
  /** 모든 폴더(폴더 고르기 시트에 쓴다) */
  folders: FolderView[];
  person: {
    contactId: string;
    /** 앱 사용자와 이어진 사람이면 그 사람 id */
    personId: string | null;
    name: string;
    nickname: string;
    avatar: AvatarConfig | null;
    /** 들어 있는 폴더 */
    folderIds: string[];
    /** 적어 둔 생일(없으면 null) */
    birthday: DateSpec | null;
  };
}
