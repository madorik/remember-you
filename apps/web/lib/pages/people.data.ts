import type { AvatarConfig, Locale } from "@readme/core";
import type { PersonRow } from "@/components/PersonRow";
import type { FolderView } from "@/lib/folders";

// 사람들 화면 데이터(lib/pages/people.ts가 만들고 components/pages/PeopleView가 그린다). 타입만 둔다

export interface PeopleData {
  locale: Locale;
  rows: PersonRow[];
  /** 최근 본 사람(contactId, 최대 6명, 가장 최근이 앞). 본 사람이 2명 미만이면 [] */
  recent: string[];
  folders: FolderView[];
  meAvatar: AvatarConfig;
  /** 주소 ?pick=1: 고르기로 연다 */
  initialPick: boolean;
  /** 주소 ?with=a,b: 처음 골라 둘 사람 */
  initial: string[];
  /** 주소 ?me=0이 아니면 나도 같이 */
  initialMe: boolean;
  /** 주소 ?to=gift: 홈 기념일 카드에서 선물을 고르러 왔다(동작 막대의 큰 단추가 선물 고르기) */
  initialGift: boolean;
  /** 주소 ?xmas=1: 홈 연말 카드에서 왔다(한 명만 골라 선물 고르기로 가면 크리스마스용 선물 고르기로) */
  initialXmas: boolean;
  ai: boolean;
}
