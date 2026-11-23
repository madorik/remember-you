import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { preload } from "react-dom";
import { BRAND } from "@readme/core";
import { KeyboardInset } from "@/components/KeyboardInset";
import { LaunchOverlay } from "@/components/LaunchOverlay";
import { LocaleSync } from "@/components/LocaleSync";
import { SplashHide } from "@/components/SplashHide";
import { Tags } from "@/components/Tags";
import { UsageTracker } from "@/components/UsageTracker";
import { WebAnalytics } from "@/components/WebAnalytics";
import { getSession } from "@/lib/data";
import { chosenLocale, makeT, requestLocale } from "@/lib/i18n";
import { LAUNCH_BOOT_SCRIPT } from "@/lib/launch-boot";
import { ogMetadata } from "@/lib/og";
import { SITE_URL } from "@/lib/site";
import { WORDMARK_FONT_URL } from "@/lib/wordmark-font";
// 앱 글꼴(손글씨 포어스토리 + 앱 글 눈누 기초고딕)은 조각을 직접 호스팅한다(scripts/fetch-fonts.mjs)
import "./fonts.css";
// 로고 글자 손글씨체(Poor Story, scripts/fetch-wordmark-font.mjs): 로고에 쓰는 글자만 담은 3KB짜리 파일
import "./wordmark.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const locale = await requestLocale(session?.profile.locale);
  return {
    metadataBase: new URL(SITE_URL),
    ...ogMetadata(locale, BRAND[locale].title),
    applicationName: BRAND[locale].name,
    appleWebApp: { capable: true, title: BRAND[locale].name, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    // 구글 서치 콘솔·네이버 서치어드바이저 사이트 확인(값은 환경 변수로)
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.NAVER_SITE_VERIFICATION ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION } : undefined,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffdf8",
  // 안드로이드 자동 다크·삼성 인터넷 다크 모드가 화면을 뒤집지 않게(앱은 밝은 화면 하나만)
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 로고는 첫 화면에 바로 보이니 글꼴을 미리 받아 둔다(없으면 잠깐 다른 글꼴로 보였다가 바뀐다)
  preload(WORDMARK_FONT_URL, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  const session = await getSession();
  const locale = await requestLocale(session?.profile.locale);
  const chosen = !!(session?.profile.localeChoice ?? (await chosenLocale()));
  // 앱 웹뷰(UA에 ReadmeApp)만 첫 HTML에 움직이는 로딩 덮개를 넣는다: 웹 브라우저(검색 노출 화면·e2e)는 그대로
  const ua = (await headers()).get("user-agent") ?? "";
  const nativeApp = /ReadmeApp/.test(ua);
  const t = makeT(locale);
  return (
    // 앱 웹뷰(Capacitor)가 화면 여백 값을 <html style>에 넣어서 서버가 그린 것과 다를 수 있다
    <html lang={locale} suppressHydrationWarning>
      <body>
        {nativeApp && (
          <>
            <script dangerouslySetInnerHTML={{ __html: LAUNCH_BOOT_SCRIPT }} />
            <LaunchOverlay word={locale === "en" ? "Remember" : "기억해"} label={t("app.loading")} os={/ReadmeApp \(android\)/.test(ua) ? "android" : "ios"} />
          </>
        )}
        <div aria-hidden="true" className="bar-mask-top" />
        {children}
        <div aria-hidden="true" className="bar-mask-bottom" />
        <KeyboardInset />
        <SplashHide />
        <LocaleSync rendered={locale} chosen={chosen} signedIn={!!session} stored={session?.profile.systemLocale ?? null} />
        <WebAnalytics />
        <UsageTracker />
        <Tags />
      </body>
    </html>
  );
}
