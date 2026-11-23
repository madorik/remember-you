import { u } from "@/lib/ui-scale";
// 캐릭터: 손그림 우주 캐릭터(배경 투명, 색 그대로) 12동작 스프라이트(public/char-sprite-v1.webp, 988×597, 4열×3줄, 칸 247×199).
// 동작 번호: 1 별 안기(!!) · 2 빼꼼(선 위에 손) · 3 하트 점프 · 4 큰 하트 · 5 구름 잠 · 6 편지 들고 달리기 · 7 책 읽기 · 8 비행접시 · 9 깜짝 · 10 뒷모습 · 11 별 들고 웃기 · 12 누워 쉬기.
// 쓰는 곳: 가운데 단추=7(구슬 안), 물어보기 카드·물어보기 완성·답하기=6, 사람 상세·시작·마음이 전해졌어요=4, 말로 적기 듣는 중=1,
// 이렇게 기억해 둘게요·같이 고르기=11, 못 먹는 것·받은 기록=9, 생일(온보딩)=3, 메모 가져오기=7, 설정=5, 질문 없는 날·달력 다가오는 날=12, 챙길 날 큰 카드=2, 질문 다 한 날=11.
// 장식이라 스크린리더에는 숨긴다(aria-hidden). 서버·클라이언트 어디서나 쓴다(훅 없음).

export const SPRITE_URL = "/char-sprite-v1.webp";
const SW = 988;
const SH = 597;
const CELL_W = 247;
const CELL_H = 199;
const COLS = 4;

export type MascotPose = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

// 동작마다 칸 안에서 캐릭터가 차지하는 자리(x, y, w, h: 스프라이트 px). 칸 가장자리의 빈 투명 부분을 뺀 빽빽한 상자
const BOX: Record<MascotPose, { x: number; y: number; w: number; h: number }> = {
  1: { x: 35, y: 32, w: 176, h: 161 },
  // 2(빼꼼): 왼쪽 끝에 얼룩 한 점이 있어 왼쪽 24px를 잘라 낸다
  2: { x: 6 + 24, y: 78, w: 235 - 24, h: 115 },
  3: { x: 27, y: 6, w: 192, h: 187 },
  4: { x: 32, y: 37, w: 182, h: 156 },
  5: { x: 26, y: 52, w: 195, h: 141 },
  6: { x: 35, y: 35, w: 177, h: 158 },
  7: { x: 17, y: 45, w: 213, h: 148 },
  8: { x: 24, y: 37, w: 198, h: 156 },
  9: { x: 36, y: 45, w: 175, h: 148 },
  10: { x: 40, y: 50, w: 166, h: 143 },
  11: { x: 40, y: 44, w: 166, h: 149 },
  12: { x: 31, y: 80, w: 184, h: 113 },
};

/** 동작의 가로세로 비(잘라 낸 상자 기준) */
export function mascotRatio(pose: MascotPose): number {
  return BOX[pose].w / BOX[pose].h;
}

/**
 * 스프라이트 한 동작을 scale(스프라이트 1px가 화면 몇 px인지)로 그린다: 틀 크기와 배경 그림 자리.
 * 구슬 단추처럼 여러 동작을 같은 크기 비율로 겹쳐 쓸 때 쓴다(Mascot은 높이로 비율을 정한다)
 */
export function mascotStyle(pose: MascotPose, scale: number): React.CSSProperties {
  const b = BOX[pose];
  const col = (pose - 1) % COLS;
  const row = Math.floor((pose - 1) / COLS);
  return {
    width: b.w * scale,
    height: b.h * scale,
    backgroundImage: `url(${SPRITE_URL})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${SW * scale}px ${SH * scale}px`,
    backgroundPosition: `${-(col * CELL_W + b.x) * scale}px ${-(row * CELL_H + b.y) * scale}px`,
  };
}

/** 캐릭터 한 동작. size는 그림의 높이(px)이고 가로는 동작에 맞게 따라온다. 빈 투명 부분은 잘라 내서 자리가 딱 맞는다 */
export function Mascot({ pose = 6, size = 64, className = "", style }: { pose?: MascotPose; size?: number; className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={`block shrink-0 ${className}`} style={{ ...mascotStyle(pose, u(size) / BOX[pose].h), ...style }} />;
}
