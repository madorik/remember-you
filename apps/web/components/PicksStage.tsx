"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GiftScene } from "@/lib/gift-scene";

// 선물을 고르는 동안 보이는 장면(꼬마 소녀 마법사 + 구슬). 예전 빈 자리(스켈레톤) 대신이다.
// 다 고르면: 구슬이 번쩍이고 소녀가 '얍!' → 번쩍임이 가장 환할 때 고른 선물이 드러난다.
// 장면은 Suspense 바깥에 있어서(Suspense 안은 다 고르는 순간 사라진다) 고른 선물이 DOM에 들어오는 걸 지켜보다가 순서를 이끈다.
// three.js는 무거워서 장면이 필요할 때만 늦게 불러오고, 끝나면 WebGL을 바로 놓는다.
// 소녀는 말풍선으로 진행을 알린다(lines: 차례로 바뀌고 마지막 줄에서 멈춘다) → 다 고르면 마지막 줄('거의 다 됐어요') → '얍!'(shout).
// 단계(data-phase): init(서버가 그린 그대로) → loading(장면) → finale(얍!) → done(번쩍임 뒤 드러남) / plain(장면 없이 바로 보임)

type Phase = "init" | "loading" | "finale" | "done" | "plain";

// 한 화면에 장면은 하나만(여러 사람 화면에서 WebGL이 여럿 뜨지 않게). 나머지는 그림 자리만 보인다
let live = 0;

export function PicksStage({ children, lines, shout, compact }: { children: React.ReactNode; lines: string[]; shout: string; compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("init");
  const [on, setOn] = useState(false);
  const [gone, setGone] = useState(false);
  const [line, setLine] = useState(0);
  const [yap, setYap] = useState(false);

  // 장면이 뜬 뒤로 말풍선이 차례로 바뀐다(마지막 줄에서 멈춘다)
  useEffect(() => {
    if (!on || phase !== "loading" || line >= lines.length - 1) return;
    const t = setTimeout(() => setLine((l) => l + 1), 2100);
    return () => clearTimeout(t);
  }, [on, phase, line, lines.length]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const has = () => el.querySelector("[data-picks-content]") !== null;
    // 이미 다 골라져 있으면(서버가 바로 그렸다) 장면 없이 그대로 보인다
    if (has()) {
      setPhase("plain");
      return;
    }
    setPhase("loading");

    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let settled = false;
    let scene: GiftScene | null = null;
    let shownAt = 0;
    let holds = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const release = () => {
      if (holds) {
        holds = false;
        live -= 1;
      }
    };

    // 장면이 막 떴다가 바로 사라지면 오히려 번쩍거려 보인다: 선물이 곧 오면 장면을 아예 안 띄운다
    later(async () => {
      if (settled || live > 0 || !canvas.current) return;
      live += 1;
      holds = true;
      try {
        const mod = await import("@/lib/gift-scene");
        if (settled || !canvas.current) return release();
        scene = mod.createGiftScene(canvas.current, { still: reduce });
        if (!scene) return release();
        shownAt = performance.now();
        setOn(true);
      } catch {
        release();
      }
    }, 150);

    const reveal = () => {
      setPhase("done");
      // 흐려지는 동안(0.3초)만 남기고 정리: 장면을 놓고 WebGL도 돌려준다(CSS picks-scene 흐려지기 300ms보다 길게)
      later(() => {
        scene?.dispose();
        scene = null;
        release();
        setGone(true);
      }, 400);
    };

    const ready = () => {
      if (settled) return;
      settled = true;
      mo.disconnect();
      // 장면이 아직 없거나 막 떴거나 움직임 줄이기면: 장면 없이 바로 보여 준다
      if (!scene || reduce || performance.now() - shownAt < 700) {
        scene?.dispose();
        scene = null;
        release();
        setPhase("plain");
        return;
      }
      setPhase("finale");
      setLine(lines.length - 1); // 모으는 동안엔 '거의 다 됐어요'
      let shown = false;
      const show = () => {
        if (shown) return;
        shown = true;
        reveal();
      };
      scene.finale(show, () => setYap(true));
      // 탭이 가려져 화면이 안 그려져도(번쩍임이 안 오면) 멈춰 있지 않게(정상이면 모으기 0.25초 + 번쩍임 0.2초 = 0.45초 만에 온다)
      later(show, 900);
    };

    const mo = new MutationObserver(() => {
      if (has()) ready();
    });
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      settled = true;
      mo.disconnect();
      timers.forEach(clearTimeout);
      scene?.dispose();
      scene = null;
      release();
    };
    // lines는 처음 한 번만 쓴다(화면이 바뀌면 key로 다시 만든다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} data-phase={phase} data-scene={on ? "on" : "off"} className="picks-stage group/stage flex flex-col">
      {!gone ? (
        <div
          role="status"
          className="picks-scene relative mx-4 mt-3 overflow-hidden rounded-[25.2px]"
          style={{ "--picks-h": compact ? "310px" : "410px", height: "var(--picks-h)", background: "linear-gradient(140deg, #fff6dd 0%, #ffe7a6 55%, #ffd36b 100%)" } as React.CSSProperties}
        >
          <span aria-hidden="true" className="absolute -right-16 top-6 size-56 rounded-full bg-white/30" />
          {/* 장면이 뜨기 전(또는 WebGL이 안 될 때) 자리를 지키는 구슬 */}
          {/* (깜빡이는 건 안쪽 span: 바깥이 흐려지는 것과 겹치면 장면 뒤로 비친다) */}
          <span aria-hidden="true" className="absolute left-1/2 top-[58%] size-32 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 group-data-[scene=on]/stage:opacity-0">
            <span
              className="block size-full rounded-full motion-safe:animate-pulse"
              style={{ background: "radial-gradient(circle at 36% 30%, #fff 0, #dff0fd 42%, #8cc8f0 100%)", boxShadow: "0 0 0 3px #1f2340, 0 0 56px 18px rgba(255,255,255,0.65)" }}
            />
          </span>
          <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 block h-full w-full opacity-0 transition-opacity duration-300 group-data-[scene=on]/stage:opacity-100" />
          {/* 소녀의 말풍선: 장면이 떠 있는 동안만 */}
          <div aria-live="polite" className="pointer-events-none absolute left-3 top-3 max-w-[46%] opacity-0 transition-opacity duration-300 group-data-[scene=on]/stage:opacity-100">
            <p
              key={yap ? "yap" : line}
              className={`relative rounded-2xl rounded-bl-md border-2 border-ink bg-white px-3 py-2 leading-[1.3] text-ink motion-safe:animate-[picks-pop_360ms_cubic-bezier(.3,1.5,.5,1)] ${yap ? "hand text-[24.3px]" : "hand-written text-[17.8px]"}`}
            >
              {yap ? shout : lines[line]}
              <span aria-hidden="true" className="absolute -bottom-[6.3px] right-7 size-3 rotate-45 border-b-2 border-r-2 border-ink bg-white" />
            </p>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
