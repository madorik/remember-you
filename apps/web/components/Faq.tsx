import { MarginLine, Tape } from "@/components/diary";
import type { Faq } from "@/lib/faq";

/**
 * 자주 묻는 질문(접이식, 줄노트 종이). 선물 가이드와 시작 화면이 같이 쓴다.
 * 접어 둔 답도 HTML에는 그대로 있어서 검색·AI가 읽는다(구조화 데이터와 같은 글)
 */
export function FaqList({ id, title, items, lang }: { id: string; title: string; items: Faq[]; lang?: string }) {
  return (
    <section aria-labelledby={id} lang={lang} className="relative flex flex-col gap-2.5 px-4 pt-[38px]">
      <h2 id={id} className="ml-1 text-[25px] font-normal">
        {title}
      </h2>
      <div className="ruled relative rounded-[10px] bg-paper py-1.5 pl-10 pr-3.5 shadow-[0_1px_2px_rgb(31_35_64/0.08),0_12px_26px_-16px_rgb(31_35_64/0.42)] [background-position:0_14px]">
        <MarginLine left={26} />
        {items.map((f) => (
          <details key={f.q} className="group border-t border-dashed border-rule-strong first:border-t-0">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-2.5 py-1.5 text-[19px] leading-[1.35] [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform group-open:rotate-180">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="pb-3.5 text-[17px] leading-[1.55] text-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <Tape color="mint" w={62} h={20} rotate={-30} alpha={0.6} className="left-1 top-7" />
    </section>
  );
}
