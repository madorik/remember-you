import { translate } from "@readme/core";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Wordmark } from "@/components/chrome";
import { Heart, Highlight } from "@/components/diary";
import { GiftLinkTabs } from "@/components/GiftLinkTabs";
import { PicksDisclosure } from "@/components/GiftPicks";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { CATALOG_BY_ID, PRICE_BANDS, type CatalogGift } from "@/lib/gift-catalog";
import { readGiftCard } from "@/lib/gifts";
import { ogMetadata } from "@/lib/og";
import { isBot, track } from "@/lib/track";

// 가족과 같이 준비: 선물 힌트 화면에서 고른 선물을 가격대별로 보여 주는 카드(로그인 없이 연다).
// 주소는 짧은 id(gift_cards) 또는 예전 긴 서명 토큰. 담긴 것은 부르는 말·날·선물 id뿐이고, 사진·상품명·쿠팡 링크는 목록에서 찾는다. ?b=가격대 로 처음 가격대를 고른다

const card = cache(async (token: string) => {
  const c = await readGiftCard(token);
  if (!c) return null;
  const items = c.ids.map((id) => CATALOG_BY_ID.get(id)).filter((x): x is CatalogGift => !!x);
  const bands = PRICE_BANDS.map((band) => ({ band, items: items.filter((x) => x.band === band) })).filter((b) => b.items.length);
  return { ...c, bands };
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await card(token);
  if (!c) return {};
  const meta = ogMetadata(c.locale, translate(c.locale, "picks.cardTitle", { name: c.name }), [c.event, translate(c.locale, "picks.cardDesc")].filter(Boolean).join(" · "));
  // 미리보기 이미지는 같은 폴더의 opengraph-image(상품 사진 모음)
  const image = { url: `/g/${token}/opengraph-image`, width: 1200, height: 630, alt: translate(c.locale, "picks.cardTitle", { name: c.name }) };
  return { ...meta, openGraph: { ...meta.openGraph, images: [image] }, twitter: { ...meta.twitter, images: [image.url] } };
}

export default async function GiftCardPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ b?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const c = await card(token);
  if (!c || !c.bands.length) notFound();
  if (!isBot((await headers()).get("user-agent"))) track("card_open", { source: "card" });
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string>) => translate(c.locale, k, v);
  // 제목은 쉼표에서 두 줄로(쉼표 뒤에 이어지는 말이 없으면 한 줄)
  const full = t("picks.cardTitle", { name: c.name });
  const cut = full.indexOf(", ");
  const title = cut > 0 ? [full.slice(0, cut + 1), full.slice(cut + 2)] : [full];
  const initial = c.bands.some((b) => b.band === sp.b) ? sp.b! : c.bands[0]!.band;
  return (
    <main className="screen">
      <div className="flex min-h-12 items-center px-5">
        <Link href="/" aria-label={t("app.name")}>
          <Wordmark size={24} locale={c.locale} />
        </Link>
      </div>
      <section className="relative px-5 pt-8">
        <h1 className="pr-24 text-[29.2px] leading-[1.15]">
          {title.map((line, i) => (
            <span key={i}>
              {i ? <br /> : null}
              <Highlight text={line} word={c.name} />
              {i < title.length - 1 ? " " : ""}
            </span>
          ))}
        </h1>
        {c.event ? <p className="pt-2.5 text-[11.7px] text-accent">{c.event}</p> : null}
        {/* 별 든 캐릭터(시안) */}
        <Mascot pose={11} size={74} className="absolute right-6 top-8" />
        <Heart size={22} rotate={14} className="right-[16.2px] top-[25.2px]" />
      </section>
      <GiftLinkTabs
        look="paper"
        pad="px-4"
        initial={initial}
        source="card"
        label={t("picks.bands")}
        bands={c.bands.map((b) => ({
          band: b.band,
          label: t(`picks.band.${b.band}` as "picks.band.1"),
          items: b.items.map((x) => ({ id: x.id, title: x.q, reason: "", name: x.name, url: x.url, image: x.image })),
        }))}
      />
      <div className="mt-auto flex flex-col">
      <PicksDisclosure text={t("picks.disclosure")} pad="px-4" />
      <div className="px-4 pt-3.5">
        <Link href="/" className="btn-outline w-full !min-h-[45px] !text-[21.1px]">
          <Icon name="chevron" size={19} strokeWidth={2} />
          {t("picks.cardOpen")}
        </Link>
      </div>
      </div>
      <div className="page-end" />
    </main>
  );
}
