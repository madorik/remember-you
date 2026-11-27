import type { CSSProperties } from "react";
import { u } from "@/lib/ui-scale";

// 바인더 속지 한 장(시안 D-Write·D-Person): 흰 종이(라인 노트 줄·여백선은 고를 수 있다)에 왼쪽 가장자리를 가로지르는 은빛 링 여섯(위 셋·아래 셋).
// 메모 쓰기 화면과 사람 화면의 메모장·기억해 둔 것이 같이 쓴다. 크기 숫자는 시안 값(90% 전)이고 u()가 90%로 줄인다.

/** 링 하나의 위(또는 아래)에서의 거리(시안 값): 구멍의 위쪽 */
const RINGS = [58, 88, 118] as const;

/**
 * 라인 노트 줄 간격(px): 메모 본문(손글씨 20.7px)의 줄 높이와 같다(34 × 0.9). 글이 줄 위에 앉도록 본문·타임라인 줄 높이를 이 값으로 맞춘다.
 * 정수가 아니라 dpr 2·3에서도 줄이 또렷하도록 반복 그라데이션(경계가 화면 픽셀 중심에서 잘려 두께가 늘 같다)으로 그린다
 */
export const RULE = u(34);
/** 줄 위치: 줄 높이 칸 안에서 글 바닥(글줄 맨 위에서 이만큼 내려간 곳)에 줄이 놓인다(손글씨 글씨체 기준 눈대중 값) */
export const RULE_AT = 25.5;
const LINE = "#DCE6F5";
/** 학교 노트의 여백선: 링 오른쪽, 글이 시작하는 곳(왼쪽 여백 36px) 바로 왼쪽 */
const MARGIN_X = u(31);
const MARGIN_LINE = "#F2A7B5";

/**
 * 라인 노트 줄 배경: 맨 위에서 first(px) 내려간 곳에 1px 줄이 있고 RULE마다 되풀이된다.
 * 내용이 흐르는 자리(예: 본문 칸)에 이 배경을 주면 글이 늘어도 줄이 같이 늘어난다
 */
export function ruledLines(first: number): CSSProperties {
  const at = ((first % RULE) + RULE) % RULE;
  const top = at > 0 ? `transparent 0, transparent ${at}px, ` : "";
  return {
    backgroundImage: `repeating-linear-gradient(to bottom, ${top}${LINE} ${at}px, ${LINE} ${at + 1}px, transparent ${at + 1}px, transparent ${RULE}px)`,
  };
}

/** 여백선(세로): 속지 맨 위부터 맨 아래까지 */
const MARGIN: CSSProperties = {
  backgroundImage: `linear-gradient(to right, transparent ${MARGIN_X}px, ${MARGIN_LINE} ${MARGIN_X}px, ${MARGIN_LINE} ${MARGIN_X + 1.3}px, transparent ${MARGIN_X + 1.3}px)`,
};

function Ring({ at, from }: { at: number; from: "top" | "bottom" }) {
  return (
    <>
      {/* 종이에 뚫린 구멍 */}
      <span aria-hidden="true" className="absolute z-[2] box-border rounded-full border border-edge bg-paper" style={{ left: u(11), [from]: u(at), width: u(13), height: u(13) }} />
      {/* 구멍을 지나 종이 가장자리 밖으로 나온 은빛 고리 */}
      <span
        aria-hidden="true"
        className="absolute z-[3] box-border rounded-full border border-edge-strong"
        style={{ left: -u(13), [from]: u(at + 2.5), width: u(33), height: u(8), background: "linear-gradient(#F6F7FA, #B7BDCE)" }}
      />
    </>
  );
}

/**
 * margin: 여백선(분홍). lines: 속지 전체에 가로 줄을 긋는다(값은 속지 맨 위에서 첫 줄까지의 거리 — 글줄 칸 맨 위의 거리에 RULE_AT을 더해 준다).
 * 줄 높이 칸이 속지 맨 위에서 가늠되지 않는 화면(위가 길이 바뀌는 메모 쓰기)은 lines 없이 본문 칸에 ruledLines()를 준다.
 * 감싸는 쪽이 위치·바깥 여백을 정한다(className).
 * 링이 종이 밖으로 나오므로 이 요소 자체는 overflow를 자르지 않고, 종이(안쪽)만 둥근 모서리로 자른다
 */
export function BinderPage({
  margin = false,
  lines,
  left = 40,
  className = "",
  pageClassName = "",
  children,
}: {
  margin?: boolean;
  lines?: number;
  /** 종이 안쪽 왼쪽 여백(시안 값) */
  left?: number;
  className?: string;
  pageClassName?: string;
  children: React.ReactNode;
}) {
  // 줄(아래)과 여백선(위)을 한 배경에 겹친다
  const layers = [margin ? MARGIN.backgroundImage : null, lines !== undefined ? ruledLines(lines).backgroundImage : null].filter(Boolean);
  const paper: CSSProperties = layers.length ? { backgroundImage: layers.join(", ") } : {};
  return (
    <div className={`relative ${className}`}>
      <div
        className={`relative z-[1] box-border h-full overflow-hidden border border-edge bg-white shadow-[0_14.4px_23.4px_-18px_rgb(31_35_64/0.55)] ${pageClassName}`}
        style={{ paddingLeft: u(left), paddingRight: u(16), borderRadius: `${u(6)}px ${u(16)}px ${u(16)}px ${u(6)}px`, ...paper }}
      >
        {children}
      </div>
      {RINGS.map((at) => (
        <Ring key={`t${at}`} at={at} from="top" />
      ))}
      {RINGS.map((at) => (
        <Ring key={`b${at}`} at={at} from="bottom" />
      ))}
    </div>
  );
}
