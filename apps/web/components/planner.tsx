import { u } from "@/lib/ui-scale";
// 플래너 시안(P2-*) 장식 조각: 찢은 마스킹테이프(분홍·민트 + 하트·반짝이), D-n 고무 도장, 하트 불릿, 제목 밑 손그림 두 줄은 globals.css의 .scribble.
// 모두 aria-hidden 장식이라 자리는 className(absolute)으로 정한다. 감싸는 요소에는 relative가 있어야 한다. 서버·클라이언트 어디서나 쓴다(훅 없음).

const INK = "#1F2340";
const STAMP = "#A8481A";
/** 시안의 테이프는 TornTape.tsx 한 곳에서 그린다(호출하는 쪽이 크기·기울기를 정한다: 큰 카드 78×24, 작은 카드 60×18) */
export { TornTape } from "./TornTape";

/** D-n 고무 도장: 이중 고리 동그라미(주황 #A8481A)를 살짝 기울여 찍는다. 위는 D-6 같은 큰 글자, 아래는 날짜 작은 글자 */
export function DdayStamp({ big, small, bigSize = 30, className = "" }: { big: string; small?: string; bigSize?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full ${className}`}
      style={{
        boxSizing: "border-box",
        border: `2px solid ${STAMP}`,
        boxShadow: `inset 0 0 0 2.5px #FFFFFF, inset 0 0 0 4px ${STAMP}`,
        color: STAMP,
        transform: "rotate(-11deg)",
      }}
    >
      <span className="hand" style={{ fontSize: Math.round(bigSize * 85) / 100, lineHeight: 0.9 }}>
        {big}
      </span>
      {small ? <span style={{ marginTop: 2, fontSize: 9, fontWeight: 700, letterSpacing: ".04em", lineHeight: 1 }}>{small}</span> : null}
    </span>
  );
}

/** 줄노트의 하트 불릿(기억해 둔 것 줄머리) */
export function HeartBullet({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={u(size)} height={u(size)} aria-hidden="true" className="shrink-0">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="#E8627C" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** 선물 상자 그림(티켓 띠 '선물 힌트 보기' 앞 아이콘) */
export function GiftBox({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={u(size)} height={u(size)} fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="4" y="10.5" width="16" height="10" rx="1.6" fill="#FFFFFF" />
      <rect x="3" y="7" width="18" height="3.5" rx="1.2" fill="#F9CBD5" />
      <path d="M12 7v13.5" />
      <path d="M12 7c-1.6-3.2-5.4-3.6-5.4-1.3C6.6 7 9.6 7 12 7zM12 7c1.6-3.2 5.4-3.6 5.4-1.3C17.4 7 14.4 7 12 7z" />
    </svg>
  );
}

/** 작은 오른쪽 화살표(›) */
export function Chev({ size = 14, color = "#5B5F78", strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={u(size)} height={u(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/**
 * 티켓처럼 뜯는 망고 띠(큰 카드의 맨 아래). 카드 안쪽 여백(px-4)을 -mx-4로 걷어 카드 폭 가득, 위는 점선 구멍줄 + 양쪽 반원 홈.
 * 카드(.relative, 모서리 18)의 맨 아래에 놓는다. children은 띠 안의 내용
 */
export function TicketStub({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative -mx-4 mt-3.5 rounded-b-[14.9px] border-t border-dashed bg-sky text-ink ${className}`} style={{ borderTopColor: "rgba(31,35,64,.30)" }}>
      <span aria-hidden="true" className="absolute -left-[1.5px] -top-[9.9px] box-border h-[19.8px] w-[9.9px] rounded-r-[9.9px] border border-l-0 border-edge bg-paper" />
      <span aria-hidden="true" className="absolute -right-[1.5px] -top-[9.9px] box-border h-[19.8px] w-[9.9px] rounded-l-[9.9px] border border-r-0 border-edge bg-paper" />
      {children}
    </div>
  );
}
