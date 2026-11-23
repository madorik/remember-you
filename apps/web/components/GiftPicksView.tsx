import type { Locale } from "@readme/core";
import Link from "@/components/AppLink";
import { use } from "react";
import { BasisTags, GiftLinkTabs } from "@/components/GiftLinkTabs";
import { Icon } from "@/components/marks";
import type { GiftPickData, GiftPicksData } from "@/lib/pages/gift-picks.data";
import { makeT, type T } from "@/lib/t";

// 이런 선물은 어때요: 이 사람 기록 전체와 메모로 고른 선물. 쿠팡 API 키가 있으면 찾을 말마다 '왜'(이유)와 쿠팡 상품 줄,
// 없으면(파트너스 최종 승인 전) 가격대 칩 + 미리 만든 파트너스 링크 목록에서 고른 것. 누르면 쿠팡(파트너스 링크)으로 간다.
// 화면은 Suspense로 감싸 먼저 그리고, 이 부분만 나중에 채운다(처음엔 AI·쿠팡을 부르느라 몇 초 걸린다).
// 고르기는 서버(lib/pages/gift-picks)가 하고 여기는 그리기만(서버 전용 모듈을 들이지 않는다)

const SCROLLER = "flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function Row({ pick, pad, t, priceOf }: { pick: GiftPickData; pad: string; t: T; priceOf: (n: number) => string }) {
  return (
    <div className="flex flex-col pt-3.5">
      <div className={`flex items-start justify-between gap-3 pb-2.5 ${pad}`}>
        <span className="flex min-w-0 flex-col gap-1 pt-1">
          <span className="hand-written truncate text-[20.3px] leading-[1.15]">{pick.keyword}</span>
          {pick.basis?.length ? <BasisTags words={pick.basis} /> : null}
          <span className="line-clamp-3 text-[11.7px] leading-[1.45] text-muted">{pick.reason}</span>
        </span>
        {pick.products.length ? (
          <a href={pick.more} target="_blank" rel="sponsored noopener noreferrer" aria-label={`${pick.keyword} ${t("picks.more")}`} className="-mr-1.5 flex min-h-11 shrink-0 items-center gap-0.5 whitespace-nowrap pl-2 text-[11.7px] text-muted">
            {t("picks.more")}
            <Icon name="chevron" size={13} strokeWidth={2} />
          </a>
        ) : null}
      </div>
      {pick.products.length ? (
        <ul className={`${SCROLLER} ${pad === "px-6" ? "scroll-px-6" : "scroll-px-3.5"} ${pad}`}>
          {pick.products.map((p) => (
            <li key={p.id} className="w-[104.4px] shrink-0 snap-start">
              <a href={p.url} target="_blank" rel="sponsored noopener noreferrer" className="flex flex-col">
                <span className="block aspect-square overflow-hidden rounded-xl border border-edge bg-white">
                  {/* 쿠팡 이미지 주소를 그대로(이미지 최적화 서버를 거치지 않게) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                </span>
                <span className="mt-2 line-clamp-2 text-[10.8px] leading-[1.3] text-muted">{p.name}</span>
                <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="num text-[15.3px]">{priceOf(p.price)}</span>
                  {p.rocket ? <span className="text-[10.8px] text-sat">{t("picks.rocket")}</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className={pad}>
          <a href={pick.more} target="_blank" rel="sponsored noopener noreferrer" className="flex min-h-[46.8px] items-center justify-between gap-2 rounded-[12.6px] border border-edge bg-white px-4 text-[13.5px]">
            <span className="min-w-0 truncate">{pick.keyword}</span>
            <span className="flex shrink-0 items-center gap-1 text-[11.7px] text-muted">
              {t("picks.coupang")}
              <Icon name="external" size={15} />
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

export function PicksDisclosure({ text, pad = "px-6" }: { text: string; pad?: string }) {
  return <p className={`pt-4 text-[10.8px] leading-[1.45] text-muted ${pad}`}>{text}</p>;
}

/** 이 사람에게 어울릴 선물(max: 찾을 말 몇 개까지). title이 없으면 제목·고지 없이 줄만(여러 사람 화면) */
/** 다시 고르기로 넘어온 '지난번에 보인 것'(주소 ?skip=a,b,…). 목록 id만, 60개까지 */
export function parseSkip(v: string | undefined): string[] {
  return [...new Set((v ?? "").split(",").filter((x) => /^[a-z0-9-]{1,40}$/.test(x)))].slice(-60);
}

/**
 * 고른 선물 그리기(picks: lib/pages/gift-picks가 고른 것). title이 없으면 고지 없이(여러 사람 화면).
 * picks가 Promise면(웹) 여기서 기다린다: 부모 Suspense가 먼저 빈 자리를 보이고 다 고르면 채운다.
 * again: 다시 고르기 주소의 앞부분(지금 화면 주소). 주면 오른쪽 위에 다시 고르기 단추(부모 section이 relative여야 한다)
 */
export function GiftPicksBody({ picks, locale, pad = "px-6", title = true, again }: { picks: GiftPicksData | null | Promise<GiftPicksData | null>; locale: Locale; pad?: string; title?: boolean; again?: string }) {
  const data = picks instanceof Promise ? use(picks) : picks;
  const t = makeT(locale);
  if (!data) return null;
  if (data.kind === "links") {
    const { bands, initial, note, next, source } = data;
    return (
      <>
        {again ? (
          <Link href={`${again}${again.includes("?") ? "&" : "?"}skip=${next}#picks`} scroll={false} className="absolute right-3 top-[19.8px] flex h-11 items-center gap-1 rounded-full px-3 text-[12.6px] text-accent active:bg-sky-soft">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14.4" height="14.4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v5h-5" />
            </svg>
            {t("picks.again")}
          </Link>
        ) : null}
        {/* 무엇을 보고 어떻게 골랐는지, 얘기하듯 */}
        {title && note ? (
          <div className={`pt-3 ${pad}`}>
            <p data-note="" className="-rotate-[0.4deg] rounded-[9.7px_11.3px_11.3px_9.7px] border border-edge bg-postit px-3.5 py-2.5 text-[12.6px] leading-[1.55]">
              {note}
            </p>
          </div>
        ) : null}
        <GiftLinkTabs
          pad={pad}
          initial={initial}
          source={source}
          label={t("picks.bands")}
          badges={{ pick: t("picks.badge.pick"), top: t("picks.badge.top") }}
          bands={bands.map((b) => ({ band: b.band, label: t(`picks.band.${b.band}` as "picks.band.1"), items: b.items }))}
        />
        {title ? <PicksDisclosure text={t("picks.disclosure")} pad={pad} /> : null}
      </>
    );
  }
  const num = new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US");
  const priceOf = (n: number) => t("picks.price", { n: num.format(n) });
  return (
    <>
      {data.picks.map((pick) => (
        <Row key={pick.keyword} pick={pick} pad={pad} t={t} priceOf={priceOf} />
      ))}
      {title ? <PicksDisclosure text={t("picks.disclosure")} pad={pad} /> : null}
    </>
  );
}
