import { formatSpec, monthName, weekdayLong } from "@readme/core";
import Link from "@/components/AppLink";
import { SeeAnswers } from "@/components/SeeAnswers";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/chrome";
import { GiftPicksBody } from "@/components/GiftPicksView";
import { Highlight } from "@/components/diary";
import { Icon } from "@/components/marks";
import { PicksContent, PicksPending } from "@/components/PicksContent";
import { PicksStage } from "@/components/PicksStage";
import { TornTape } from "@/components/TornTape";
import type { PersonReminderProps } from "@/lib/pages/person-reminder.data";
import { makeT } from "@/lib/t";

export function PersonReminderView({ locale, contactId, avatar, name, spec, next, event, picksOn, skip, again, eventKnown, answered, picks }: PersonReminderProps) {
  const t = makeT(locale);
  return (
    <>
      {/* 답이 온 사람의 선물 고르기로 곧장 왔으면(홈 연말 카드) 그 답장 알림은 읽은 것으로 */}
      {answered ? <SeeAnswers contactId={contactId} /> : null}
      <TopBar back={`/people/${contactId}`} label={t("common.back")} right={<Link href="/privacy#reminders" aria-label={t("privacy.reminders")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center"><Icon name="bell" size={24} strokeWidth={1.8} /></Link>} />

      {eventKnown && next && spec ? (
        <div className="relative flex items-center gap-3.5 px-5">
          <span className="hand relative block px-1.5 py-1 text-[44.6px] leading-none">
            <svg aria-hidden="true" viewBox="0 0 64 56" width="70.2" height="59.4" fill="none" stroke="#FFC23D" strokeWidth="3.2" strokeLinecap="round" className="pointer-events-none absolute -left-2.5 -top-2">
              <path d="M12 30 C8 14 24 5 38 6 C54 8 61 19 57 33 C53 47 36 52 23 48 C13 45 9 37 13 25" />
            </svg>
            <span className="relative">{next.date.d}</span>
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-[2.7px]">
            <span className="text-[12.6px] leading-[1.35]">
              {monthName(next.date.m, locale, true)} {weekdayLong(next.date, locale)}
            </span>
            {spec.calendar === "lunar" ? <span className="text-[10.8px] leading-[1.3] text-muted">{formatSpec(spec, locale)}</span> : null}
          </div>
          <Avatar config={avatar} size={52} label={t("avatar.of", { name })} />
        </div>
      ) : null}

      {/* 홈·달력·알림에서 챙길 날(생일·기념일·크리스마스)을 짚어 열었을 때만 그 날을 제목으로. 사람 화면의 '선물 고르기'처럼 날을 정하지 않고 열면 생일이라고 단정하지 않는다 */}
      {eventKnown ? (
        <h1 className="hand-written relative mx-5 mt-2.5 text-[25.1px] leading-[1.15]">
          {next ? (
            next.daysUntil === 0 ? (
              t("reminder.today", { event })
            ) : (
              <Highlight text={t("reminder.left", { event, n: next.daysUntil })} word={locale === "ko" ? `${next.daysUntil}일` : `${next.daysUntil} ${next.daysUntil === 1 ? "day" : "days"}`} />
            )
          ) : (
            event
          )}
        </h1>
      ) : (
        <div className="relative mx-5 mt-2.5 flex items-center gap-3.5">
          <Avatar config={avatar} size={52} label={t("avatar.of", { name })} />
          <h1 className="hand-written min-w-0 text-[25.1px] leading-[1.15]">{t("reminder.giftFor", { name })}</h1>
        </div>
      )}

      {picksOn ? (
        <section id="picks" aria-labelledby="picks-title" className="card relative mx-4 mt-5 flex scroll-mt-2 flex-col pb-3 pt-3">
          <TornTape color="mango" w={70} h={21} rotate={-6} className="-top-3 left-6" />
          {/* 아래(채워지면) 무엇을 보고 골랐는지 풀어 쓴 한두 문장. 오른쪽 위 다시 고르기 단추 자리는 float라 첫 두 줄만 비켜 가고 아래 줄은 전체 폭을 쓴다 */}
          {/* 다 고르면 제목 줄 오른쪽 끝은 다시 고르기 단추(.picks-again-slot이 그 자리를 비워 둔다) */}
          <div className="flow-root min-h-9 px-3.5">
            <span aria-hidden="true" className="picks-again-slot float-right h-9 w-28" />
            <h2 id="picks-title" className="text-[18.6px] leading-[1.1]">
              <span className="picks-t-done">{t("picks.titleFor", { name })}</span>
              <span className="picks-t-busy">{t("picks.titleBusy", { name })}</span>
            </h2>
          </div>
          {/* 고르는 동안은 꼬마 마법사 장면, 다 고르면 번쩍임 뒤에 선물이 나온다. 다시 고르면 key가 바뀌어 장면을 다시 보인다 */}
          <PicksStage key={skip.join(",")} lines={[1, 2, 3, 4].map((n) => t(`picks.loading.${n}` as "picks.loading.1", { name }))} shout={t("picks.shout")}>
            <Suspense fallback={<PicksPending />}>
              <PicksContent>
                <GiftPicksBody picks={picks} locale={locale} again={again} pad="px-3.5" />
              </PicksContent>
            </Suspense>
          </PicksStage>
        </section>
      ) : null}

      <div className="page-end mt-6" />
    </>
  );
}
