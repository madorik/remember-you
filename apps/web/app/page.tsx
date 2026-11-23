import { APP_ID, BRAND } from "@readme/core";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { setLocale } from "@/app/actions/auth";
import { AuthButtons } from "@/components/AuthButtons";
import { Wordmark } from "@/components/chrome";
import { FaqList } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { HeroHeadline, LoginHero, StartLegal } from "@/components/LoginHero";
import { PROVIDERS } from "@/lib/auth";
import { getSession } from "@/lib/data";
import { demoEnabled } from "@/lib/demo-core";
import { LANDING_UPDATED_ON, START_FAQ } from "@/lib/faq";
import { GUIDES } from "@/lib/guides";
import { makeT, requestLocale } from "@/lib/i18n";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/legal";
import { ogMetadata, siteDescription } from "@/lib/og";
import { absoluteUrl, safeNext } from "@/lib/site";
import { APP_STORE_URL } from "@/lib/store";

// 시작 화면은 검색에 내보내는 첫 화면: 제목·설명·대표 주소와 구조화 데이터(서비스·앱·만든 곳·자주 묻는 질문).
// 화면 아래에는 자주 묻는 질문(접이식)과 선물 가이드 링크가 있다: 검색·AI가 읽을 글과 안쪽 길을 늘리려는 것. 앱 안(UA에 ReadmeApp)에서는 로그인 화면 하나로 두려고 그리지 않는다
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const title = locale === "ko" ? "기억해유 - 사랑하는 사람들의 컨닝페이퍼 · 취향·생일·선물 추천" : BRAND.en.title;
  const description =
    locale === "ko"
      ? "가족·연인·친구의 취향, 못 먹는 음식, 사이즈, 생일을 기록하고 링크로 물어보세요. 챙길 날이 다가오면 그 사람에게 맞는 선물을 가격대별로 골라 드려요. 무료."
      : siteDescription(locale);
  return {
    ...ogMetadata(locale, title, description),
    alternates: { canonical: "/" },
    keywords: locale === "ko" ? ["기억해유", "선물 추천", "생일 알림", "취향 기록", "부모님 선물", "기념일 선물", "알레르기 기록", "사이즈 기록"] : ["gift ideas", "birthday reminder", "favorites", "food allergies"],
  };
}

export default async function Start({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  // 세션 쿠키가 있고 ?next가 없으면 proxy가 먼저 /home으로 보낸다. 여기는 ?next가 있거나 쿠키가 낡은 때
  const session = await getSession();
  if (session) redirect(session.profile.onboardedAt ? next : `/onboarding/avatar${next !== "/home" ? `?next=${encodeURIComponent(next)}` : ""}`);

  const locale = await requestLocale();
  const t = makeT(locale);
  const web = !/ReadmeApp/.test((await headers()).get("user-agent") ?? "");
  const faq = START_FAQ[locale];

  return (
    <main className="screen">
      <JsonLd
        data={[
          // 눈에 보이는 질문과 같은 글(웹일 때만: 앱 안에서는 그리지 않으니 구조화 데이터도 내지 않는다)
          ...(web ? [{ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: locale, mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
          { "@context": "https://schema.org", "@type": "Organization", name: OPERATOR.ko, alternateName: OPERATOR.en, url: absoluteUrl("/"), email: SUPPORT_EMAIL, logo: absoluteUrl("/icon.png") },
          { "@context": "https://schema.org", "@type": "WebSite", name: BRAND.ko.name, alternateName: BRAND.en.name, url: absoluteUrl("/"), inLanguage: ["ko", "en"] },
          {
            "@context": "https://schema.org",
            "@type": "MobileApplication",
            name: BRAND.ko.name,
            alternateName: BRAND.en.name,
            applicationCategory: "LifestyleApplication",
            operatingSystem: "iOS, Android, Web",
            identifier: APP_ID,
            url: absoluteUrl("/"),
            installUrl: APP_STORE_URL,
            dateModified: LANDING_UPDATED_ON,
            description: "가족·연인·친구의 취향, 못 먹는 음식, 사이즈, 생일을 기록하고 물어보고, 챙길 날이 다가오면 가격대별 선물을 골라 주는 앱",
            offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
            publisher: { "@type": "Organization", name: OPERATOR.ko },
          },
        ]}
      />
      {/* 큰 로고의 U 위 점이 글줄 위로 5px쯤 나온다. 상태바·화면 위 끝에 붙어 잘리지 않게 위를 비워 둔다 */}
      <div className="flex items-center justify-between pl-5 pr-2 pt-4">
        <Wordmark size={24} locale={locale} />
        <form action={setLocale}>
          <input type="hidden" name="locale" value={locale === "ko" ? "en" : "ko"} />
          <input type="hidden" name="back" value={rawNext ? `/?next=${encodeURIComponent(next)}` : "/"} />
          <button className="flex min-h-11 items-center px-2.5 text-[11.7px] underline underline-offset-4">{t("lang.other")}</button>
        </form>
      </div>

      {/* 컨닝페이퍼와 흘끔 보는 눈(로그인 화면과 같은 그림). 키 작은 휴대폰에서는 조금 줄인다 */}
      <div className="flex flex-1 items-center px-6 py-4 [@media(max-height:860px)]:py-2 [@media(max-height:860px)]:[zoom:0.9] [@media(max-height:720px)]:[zoom:0.78]">
        <LoginHero t={t} />
      </div>

      <section className="relative flex flex-col gap-3 px-6">
        <HeroHeadline text={t("start.headline")} />
        <p className="hero-rise whitespace-pre-line text-[13.5px] leading-[1.6]" style={{ animationDelay: "0.3s" }}>
          {t("start.body")}
        </p>
      </section>

      <div className="px-6 pt-7">
        <AuthButtons locale={locale} next={next} google={PROVIDERS.google} apple={PROVIDERS.apple} demo={demoEnabled()} />
        <StartLegal locale={locale} />
      </div>

      {web ? (
        <>
          <FaqList id="start-faq" title={locale === "ko" ? "자주 묻는 질문" : "FAQ"} items={faq} lang={locale} />
          {/* 선물 가이드는 한국어 글이라 한국어 화면에서만 */}
          {locale === "ko" ? (
            <nav aria-label="선물 가이드" className="flex flex-col gap-3 px-4 pt-[34.2px]">
              <h2 className="ml-1 text-[20.3px]">선물 가이드</h2>
              <div className="flex flex-wrap gap-2">
                {GUIDES.map((g) => (
                  <Link key={g.slug} href={`/gifts/${g.slug}`} className="chip">
                    {g.who} 선물
                  </Link>
                ))}
                <Link href="/gifts" className="chip">
                  모아 보기
                </Link>
              </div>
            </nav>
          ) : null}
          <div className="page-end" />
        </>
      ) : null}
    </main>
  );
}
