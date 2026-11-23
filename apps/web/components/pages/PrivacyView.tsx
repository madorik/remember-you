import Link from "@/components/AppLink";
import { cancelInvite } from "@/app/actions/request";
import { AppLockSetting, HolidaySetting, PendingButton, PushSetting, ReminderSetting, WebPushSetting } from "@/app/(app)/privacy/Settings";
import { DeleteAccount } from "@/components/DeleteAccount";
import { TornTape } from "@/components/TornTape";
import { LanguageSetting } from "@/components/LanguageSetting";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { ShareAppRow } from "@/components/ShareAppRow";
import type { PrivacyData } from "@/lib/pages/types";
import { qrShape } from "@/lib/qr";
import { absoluteUrl } from "@/lib/site";
import { makeT } from "@/lib/t";

export function PrivacyView({ locale, isAnonymous, invites, localeChoice, appLock, pushEnabled, holidayReminders, reminderOffsets, ai, webPushKey }: PrivacyData) {
  const t = makeT(locale);
  // 앱 공유하기: 보는 사람 기기에 맞는 스토어로 이어 주는 주소(/get). QR은 서버에서 모양만 만들어 넘긴다
  const shareUrl = absoluteUrl("/get?from=share");

  return (
    <>
      <header className="relative flex items-end justify-between px-5 pt-1.5">
        <h1 className="scribble text-[38px] leading-none">{t("privacy.title")}</h1>
        {/* 설정 제목 옆에서 구름 위에 잠든 캐릭터(시안) */}
        <Mascot pose={5} size={40} className="mb-1 mr-1" />
      </header>
      {isAnonymous ? (
        <div className="card mx-4 mt-4 flex items-center gap-3 !bg-sky-soft px-4 py-2">
          <span className="flex-1 text-[14px] leading-[1.35]">{t("privacy.demo")}</span>
          <a href="/login?next=/home" className="flex min-h-11 shrink-0 items-center text-[15px] underline underline-offset-4">
            {t("privacy.signIn")}
          </a>
        </div>
      ) : null}

      {/* 아직 아무도 안 연 물어보기 링크는 있을 때만(퍼지면 아무나 답할 수 있으니 취소할 곳) */}
      {invites.length ? (
        <section aria-label={t("privacy.links")} className="card relative mx-4 mt-6 px-3.5 pb-1 pt-2.5">
          <TornTape color="pink" w={68} h={21} rotate={-4} className="-top-3 right-6" />
          <h2 className="scribble text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
            {t("privacy.links")}
          </h2>
          <ul className="mt-3 flex flex-col">
            {invites.map((i) => (
              <li key={i.id} className="flex min-h-[45px] items-center gap-3 border-t-[1.5px] border-dashed border-ink/[0.18]">
                <span className="min-w-0 flex-1 text-[15px]">{t("privacy.linkRequest", { name: i.recipientName })}</span>
                <form action={cancelInvite}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="back" value="/privacy" />
                  <PendingButton className="flex min-h-11 items-center pl-3 text-[15px] text-red">{t("privacy.linkCancel")}</PendingButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label={t("privacy.appSettings")} className="card relative mx-4 mt-6 px-3.5 pb-1 pt-2.5">
        <TornTape color="mint" w={68} h={21} rotate={-8} className="-top-[13px] left-[22px]" />
        <h2 className="scribble text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
          {t("privacy.appSettings")}
        </h2>
        <div className="mt-3 flex flex-col">
          <LanguageSetting choice={localeChoice} back="/privacy" t={t} className="border-t-[1.5px] border-dashed border-ink/[0.18]" />
          <AppLockSetting locale={locale} enabled={appLock} />
          <PushSetting locale={locale} enabled={pushEnabled} />
          {pushEnabled && webPushKey ? <WebPushSetting locale={locale} publicKey={webPushKey} /> : null}
          {pushEnabled ? <HolidaySetting locale={locale} enabled={holidayReminders} /> : null}
          {/* 알림을 끄면 언제 알릴지는 숨긴다 */}
          {pushEnabled ? (
            <div id="reminders" className="border-t-[1.5px] border-dashed border-ink/[0.18] pb-2.5 pt-2.5">
              <ReminderSetting locale={locale} offsets={reminderOffsets} />
            </div>
          ) : null}
          <Link href={ai ? "/voice?tour=1" : "/request?tour=1"} className="flex min-h-[45px] items-center gap-3 border-t-[1.5px] border-dashed border-ink/[0.18]">
            <span className="flex-1 text-[15px]">{t("privacy.replayIntro")}</span>
            <Icon name="chevron" size={15} strokeWidth={2} className="shrink-0 text-muted" />
          </Link>
          <ShareAppRow locale={locale} url={shareUrl} qr={qrShape(shareUrl)} />
        </div>
      </section>

      {/* 계정 삭제는 설정 맨 아래(로그아웃은 홈 오른쪽 위 내 얼굴 메뉴) */}
      <section aria-label={t("profile.account")} className="card relative mx-4 mt-3.5 px-3.5 pb-1 pt-2.5">
        <h2 className="scribble text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
          {t("profile.account")}
        </h2>
        <div className="mt-3">
          <a href="/api/export" download="remember-you.json" className="flex min-h-[45px] items-center gap-3 border-t-[1.5px] border-dashed border-ink/[0.18]">
            <span className="flex-1 text-[15px]">{t("privacy.exportData")}</span>
            <Icon name="up" size={17} strokeWidth={1.8} className="shrink-0 rotate-180 text-muted" />
          </a>
          <div className="border-t-[1.5px] border-dashed border-ink/[0.18]">
            <DeleteAccount locale={locale} />
          </div>
        </div>
      </section>

      <div className="page-end" />
    </>
  );
}
