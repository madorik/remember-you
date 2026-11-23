import { redirect } from "next/navigation";
import { AuthButtons } from "@/components/AuthButtons";
import { demoEnabled } from "@/lib/demo-core";
import { TopBar, Wordmark } from "@/components/chrome";
import { HeroHeadline, LoginHero, StartLegal } from "@/components/LoginHero";
import { Icon } from "@/components/marks";
import { PROVIDERS } from "@/lib/auth";
import { getSession } from "@/lib/data";
import { makeT, requestLocale } from "@/lib/i18n";
import { safeNext } from "@/lib/site";

// 초대 받기·답한 뒤 가져오기처럼 다른 화면에서 로그인하러 올 때
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; failed?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  // 데모 계정은 여기서 구글·애플로 로그인해 진짜 계정으로 넘어간다
  const session = await getSession();
  if (session && !session.user.isAnonymous) redirect(next);
  const locale = await requestLocale();
  const t = makeT(locale);
  return (
    <main className="screen">
      <TopBar back={`/?next=${encodeURIComponent(next)}`} label={t("common.back")} center={<Wordmark size={24} locale={locale} />} />

      {/* 시작 화면과 같은 그림·제목. 키 작은 휴대폰(SE 등)에서는 그림을 조금 줄여 버튼까지 한 화면에 */}
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
        {sp.failed ? (
          <p role="alert" className="mb-3.5 flex items-center gap-2.5 rounded-[12.6px] border border-red bg-red-soft px-4 py-3 text-[12.6px] leading-[1.35] text-red">
            <Icon name="alert" size={22} strokeWidth={2.2} className="shrink-0" />
            {t("login.failed")}
          </p>
        ) : null}
        <AuthButtons locale={locale} next={next} google={PROVIDERS.google} apple={PROVIDERS.apple} demo={!session && demoEnabled()} />
        <StartLegal locale={locale} />
      </div>
    </main>
  );
}
