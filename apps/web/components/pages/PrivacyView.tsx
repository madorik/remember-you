import Link from "@/components/AppLink";
import { cancelInvite } from "@/app/actions/request";
import { AppLockSetting, HolidaySetting, PendingButton, PushSetting, ReminderSetting, WebPushSetting } from "@/app/(app)/privacy/Settings";
import { DeleteAccount } from "@/components/DeleteAccount";
import { Star, Tape } from "@/components/diary";
import { LanguageSetting } from "@/components/LanguageSetting";
import { Icon } from "@/components/marks";
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
      <header className="relative px-6 pt-1.5">
        <h1 className="hl inline-block px-[5px] text-[32px] font-normal leading-[1.2]">{t("privacy.title")}</h1>
        <svg aria-hidden="true" viewBox="0 0 350 10" preserveAspectRatio="none" width="100%" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="mt-1.5 block">
          <path vectorEffect="non-scaling-stroke" d="M2 6 C 60 2, 120 9, 180 5 S 300 3, 348 6" />
        </svg>
        <Star size={20} rotate={14} className="left-[96px] top-[10px]" />
      </header>
      {isAnonymous ? (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-[10px] bg-sky-soft px-4 py-2">
          <span className="flex-1 text-[16px] leading-[1.35]">{t("privacy.demo")}</span>
          <a href="/login?next=/home" className="flex min-h-11 shrink-0 items-center text-[18px] underline underline-offset-4">
            {t("privacy.signIn")}
          </a>
        </div>
      ) : null}

      {/* 아직 아무도 안 연 물어보기 링크는 있을 때만(퍼지면 아무나 답할 수 있으니 취소할 곳) */}
      {invites.length ? (
        <section aria-label={t("privacy.links")} className="card relative mx-4 mt-4 px-4 pb-1.5 pt-3.5">
          <Tape color="pink" w={108} h={26} rotate={-3} alpha={0.62} className="-top-[13px] left-1/2 -ml-[54px]" />
          <h2 className="pl-1 text-[20px] font-normal">{t("privacy.links")}</h2>
          <ul className="mt-1 flex flex-col">
            {invites.map((i) => (
              <li key={i.id} className="flex min-h-12 items-center gap-3 border-t-[1.5px] border-dashed border-rule">
                <span className="min-w-0 flex-1 pl-1 text-[19px]">{t("privacy.linkRequest", { name: i.recipientName })}</span>
                <form action={cancelInvite}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="back" value="/privacy" />
                  <PendingButton className="flex min-h-11 items-center pl-3 pr-1.5 text-[19px] text-red">{t("privacy.linkCancel")}</PendingButton>
                </form>
              </li>
            ))}
          </ul>
          </section>
      ) : null}

      <section aria-label={t("privacy.appSettings")} className="card relative mx-4 mt-3 px-4 pb-1 pt-2.5">
      <h2 className="pl-1 text-[20px] font-normal">{t("privacy.appSettings")}</h2>
      <div className="mt-1 flex flex-col">
        <LanguageSetting choice={localeChoice} back="/privacy" t={t} className="border-t-[1.5px] border-dashed border-rule" />
        <AppLockSetting locale={locale} enabled={appLock} />
        <PushSetting locale={locale} enabled={pushEnabled} />
        {pushEnabled && webPushKey ? <WebPushSetting locale={locale} publicKey={webPushKey} /> : null}
        {pushEnabled ? <HolidaySetting locale={locale} enabled={holidayReminders} /> : null}
        {/* 알림을 끄면 언제 알릴지는 숨긴다 */}
        {pushEnabled ? (
          <div id="reminders" className="border-t-[1.5px] border-dashed border-rule pb-2 pt-2.5">
            <ReminderSetting locale={locale} offsets={reminderOffsets} />
          </div>
        ) : null}
        <Link href={ai ? "/voice?tour=1" : "/request?tour=1"} className="flex min-h-12 items-center gap-3 border-t-[1.5px] border-dashed border-rule">
          <span className="flex-1 pl-1 text-[19px]">{t("privacy.replayIntro")}</span>
          <Icon name="chevron" size={20} className="mr-1 shrink-0 text-muted" />
        </Link>
        <ShareAppRow locale={locale} url={shareUrl} qr={qrShape(shareUrl)} />
      </div>
      <Tape color="mint" className="-left-2.5 -top-1.5" />
      </section>

      {/* 계정 삭제는 설정 맨 아래(로그아웃은 홈 오른쪽 위 내 얼굴 메뉴) */}
      <section aria-label={t("profile.account")} className="card relative mx-4 mt-3 px-4 pb-1 pt-2.5">
      <h2 className="pl-1 text-[20px] font-normal">{t("profile.account")}</h2>
      <div className="mt-1">
        <a href="/api/export" download="remember-you.json" className="flex min-h-12 items-center gap-3 border-t-[1.5px] border-dashed border-rule">
          <span className="flex-1 pl-1 text-[19px]">{t("privacy.exportData")}</span>
          <Icon name="up" size={20} className="mr-1 shrink-0 rotate-180 text-muted" />
        </a>
        <div className="border-t-[1.5px] border-dashed border-rule">
          <DeleteAccount locale={locale} />
        </div>
      </div>
      </section>

      <div className="h-1.5" />
    </>
  );
}
