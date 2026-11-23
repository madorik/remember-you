import { u } from "@/lib/ui-scale";
// 플래너 시안 장식 조각: 찢은 마스킹테이프(분홍·민트 + 하트·반짝이), 작은 화살표.
// 홈의 날짜 머리·다가오는 날 카드·이번 주 카드 조각은 HomeParts.tsx에 있다. 제목 밑 손그림 두 줄은 globals.css의 .scribble.
// 모두 aria-hidden 장식이라 자리는 className(absolute)으로 정한다. 감싸는 요소에는 relative가 있어야 한다. 서버·클라이언트 어디서나 쓴다(훅 없음).

/** 시안의 테이프는 TornTape.tsx 한 곳에서 그린다(호출하는 쪽이 크기·기울기를 정한다: 작은 카드 60×18) */
export { TornTape } from "./TornTape";

/** 작은 오른쪽 화살표(›) */
export function Chev({ size = 14, color = "#5B5F78", strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={u(size)} height={u(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
