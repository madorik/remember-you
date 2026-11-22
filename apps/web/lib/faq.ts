import type { Locale } from "@readme/core";

// 시작 화면(/)의 자주 묻는 질문: 눈에 보이는 글이자 구조화 데이터(FAQPage)의 글. 둘이 같아야 하니 한 곳에서만 쓴다.
// 사실만 적는다(llms.txt와 같은 내용): 기능·개인정보·값·쓸 수 있는 곳. 안드로이드 앱은 Play 공개 전이라 적지 않는다

export interface Faq {
  q: string;
  a: string;
}

/** 시작 화면 내용(질문·선물 가이드 링크)을 마지막으로 고친 날(YYYY-MM-DD). 고치면 이 날짜도 바꾼다(사이트맵 수정일·구조화 데이터) */
export const LANDING_UPDATED_ON = "2026-11-22";

export const START_FAQ: Record<Locale, Faq[]> = {
  ko: [
    { q: "기억해유는 어떤 앱인가요?", a: "가족·연인·친구처럼 가까운 사람의 취향, 못 먹는 음식(알레르기), 사이즈, 생일·기념일을 적어 두는 앱이에요. 모르는 건 링크로 물어보고, 챙길 날이 다가오면 그 사람에게 맞는 선물을 가격대별로 골라 드려요." },
    { q: "상대방도 앱을 깔아야 하나요?", a: "아니요. 물어보기 링크를 보내면 상대는 앱 없이 웹에서 답하고, 답은 바로 내 기록에 들어가요." },
    { q: "내가 적은 기록을 다른 사람이 볼 수 있나요?", a: "내가 적은 기록과 메모는 나만 봐요. 알레르기·사이즈·날짜·메모는 암호화해서 저장하고, 공개 프로필이나 이름 검색은 없어요." },
    { q: "선물은 어떻게 골라 주나요?", a: "그 사람의 기록과 메모를 보고 1만원대·3만원대·5만원대·10만원 이상 가격대마다 다섯 개씩 골라, 왜 어울리는지 한 문장으로 알려 드려요. 작년에 준 선물은 빼요." },
    { q: "음력 생일도 알려 주나요?", a: "네. 음력 생일과 기념일이 다가오면 알려 드려요." },
    { q: "무료인가요?", a: "네, 무료예요. 선물 링크는 쿠팡 파트너스 링크라서, 구매하시면 일정액의 수수료를 받아요." },
    { q: "어디서 쓸 수 있나요?", a: "iPhone 앱과 웹 브라우저에서 쓸 수 있어요." },
  ],
  en: [
    { q: "What is Remember You?", a: "An app for jotting down the tastes, food allergies, sizes and birthdays of the people close to you — family, partner, friends. Ask them anything you don't know with a link, and when a special day nears, it picks gifts that suit them by price range." },
    { q: "Does the other person need the app?", a: "No. Send them an ask link and they answer on the web without installing anything; the answer goes straight into your notes." },
    { q: "Can other people see what I write?", a: "No. Your notes and memos are visible only to you. Allergies, sizes, dates and memos are stored encrypted, and there are no public profiles or name search." },
    { q: "How does it choose gifts?", a: "From each person's notes and memos, it picks five gifts per price range (₩10,000, ₩30,000, ₩50,000 and ₩100,000+) and tells you in one sentence why each one suits them. It leaves out what you gave last year." },
    { q: "Does it remind me of lunar-calendar birthdays?", a: "Yes. It reminds you when a lunar birthday or anniversary is coming up." },
    { q: "Is it free?", a: "Yes. Gift links are Coupang Partners links, so we earn a small commission if you buy." },
    { q: "Where can I use it?", a: "In the iPhone app and in a web browser." },
  ],
};
