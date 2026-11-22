import { aboutPrompt, addDays, canAnswerOwn, countWord, formatDayFull, formatMonthDay, formatSpec, holidayKey, nextHoliday, NONE, NONE_LABEL, sameYmd, solarToLunar, weekday, weekdayNames, yearEnd } from "@readme/core";
import Link from "@/components/AppLink";
import { answerAbout, askAbout, muteAbout, skipAbout } from "@/app/actions/people";
import { Avatar } from "@/components/Avatar";
import { ChiliMeter } from "@/components/Chili";
import { Wordmark } from "@/components/chrome";
import { EmptyPortrait, EventPortrait, EventPortraits } from "@/components/EventArt";
import { FaceStack } from "@/components/FaceStack";
import { HolidayPortrait } from "@/components/HolidayArt";
import { NotificationBell, type BellItem } from "@/components/NotificationBell";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ReviewMoment } from "@/components/ReviewAsk";
import { HandCircle, Heart, MarginLine, Sparkle, SKY_STAR, Squiggle, Stamp, Star, Tape } from "@/components/diary";
import { CheckGlyph, Icon } from "@/components/marks";
import { eventName, eventsFor } from "@/lib/events";
import type { Person } from "@/lib/data";
import type { HomeData } from "@/lib/pages/home.data";
import { displayName } from "@/lib/person";
import { makeT } from "@/lib/t";

// 다이어리 v2: 다이어리 머리(연도·날짜·월~일 줄) → 다가오는 날(테이프 붙인 종이, 폴라로이드 얼굴, D-day 도장) → 이번 주(오늘은 손그림 동그라미, 챙길 날엔 그 사람 얼굴 + 하트)
// → 줄노트에 적힌 오늘의 질문 → 내 사람들(가로 줄). 장식은 components/diary.tsx
// 다가오는 날: 사람 기념일이 두 달 안에 있으면 그 사람 카드. 하나도 없을 때만 30일 안의 명절·챙기는 날(그림 폴라로이드), 그것도 없으면 '새 친구 추가해 봐요'.
// 연말(크리스마스 45일 전~당일)엔 더 가까운 사람 기념일이 없으면(사람이 하나도 없을 때 포함) 크리스마스 트리 + 감성 문구 + '받고 싶은 선물, 살짝 물어보기'로 채운다.

/** '기억해 둔 것' 포스트잇에 적을 말: 사람 기록에서 꽃·마실 것·간식·좋아하는 것·향·갖고 싶은 것 중 셋까지 */
function memoOf(p: Person | null): string {
  const c = p?.card;
  if (!c) return "";
  return [c.favorites?.flowers, c.taste?.drinks, c.taste?.dessert, ...(c.taste?.likes ?? []).slice(0, 2), c.favorites?.scent, c.gifts?.wishlist?.[0]?.title]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}
export function HomeView({ locale, avatar, today, people, question: asked, answers, answered, muted, isAdmin }: HomeData) {
  const t = makeT(locale);
  // 물어보기에 온 답장(아직 안 본 것)은 오른쪽 위 종에 모은다. 누르면 그 사람 화면, 열면 읽은 것으로
  const rtf = new Intl.RelativeTimeFormat(locale === "ko" ? "ko" : "en", { numeric: "auto" });
  const ago = (min: number) => {
    if (min < 1) return t("home.justNow");
    if (min < 60) return rtf.format(-min, "minute");
    if (min < 60 * 24) return rtf.format(-Math.round(min / 60), "hour");
    return rtf.format(-Math.round(min / (60 * 24)), "day");
  };
  const events = eventsFor(people, today);
  const nearest = events.find((e) => e.daysUntil <= 60) ?? null;
  // 연말(크리스마스 45일 전~당일): 사람이 있든 없든 더 가까운 사람 기념일이 없으면 크리스마스 카드(D-day는 크리스마스까지)
  const xmasAt = yearEnd(today);
  const xmas = xmasAt && (!nearest || xmasAt.daysUntil < nearest.daysUntil) ? xmasAt : null;
  const next = xmas ? null : nearest;
  const personOf = (contactId: string) => people.find((p) => p.contactId === contactId) ?? null;
  // 연말 카드의 흐름: 선물 고르기 화면(사람 화면의 '선물 고르기'가 가는 곳, 크리스마스용 ?xmas=1)으로 바로 간다.
  // 답이 온 사람이 있으면 그 사람, 사람이 하나뿐이면 그 사람, 여럿이면 사람들에서 한 명을 고르게(고르면 그 사람의 선물 고르기로), 아직 없으면 사람 추가 → 물어보기로
  const answeredIds = [...new Set(answers.map((a) => a.contactId))].filter((id) => personOf(id));
  const answeredFirst = answeredIds[0] ? personOf(answeredIds[0]) : null;
  const xmasGiftHref = answeredFirst
    ? `/people/${answeredFirst.contactId}/reminder?xmas=1`
    : people.length === 1
      ? `/people/${people[0]!.contactId}/reminder?xmas=1`
      : "/people?pick=1&me=0&to=gift&xmas=1";
  const bellItems: BellItem[] = answers.map((a) => {
    const who = personOf(a.contactId);
    const name = who ? displayName(who) : a.label;
    return { id: a.id, href: `/people/${a.contactId}`, avatar: who?.avatar ?? null, name: name || t("notif.answeredAnon"), title: name ? t("notif.answered", { name }) : t("notif.answeredAnon"), when: ago(a.minutes) };
  });
  const nextPerson = next ? personOf(next.contactId) : null;
  // 같은 날 챙길 날이 여럿이면 모두 보인다. 얼굴·선물 힌트는 사람마다 하나
  const nextGroup = next ? events.filter((e) => e.daysUntil === next.daysUntil) : [];
  const nextFaces = [...new Map(nextGroup.map((e) => [e.contactId, e])).values()];
  // 사람 기념일이 두 달 안에 하나도 없을 때만: 30일 안에 오는 명절·챙기는 날 중 가장 가까운 하나
  const holiday = next || xmas ? null : nextHoliday(today);
  const stampDays = next ? next.daysUntil : ((xmas ?? holiday)?.daysUntil ?? null);
  const holidayTitle = holiday ? t(holidayKey(holiday.id)) : "";
  // 오늘의 질문: 내가 등록한 사람 중 아직 답이 없는 칸 하나. 답은 그 사람 기록에 들어간다
  const question = asked?.q ?? null;
  const askedPerson = asked ? personOf(asked.contactId) : null;
  const askedName = askedPerson ? displayName(askedPerson) : "";
  const names = weekdayNames(locale);
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i));
  // 이번 주에 챙길 날 수(같은 날 두 사람이면 둘)
  const weekEvents = events.filter((e) => e.daysUntil < days.length).length;
  const lunarToday = solarToLunar(today);
  // 다이어리 머리의 월~일 줄(월요일부터)
  const weekRow = [1, 2, 3, 4, 5, 6, 0];
  const todayWd = weekday(today);
  const memo = nextFaces.length === 1 ? memoOf(nextPerson) : "";
  const hintHref = (e: (typeof events)[number]) => `/people/${e.contactId}/reminder?kind=${e.kind}${e.label ? `&label=${encodeURIComponent(e.label)}` : ""}`;
  // 내 사람들 줄: 즐겨찾기 먼저, 한 달 안에 챙길 날이 있으면 D-day 배지
  const strip = [...people]
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
    .map((p) => {
      const soon = events.find((e) => e.contactId === p.contactId && e.daysUntil <= 30);
      // 화면에는 부르는 말(짧게), 읽어 줄 때는 그 사람 이름 + 부르는 말
      const name = p.name || displayName(p);
      const label = p.nickname && p.nickname !== name ? `${name} ${p.nickname}` : name;
      return { p, label, badge: soon ? (soon.daysUntil === 0 ? t("start.today") : `D-${soon.daysUntil}`) : "" };
    });

  return (
    <>
      {/* 기록을 저장하고 돌아온 직후면(앱에서만, 며칠 써 본 사람에게만) 스토어 리뷰 부탁 */}
      <ReviewMoment source="saved" when="saved" delay={2500} />
      <div className="relative flex items-center justify-between pl-5 pr-2.5">
        <Wordmark locale={locale} />
        <div className="flex items-center gap-0.5">
          <NotificationBell items={bellItems} labels={{ title: t("notif.title"), empty: t("notif.empty") }} />
          <ProfileMenu avatar={avatar} admin={isAdmin} labels={{ menu: t("home.profileMenu"), profile: t("profile.title"), admin: t("home.adminMenu"), signOut: t("privacy.signOut") }} />
        </div>
      </div>

      {/* 다이어리 머리: 연도, 오늘 날짜, 월~일 줄(오늘은 손그림 동그라미), 물결선. 음력은 연도 옆에 작게 */}
      <section aria-label={t("start.today")} className="relative px-5 pt-2">
        <Star size={22} rotate={14} className="left-[134px] top-[42px]" />
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] text-muted">
              {locale === "ko" ? `${today.y}년` : today.y}
              {lunarToday ? (locale === "ko" ? ` · 음력 ${lunarToday.m}월 ${lunarToday.d}일` : ` · Lunar ${lunarToday.m}/${lunarToday.d}`) : ""}
            </span>
            <h1 className="text-[30px] font-normal leading-[1.1]">{formatMonthDay(today, locale)}</h1>
          </div>
          <div className={`flex pb-[3px] ${locale === "ko" ? "gap-px text-[16px]" : "gap-1 text-[14px]"}`} aria-hidden="true">
            {weekRow.map((wd) => (
              <span key={wd} className={`relative flex h-[26px] min-w-6 items-center justify-center px-px ${wd === todayWd ? "text-ink" : wd === 0 ? "text-red" : wd === 6 ? "text-sat" : "text-muted"}`}>
                {wd === todayWd ? <HandCircle w={34} h={31} stroke={2.4} className="-left-[5px] -top-[3px]" /> : null}
                {names[wd]}
              </span>
            ))}
          </div>
        </div>
        <svg aria-hidden="true" viewBox="0 0 350 10" preserveAspectRatio="none" width="100%" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="mt-2 block">
          <path vectorEffect="non-scaling-stroke" d="M2 6 C 60 2, 120 9, 180 5 S 300 3, 348 6" />
        </svg>
      </section>

      <section aria-label={t("home.upcoming")} className="card relative mx-4 mt-[26px] flex -rotate-[0.7deg] flex-col px-5 pb-5 pt-[26px]">
        <Tape color="mango" w={108} h={26} rotate={-3} alpha={0.62} className="-top-[13px] left-1/2 -ml-[54px]" />
        {stampDays !== null ? (
          <Stamp className="right-4 top-4" fontSize={stampDays === 0 && locale !== "ko" ? 21 : 27}>
            {stampDays === 0 ? t("start.today") : `D-${stampDays}`}
          </Stamp>
        ) : null}
        <span className="text-[16px] text-accent">{t("home.upcoming")}</span>
        {/* 눈으로는 도장(D-2)이 알리니 읽어 줄 때만 '2 일 뒤' */}
        {stampDays !== null && stampDays > 0 ? (
          <span className="sr-only">
            {stampDays} {stampDays === 1 ? t("home.dayToGo") : t("home.daysToGo")}
          </span>
        ) : null}
        {next ? (
          <>
            <div className="mt-[26px] flex items-center gap-2">
              {nextFaces.length > 1 ? (
                <EventPortraits faces={nextFaces.map((e) => ({ avatar: personOf(e.contactId)?.avatar ?? null, name: e.name }))} kind={next.kind} />
              ) : (
                <EventPortrait href={`/people/${next.contactId}`} avatar={nextPerson?.avatar ?? null} name={nextPerson ? displayName(nextPerson) : next.name} kind={next.kind} />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {/* 같은 날 둘까지는 한 줄씩, 셋 이상이면 첫 사람 + '외 n명' */}
                <span className="flex flex-col items-start leading-[1.25]">
                  {(nextGroup.length > 2 ? nextGroup.slice(0, 1) : nextGroup).map((e) => {
                    const title = eventName(e, t, locale);
                    return (
                      <span key={`${e.contactId}-${e.kind}-${e.label ?? ""}`} className={nextGroup.length > 1 || title.length > 7 ? "text-[24px]" : "text-[29px]"}>
                        <span className="hl">{title}</span>
                      </span>
                    );
                  })}
                  {nextGroup.length > 2 ? <span className="text-[17px] text-ink-2">{t("home.others", { n: nextGroup.length - 1 })}</span> : null}
                </span>
                {/* 양력 날짜를 먼저, 음력이면 옆에 */}
                <span className="text-[17px] text-muted">
                  {formatDayFull(next.date, locale)}
                  {nextGroup.length === 1 && next.spec.calendar === "lunar" ? ` · ${formatSpec(next.spec, locale)}` : ""}
                </span>
              </div>
            </div>
            {memo ? (
              <div className="mt-[18px] flex rotate-[0.8deg] flex-col gap-1 rounded-[3px] bg-postit px-3.5 pb-[13px] pt-3 shadow-[0_6px_12px_-9px_rgb(31_35_64/0.45)]">
                <span className="text-[14px] text-[#8a3b4e]">{t("person.mineList")}</span>
                <span className="text-[18px] leading-[1.45]">{memo}</span>
              </div>
            ) : null}
            {nextFaces.length > 1 ? (
              <div className="mt-[18px] flex flex-col">
                {nextFaces.map((e) => (
                  <Link key={e.contactId} href={hintHref(e)} className="flex min-h-[52px] items-center gap-2.5 border-t-[1.5px] border-dashed border-rule text-[18px]">
                    <span aria-hidden="true">
                      <Avatar config={personOf(e.contactId)?.avatar ?? null} size={28} label={e.name} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t("home.hintsFor", { name: e.name })}</span>
                    <Icon name="chevron" size={18} strokeWidth={1.8} className="text-muted" />
                  </Link>
                ))}
              </div>
            ) : (
              <Link href={hintHref(next)} className="btn-primary mt-[18px]">
                {t("home.hints")}
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            )}
          </>
        ) : xmas ? (
          <>
            <div className="mt-[26px] flex items-center gap-2">
              <HolidayPortrait id="christmas" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[26px] leading-[1.25]">
                  <span className="hl">{t("home.yearEnd")}</span>
                </span>
                {/* 답이 온 사람이 있으면 그 소식이 곧 문구(누가 답했는지), 아니면 감성 문구 */}
                <span className="whitespace-pre-line text-[19px] leading-[1.4] text-ink-2">
                  {answeredFirst
                    ? answeredIds.length > 1
                      ? t("home.yearEndAnswered", { name: displayName(answeredFirst), n: answeredIds.length - 1 })
                      : t("notif.answered", { name: displayName(answeredFirst) })
                    : t("home.yearEndLine")}
                </span>
              </div>
            </div>
            {/* 사람이 없으면: 챙기고 싶은 사람을 더하고(사람 추가) → 곧바로 그 사람에게 물어보기(받고 싶은 것) → 답이 오면 이 카드가 알려 주며 선물 고르기로.
                사람이 있으면 곧장 선물 고르기 */}
            {people.length ? (
              <Link href={xmasGiftHref} className="btn-primary mt-[18px]">
                <Icon name="gift" size={20} strokeWidth={2} />
                {t("home.yearEndGift")}
              </Link>
            ) : (
              <Link href="/people/new?xmas=1" className="btn-primary mt-[18px]">
                <Icon name="personAdd" size={20} strokeWidth={2} />
                {t("home.yearEndAdd")}
              </Link>
            )}
          </>
        ) : holiday ? (
          <>
            <div className="mt-[26px] flex items-center gap-2">
              <HolidayPortrait id={holiday.id} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={`leading-[1.25] ${holidayTitle.length > 7 ? "text-[24px]" : "text-[29px]"}`}>
                  <span className="hl">{holidayTitle}</span>
                </span>
                {/* 양력 날짜(요일까지)를 먼저, 음력 날이면 음력도 작게 */}
                <span className="flex flex-col text-[17px] leading-[1.35] text-muted">
                  {formatDayFull(holiday.date, locale)}
                  {holiday.spec.calendar === "lunar" ? <span className="text-[15px]">{formatSpec(holiday.spec, locale)}</span> : null}
                </span>
              </div>
            </div>
            {/* 사람이 있으면 그 중 골라 선물 힌트로(사람들 고르기), 없으면 먼저 사람부터 */}
            {people.length ? (
              <Link href="/people?pick=1&me=0&to=gift" className="btn-primary mt-[18px]">
                {t("plan.gift")}
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            ) : (
              <Link href="/people/new" className="btn-primary mt-[18px]">
                {t("home.addPerson")}
              </Link>
            )}
          </>
        ) : (
          <>
            <div className="mt-[26px] flex items-center gap-2">
              <EmptyPortrait />
              <span className="min-w-0 flex-1 text-[24px] leading-[1.25]">{t("home.newFriend")}</span>
            </div>
            <Link href="/people/new" className="btn-primary mt-[18px]">
              {t("home.addPerson")}
            </Link>
            {/* 사람은 있는데 날짜를 아는 사람이 없으면 생일·기념일을 물어볼 수도 있다 */}
            {people.length && !events.length ? (
              <Link href="/request" className="mt-1.5 flex min-h-[52px] items-center justify-between border-t-[1.5px] border-dashed border-rule pt-1 text-[18px]">
                {t("home.askDates")}
                <Icon name="chevron" size={18} strokeWidth={1.8} className="text-muted" />
              </Link>
            ) : null}
          </>
        )}
        {/* 낙서 */}
        <Heart size={28} rotate={-14} className="-bottom-2.5 -left-2" />
        <Squiggle w={58} className="-bottom-[7px] right-6" />
        <Sparkle size={18} className="left-[106px] top-[46px]" />
      </section>

      {/* 누르면 월별 달력(카드 전체가 눌린다) */}
      <section aria-label={t("home.thisWeek")} className="card relative mx-4 mt-[22px] px-3 pb-3 pt-4 transition-transform active:scale-[0.99]">
        <Link href="/calendar" aria-label={t("home.openCalendar")} className="absolute inset-0 z-10 rounded-[10px]" />
        <div className="flex items-center justify-between pl-2 pr-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[21px] font-normal">{t("home.thisWeek")}</h2>
            {weekEvents ? (
              <span className="-rotate-3 rounded-full bg-[#fff0c9] px-2.5 pb-1 pt-[3px] text-[15px] shadow-[inset_0_0_0_1.5px_var(--color-ink)]">{t("home.weekCount", { n: countWord(weekEvents, locale) })}</span>
            ) : null}
          </div>
          <Icon name="calendar" size={22} strokeWidth={1.8} className="text-ink" />
        </div>
        <ol className="mt-3 grid grid-cols-[repeat(8,minmax(0,1fr))]">
          {days.map((day, i) => {
            const wd = weekday(day);
            const dayEvents = events.filter((e) => sameYmd(e.date, day));
            const lunar = solarToLunar(day);
            const isToday = i === 0;
            return (
              <li key={i} className={`flex flex-col items-center gap-0.5 py-0.5 ${i ? "border-l border-dashed border-rule" : ""}`} aria-current={isToday ? "date" : undefined}>
                <span className={`whitespace-nowrap text-[15px] ${isToday ? "text-ink" : wd === 0 ? "text-red" : wd === 6 ? "text-sat" : "text-muted"}`}>
                  {isToday ? <span className="sr-only">{t("start.today")} </span> : null}
                  {names[wd]}
                </span>
                <span className={`num relative flex h-[34px] w-[38px] items-center justify-center text-[21px] ${!isToday && wd === 0 ? "text-red" : ""}`}>
                  {isToday ? <HandCircle w={40} h={36} className="-left-px -top-px" /> : null}
                  {day.d}
                </span>
                <span className="num whitespace-nowrap text-[13px] text-muted">{lunar ? `${lunar.m}.${lunar.d}` : ""}</span>
                <span className="relative flex h-[30px] items-center justify-center">
                  <FaceStack faces={dayEvents.map((e) => ({ key: `${e.contactId}-${e.kind}-${e.label ?? ""}`, avatar: personOf(e.contactId)?.avatar ?? null, label: eventName(e, t, locale) }))} size={28} />
                  {dayEvents.length ? <Heart size={15} rotate={14} className="-right-[5px] -top-1.5" /> : null}
                </span>
              </li>
            );
          })}
        </ol>
        <Tape color="pink" className="-left-2.5 -top-1.5" />
        <Tape color="mint" className="-bottom-1 -right-2.5" />
        <Star size={20} rotate={-12} className="left-24 -top-2.5" />
        <Squiggle w={54} color="#F59BAE" width={2.4} className="-bottom-2 left-[22px]" />
      </section>

      {question && asked && askedPerson ? (
        <section aria-label={t("home.question")} className="card ruled relative mx-4 mt-[22px] flex flex-col gap-3 pb-3.5 pl-[42px] pr-[18px] pt-5">
          <MarginLine />
          <Tape color="mint" w={74} h={22} rotate={-8} alpha={0.55} vertical className="-top-2.5 left-3.5" />
          <div className="flex items-center gap-2.5">
            <span className="text-[16px] text-accent">{t("home.question")}</span>
            <Link href={`/people/${asked.contactId}`} className="relative flex min-w-0 items-center gap-1 rounded-full bg-white py-0.5 pl-[3px] pr-2.5 text-[15px] shadow-[inset_0_0_0_1.5px_var(--color-ink)] before:absolute before:-inset-y-2 before:inset-x-0">
              <Avatar config={askedPerson.avatar} size={24} label={askedName} decorative />
              <span className="truncate">{askedName}</span>
            </Link>
          </div>
          <h2 className="text-[24px] font-normal leading-[1.3]">{aboutPrompt(question.id, askedName, locale)}</h2>
          {/* 고를 수 있는 보기(칩). '없음'이 있는 질문은 맨 끝에 아이콘 칩 */}
          {(() => {
            const hasNone = question.options.some((o) => o.value === NONE);
            const opts = question.options.filter((o) => o.value !== NONE);
            return (
              <form action={answerAbout} className="flex flex-wrap gap-2">
                <input type="hidden" name="contactId" value={asked.contactId} />
                <input type="hidden" name="id" value={question.id} />
                {opts.map((o) => (
                  <button key={o.value} name="value" value={o.value} className={`chip transition-transform hover:bg-sky-soft active:scale-95 ${question.id === "spicy" ? "!flex-col !gap-0 !py-1.5" : ""}`}>
                    {o.label[locale]}
                    {/* 매운맛 질문은 고추 개수로도(값이 단계 0–4) */}
                    {question.id === "spicy" ? <ChiliMeter level={Number(o.value)} size={16} /> : null}
                  </button>
                ))}
                {hasNone ? (
                  <button name="value" value={NONE} aria-label={NONE_LABEL[locale]} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-muted shadow-[inset_0_0_0_1.5px_var(--color-ink)] transition-transform hover:bg-sky-soft active:scale-95">
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </form>
            );
          })()}
          {/* 보기에 없는 답은 직접(음료·꽃·향·음악·영화) */}
          {canAnswerOwn(question.id) ? (
            <form action={answerAbout} className="flex items-center gap-2">
              <input type="hidden" name="contactId" value={asked.contactId} />
              <input type="hidden" name="id" value={question.id} />
              <input
                name="value"
                required
                maxLength={60}
                enterKeyHint="send"
                placeholder={t("home.questionOwn")}
                aria-label={t("home.questionOwn")}
                className="h-11 min-w-0 flex-1 border-0 border-b-[1.5px] border-dashed border-ink bg-transparent px-0.5 text-[18px] placeholder:text-muted"
              />
              <button aria-label={t("common.save")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_var(--color-ink)] active:scale-95">
                <CheckGlyph size={20} />
              </button>
            </form>
          ) : null}
          {/* 내가 어림짐작하지 않고 그 사람에게 직접 물어보기 / 모르는 건 건너뛰기(오늘 두 번까지만 카드가 뜬다) */}
          <div className="-mt-1 flex items-center justify-between gap-2">
            <form action={askAbout}>
              <input type="hidden" name="contactId" value={asked.contactId} />
              <input type="hidden" name="id" value={question.id} />
              <button className="pill !min-h-11 !px-4 !text-[17px]">{t("home.questionAsk")}</button>
            </form>
            <form action={skipAbout}>
              <button className="flex min-h-11 items-center gap-1 pl-2 text-[16px] text-muted">
                {t("common.skip")}
                <Icon name="chevron" size={18} strokeWidth={2} />
              </button>
            </form>
          </div>
          <form action={muteAbout} className="-mb-1.5 -mt-1.5">
            <input type="hidden" name="contactId" value={asked.contactId} />
            <button className="flex min-h-11 items-center text-[15px] text-muted underline decoration-dotted underline-offset-4">{t("home.questionMute")}</button>
          </form>
          <Heart size={26} rotate={16} className="-right-[7px] top-11" />
          <Star size={20} rotate={-12} className="-left-[7px] bottom-[30px]" />
        </section>
      ) : null}
      {answered || muted ? (
        <p role="status" className="mx-5 mt-2.5 flex items-center gap-2 text-[16px] text-muted">
          <Icon name="check" size={16} className="text-accent" />
          {t(muted ? "home.muted" : "home.answered")}
        </p>
      ) : null}

      <section aria-label={t("home.people")} className="card relative mx-4 mt-[22px] px-3 pb-3.5 pt-4">
        <div className="flex items-center justify-between pl-2">
          <h2 className="flex items-baseline gap-2 text-[21px] font-normal">
            {t("home.people")}
            <span className="num text-[16px] text-muted">{people.length}</span>
          </h2>
          {people.length ? (
            <Link href="/people" className="flex min-h-11 items-center gap-0.5 pl-2 pr-0.5 text-[16px] text-muted">
              {t("home.seeAll")}
              <Icon name="chevron" size={18} strokeWidth={2} />
            </Link>
          ) : null}
        </div>
        {people.length ? (
          <div className="-mx-3 mt-1 flex gap-2 overflow-x-auto px-4 pb-1 pt-1.5 [scrollbar-width:none]">
            {strip.map(({ p, label, badge }) => (
              <Link key={p.contactId} href={`/people/${p.contactId}`} aria-label={badge ? `${label} ${badge}` : label} className="relative flex w-[60px] shrink-0 flex-col items-center gap-1">
                <Avatar config={p.avatar} size={56} label={label} decorative />
                <span className="w-full truncate text-center text-[16px]">{displayName(p)}</span>
                {badge ? <span className="num absolute -right-2 -top-0.5 rotate-[8deg] whitespace-nowrap rounded-full bg-sky px-1.5 pb-0.5 pt-px text-[13px] shadow-[0_0_0_1.5px_var(--color-ink)]">{badge}</span> : null}
              </Link>
            ))}
            <Link href="/request" className="flex w-[60px] shrink-0 flex-col items-center gap-1 text-muted">
              <span className="my-1.5 flex h-[46px] w-[46px] items-center justify-center rounded-full border-[1.8px] border-dashed border-ink text-ink">
                <Icon name="plus" size={20} strokeWidth={2} />
              </span>
              <span className="text-[16px]">{t("home.request")}</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-2 pt-3">
            <p className="text-[17px] leading-[1.5] text-muted">{t("home.empty")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/people/new" className="btn-outline">
                {t("people.add")}
              </Link>
              <Link href="/request" className="btn-primary">
                {t("home.ask")}
              </Link>
            </div>
          </div>
        )}
        <Star size={22} rotate={12} color={SKY_STAR} className="-right-1 -top-[11px]" />
      </section>

      <div className="h-4" />
    </>
  );
}
