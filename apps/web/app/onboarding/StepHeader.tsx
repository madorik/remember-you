import Link from "next/link";
import type { Locale } from "@readme/core";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import type { T } from "@/lib/i18n";

// 제목을 두 줄로 나누는 자리(첫 줄에 들어갈 낱말 수): 첫 줄은 그대로, 둘째 줄에 형광펜
const LEAD: Record<Locale, [number, number, number]> = { ko: [2, 3, 1], en: [1, 2, 2] };

// 단계 캐릭터(시안): 못 먹는 것 = 깜짝(9), 생일 = 하트 점프(3). 높이는 86px 틀 안에 들어가게
const STEP_MASCOT = { 2: { pose: 9, size: 65 }, 3: { pose: 3, size: 75 } } as const;

/**
 * 온보딩 윗부분(시안): 뒤로 · 진행 점 셋(지금 단계는 긴 알약) · 나중에, 손글씨 제목과 캐릭터. 아래는 흰 카드(Steps)가 이어진다.
 * compact: 한 화면에 다 들어와야 하는 단계(캐릭터 만들기)용 — 뒤로·나중에 줄과 캐릭터를 빼고 제목을 한 줄로
 */
export function StepHeader({ step, back, skip, t, title, locale = "ko", compact = false }: { step: 1 | 2 | 3; back?: string; skip?: string; t: T; title: string; locale?: Locale; compact?: boolean }) {
  const words = title.split(" ");
  const lead = Math.min(LEAD[locale][step - 1], words.length - 1);
  const dots = (
    <div role="progressbar" aria-label={t("onb.step", { n: step })} aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} className="flex justify-center gap-1.5">
      {([1, 2, 3] as const).map((n) => (
        <span key={n} className={`box-border block h-2 rounded-full border border-edge ${n === step ? "w-[19.8px] bg-sky" : n < step ? "w-2 bg-sky" : "w-2 bg-white"}`} />
      ))}
    </div>
  );
  if (compact)
    return (
      <div className="relative">
        <div className="flex h-12 items-center justify-center">{dots}</div>
        <h1 className="whitespace-nowrap px-6 pt-2 text-[30.8px] leading-[1.15]">
          {words.slice(0, lead).join(" ")} <span className="hl">{words.slice(lead).join(" ")}</span>
        </h1>
      </div>
    );
  const mascot = STEP_MASCOT[step === 3 ? 3 : 2];
  return (
    <div className="relative">
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center pl-1.5 pr-2">
        {back ? (
          <Link href={back} aria-label={t("common.back")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center justify-self-start">
            <Icon name="back" size={26} strokeWidth={2} />
          </Link>
        ) : (
          <span />
        )}
        {dots}
        {skip ? (
          <Link href={skip} className="flex h-11 items-center justify-self-end px-2 text-[12.6px] text-muted">
            {step === 1 ? t("common.skip") : t("common.later")}
          </Link>
        ) : (
          <span />
        )}
      </div>
      <div className="flex items-end justify-between gap-1.5 pl-6 pr-[16.2px] pt-2">
        <h1 className="mb-2 min-w-0 text-[30.8px] leading-[1.15]">
          {words.slice(0, lead).join(" ")} <br />
          <span className="hl">{words.slice(lead).join(" ")}</span>
        </h1>
        <span aria-hidden="true" className="flex h-[77.4px] w-[77.4px] shrink-0 items-end justify-center">
          <Mascot pose={mascot.pose} size={mascot.size} />
        </span>
      </div>
    </div>
  );
}
