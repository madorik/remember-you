import type { AvatarConfig, DailyQuestion, Locale, YMD } from "@readme/core";
import type { Person, UnreadAnswer } from "@/lib/data";
import type { QuestionLogEntry } from "@/lib/question-topic";

// 홈 화면 데이터(lib/pages/home.ts가 읽고 components/pages/HomeView가 그린다). 타입만 둔다

export interface HomeData {
  locale: Locale;
  /** 내 얼굴(오른쪽 위 메뉴) */
  avatar: AvatarConfig;
  today: YMD;
  people: Person[];
  /** 오늘의 질문: 가까운 사람(가족 폴더, 즐겨찾기, 자주 연 사람) 중 아직 답이 없는 칸 하나. 하루 두 번까지이고, 없거나 다 썼으면 null */
  question: { contactId: string; q: DailyQuestion } | null;
  /** 오늘 질문 카드를 처리한 횟수(하루 두 번까지) */
  questionsUsed: number;
  /** 오늘 처리한 질문 목록(이 기기에 적어 둔 것: 홈의 '다 했어요' 체크 목록. 다른 기기에선 비어 있을 수 있다) */
  questionLog: QuestionLogEntry[];
  /** 아직 안 본 답장 */
  answers: UnreadAnswer[];
  /** 오늘의 질문에 막 답했다(?answered=1) */
  answered: boolean;
  /** 이 사람에 대해 질문을 그만뒀다(?muted=1) */
  muted: boolean;
  ai: boolean;
  /** 관리자 계정이면 프로필 메뉴에 '관리자'가 보인다 */
  isAdmin: boolean;
}
