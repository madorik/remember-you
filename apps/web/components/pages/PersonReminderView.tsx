import { formatSpec, monthName, weekdayLong } from "@readme/core";
import Link from "@/components/AppLink";
import { SeeAnswers } from "@/components/SeeAnswers";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/chrome";
import { GiftPicksBody } from "@/components/GiftPicksView";
import { HandCircle, Heart, SKY_STAR, Squiggle, Star, Tape } from "@/components/diary";
import { Icon } from "@/components/marks";
import { PicksContent, PicksPending } from "@/components/PicksContent";
import { PicksStage } from "@/components/PicksStage";
import type { PersonReminderProps } from "@/lib/pages/person-reminder.data";
import { makeT } from "@/lib/t";

export function PersonReminderView({ locale, contactId, avatar, name, spec, next, event, picksOn, skip, again, eventKnown, answered, picks }: PersonReminderProps) {
  const t = makeT(locale);
  return (
    <>
      {/* 답이 온 사람의 선물 고르기로 곧장 왔으면(홈 연말 카드) 그 답장 알림은 읽은 것으로 */}
      {answered ? <SeeAnswers contactId={contactId} /> : null}
      <TopBar back={`/people/${contactId}`} label={t("common.back")} right={<Link href="/privacy#reminders" aria-label={t("privacy.reminders")} className="flex h-11 w-11 items-center justify-center"><Icon name="bell" /></Link>} />

      {eventKnown && next && spec ? (
        <div className="relative flex items-center gap-4 pb-0 pl-[30px] pr-6 pt-2.5">
          <span className="num relative flex w-28 shrink-0 items-center justify-center text-[104px] !leading-[0.9] tracking-[-0.02em]">
            <HandCircle w={138} h={118} stroke={1.5} className="left-1/2 top-1/2 -ml-[69px] -mt-[59px]" />
            {next.date.d}
          </span>
          <div className="flex min-w-0 flex-1 flex-col pt-1.5">
            <span className="text-[23px] leading-[1.25]">
              {monthName(next.date.m, locale, true)} {weekdayLong(next.date, locale)}
            </span>
            {spec.calendar === "lunar" ? <span className="text-[16px] text-muted">{formatSpec(spec, locale)}</span> : null}
          </div>
          <Avatar config={avatar} size={56} label={t("avatar.of", { name })} />
          <Star size={22} rotate={14} className="-top-1.5 right-[30px]" />
        </div>
      ) : null}

      {/* 홈·달력·알림에서 챙길 날(생일·기념일·크리스마스)을 짚어 열었을 때만 그 날을 제목으로. 사람 화면의 '선물 고르기'처럼 날을 정하지 않고 열면 생일이라고 단정하지 않는다 */}
      {eventKnown ? (
        <h1 className="relative mx-6 mt-[22px] text-[31px] leading-[1.35]">{next ? (next.daysUntil === 0 ? t("reminder.today", { event }) : t("reminder.left", { event, n: next.daysUntil })) : event}</h1>
      ) : (
        <div className="relative mx-6 mt-3 flex items-center gap-3.5">
          <Avatar config={avatar} size={56} label={t("avatar.of", { name })} />
          <h1 className="min-w-0 text-[31px] leading-[1.35]">{t("reminder.giftFor", { name })}</h1>
        </div>
      )}

      {picksOn ? (
        <section id="picks" aria-labelledby="picks-title" className="card relative mx-4 mt-7 flex scroll-mt-2 flex-col pb-4 pt-7">
          <Tape color="mango" w={108} h={26} rotate={-3} alpha={0.62} className="-top-[13px] left-1/2 -ml-[54px]" />
          <Tape color="mint" className="-bottom-1 -right-2.5" />
          <Heart size={26} rotate={16} className="-right-[9px] top-[70px]" />
          <Star size={20} rotate={-12} color={SKY_STAR} className="-left-2 top-[330px]" />
          <Squiggle w={54} width={2.4} className="-bottom-2 left-[30px]" />
          {/* 아래(채워지면) 무엇을 보고 골랐는지 풀어 쓴 한두 문장. 오른쪽 위 다시 고르기 단추 자리는 float라 첫 두 줄만 비켜 가고 아래 줄은 전체 폭을 쓴다 */}
          {/* 다 고르면 제목 줄 오른쪽 끝은 다시 고르기 단추(.picks-again-slot이 그 자리를 비워 둔다) */}
          <div className="flow-root min-h-10 px-[18px]">
            <span aria-hidden="true" className="picks-again-slot float-right h-10 w-28" />
            <h2 id="picks-title" className="text-[24px] leading-[1.35]">
              <span className="picks-t-done">{t("picks.titleFor", { name })}</span>
              <span className="picks-t-busy">{t("picks.titleBusy", { name })}</span>
            </h2>
          </div>
          {/* 고르는 동안은 꼬마 마법사 장면, 다 고르면 번쩍임 뒤에 선물이 나온다. 다시 고르면 key가 바뀌어 장면을 다시 보인다 */}
          <PicksStage key={skip.join(",")} lines={[1, 2, 3, 4].map((n) => t(`picks.loading.${n}` as "picks.loading.1", { name }))} shout={t("picks.shout")}>
            <Suspense fallback={<PicksPending />}>
              <PicksContent>
                <GiftPicksBody picks={picks} locale={locale} again={again} pad="px-[18px]" />
              </PicksContent>
            </Suspense>
          </PicksStage>
        </section>
      ) : null}

      <div className="page-end mt-6" />
    </>
  );
}
