import type { AvatarConfig, Locale, PartialCard, YMD } from "@readme/core";
import type { FolderView } from "@/lib/folders";

// 사람 화면 데이터(lib/pages/person.ts가 만들고 components/pages/PersonView가 그린다). 타입만 둔다

export interface PersonData {
  locale: Locale;
  /** 뒤로 갈 곳(고르기 중이나 폴더에서 들어왔으면 거기) */
  back: string;
  today: YMD;
  person: {
    contactId: string;
    /** 앱 사용자와 이어진 사람이면 그 사람 id */
    personId: string | null;
    name: string;
    nickname: string;
    avatar: AvatarConfig | null;
    card: PartialCard;
    favorite: boolean;
    /** '이 사람에 대해 다시 묻지 않기'를 했다(오늘의 질문에서 빠져 있다) */
    askOff: boolean;
    folderIds: string[];
  };
  /** 부를 이름(내가 정한 부르는 말, 없으면 그 사람 이름) */
  name: string;
  /** 나만 보는 메모(최근 것부터) */
  notes: { id: string; label: string; body: string; createdAt: string }[];
  folders: FolderView[];
  /** 아직 안 본 답이 있다(화면을 열면 읽은 것으로) */
  answered: boolean;
  /** 물어보고 답을 기다리는 중인 링크 */
  waiting: { inviteId: string; /** 보낸 날이 1일째 */ days: number } | null;
  ai: boolean;
}
