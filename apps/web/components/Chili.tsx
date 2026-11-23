import { u } from "@/lib/ui-scale";
// 매운맛 단계: 고추 다섯 개 중 몇 개가 빨간지. 단계 0(안 매운 것만)이 고추 1개, 단계 4(아주 매워도)가 5개.

const BODY = "M24.6 7.6 C27.8 10.2 27.2 15.8 23.6 20.2 C19.6 25.2 12.2 28.6 6.1 28.1 C5.1 28 4.7 27.1 5.5 26.5 C10.6 22.9 14.1 18.6 16.6 13.6 C18.2 10.6 20.6 7.1 24.6 7.6 Z";
const CAP = "M21.2 8.8 C22.4 6.6 25.9 6.1 27.3 8.3 C25.6 9.1 23.3 9.6 21.2 8.8 Z";

export function ChiliIcon({ on, size: sizeIn = 22 }: { on: boolean; size?: number }) {
  const size = u(sizeIn);
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" className="block shrink-0">
      <path d="M24.6 7.6 C24.2 5.6 25.2 3.9 27.2 3.1" fill="none" stroke={on ? "#3E9B4F" : "#C9CDD8"} strokeWidth="2.2" strokeLinecap="round" />
      <path d={BODY} fill={on ? "#E8412C" : "#E4E6EE"} stroke={on ? "#B92D1C" : "#D2D5DF"} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={CAP} fill={on ? "#3E9B4F" : "#C9CDD8"} />
      {on ? <path d="M21 11.2 C19.9 13.8 18.2 16.2 16.3 18.2" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" /> : null}
    </svg>
  );
}

/** 단계(0–4)를 고추 다섯 개로. label이 있으면 읽어 주는 이름으로 쓴다 */
export function ChiliMeter({ level, size = 22, label }: { level: number; size?: number; label?: string }) {
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="flex shrink-0 items-center gap-[2px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <ChiliIcon key={i} on={i <= level} size={size} />
      ))}
    </span>
  );
}
