import { TornTape } from "@/components/TornTape";
import type { Faq } from "@/lib/faq";

/**
 * 자주 묻는 질문(접이식, 흰 카드). 선물 가이드와 시작 화면이 같이 쓴다.
 * 접어 둔 답도 HTML에는 그대로 있어서 검색·AI가 읽는다(구조화 데이터와 같은 글)
 */
export function FaqList({ id, title, items, lang }: { id: string; title: string; items: Faq[]; lang?: string }) {
  return (
    <section aria-labelledby={id} lang={lang} className="relative flex flex-col gap-3 px-4 pt-[38px]">
      <h2 id={id} className="scribble ml-1 self-start text-[24px] leading-none">
        {title}
      </h2>
      <div className="card relative mt-2 px-3.5 py-1">
        {items.map((f) => (
          <details key={f.q} className="group border-t-[1.5px] border-dashed border-ink/[0.18] first:border-t-0">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2.5 py-1.5 text-[15px] leading-[1.35] [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted transition-transform group-open:rotate-180">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="pb-3 text-[13px] leading-[1.6] text-muted">{f.a}</p>
          </details>
        ))}
        <TornTape color="mint" w={62} h={20} rotate={6} className="-top-3 right-6" />
      </div>
    </section>
  );
}
