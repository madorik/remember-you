import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/chrome";
import { TornTape, type TornTapeColor } from "@/components/TornTape";
import { JsonLd } from "@/components/JsonLd";
import { Icon } from "@/components/marks";
import { GUIDES, GUIDES_PUBLISHED, GUIDES_UPDATED, guidePicks } from "@/lib/guides";
import { ogMetadata } from "@/lib/og";
import { absoluteUrl } from "@/lib/site";

// 공개 선물 가이드 모음(검색·AI 답변용): 누구에게(부모님·연인·친구·동료)·무엇을 좋아하는 분께(등산·골프·캠핑·커피) 가이드로 이어진다

const TITLE = "선물 추천 가이드 · 누구에게, 얼마로";
const DESCRIPTION = "부모님·연인·친구·직장 동료 선물과 등산·골프·캠핑·커피 좋아하는 분께 줄 선물을 1만원대부터 10만원 이상까지 가격대별로 골랐어요.";

// 한국어 하나뿐인 공개 글이라 빌드 때 한 번 그려 CDN에 둔다. 루트 레이아웃이 로그인·언어(쿠키·헤더)를 읽어서 그냥 두면 요청마다 새로 그려지므로,
// force-static으로 그 값들을 빈 값으로 읽게 한다(이 화면은 로그인 상태와 상관없다)
export const dynamic = "force-static";

export const metadata: Metadata = { ...ogMetadata("ko", `${TITLE} | 기억해유`, DESCRIPTION), alternates: { canonical: "/gifts" }, keywords: ["선물 추천", "부모님 선물", "생일 선물", "기념일 선물", "가격대별 선물", "5만원대 선물"] };

// 카드마다 돌아가며 칠하는 사진 바탕색(시안)
const TILES = ["#f1ecfd", "#fbe1e8", "#fff4d6", "#e3f4ec", "#fff4d6", "#e4ecfa", "#e3f4ec", "#fff1cc"];

// 카드마다 돌아가며 붙이는 테이프 색과 기울기
const TAPES: { color: TornTapeColor; rotate: number; tilt: string }[] = [
  { color: "mango", rotate: -4, tilt: "[transform:rotate(-0.8deg)]" },
  { color: "pink", rotate: 3, tilt: "[transform:rotate(0.7deg)]" },
  { color: "mint", rotate: -2, tilt: "[transform:rotate(0.6deg)]" },
  { color: "mango", rotate: 4, tilt: "[transform:rotate(-0.6deg)]" },
];

export default function Gifts() {
  const cards = GUIDES.map((g) => ({ g, cover: guidePicks(g).flatMap((b) => b.items).find((x) => x.image) }));
  return (
    <main className="screen" lang="ko">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: TITLE,
          description: DESCRIPTION,
          url: absoluteUrl("/gifts"),
          inLanguage: "ko",
          datePublished: GUIDES_PUBLISHED,
          dateModified: GUIDES_UPDATED,
          hasPart: GUIDES.map((g) => ({ "@type": "WebPage", name: g.title, url: absoluteUrl(`/gifts/${g.slug}`) })),
        }}
      />
      <div className="flex min-h-12 items-center px-5">
        <Link href="/" aria-label="기억해유">
          <Wordmark size={24} locale="ko" />
        </Link>
      </div>
      <header className="relative px-5 pt-5">
        <h1 className="text-[30.8px] leading-[1.15]">
          <span className="hl">누구에게, 얼마로</span> 줄까요?
        </h1>
        <p className="pt-3 text-[11.7px] leading-[1.55] text-muted">{DESCRIPTION}</p>
      </header>
      <ul aria-label="선물 가이드 목록" className="relative grid grid-cols-2 gap-x-[9px] gap-y-3 px-4 pt-7">
        {cards.map(({ g, cover }, i) => {
          const tp = TAPES[i % TAPES.length]!;
          return (
            <li key={g.slug} className={`flex ${tp.tilt}`}>
              <Link href={`/gifts/${g.slug}`} className="card relative flex w-full flex-col gap-2.5 px-[9.9px] pb-3 pt-3 active:bg-fill">
                <TornTape color={tp.color} w={56} h={19} rotate={tp.rotate} className="-top-2.5 left-1/2 -ml-7" />
                <span aria-hidden="true" className="block aspect-square overflow-hidden rounded-lg" style={{ background: TILES[i % TILES.length] }}>
                  {cover?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full bg-white object-contain" />
                  ) : null}
                </span>
                <span className="hand px-0.5 text-[16.2px] leading-[1.25]">{g.who} 선물</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <section className="card relative mx-4 mt-10 flex flex-col gap-3 px-3.5 pb-3.5 pt-3">
        <h2 className="hand scribble self-start text-[19.4px] leading-none">그 사람에게 꼭 맞는 선물은</h2>
        <p className="pt-1 text-[11.7px] leading-[1.55] text-muted">기억해유에 가까운 사람의 취향·사이즈·챙길 날을 적어 두면, 그 사람에게 맞춘 선물을 가격대별로 골라 드려요.</p>
        <Link href="/" className="btn-primary w-full !min-h-[45px] !text-[19.4px]">
          <Icon name="chevron" size={19} strokeWidth={2} />
          기억해유 시작하기
        </Link>
      </section>
      <p className="px-6 pt-[19.8px] text-[10.8px] leading-[1.45] text-muted">이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
      <div className="page-end" />
    </main>
  );
}
