"use client";

import { useEffect, useState } from "react";
import { Sparkle, Star } from "@/components/diary";
import { TornTape } from "@/components/TornTape";
import { Icon } from "@/components/marks";

/** 단계가 바뀌는 시간(ms). 마지막 단계에서는 멈춰 기다린다 */
const STEP_MS = [1400, 1500];

/** 지금 몇 번째 문구인가: 시간에 맞춰 하나씩 올라가고 마지막에서 멈춘다 */
function useStep(count: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= count - 1) return;
    const t = setTimeout(() => setStep(step + 1), STEP_MS[Math.min(step, STEP_MS.length - 1)]);
    return () => clearTimeout(t);
  }, [step, count]);
  return step;
}

/** 적은 문장을 낱말 조각으로(여섯 조각까지, 긴 낱말은 줄인다) */
const pieces = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((w) => (Array.from(w).length > 8 ? `${Array.from(w).slice(0, 7).join("")}…` : w));

const LINES = [
  ["62%", "40%"],
  ["72%", "52%"],
  ["54%", "66%"],
];

/**
 * 기억해 두기를 누른 뒤 AI가 정리하는 동안 보이는 화면(스피너 대신). 적은 문장이 낱말 조각으로 나뉘어 아래 카드로 날아가 쌓이고,
 * 카드마다 연필이 줄을 쓴다. 문구는 steps(분류하고 있어요 → 적고 있어요 → 정리하고 있어요)가 1.4초쯤마다 바뀌고 마지막에서 멈춰 기다린다.
 * 움직임 줄이기를 켜면 그림은 멈추고 문구만 바뀐다. 문구는 aria-live로 읽힌다
 */
export function OrganizeScene({ text, steps }: { text: string; steps: string[] }) {
  const step = useStep(steps.length);
  const words = pieces(text);
  return (
    <div className="organize page-end flex flex-1 flex-col items-center justify-center px-4" data-step={step}>
      {/* 적은 문장 */}
      <section aria-hidden="true" className="card relative w-full px-3.5 py-3">
        <TornTape color="pink" w={72} h={22} rotate={-6} className="-top-3 left-5" />
        <p className="hand-written line-clamp-3 text-[19.4px] leading-[27px] [background-image:repeating-linear-gradient(180deg,transparent_0_26px,#d5e1f3_26px_27px)]">{text}</p>
      </section>

      {/* 문장에서 떨어져 나온 조각들이 아래 카드로 날아간다 */}
      <div aria-hidden="true" className="relative z-10 flex h-[104.4px] w-full flex-wrap content-start justify-center gap-1.5 px-5 pt-3.5">
        {words.map((w, i) => (
          <span key={i} className="organize-chip" style={{ "--i": i, "--dx": `${((words.length - 1) / 2 - i) * 24}px`, "--r": `${i % 2 ? 4 : -4}deg` } as React.CSSProperties}>
            {w}
          </span>
        ))}
      </div>

      {/* 쌓이는 카드와 줄을 쓰는 연필 */}
      <div aria-hidden="true" className="relative mb-9 h-[124.2px] w-[78%]">
        {LINES.map((widths, k) => (
          <div key={k} className="organize-card" style={{ "--k": k, "--rot": `${[-2.2, 1.6, -1][k]}deg`, top: k * 34 } as React.CSSProperties}>
            <span className={`h-[19.8px] w-[19.8px] shrink-0 rounded-full shadow-[inset_0_0_0_1px_var(--color-edge)] ${["bg-sky", "bg-pink", "bg-mint"][k]}`} />
            <span className="flex min-w-0 flex-1 flex-col gap-[6.3px] pt-1">
              {widths.map((w, l) => (
                <span key={l} className="organize-line" style={{ width: w, "--l": l } as React.CSSProperties} />
              ))}
            </span>
          </div>
        ))}
        <span className="organize-pencil">
          <Icon name="pencil" size={26} strokeWidth={2} />
        </span>
        <Star size={22} rotate={14} className="-right-3 -top-3" />
        <Sparkle size={20} className="organize-sparkle -left-4 bottom-1" />
      </div>

      {/* 지금 하는 일: 문구가 바뀔 때마다 위로 올라오며 나타난다 */}
      <p role="status" aria-live="polite" className="hand-written flex h-9 items-center justify-center gap-0.5 text-[21.1px] leading-none">
        <span key={step} className="organize-step">
          {steps[step]}
        </span>
        <span aria-hidden="true" className="organize-dots">
          <i />
          <i />
          <i />
        </span>
      </p>
      <div aria-hidden="true" className="mt-4 flex items-center gap-2">
        {steps.map((_, i) => (
          <span key={i} className={`h-2.5 rounded-full transition-all duration-500 ${i <= step ? "w-7 bg-mango-deep" : "w-2.5 bg-rule-strong"}`} />
        ))}
      </div>
    </div>
  );
}
