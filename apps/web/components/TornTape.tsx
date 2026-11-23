// 플래너 시안의 마스킹테이프: 양 끝이 톱니로 뜯긴 띠 + 남색 가는 선 + 하트·반짝이 무늬. 카드 모서리·윗변에 걸친다.
// 자리는 className으로(absolute). 감싸는 카드는 relative여야 한다. 장식이라 스크린리더에서 숨긴다

const FILL = { mango: "#FFE29A", pink: "#F9CBD5", mint: "#CDEBDD" } as const;
export type TornTapeColor = keyof typeof FILL;

export function TornTape({ color = "pink", w = 72, h = 22, rotate = -6, className = "" }: { color?: TornTapeColor; w?: number; h?: number; rotate?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 86 26"
      width={w}
      height={h}
      preserveAspectRatio="none"
      className={`pointer-events-none absolute ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M3 3 H83 L80.5 7.5 L83 12 L80.5 16.5 L83 21 V23 H3 L5.5 18.5 L3 14 L5.5 9.5 L3 5 Z" fill={FILL[color]} stroke="#1F2340" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M18 11.2 a2.1 2.1 0 0 1 4.2 0 a2.1 2.1 0 0 1 4.2 0 c0 2.8 -4.2 4.8 -4.2 4.8 s-4.2 -2 -4.2 -4.8z" fill="#FFFFFF" />
      <path d="M38 7.5 L39.3 11.2 L43 12.5 L39.3 13.8 L38 17.5 L36.7 13.8 L33 12.5 L36.7 11.2 Z" fill="#FFFFFF" />
      <path d="M50 11.2 a2.1 2.1 0 0 1 4.2 0 a2.1 2.1 0 0 1 4.2 0 c0 2.8 -4.2 4.8 -4.2 4.8 s-4.2 -2 -4.2 -4.8z" fill="#FFFFFF" />
      <path d="M70 7.5 L71.3 11.2 L75 12.5 L71.3 13.8 L70 17.5 L68.7 13.8 L65 12.5 L68.7 11.2 Z" fill="#FFFFFF" />
    </svg>
  );
}
