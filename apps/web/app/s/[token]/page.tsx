import { SECTIONS_BY_IMPORTANCE, mergeDiffers, translate } from "@readme/core";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppTabBar } from "@/components/AppTabBar";
import { ClaimShare, type ClaimPerson } from "@/components/ClaimShare";
import { TopBar, Wordmark } from "@/components/chrome";
import { TornTape } from "@/components/TornTape";
import { aiConfigured } from "@/lib/ai";
import { getSession, listPeople } from "@/lib/data";
import { makeT, requestLocale } from "@/lib/i18n";
import { ogMetadata } from "@/lib/og";
import { displayName } from "@/lib/person";
import { readRecordShare, shareTokenOf } from "@/lib/record-share";
import { shareParts } from "@/lib/share-record";

// 링크 미리보기(카카오톡·문자): 누가·무슨 정보인지는 담지 않는다("정보가 도착했어요"만)
export async function generateMetadata() {
  const locale = await requestLocale((await getSession())?.profile.locale);
  return ogMetadata(locale, translate(locale, "og.shareTitle"));
}

// 링크로 받은 기록(/s/<10글자>). 링크에는 정보가 없고, 로그인한 사람에게만 내용을 보여 준다.
// 앱이 깔려 있으면 앱 링크로 앱에서 열리고(Android /s/ 앱 링크, iOS 유니버설 링크), 아니면 이 화면에서 앱 열기·앱 받기·로그인을 고른다
export default async function ReceiveSharePage({ params }: { params: Promise<{ token: string }> }) {
  const token = shareTokenOf((await params).token);
  const session = await getSession();
  const locale = await requestLocale(session?.profile.locale);
  const t = makeT(locale);
  const view = await readRecordShare(token);
  const inApp = /ReadmeApp/.test((await headers()).get("user-agent") ?? "");

  const message = (text: string, extra?: React.ReactNode) => (
    <main className="screen">
      <div className="flex min-h-12 items-center px-5">
        <Wordmark size={24} locale={locale} />
      </div>
      <section className="card relative mx-4 mt-10 px-5 pb-6 pt-8">
        <TornTape color="pink" w={66} h={21} rotate={6} className="-top-3 right-6" />
        <p className="hand text-[28px] leading-[1.3]">{text}</p>
        {extra}
      </section>
    </main>
  );

  if (view.state !== "ok") return message(t(view.state === "expired" ? "accept.expired" : view.state === "full" ? "share.in.full" : "accept.notFound"));

  // 로그인 전: 앱에서 열기·앱 받기·로그인(받은 내용은 로그인한 뒤에야 보인다)
  if (!session || !session.profile.onboardedAt) {
    if (session) redirect("/onboarding/avatar");
    const next = encodeURIComponent(`/s/${token}`);
    return message(
      t("share.in.title"),
      <div className="mt-7 flex flex-col gap-2.5">
        {inApp ? null : (
          <>
            <a href={`kr.readme.app://s/${token}`} className="btn-primary w-full">
              {t("share.in.openApp")}
            </a>
            <a href={`/get?from=share_record&next=${next}`} className="btn-outline w-full">
              {t("share.in.getApp")}
            </a>
          </>
        )}
        <Link href={`/?next=${next}`} className={`${inApp ? "btn-primary" : "btn-outline"} w-full`}>
          {t("share.in.login")}
        </Link>
      </div>,
    );
  }

  const shell = (children: React.ReactNode) => (
    <main className="screen !pb-0 overflow-x-clip" data-tabs="">
      <TopBar close="/home" label={t("common.close")} />
      {children}
      <AppTabBar locale={locale} voice={aiConfigured()} />
    </main>
  );

  // 내가 보낸 링크는 내가 받을 수 없다
  if (view.fromId === session.user.id) return shell(<p className="hand px-6 pt-6 text-[26px] leading-[1.35]">{t("share.in.mine")}</p>);

  const { record } = view;
  const from = record.name || t("share.in.someone");
  const parts = shareParts(SECTIONS_BY_IMPORTANCE, record.card, locale, t, { wishlist: true });
  const mine = await listPeople(session);
  const people: ClaimPerson[] = mine.map((p) => ({ id: p.contactId, name: displayName(p), avatar: p.avatar, conflict: mergeDiffers(p.card, record.card) }));
  // 이름이 같은 사람이 있으면 먼저 보여 주고 처음부터 골라 둔다(이미 저장해 둔 사람일 수 있다)
  const same = people.find((p) => record.name && p.name.replace(/\s+/g, "").toLowerCase() === record.name.replace(/\s+/g, "").toLowerCase()) ?? null;
  const ordered = same ? [same, ...people.filter((p) => p !== same)] : people;

  return shell(
    <ClaimShare
      token={token}
      from={from}
      avatar={record.avatar}
      parts={parts}
      people={ordered}
      suggestedId={same?.id ?? null}
      labels={{
        title: t("share.in.from", { name: from }),
        where: t("share.in.where"),
        newPerson: t("share.in.new"),
        people: t("share.in.people"),
        conflict: t("share.in.conflict"),
        keep: t("share.in.keep"),
        overwrite: t("share.in.overwrite"),
        save: t("share.in.save"),
        avatarOf: t("avatar.of", { name: "{name}" }),
        errors: {
          login: t("share.in.login"),
          notfound: t("accept.notFound"),
          expired: t("accept.expired"),
          full: t("share.in.full"),
          mine: t("share.in.mine"),
          limit: t("share.in.limit"),
          target: t("common.error"),
          busy: t("share.in.busy"),
          error: t("share.in.error"),
        },
      }}
    />,
  );
}
