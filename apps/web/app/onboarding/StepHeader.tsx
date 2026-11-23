import Link from "next/link";
import type { Locale } from "@readme/core";
import { Star } from "@/components/diary";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import type { T } from "@/lib/i18n";

// 제목을 두 줄로 나누는 자리(첫 줄에 들어갈 낱말 수): 첫 줄은 그대로, 둘째 줄에 형광펜
const LEAD: Record<Locale, [number, number, number]> = { ko: [2, 3, 1], en: [1, 2, 2] };

/**
 * 온보딩 윗부분: 크림 바탕 위에 뒤로·나중에, 진행 막대(웃는 손잡이), 제목과 리디. 아래 종이 시트(Steps의 SHEET)가 이어진다.
 * compact: 한 화면에 다 들어와야 하는 단계(캐릭터 만들기)용 — 뒤로·나중에 줄과 리디를 빼고 제목을 한 줄로
 */
export function StepHeader({ step, back, skip, t, title, locale = "ko", compact = false }: { step: 1 | 2 | 3; back?: string; skip?: string; t: T; title: string; locale?: Locale; compact?: boolean }) {
  const pct = `${(step / 3) * 100}%`;
  const words = title.split(" ");
  const lead = Math.min(LEAD[locale][step - 1], words.length - 1);
  const progress = (pt: string) => (
    <div className={`flex items-center gap-3 px-6 ${pt}`}>
      <div role="progressbar" aria-label={t("onb.step", { n: step })} aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} className="relative h-3 flex-1 rounded-full bg-white shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-sky" style={{ width: pct }} />
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 30 30" className="absolute -top-2.5" style={{ left: `calc(${pct} - 14px)` }}>
          <circle cx="15" cy="15" r="13" fill="#FFFFFF" stroke="#1F2340" strokeWidth="2" />
          <circle cx="11" cy="13.5" r="1.7" fill="#1F2340" />
          <circle cx="19" cy="13.5" r="1.7" fill="#1F2340" />
          <path d="M11.5 18 Q15 21 18.5 18" fill="none" stroke="#1F2340" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <span aria-hidden="true" className="num text-[20px]">
        {t("onb.step", { n: step })}
      </span>
    </div>
  );
  if (compact)
    return (
      <div className="relative" style={{ paddingTop: "max(var(--sat), 14px)" }}>
        {progress("")}
        <h1 className="whitespace-nowrap px-6 pt-2 text-[28px] leading-[1.3]">
          {words.slice(0, lead).join(" ")} <span className="hl px-1">{words.slice(lead).join(" ")}</span>
        </h1>
        <Star size={22} rotate={14} className="right-11 top-[80px]" />
      </div>
    );
  return (
    <div className="relative" style={{ paddingTop: "max(var(--sat), 12px)" }}>
      <div className="flex min-h-11 items-center justify-between px-2 pt-1.5">
        {back ? (
          <Link href={back} aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center">
            <Icon name="back" size={24} strokeWidth={2} />
          </Link>
        ) : (
          <span className="w-11" />
        )}
        {skip ? (
          <Link href={skip} className="flex min-h-11 items-center px-3 text-[19px] text-muted">
            {step === 1 ? t("common.skip") : t("common.later")}
          </Link>
        ) : (
          <span className="w-11" />
        )}
      </div>
      {progress("pt-1")}
      <div className="relative flex items-end gap-2 pl-6 pr-[18px] pt-4">
        <h1 className="min-w-0 flex-1 pb-2 text-[34px] leading-[1.3]">
          {words.slice(0, lead).join(" ")} <br />
          <span className="hl -ml-1 px-1">{words.slice(lead).join(" ")}</span>
        </h1>
        <Mascot pose={step === 2 ? 3 : step === 3 ? 9 : 4} size={86} />
        <Star size={22} rotate={14} className="left-[178px] top-3" />
      </div>
    </div>
  );
}
