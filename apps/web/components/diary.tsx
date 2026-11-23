// 다이어리 장식: 별·하트·물결선·반짝이·손그림 동그라미·D-day 도장·폴라로이드·줄노트 여백선.
// 장식은 모두 aria-hidden + pointer-events-none이고 absolute다(자리는 className으로). 감싸는 요소에는 relative가 있어야 하고,
// 새로 relative·transform을 씌우지 않도록 이미 relative인 카드(.card relative) 안에 넣는다.

import { TornTape } from "./TornTape";

const INK = "#1F2340";
const MANGO = "#FFC23D";
const MANGO_DEEP = "#E09A12";
const PINK = "#F59BAE";
const SKY = "#8FD2EC";

const PLACE = "pointer-events-none absolute";

const STAR = "M12 3 L14.2 9 L20.5 9.3 L15.5 13.2 L17.3 19.5 L12 15.8 L6.7 19.5 L8.5 13.2 L3.5 9.3 L9.8 9 Z";

/** 별(남색 선 + 색 채움). 기본은 망고, 하늘색은 color={SKY_STAR} */
export function Star({ size = 20, rotate = -12, color = MANGO, className = "" }: { size?: number; rotate?: number; color?: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color}
      stroke={INK}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${PLACE} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d={STAR} />
    </svg>
  );
}
export const SKY_STAR = SKY;

const HEART = "M12 20 C4 14 2 9 5.5 6.5 C8 4.7 11 6 12 8.5 C13 6 16 4.7 18.5 6.5 C22 9 20 14 12 20 Z";

/** 하트(분홍). inline이면 자리를 차지하는 글줄 속 하트(폴라로이드 이름 옆) */
export function Heart({ size = 20, rotate = 0, inline = false, className = "" }: { size?: number; rotate?: number; inline?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={PINK}
      stroke={INK}
      strokeWidth={inline ? 2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${inline ? "shrink-0" : PLACE} ${className}`}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      <path d={HEART} />
    </svg>
  );
}

/** 물결선 하나(카드 아래 모서리의 낙서) */
export function Squiggle({ w = 56, color = MANGO_DEEP, width = 2.2, className = "" }: { w?: number; color?: string; width?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 60 14" width={w} height={Math.round((w * 14) / 60)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" className={`${PLACE} ${className}`}>
      <path d="M2 8 C 8 0, 12 14, 18 7 S 30 0, 36 7 S 48 14, 58 6" />
    </svg>
  );
}

/** 반짝이(여덟 갈래 선) */
export function Sparkle({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" className={`${PLACE} ${className}`}>
      <path d="M12 4 V20 M4 12 H20 M7 7 L17 17 M17 7 L7 17" />
    </svg>
  );
}

/** 감싼 것 둘레에 손으로 두른 동그라미(오늘 날짜). 부모는 position: relative 여야 하고, 자리는 부모 크기에 맞춰 className으로 */
export function HandCircle({ w = 40, h = 36, stroke = 2.2, className = "" }: { w?: number; h?: number; stroke?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 44 40" width={w} height={h} fill="none" stroke={MANGO_DEEP} strokeWidth={stroke} strokeLinecap="round" className={`${PLACE} ${className}`}>
      <path d="M7 21 C5 10 15 4 24 5 C35 6 41 13 39 22 C37 31 27 36 18 34 C10 32 6 26 8.5 17" />
    </svg>
  );
}

/** 누를 곳(가운데 구슬)을 가리키는 손그림 화살표: 끝이 왼쪽 위를 향한다. 부모는 relative, 자리는 className으로 */
export function PointArrow({ w = 76, className = "" }: { w?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 72 72" width={w} height={w} fill="none" strokeLinecap="round" strokeLinejoin="round" className={`${PLACE} ${className}`}>
      <g stroke={INK} strokeWidth="2.8">
        <path d="M60 66 C 66 46 52 30 26 22" />
        <path d="M35 36 L25 22 L41 19" />
      </g>
      <path d="M52 18 L58 12 M60 26 L68 24" stroke={MANGO_DEEP} strokeWidth="2.6" />
    </svg>
  );
}

/** 글자 둘레에 손으로 두른 가로로 긴 동그라미(양력·음력 고르기). 부모는 relative */
export function HandOval({ w = 72, h = 40, className = "" }: { w?: number; h?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 70 40" width={w} height={h} fill="none" stroke={MANGO_DEEP} strokeWidth="2.4" strokeLinecap="round" className={`${PLACE} ${className}`}>
      <path d="M10 22 C6 9 24 4 38 5 C56 6 68 12 65 22 C62 32 46 36 30 34 C16 32 7 27 11 17" />
    </svg>
  );
}

/** D-day 도장: 이중 테두리 동그라미를 살짝 기울여 찍는다. 안은 글자(D-2, 오늘) */
export function Stamp({ children, size = 72, fontSize = 27, className = "" }: { children: React.ReactNode; size?: number; fontSize?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`${PLACE} flex items-center justify-center rounded-full text-accent ${className}`}
      style={{
        width: size,
        height: size,
        fontSize,
        border: `2.5px solid ${MANGO_DEEP}`,
        boxShadow: `inset 0 0 0 3px var(--color-paper), inset 0 0 0 4.5px ${MANGO_DEEP}`,
        transform: "rotate(-12deg)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * 폴라로이드 틀: 흰 종이 한 장에 사진 칸(연한 망고)과 이름 줄. 사진 칸 안에 얼굴(Avatar)을 넣는다.
 * 틀만 기울이는 장식이라 눌리는 건 안에 넣은 것이 한다
 */
export function Polaroid({
  children,
  caption,
  rotate = -4,
  photo = 80,
  dashed = false,
  className = "",
}: {
  children: React.ReactNode;
  caption?: React.ReactNode;
  rotate?: number;
  photo?: number;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <figure
      className={`m-0 flex shrink-0 flex-col items-center gap-1 bg-white px-[7px] pb-[6px] pt-[7px] shadow-[0_1px_2px_rgb(31_35_64/0.12),0_8px_16px_-10px_rgb(31_35_64/0.5)] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="flex items-center justify-center" style={{ width: photo, height: photo, background: "#FFF1CC", boxShadow: dashed ? "inset 0 0 0 2px var(--color-mango-edge)" : undefined }}>
        {children}
      </div>
      {caption ? <figcaption className="flex items-center gap-[3px] text-[14px] leading-[1.2]">{caption}</figcaption> : null}
    </figure>
  );
}

/** 줄노트의 왼쪽 분홍 여백선(부모에 .ruled와 relative, 왼쪽 안쪽 여백이 있어야 한다) */
export function MarginLine({ left = 28 }: { left?: number }) {
  return <span aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 w-[1.5px] bg-margin" style={{ left }} />;
}

/** 손으로 쭉 그은 남색 줄(제목 아래 구분선). 블록이라 자리를 차지한다 */
export function HandRule({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 350 10" preserveAspectRatio="none" width="100%" height="10" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={`block ${className}`}>
      <path d="M2 6 C 60 2, 120 9, 180 5 S 300 3, 348 6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 제목 속 낱말(이름 등)에 형광펜: text 안의 word를 .hl로 감싼다(없으면 그대로) */
export function Highlight({ text, word }: { text: string; word: string }) {
  const i = word ? text.indexOf(word) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="hl">{word}</span>
      {text.slice(i + word.length)}
    </>
  );
}

/**
 * 체험(?tour=) 안내 상자(플래너 모양): 흰 종이 카드 + 남색 선, 윗변에 찢은 망고 테이프, 모서리에 별.
 * 키보드가 뜨면(html[data-kb]) 접는다. 안에는 순서(1 / 2)·제목·예시를 넣는다
 */
export function TourNote({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={`card relative mx-4 flex flex-col items-center gap-0.5 px-5 pb-[18px] pt-[22px] text-center [html[data-kb]_&]:hidden ${className}`}>
      <TornTape color="mango" w={78} h={24} rotate={-3} className="-top-3 left-1/2 -ml-[39px]" />
      {children}
      <Star size={22} rotate={14} className="-right-2 -top-2.5" />
    </section>
  );
}
