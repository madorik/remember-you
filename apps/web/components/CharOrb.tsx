"use client";

import Link from "next/link";
import { useRef } from "react";
import { mascotStyle, type MascotPose } from "./Mascot";

/**
 * 아래 메뉴 가운데 단추 '구슬 속 캐릭터': 유리 구슬(망고빛 그라데이션 + 위 반사광 + 아래 테두리 반사 + 공기방울) 안의 캐릭터.
 * CSS는 app/globals.css의 .orb-wrap(시안 P2-Orb와 같다). 8초 한 바퀴: 책 읽으며 둥둥(7) → 오른쪽 유리에 콩·찌그러짐(구슬도 출렁) → 깜짝(9) → 별 들고 통통(11) → 책(7).
 * 누를 때(눌렀다 뗄 때가 아니라 누르는 순간): 쏙 작아졌다가 젤리처럼 통 튀고, 캐릭터가 깜짝(9)에서 웃는(11) 얼굴로.
 * 듣는 동안(<html data-listening>, lib/orb.ts): 구슬이 숨 쉬듯 커졌다 작아지고 바깥으로 물결 고리가 퍼지며 캐릭터는 귀 쫑긋(1)으로 통통. 마이크 크기(--mic)에 맞춰 더 출렁인다.
 * 움직임 줄이기를 켜면 책 읽는 멈춘 그림.
 * 구슬 안은 모두 장식이라 스크린리더에는 링크 이름(label)만 읽힌다.
 */
// 구슬 크기 S에서 캐릭터 한 칸이 차지하는 비율(시안: S 62 → 스프라이트 배율 0.235). 동작이 달라도 같은 배율이라 키가 같다
const SCALE = 0.00379;
const IDLE = [7, 9, 11] as const;

function Pose({ pose, className, scale }: { pose: MascotPose; className: string; scale: number }) {
  return <span className={`pose ${className}`} style={mascotStyle(pose, scale)} />;
}

export function CharOrbLink({ href, label, size = 62 }: { href: string; label: string; size?: number }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = size * SCALE;
  // 누르는 순간 반응을 처음부터 다시 돌린다(연달아 눌러도 매번 통 튄다)
  const react = () => {
    const el = wrap.current;
    if (!el) return;
    el.removeAttribute("data-react");
    void el.offsetWidth;
    el.setAttribute("data-react", "");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => el.removeAttribute("data-react"), 900);
  };
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      // 손가락·마우스는 누르는 순간, 키보드(Enter)는 열릴 때(detail 0) 반응
      onPointerDown={react}
      onClick={(e) => {
        if (e.detail === 0) react();
      }}
      className="flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      <span ref={wrap} data-orb="" aria-hidden="true" className="orb-wrap" style={{ width: size, height: size }}>
        <span className="orb-ripple" />
        <span className="orb-ripple" style={{ animationDelay: "0.8s" }} />
        <span className="orb">
          <span className="bub b1" />
          <span className="bub b2" />
          <span className="bub b3" />
          <span className="mover" style={{ width: size * 0.82, height: size * 0.565 }}>
            {/* 평소: 7(책) → 9(깜짝) → 11(별) */}
            <Pose pose={IDLE[0]} className="idle p1" scale={scale} />
            <Pose pose={IDLE[1]} className="idle p2" scale={scale} />
            <Pose pose={IDLE[2]} className="idle p3" scale={scale} />
            {/* 누를 때: 9(깜짝) → 11(웃는 얼굴) */}
            <Pose pose={9} className="react r1" scale={scale} />
            <Pose pose={11} className="react r2" scale={scale} />
            {/* 듣는 동안: 1(별 안기, !!) */}
            <Pose pose={1} className="listen" scale={scale} />
          </span>
          <span className="shine" />
          <span className="dot" />
          <span className="rim" />
        </span>
      </span>
    </Link>
  );
}
