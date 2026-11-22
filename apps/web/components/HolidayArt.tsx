import type { HolidayId } from "@readme/core";
import { Polaroid } from "@/components/diary";

// 홈 '다가오는 날' 왼쪽 그림(명절·챙기는 날): 폴라로이드 사진 칸에 손으로 그린 듯한 그림 하나.
// 남색 선 + 망고·분홍·하늘·민트 채움으로, 다이어리의 별·하트와 같은 결. 모두 장식이라 aria-hidden(이름은 옆 글자가 읽어 준다).

const INK = "#1F2340";
const MANGO = "#FFC23D";
const MANGO_DEEP = "#E09A12";
const PINK = "#F59BAE";
const ROSE = "#EE6C80";
const SKY = "#8FD2EC";
const MINT = "#7FD6B8";
const CREAM = "#FFF7E3";
const CHOCO = "#A8613B";

/** 크리스마스: 별을 얹은 세 단 트리, 알전구, 눈송이 점 */
function Tree() {
  return (
    <>
      <path d="M28 51 H36 V59 H28 Z" fill="#D49A5A" />
      <path d="M32 31 C38 40 46 47 54 52 C43 56 21 56 10 52 C18 47 26 40 32 31 Z" fill={MINT} />
      <path d="M32 20 C36 27 43 34 49 40 C40 43 24 43 15 40 C21 34 28 27 32 20 Z" fill={MINT} />
      <path d="M32 9 C35 15 39 21 44 27 C37 30 27 30 20 27 C25 21 29 15 32 9 Z" fill={MINT} />
      <circle cx="26" cy="47" r="2.6" fill={PINK} />
      <circle cx="39" cy="46" r="2.6" fill={SKY} />
      <circle cx="33" cy="37" r="2.4" fill={MANGO} />
      <circle cx="27" cy="26" r="2.1" fill={SKY} />
      <circle cx="37" cy="25" r="2.1" fill={PINK} />
      <path d="M32 3.5 L33.7 8 L38.4 8.2 L34.7 11 L36 15.6 L32 12.9 L28 15.6 L29.3 11 L25.6 8.2 L30.3 8 Z" fill={MANGO} strokeWidth="1.5" />
      <g stroke="none" fill={SKY}>
        <circle cx="9" cy="14" r="1.6" />
        <circle cx="55" cy="22" r="1.6" />
        <circle cx="52" cy="9" r="1.2" />
        <circle cx="12" cy="30" r="1.2" />
      </g>
    </>
  );
}

/** 설날: 복주머니(주름 잡은 주머니 입, 매듭 끈, 술) */
function Pouch() {
  return (
    <>
      <path d="M22 26 C13 33 9 42 12 50 C15 58 25 59 32 59 C39 59 49 58 52 50 C55 42 51 33 42 26 Z" fill={PINK} />
      <path d="M23 25 C19 17 26 11 32 16 C38 11 45 17 41 25 Z" fill={SKY} />
      <path d="M27 24 C26 20 27 18 28.5 16.5 M32 24 V17 M37 24 C38 20 37 18 35.5 16.5" strokeWidth="1.4" />
      <path d="M22 26 C28 30 36 30 42 26" fill="none" stroke={MANGO_DEEP} strokeWidth="3.2" />
      <circle cx="32" cy="43" r="9" fill={MANGO} />
      <path d="M29 43 C29 38.5 36.5 38.5 36.5 43 C36.5 47.5 30 47.5 31 43.4" fill="none" strokeWidth="1.5" />
      <path d="M22 28 C16 31 15 36 16 41 M16 41 L14.5 47 M16 41 L16.5 48 M16 41 L18.5 47" fill="none" stroke={MANGO_DEEP} strokeWidth="1.8" />
      <g stroke="none" fill={MANGO}>
        <circle cx="52" cy="14" r="1.8" />
        <circle cx="10" cy="14" r="1.4" />
      </g>
    </>
  );
}

/** 추석: 보름달 아래 송편 둘 */
function MoonAndSongpyeon() {
  return (
    <>
      <circle cx="32" cy="24" r="17" fill={MANGO} />
      <path d="M23 19 C25 16 29 16 30 19 M36 15 C39 15 41 17 41 19 M25 29 C28 31 32 30 33 28 M38 26 C40 25 42 26 42 28" fill="none" stroke={MANGO_DEEP} strokeWidth="1.6" />
      <path d="M7 55 C6 45 28 45 29 55 C23 59 13 59 7 55 Z" fill="#FFFFFF" />
      <path d="M33 56 C32 46 55 46 56 56 C50 60 40 60 33 56 Z" fill={MINT} />
      <path d="M10 49.5 L11.5 52 M15 47.5 L16 50.5 M20 47.5 L20 50.5 M25 49.5 L24 52" fill="none" strokeWidth="1.3" />
      <path d="M37 50.5 L38.5 53 M43 48.5 L43.5 51.5 M49 49 L48 52" fill="none" strokeWidth="1.3" />
      <g stroke="none" fill={INK}>
        <circle cx="14" cy="54" r="0.9" />
        <circle cx="21" cy="55" r="0.9" />
        <circle cx="42" cy="55" r="0.9" />
        <circle cx="49" cy="54" r="0.9" />
      </g>
      <path d="M8 8 V14 M5 11 H11 M55 36 V41 M52.5 38.5 H57.5" fill="none" strokeWidth="1.5" />
    </>
  );
}

/** 어린이날: 풍선 셋 */
function Balloons() {
  return (
    <>
      <path d="M22 35 C21 45 29 49 32 60 M42 33 C43 44 35 49 32 60 M32 43 C32 50 31 55 32 60" fill="none" strokeWidth="1.4" />
      <ellipse cx="21" cy="21" rx="10" ry="12" fill={PINK} transform="rotate(-8 21 21)" />
      <path d="M21 33 L18.5 37.5 H23.5 Z" fill={PINK} strokeWidth="1.4" />
      <ellipse cx="43" cy="19" rx="10" ry="12" fill={SKY} transform="rotate(8 43 19)" />
      <path d="M42.6 31 L40 35.5 H45 Z" fill={SKY} strokeWidth="1.4" />
      <ellipse cx="32" cy="31" rx="10.5" ry="12.5" fill={MANGO} />
      <path d="M32 43.5 L29.3 48 H34.7 Z" fill={MANGO} strokeWidth="1.4" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="1.8">
        <path d="M15.5 17 C16 14 18 12.5 20 12" />
        <path d="M37.5 15 C38 12.5 40 11 42 10.5" />
        <path d="M26 27 C26.4 24 28 22 30 21.5" />
      </g>
    </>
  );
}

/** 어버이날: 카네이션 한 송이(주름진 꽃잎, 줄기, 잎) */
function Carnation() {
  return (
    <>
      <path d="M30 38 C30 48 33 53 32 61 H35.5 C36.5 52 33.5 47 34 38 Z" fill={MINT} />
      <path d="M33.5 53 C40 51 46 53 50 47 C44 44 36 47 33.5 53 Z" fill={MINT} />
      <path d="M31 53 C26 51 20 52 17 47 C23 44 29 46 31 53 Z" fill={MINT} />
      <path d="M16 26 C11 20 17 11 24 14 C26 7 37 7 39 14 C47 11 53 20 48 26 C53 32 47 39 40 36 C36 42 28 42 24 36 C17 39 11 32 16 26 Z" fill={ROSE} />
      <path d="M23 21 C28 17 36 17 41 21 M20 29 C27 34 37 34 44 29 M32 16.5 V29 M26 23 C27 26 28 28 28 30 M38 23 C37 26 36 28 36 30" fill="none" stroke={INK} strokeWidth="1.4" />
      <path d="M26 36 H38 L36 43 H28 Z" fill={MINT} strokeWidth="1.5" />
      <g stroke="none" fill={PINK}>
        <circle cx="10" cy="10" r="1.6" />
        <circle cx="55" cy="46" r="1.6" />
      </g>
    </>
  );
}

/** 스승의 날: 사과와 비스듬히 세운 연필 */
function ApplePencil() {
  return (
    <>
      <path d="M26 24 C20 17 8 21 9 34 C10 46 19 55 26 52 C33 55 42 46 43 34 C44 21 32 17 26 24 Z" fill={ROSE} />
      <path d="M26 24 C26 20 25 17 24 14" fill="none" strokeWidth="2.4" />
      <path d="M27 21 C28 14 34 11 39 12 C38 18 33 22 27 21 Z" fill={MINT} />
      <path d="M14 30 C14 27 16 25 18 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
      <g transform="translate(43 53) rotate(-64)">
        <path d="M0 -4 H24 V4 H0 Z" fill={MANGO} />
        <path d="M0 -4 L-9 0 L0 4 Z" fill="#FFE3C4" />
        <path d="M-5.2 -1.6 L-9 0 L-5.2 1.6 Z" fill={INK} strokeWidth="1" />
        <path d="M24 -4 H29 Q31 -4 31 -2 V2 Q31 4 29 4 H24 Z" fill={PINK} />
        <path d="M24 -4 V4 M8 -4 V4" fill="none" strokeWidth="1.3" />
      </g>
    </>
  );
}

/** 발렌타인데이: 리본 맨 큰 하트와 작은 하트들 */
function WrappedHeart() {
  return (
    <>
      <path d="M32 55 C10 40 6 26 15 18.5 C22 13 29 16 32 22.5 C35 16 42 13 49 18.5 C58 26 54 40 32 55 Z" fill={ROSE} />
      <path d="M16 24 C16 21 18 19 20.5 18.5" fill="none" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M22 17 L42 46 M42 17 L22 46" fill="none" stroke="none" />
      <path d="M32 22 C26 16 20 10 24 6.5 C27 4.5 31 8 32 12 C33 8 37 4.5 40 6.5 C44 10 38 16 32 22 Z" fill={MANGO} />
      <circle cx="32" cy="14.5" r="3.4" fill={MANGO_DEEP} strokeWidth="1.5" />
      <path d="M32 18 C30 28 35 36 32 42" fill="none" stroke={MANGO_DEEP} strokeWidth="2.6" />
      <path d="M52 8 C48 5 45 8.5 48 11 L52 14.5 L56 11 C59 8.5 56 5 52 8 Z" fill={PINK} strokeWidth="1.5" />
      <path d="M9 40 C6 37.5 4 40.5 6.5 42.5 L9 45 L11.5 42.5 C14 40.5 12 37.5 9 40 Z" fill={PINK} strokeWidth="1.5" />
    </>
  );
}

/** 화이트데이: 소용돌이 막대사탕과 포장 사탕 */
function Candy() {
  return (
    <>
      <path d="M33 38 L29 59" fill="none" stroke={INK} strokeWidth="5" />
      <path d="M33 38 L29 59" fill="none" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="33" cy="24" r="16" fill="#FFFFFF" />
      <path d="M33 24 C36 24 37 21 35 19 C31 16 26 20 27.5 25 C29 31 37 32 40 27 C43 21 38 13 31 13.5" fill="none" stroke={SKY} strokeWidth="3" />
      <path d="M33 24 C36 24 37 21 35 19" fill="none" stroke={PINK} strokeWidth="3" />
      <g transform="translate(47 49) rotate(-22)">
        <path d="M-7 0 L-15 -6 V6 Z" fill={PINK} strokeWidth="1.5" />
        <path d="M7 0 L15 -6 V6 Z" fill={PINK} strokeWidth="1.5" />
        <ellipse cx="0" cy="0" rx="8.5" ry="6.5" fill={MANGO} />
        <path d="M-3 -5 C-1 -2 -1 2 -3 5 M3 -5.5 C5 -2 5 2 3 5.5" fill="none" strokeWidth="1.3" />
      </g>
      <g stroke="none" fill={PINK}>
        <circle cx="9" cy="11" r="1.5" />
        <circle cx="10" cy="48" r="1.5" />
      </g>
    </>
  );
}

/** 빼빼로데이: 리본으로 묶은 빼빼로 셋 */
function PeperoSticks() {
  const stick = (rot: number, x: number) => (
    <g transform={`rotate(${rot} 32 58)`}>
      <rect x={x - 4} y="10" width="8" height="48" rx="4" fill="#F3D9A0" />
      <path d={`M${x - 4} 38 V14 Q${x - 4} 10 ${x} 10 Q${x + 4} 10 ${x + 4} 14 V38 Z`} fill={CHOCO} />
      <path d={`M${x - 4} 38 C${x - 2} 41 ${x} 36 ${x + 2} 40 C${x + 3} 41 ${x + 4} 39 ${x + 4} 38`} fill={CHOCO} strokeWidth="1.4" />
      <g stroke="none" fill={CREAM}>
        <circle cx={x - 1.5} cy="16" r="0.9" />
        <circle cx={x + 1.5} cy="22" r="0.9" />
        <circle cx={x - 1.5} cy="28" r="0.9" />
        <circle cx={x + 1.5} cy="33" r="0.9" />
      </g>
    </g>
  );
  return (
    <>
      {stick(-20, 32)}
      {stick(20, 32)}
      {stick(0, 32)}
      <path d="M23 52 C28 55 36 55 41 52 V58 C36 61 28 61 23 58 Z" fill={ROSE} strokeWidth="1.6" />
      <path d="M32 54 C27 49 22 51 24 54 C26 57 30 56 32 54 C34 56 38 57 40 54 C42 51 37 49 32 54 Z" fill={PINK} strokeWidth="1.5" />
      <g fill="none" strokeWidth="1.5">
        <path d="M8 12 V18 M5 15 H11" />
        <path d="M54 30 V35 M51.5 32.5 H56.5" />
      </g>
    </>
  );
}

const ART: Record<HolidayId, () => React.JSX.Element> = {
  christmas: Tree,
  seollal: Pouch,
  chuseok: MoonAndSongpyeon,
  childrensDay: Balloons,
  parentsDay: Carnation,
  teachersDay: ApplePencil,
  valentine: WrappedHeart,
  whiteDay: Candy,
  pepero: PeperoSticks,
};

/** 명절·챙기는 날의 손그림(사진 칸 안에 들어가는 크기) */
export function HolidayArt({ id, size = 70 }: { id: HolidayId; size?: number }) {
  const Art = ART[id];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="block" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Art />
    </svg>
  );
}

/** 다가오는 날 카드의 주인공(명절): 폴라로이드에 그날의 그림. 사람 얼굴 대신이라 누르는 곳은 아니다 */
export function HolidayPortrait({ id }: { id: HolidayId }) {
  return (
    <span aria-hidden="true" className="block shrink-0 py-2 pl-1 pr-2">
      <Polaroid rotate={-4}>
        <HolidayArt id={id} />
      </Polaroid>
    </span>
  );
}
