import type { AvatarConfig, DailyQuestion, DateSpec, Locale, PartialCard, ReminderOffset, Section, YMD } from "@readme/core";

// 화면마다 서버가 읽어 주는 데이터 모양(lib/pages/<화면>.ts가 만들고 components/pages/<화면>View가 그린다).
// 타입만 둔다(서버 전용 코드를 들이지 않는다)

export interface MeData {
  locale: Locale;
  name: string;
  avatar: AvatarConfig;
  card: PartialCard;
  today: YMD;
  ai: boolean;
}

export interface MeEditData {
  locale: Locale;
  name: string;
  /** 이름 옆 작은 얼굴 */
  avatar: AvatarConfig;
  card: PartialCard;
  open: Section | null;
}

export interface MeEditSectionData {
  locale: Locale;
  section: Section;
  card: PartialCard;
}

export interface MeAvatarData {
  locale: Locale;
  name: string;
  avatar: AvatarConfig;
  today: YMD;
  /** 내가 적어 둔 생일(없으면 null) */
  birthday: DateSpec | null;
}

/** 온보딩(첫 메모): 메모지 화면과 같은 데이터 + 끝나고 가려던 곳 */
export interface OnboardingData {
  locale: Locale;
  today: YMD;
  /** 이미 있는 내 사람(온보딩 전에는 거의 없다) */
  people: { id: string; name: string; tag: string; avatar: AvatarConfig | null }[];
  next: string;
}

export interface PrivacyData {
  locale: Locale;
  isAnonymous: boolean;
  invites: { id: string; recipientName: string }[];
  localeChoice: Locale | null;
  appLock: boolean;
  pushEnabled: boolean;
  /** 명절·챙기는 날 알림 */
  holidayReminders: boolean;
  reminderOffsets: ReminderOffset[];
  /** 브라우저 푸시 공개 키(서버에 VAPID 키가 없으면 null: 브라우저 알림 스위치를 숨긴다) */
  webPushKey: string | null;
}

export interface AskPersonData {
  id: string;
  name: string;
  tag: string;
  label: string;
  avatar: AvatarConfig | null;
  missing: Section[];
}

export interface RequestData {
  locale: Locale;
  people: AskPersonData[];
  fixed: AskPersonData | null;
  initialName: string;
  defaults: Section[];
  /** 홈의 크리스마스 물어보기(?xmas=1)에서 왔다: 누구를 고르든 선물 쪽을 먼저 묻는다 */
  xmas: boolean;
  /** 예전 오늘의 질문 '물어보기'(?topic=)에서 왔다: 그 항목만 묻는다 */
  focus: Section | null;
  /** 오늘의 질문 하나만 묻는다(?q=): 받는 사람은 그 질문의 보기만 보고, 답은 그 칸에 들어간다 */
  question: DailyQuestion["id"] | null;
  /** 브라우저 푸시 공개 키(알림이 꺼져 있거나 서버에 키가 없으면 null: 링크를 만든 뒤 '답장 오면 알려 드릴까요?'를 숨긴다) */
  webPushKey: string | null;
}

export interface VoiceData {
  locale: Locale;
  /** 메모장 머리의 오늘 날짜(내 시간대) */
  today: YMD;
  people: { id: string; name: string; tag: string; avatar: AvatarConfig | null; hint: string }[];
  /** 사람 화면에서 구슬로 들어왔을 때(?to=) 적을 사람. 말하는 것·적는 것 모두 이 사람의 기록으로 들어간다 */
  fixed: { id: string; name: string; tag: string; avatar: AvatarConfig | null; hint: string } | null;
  /** 앱의 '공유 받기'로 열렸다(?shared=1): 메모 쓰기 화면이 받은 글을 본문에 채운다 */
  shared: boolean;
}
