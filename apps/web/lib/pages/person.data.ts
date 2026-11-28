import type { AvatarConfig, EffectLine, Locale, PartialCard, Section, YMD } from "@readme/core";
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
    /** 항목별로 그 사람이 직접 답한 때(ISO). 내가 그 항목을 고치면 빠진다 — 화면이 '○○가 알려 줌' 표시에 쓴다 */
    answered: Partial<Record<Section, string>>;
  };
  /** 부를 이름(내가 정한 부르는 말, 없으면 그 사람 이름) */
  name: string;
  /** 나만 보는 메모(최근 것부터). date: 적은 날(내 시간대) */
  notes: { id: string; label: string; body: string; createdAt: string; date: YMD; /** 같이 지우기로 지금 되돌려지는 것(없으면 빈 목록) */ adds: EffectLine[]; /** 이 메모에 저장된 '더한 것'(일)의 수(메모 고치기 뒤 다시 정리해 새로 붙은 것만 되돌릴 때의 기준) */ fx: number }[];
  /** 주소가 정한 바인더 칸(?tab=memo·?tab=remembered). 없으면 null: 화면이 메모·기록의 양을 보고 정한다(lib/person-tab) */
  tab: "memo" | "remembered" | null;
  folders: FolderView[];
  /** 아직 안 본 답이 있다(화면을 열면 읽은 것으로) */
  answered: boolean;
  /** 물어보고 답을 기다리는 중인 링크 */
  waiting: { inviteId: string; /** 보낸 날이 1일째 */ days: number } | null;
  ai: boolean;
}
