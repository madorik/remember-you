import { u } from "@/lib/ui-scale";

const INK = "#1F2340";
const LINE = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/**
 * 컬러 스프링 메모지 그림(아래 메뉴 가운데 단추): 뒤로 비스듬한 분홍 한 장, 흰 메모지에 망고 윗띠·링 넷·줄·하트, 연필과 반짝이.
 * 장식이라 스크린리더에서 숨긴다(이름은 감싼 링크가 준다). size는 90% 배율 전의 값
 */
export function MemoIcon({ size = 44, className = "", rotate = -6 }: { size?: number; className?: string; rotate?: number }) {
  const px = u(size);
  return (
    <svg viewBox="0 0 48 48" width={px} height={px} aria-hidden="true" className={`block shrink-0 ${className}`} style={{ transform: `rotate(${rotate}deg)` }}>
      <rect x="11" y="10.5" width="26" height="31" rx="4" fill="#FFE3E8" {...LINE} transform="rotate(7 24 26)" />
      <rect x="8.5" y="9" width="27" height="32" rx="4" fill="#FFFFFF" {...LINE} />
      <path d="M8.5 13a4 4 0 0 1 4-4h19a4 4 0 0 1 4 4v3.4h-27z" fill="#FFC23D" {...LINE} />
      {[13.4, 18.6, 23.8, 29].map((x) => (
        <path key={x} d={`M${x} 12.4V7.3a1.6 1.6 0 0 1 3.2 0V9`} fill="none" {...LINE} />
      ))}
      <path d="M13.5 22.5h17M13.5 27.5h17M20 32.5h7" stroke="#A9BCE0" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12.6 32.3a1.8 1.8 0 0 1 3.2-1.1 1.8 1.8 0 0 1 3.2 1.1c0 2.1-3.2 3.7-3.2 3.7s-3.2-1.6-3.2-3.7z" fill="#F59BAE" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <g transform="translate(36 28.5) rotate(36)">
        <rect x="-3.4" y="-13" width="6.8" height="16" rx="1" fill="#7FD6B8" {...LINE} />
        <path d="M-3.4 -13v-2.4a2.2 2.2 0 0 1 2.2-2.2h2.4a2.2 2.2 0 0 1 2.2 2.2v2.4z" fill="#F59BAE" {...LINE} />
        <path d="M-3.4 3L0 9.6 3.4 3z" fill="#FFE7A3" {...LINE} />
        <path d="M-1.15 7.4L0 9.6 1.15 7.4z" fill={INK} />
      </g>
      <path d="M41.2 4.6l.95 2.5 2.5.95-2.5.95-.95 2.5-.95-2.5-2.5-.95 2.5-.95z" fill="#FFC23D" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
