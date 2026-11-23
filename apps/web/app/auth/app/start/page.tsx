import { Wordmark } from "@/components/chrome";
import { makeT, requestLocale } from "@/lib/i18n";
import { StartSocial } from "./StartSocial";

// 앱이 시스템 브라우저로 여는 화면: 여기서 평소처럼 구글·Apple 로그인을 시작한다
export default async function AppAuthStart({ searchParams }: { searchParams: Promise<{ provider?: string }> }) {
  const { provider } = await searchParams;
  const locale = await requestLocale();
  const t = makeT(locale);
  return (
    <main className="screen items-center justify-center gap-5 px-6">
      <Wordmark locale={locale} />
      <p className="text-[13.5px] text-muted">{t("login.title")}</p>
      <StartSocial provider={provider === "apple" ? "apple" : "google"} />
    </main>
  );
}
