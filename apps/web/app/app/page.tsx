import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { Wordmark } from "@/components/chrome";
import { Heart, Star } from "@/components/diary";
import { Mascot } from "@/components/Mascot";
import { TornTape } from "@/components/TornTape";
import { isAdminAccount } from "@/lib/admin";
import { getSession } from "@/lib/data";
import { makeT, requestLocale } from "@/lib/i18n";
import { qrShape } from "@/lib/qr";
import { absoluteUrl } from "@/lib/site";
import { APP_STORE_URL, playPublic, playUrl } from "@/lib/store";
import { track } from "@/lib/track";
import { uaInfo } from "@/lib/usage";
import { webGateFor } from "@/lib/web-gate";

// 앱 받기 화면: 웹은 로그인·가입만이라(lib/web-gate-core.ts) 웹 브라우저로 로그인한 사람은 앱 화면 대신 여기로 온다.
// 아이폰은 App Store 단추, PC는 폰 카메라로 찍는 QR(/get?from=web_gate이 폰 기기에 맞는 스토어로) + 스토어 링크, 안드로이드는 Play가 공개된 뒤에만 여기로 온다(Play 단추).
// 앱 안이거나 막지 않는 환경이면 홈으로, 로그인 전이면 시작 화면으로. 설명 글은 두지 않는다
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return { title: makeT(locale)("webGate.title"), robots: { index: false, follow: false } };
}

export default async function GetTheApp() {
  const session = await getSession();
  // ?next가 있어야 proxy가 낡은 쿠키 때문에 이 화면으로 다시 돌려보내지 않는다
  if (!session) redirect("/?next=%2Fapp");
  const ua = (await headers()).get("user-agent");
  const kind = webGateFor(ua);
  if (!kind) redirect("/home");

  const locale = await requestLocale(session.profile.locale);
  const t = makeT(locale);
  track("web_gate", { userId: session.user.id, source: kind, platform: "web", ...uaInfo(ua) });

  const admin = isAdminAccount(session.user);
  // /get은 보는 기기에 맞는 스토어로 보내고 누른 것을 이용 기록(app_get)으로 남긴다(아이폰·안드로이드 단추). PC의 스토어 링크는 바로 스토어
  const getUrl = "/get?from=web_gate";
  const appStore = process.env.APP_STORE_URL || APP_STORE_URL;
  const qrUrl = absoluteUrl(getUrl);
  const qr = kind === "desktop" ? qrShape(qrUrl) : null;
  const pad = 2;

  return (
    <main className="screen">
      <div className="flex min-h-12 items-center px-5">
        <Wordmark size={24} locale={locale} />
      </div>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6 text-center">
        <Mascot pose={8} size={112} />
        <h1 className="hand text-[27px] leading-[1.3]">{t("webGate.title")}</h1>

        {kind === "ios" ? (
          <a href={getUrl} className="btn-primary mt-2 w-full max-w-[320px] !min-h-[58px] !text-[22px]">
            {t("webGate.appStore")}
          </a>
        ) : null}

        {kind === "android" ? (
          <a href={getUrl} className="btn-primary mt-2 w-full max-w-[320px] !min-h-[58px] !text-[22px]">
            {t("webGate.googlePlay")}
          </a>
        ) : null}

        {qr ? (
          <>
            {/* QR은 밝은 바탕에 어두운 점이어야 잘 읽혀서 종이 카드 안에 흰 바탕으로 둔다 */}
            <div className="relative mt-2 rounded-[16.2px] border border-edge bg-white p-3.5">
              <TornTape color="mango" w={76} h={22} rotate={-4} className="-top-[9.9px] left-1/2 -ml-[34.2px]" />
              <svg role="img" aria-label={t("privacy.shareAppQr")} viewBox={`${-pad} ${-pad} ${qr.size + pad * 2} ${qr.size + pad * 2}`} width="208" height="208" shapeRendering="crispEdges" className="block">
                <rect x={-pad} y={-pad} width={qr.size + pad * 2} height={qr.size + pad * 2} fill="#fff" />
                <path d={qr.d} fill="#1F2340" />
              </svg>
              <Heart size={24} rotate={14} className="-right-3 -bottom-3" />
              <Star size={20} rotate={-12} className="-left-3 -bottom-2.5" />
            </div>
            <p className="text-[13.5px] leading-[1.5] text-muted">{t("webGate.scan")}</p>
            <div className="flex w-full max-w-[320px] flex-col gap-2.5">
              <a href={appStore} className="btn-outline w-full">
                {t("webGate.appStore")}
              </a>
              {playPublic() ? (
                <a href={playUrl("web_gate")} className="btn-outline w-full">
                  {t("webGate.googlePlay")}
                </a>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      {/* 화면 끝: 아래 막대 가림 띠 위로 여유(.page-end) */}
      <footer className="page-end flex flex-wrap items-center justify-center gap-x-2 px-6 pt-2 text-[12px] text-muted">
        <form action={signOut}>
          <button className="flex min-h-[44px] items-center px-3 underline underline-offset-4">{t("privacy.signOut")}</button>
        </form>
        <Link href="/delete-account" prefetch={false} className="flex min-h-[44px] items-center px-3 underline underline-offset-4">
          {t("webGate.deleteGuide")}
        </Link>
        {admin ? (
          <Link href="/admin" prefetch={false} className="flex min-h-[44px] items-center px-3 underline underline-offset-4">
            {t("home.adminMenu")}
          </Link>
        ) : null}
      </footer>
    </main>
  );
}
