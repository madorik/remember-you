import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/chrome";
import { HandRule, Heart, Squiggle, Star, SKY_STAR, Tape } from "@/components/diary";
import { FaqList } from "@/components/Faq";
import { PicksDisclosure } from "@/components/GiftPicks";
import { GuideList } from "@/components/GuideList";
import { JsonLd } from "@/components/JsonLd";
import { Icon } from "@/components/marks";
import { BAND_NAME, GUIDE_BY_SLUG, GUIDES, GUIDES_PUBLISHED, GUIDES_UPDATED, bandFaq, guidePicks, koDate } from "@/lib/guides";
import { OPERATOR } from "@/lib/legal";
import { ogMetadata } from "@/lib/og";
import { absoluteUrl } from "@/lib/site";

// 공개 선물 가이드(검색·AI 답변용): 먼저 답하는 몇 문장 → 가격대별 선물 다섯 → 묻고 답하기 → 기억해유로 이어 가기.
// 구조화 데이터: 글(Article, 작성·수정일)·상품 목록(ItemList)·묻고 답하기(FAQPage)·위치(BreadcrumbList)

// 빌드 때 한 번 그려 CDN에 둔다(generateStaticParams). 루트 레이아웃이 쿠키·헤더를 읽어서 그냥 두면 요청마다 새로 그려지므로 force-static으로 빈 값으로 읽게 한다
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = GUIDE_BY_SLUG.get((await params).slug);
  if (!g) return {};
  return { ...ogMetadata("ko", `${g.title} | 기억해유`, g.description), alternates: { canonical: `/gifts/${g.slug}` }, keywords: [`${g.who} 선물`, `${g.who} 선물 추천`, ...Object.values(BAND_NAME).map((b) => `${g.who} 선물 ${b}`)] };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = GUIDE_BY_SLUG.get((await params).slug);
  if (!g) notFound();
  const picks = guidePicks(g);
  const faq = [...g.faq, ...bandFaq(g, picks)];
  const url = absoluteUrl(`/gifts/${g.slug}`);
  const others = GUIDES.filter((x) => x.slug !== g.slug);
  // 제목은 쉼표 앞 첫 마디에 형광펜(없으면 통째로)
  const comma = g.title.indexOf(", ");
  const title = comma > 0 ? { head: g.title.slice(0, comma + 1), rest: g.title.slice(comma + 2) } : { head: g.title, rest: "" };
  return (
    <main className="screen" lang="ko">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "기억해유", item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: "선물 가이드", item: absoluteUrl("/gifts") },
              { "@type": "ListItem", position: 3, name: `${g.who} 선물`, item: url },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: g.title,
            description: g.description,
            inLanguage: "ko",
            mainEntityOfPage: url,
            datePublished: GUIDES_PUBLISHED,
            dateModified: GUIDES_UPDATED,
            author: { "@type": "Organization", name: OPERATOR.ko, url: absoluteUrl("/") },
            publisher: { "@type": "Organization", name: OPERATOR.ko, logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png") } },
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: g.title,
            url,
            itemListElement: picks.flatMap((b) => b.items).map((x, i) => ({ "@type": "ListItem", position: i + 1, name: `${x.q} (${BAND_NAME[x.band]})`, url: x.url, ...(x.image ? { image: x.image } : {}) })),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />
      <nav aria-label="위치" className="flex min-h-11 items-center gap-1.5 px-5 text-[17px] text-muted">
        <Link href="/" aria-label="기억해유">
          <Wordmark size={22} locale="ko" />
        </Link>
        <span aria-hidden="true">›</span>
        <Link href="/gifts" className="flex min-h-11 items-center">
          선물 가이드
        </Link>
      </nav>
      <article className="flex flex-col">
        <header className="relative px-5 pt-3.5">
          <h1 className="text-[31px] font-normal leading-[1.25]">
            {title.rest ? (
              <>
                <span className="hl">{title.head}</span> <br />
                {title.rest}
              </>
            ) : (
              <span className="hl">{g.title}</span>
            )}
          </h1>
          <HandRule className="mt-3" />
          <p className="mt-2.5 text-[16px] text-muted">
            <time dateTime={GUIDES_UPDATED}>{koDate(GUIDES_UPDATED)} 업데이트</time>
          </p>
          <p className="mt-2.5 rounded-[3px] bg-[#fff0c9] px-3.5 pb-3.5 pt-3 text-[18px] leading-[1.55] shadow-[0_6px_12px_-9px_rgb(31_35_64/0.45)] [transform:rotate(-0.4deg)]">{g.answer}</p>
          <Star size={22} rotate={14} className="right-[22px] top-2" />
          <Heart size={24} rotate={16} className="-bottom-3 right-3.5" />
        </header>
        <div className="px-4 pt-[30px]">
          <GuideList bands={picks.map((b) => ({ band: b.band, title: `${BAND_NAME[b.band]} ${g.who} 선물`, items: b.items.map((x) => ({ id: x.id, title: x.q, name: x.name, url: x.url, image: x.image })) }))} />
        </div>
        <FaqList id="faq" title="자주 묻는 질문" items={faq} />
        <section className="card relative mx-4 mt-10 flex flex-col gap-4 px-5 pb-[22px] pt-6">
          <Tape color="mango" w={108} h={26} rotate={-3} alpha={0.62} className="-top-[13px] left-1/2 -ml-[54px]" />
          <h2 className="text-[26px] font-normal leading-[1.3]">{g.who}의 취향을 알면 더 꼭 맞아요</h2>
          <p className="text-[18px] leading-[1.5] text-ink-2">기억해유에 {g.who}의 취향·사이즈·챙길 날을 적어 두면, 그 사람에게 맞춘 선물을 가격대별로 골라 드려요. 가족과 카드로 같이 고를 수도 있어요.</p>
          <Link href="/" className="btn-primary w-full !min-h-14 !text-[21px]">
            기억해유 시작하기
            <Icon name="arrow" size={20} strokeWidth={2} />
          </Link>
          <Star size={24} rotate={14} color={SKY_STAR} className="-right-2 top-6" />
          <Squiggle w={56} className="-bottom-2 left-6" />
        </section>
        <nav aria-label="다른 선물 가이드" className="flex flex-col gap-3 px-4 pt-[38px]">
          <h2 className="ml-1 text-[25px] font-normal">다른 선물 가이드</h2>
          <div className="flex flex-wrap gap-2">
            {others.map((x) => (
              <Link key={x.slug} href={`/gifts/${x.slug}`} className="chip">
                {x.who} 선물
              </Link>
            ))}
          </div>
        </nav>
      </article>
      <div className="pt-3">
        <PicksDisclosure text="이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다." />
      </div>
      <div className="page-end" />
    </main>
  );
}
