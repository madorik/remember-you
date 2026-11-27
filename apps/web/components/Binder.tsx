import type { CSSProperties } from "react";
import { u } from "@/lib/ui-scale";

// 바인더 속지 한 장(시안 D-Write·D-Person): 흰 종이(점 모눈은 고를 수 있다)에 왼쪽 가장자리를 가로지르는 은빛 링 여섯(위 셋·아래 셋).
// 메모 쓰기 화면과 사람 화면의 메모장·기억해 둔 것이 같이 쓴다. 크기 숫자는 시안 값(90% 전)이고 u()가 90%로 줄인다.

/** 링 하나의 위(또는 아래)에서의 거리(시안 값): 구멍의 위쪽 */
const RINGS = [58, 88, 118] as const;

const GRID: CSSProperties = {
  backgroundImage: "radial-gradient(circle, #C9D1E4 1px, transparent 1.4px)",
  backgroundSize: `${u(17)}px ${u(17)}px`,
  backgroundPosition: `${u(4)}px ${u(6)}px`,
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
 * dots: 점 모눈. pad: 종이 안쪽 가로 여백(왼쪽은 링 자리라 넓다). 감싸는 쪽이 위치·바깥 여백을 정한다(className).
 * 링이 종이 밖으로 나오므로 이 요소 자체는 overflow를 자르지 않고, 종이(안쪽)만 둥근 모서리로 자른다
 */
export function BinderPage({
  dots = true,
  left = 40,
  className = "",
  pageClassName = "",
  children,
}: {
  dots?: boolean;
  /** 종이 안쪽 왼쪽 여백(시안 값) */
  left?: number;
  className?: string;
  pageClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        className={`relative z-[1] box-border h-full overflow-hidden border border-edge bg-white shadow-[0_14.4px_23.4px_-18px_rgb(31_35_64/0.55)] ${pageClassName}`}
        style={{ paddingLeft: u(left), paddingRight: u(16), borderRadius: `${u(6)}px ${u(16)}px ${u(16)}px ${u(6)}px`, ...(dots ? GRID : null) }}
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
