import { aboutPrompt, addDays, canAnswerOwn, formatDayFull, formatMonthDay, formatSpec, holidayKey, nextHoliday, NONE, NONE_LABEL, sameYmd, solarToLunar, weekday, weekdayNames, yearEnd } from "@readme/core";
import Link from "@/components/AppLink";
import { askAbout, muteAbout, skipAbout } from "@/app/actions/people";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/chrome";
import { EmptyPortrait, EventPortrait, EventPortraits } from "@/components/EventArt";
import { FaceStack } from "@/components/FaceStack";
import { HolidayPortrait } from "@/components/HolidayArt";
import { HomeQuestionAnswers } from "@/components/HomeQuestionAnswers";
import { NotificationBell, type BellItem } from "@/components/NotificationBell";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ReviewMoment } from "@/components/ReviewAsk";
import { HandCircle, Tape } from "@/components/diary";
import { Icon } from "@/components/marks";
import { eventName, eventsFor } from "@/lib/events";
import type { Person } from "@/lib/data";
import type { HomeData } from "@/lib/pages/home.data";
import { displayName } from "@/lib/person";
import { makeT } from "@/lib/t";

// 다이어리 v2 · 한 화면(위 47·아래 34 안전 영역의 390×844에서 하단 메뉴까지 스크롤 없이): 머리 줄 → 오늘 날짜(양력·음력)와 달력 → 이번 주 8일(오늘은 손그림 동그라미, 챙길 날엔 그 사람 얼굴)
// → 다가오는 날(테이프 하나, 작은 폴라로이드, D-day 알약) → 오늘의 질문(칩 + 연필 칩, 건너뛰기) → 내 사람들(가로 줄). 장식은 덜어 테이프 하나·망고 하나. 장식은 components/diary.tsx
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
  const lunarToday = solarToLunar(today);
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

  const hasNone = !!question?.options.some((o) => o.value === NONE);
  const answerOptions = question ? question.options.filter((o) => o.value !== NONE).map((o) => ({ value: o.value, label: o.label[locale] })) : [];
  // 다가오는 날 카드 아래 줄의 단추(선물 힌트 / 선물 고르기 / 사람 추가). 한 줄에 들어오게 작게
  const cardBtn = "btn-primary !min-h-10 !px-4 !py-1 !text-[18px]";

  return (
    <>
      {/* 기록을 저장하고 돌아온 직후면(앱에서만, 며칠 써 본 사람에게만) 스토어 리뷰 부탁 */}
      <ReviewMoment source="saved" when="saved" delay={2500} />
      <div className="relative flex h-11 items-center justify-between pl-5 pr-2.5">
        <Wordmark locale={locale} />
        <div className="flex items-center gap-0.5">
          <NotificationBell items={bellItems} labels={{ title: t("notif.title"), empty: t("notif.empty") }} />
          <ProfileMenu avatar={avatar} admin={isAdmin} labels={{ menu: t("home.profileMenu"), profile: t("profile.title"), admin: t("home.adminMenu"), signOut: t("privacy.signOut") }} />
        </div>
      </div>

      {/* 오늘: 날짜 + 음력을 한 줄에, 오른쪽에 달력 */}
      <section aria-label={t("start.today")} className="flex h-10 items-center justify-between gap-2 px-5">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="shrink-0 text-[30px] font-normal leading-[1.15]">{formatMonthDay(today, locale)}</h1>
          <span className="truncate text-[15px] text-muted">
            {locale === "ko" ? `${today.y}년` : today.y}
            {lunarToday ? (locale === "ko" ? ` · 음력 ${lunarToday.m}월 ${lunarToday.d}일` : ` · Lunar ${lunarToday.m}/${lunarToday.d}`) : ""}
          </span>
        </div>
        <Link href="/calendar" aria-label={t("home.openCalendar")} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center">
          <Icon name="calendar" size={22} strokeWidth={1.8} className="text-ink" />
        </Link>
      </section>

      {/* 이번 주 8일: 오늘은 손그림 동그라미, 챙길 날엔 그 사람 얼굴(달력 아이콘이 월별 달력으로) */}
      <ol aria-label={t("home.thisWeek")} className="mx-5 mt-0.5 grid grid-cols-[repeat(8,minmax(0,1fr))]">
        {days.map((day, i) => {
          const wd = weekday(day);
          const dayEvents = events.filter((e) => sameYmd(e.date, day));
          const isToday = i === 0;
          return (
            <li key={i} className="flex flex-col items-center" aria-current={isToday ? "date" : undefined}>
              <span className={`whitespace-nowrap text-[14px] leading-[1.2] ${isToday ? "text-ink" : wd === 0 ? "text-red" : wd === 6 ? "text-sat" : "text-muted"}`}>
                {isToday ? <span className="sr-only">{t("start.today")} </span> : null}
                {names[wd]}
              </span>
              <span className={`num relative flex h-[28px] w-[38px] items-center justify-center text-[19px] ${!isToday && wd === 0 ? "text-red" : ""}`}>
                {isToday ? <HandCircle w={37} h={32} className="left-px -top-0.5" /> : null}
                {day.d}
              </span>
              <span className="flex h-[28px] items-center justify-center">
                <FaceStack faces={dayEvents.map((e) => ({ key: `${e.contactId}-${e.kind}-${e.label ?? ""}`, avatar: personOf(e.contactId)?.avatar ?? null, label: eventName(e, t, locale) }))} size={26} />
              </span>
            </li>
          );
        })}
      </ol>

      <section aria-label={t("home.upcoming")} className="card relative mx-4 mt-2 flex flex-col px-3.5 pb-2 pt-2.5">
        <Tape color="mango" w={90} h={20} rotate={-3} alpha={0.62} className="-top-[10px] left-1/2 -ml-[45px]" />
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-accent">{t("home.upcoming")}</span>
          {stampDays !== null ? (
            <span aria-hidden="true" className="num inline-flex h-7 items-center whitespace-nowrap rounded-full bg-sky px-3 text-[18px] leading-none shadow-[0_0_0_1.5px_var(--color-ink)]">
              {stampDays === 0 ? t("start.today") : `D-${stampDays}`}
            </span>
          ) : null}
        </div>
        {/* 눈으로는 알약(D-2)이 알리니 읽어 줄 때만 '2 일 뒤' */}
        {stampDays !== null && stampDays > 0 ? (
          <span className="sr-only">
            {stampDays} {stampDays === 1 ? t("home.dayToGo") : t("home.daysToGo")}
          </span>
        ) : null}
        {next ? (
          <>
            <div className="mt-1.5 flex items-center gap-3">
              {nextFaces.length > 1 ? (
                <EventPortraits faces={nextFaces.map((e) => ({ avatar: personOf(e.contactId)?.avatar ?? null, name: e.name }))} kind={next.kind} />
              ) : (
                <EventPortrait href={`/people/${next.contactId}`} avatar={nextPerson?.avatar ?? null} name={nextPerson ? displayName(nextPerson) : next.name} kind={next.kind} />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {/* 같은 날 둘까지는 한 줄씩, 셋 이상이면 첫 사람 + '외 n명' */}
                <span className="flex flex-col items-start leading-[1.25]">
                  {(nextGroup.length > 2 ? nextGroup.slice(0, 1) : nextGroup).map((e) => {
                    const title = eventName(e, t, locale);
                    return (
                      <span key={`${e.contactId}-${e.kind}-${e.label ?? ""}`} className={nextGroup.length > 1 || title.length > 8 ? "text-[21px]" : "text-[24px]"}>
                        <span className="hl">{title}</span>
                      </span>
                    );
                  })}
                  {nextGroup.length > 2 ? <span className="text-[16px] text-ink-2">{t("home.others", { n: nextGroup.length - 1 })}</span> : null}
                </span>
                {/* 양력 날짜를 먼저, 음력이면 옆에 */}
                <span className="text-[15px] leading-[1.35] text-muted">
                  {formatDayFull(next.date, locale)}
                  {nextGroup.length === 1 && next.spec.calendar === "lunar" ? ` · ${formatSpec(next.spec, locale)}` : ""}
                </span>
              </div>
            </div>
            {nextFaces.length > 1 ? (
              <div className="mt-1.5 flex flex-col">
                {nextFaces.map((e) => (
                  <Link key={e.contactId} href={hintHref(e)} className="flex min-h-11 items-center gap-2.5 border-t-[1.5px] border-dashed border-rule text-[17px]">
                    <span aria-hidden="true">
                      <Avatar config={personOf(e.contactId)?.avatar ?? null} size={26} label={e.name} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t("home.hintsFor", { name: e.name })}</span>
                    <Icon name="chevron" size={18} strokeWidth={1.8} className="text-muted" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                {/* 기억해 둔 것 한 줄(옆의 선물 힌트 단추와 같은 줄) */}
                {memo ? <span className="flex h-10 min-w-0 flex-1 items-center truncate rounded-md bg-postit px-3 text-[16px]">{memo}</span> : null}
                <Link href={hintHref(next)} aria-label={t("home.hints")} className={`${cardBtn} shrink-0 ${memo ? "" : "flex-1"}`}>
                  {t("home.hintsShort")}
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            )}
          </>
        ) : xmas ? (
          <>
            <div className="mt-1.5 flex items-center gap-3">
              <HolidayPortrait id="christmas" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[22px] leading-[1.25]">
                  <span className="hl">{t("home.yearEnd")}</span>
                </span>
                {/* 답이 온 사람이 있으면 그 소식이 곧 문구(누가 답했는지), 아니면 감성 문구 */}
                <span className="whitespace-pre-line text-[16px] leading-[1.35] text-ink-2">
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
              <Link href={xmasGiftHref} className="btn-primary mt-2 !min-h-11">
                <Icon name="gift" size={20} strokeWidth={2} />
                {t("home.yearEndGift")}
              </Link>
            ) : (
              <Link href="/people/new?xmas=1" className="btn-primary mt-2 !min-h-11">
                <Icon name="personAdd" size={20} strokeWidth={2} />
                {t("home.yearEndAdd")}
              </Link>
            )}
          </>
        ) : holiday ? (
          <>
            <div className="mt-1.5 flex items-center gap-3">
              <HolidayPortrait id={holiday.id} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`leading-[1.25] ${holidayTitle.length > 8 ? "text-[21px]" : "text-[24px]"}`}>
                  <span className="hl">{holidayTitle}</span>
                </span>
                {/* 양력 날짜(요일까지)를 먼저, 음력 날이면 음력도 작게 */}
                <span className="flex flex-col text-[15px] leading-[1.35] text-muted">
                  {formatDayFull(holiday.date, locale)}
                  {holiday.spec.calendar === "lunar" ? <span className="text-[14px]">{formatSpec(holiday.spec, locale)}</span> : null}
                </span>
              </div>
            </div>
            {/* 사람이 있으면 그 중 골라 선물 힌트로(사람들 고르기), 없으면 먼저 사람부터 */}
            {people.length ? (
              <Link href="/people?pick=1&me=0&to=gift" className="btn-primary mt-2 !min-h-11">
                {t("plan.gift")}
                <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            ) : (
              <Link href="/people/new" className="btn-primary mt-2 !min-h-11">
                {t("home.addPerson")}
              </Link>
            )}
          </>
        ) : (
          <>
            <div className="mt-1.5 flex items-center gap-3">
              <EmptyPortrait />
              <span className="min-w-0 flex-1 text-[22px] leading-[1.25]">{t("home.newFriend")}</span>
            </div>
            <Link href="/people/new" className="btn-primary mt-2 !min-h-11">
              {t("home.addPerson")}
            </Link>
            {/* 사람은 있는데 날짜를 아는 사람이 없으면 생일·기념일을 물어볼 수도 있다 */}
            {people.length && !events.length ? (
              <Link href="/request" className="mt-1 flex min-h-11 items-center justify-between border-t-[1.5px] border-dashed border-rule pt-1 text-[17px]">
                {t("home.askDates")}
                <Icon name="chevron" size={18} strokeWidth={1.8} className="text-muted" />
              </Link>
            ) : null}
          </>
        )}
      </section>

      {question && asked && askedPerson ? (
        <section aria-label={t("home.question")} className="card relative mx-4 mt-2 flex flex-col px-3.5 pb-2 pt-2">
          <div className="flex h-7 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-[15px] text-accent">{t("home.question")}</span>
              <Link href={`/people/${asked.contactId}`} className="relative flex min-w-0 items-center gap-1 rounded-full bg-white py-0.5 pl-[3px] pr-2 text-[15px] shadow-[inset_0_0_0_1.5px_var(--color-ink)] before:absolute before:-inset-y-2 before:inset-x-0">
                <Avatar config={askedPerson.avatar} size={20} label={askedName} decorative />
                <span className="truncate">{askedName}</span>
              </Link>
            </div>
            {/* 모르는 건 건너뛰기(오늘 두 번까지만 카드가 뜬다) */}
            <form action={skipAbout} className="shrink-0">
              <button className="relative flex items-center gap-0.5 text-[16px] text-muted before:absolute before:-inset-2">
                {t("common.skip")}
                <Icon name="chevron" size={16} strokeWidth={2} />
              </button>
            </form>
          </div>
          <h2 className="mt-0.5 text-[19px] font-normal leading-[1.3]">{aboutPrompt(question.id, askedName, locale)}</h2>
          {/* 고를 수 있는 보기(칩) + 연필 칩(직접 적기, 음료·꽃·향·음악·영화) + '없음'이 있는 질문은 맨 끝에 아이콘 칩 */}
          <HomeQuestionAnswers
            contactId={asked.contactId}
            questionId={question.id}
            options={answerOptions}
            none={hasNone ? { value: NONE, label: NONE_LABEL[locale] } : null}
            canOwn={canAnswerOwn(question.id)}
            labels={{ own: t("home.questionOwn"), save: t("common.save") }}
          />
          {/* 어림짐작하지 않고 그 사람에게 직접 물어보기 / 이 사람은 다시 묻지 않기 */}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <form action={askAbout}>
              <input type="hidden" name="contactId" value={asked.contactId} />
              <input type="hidden" name="id" value={question.id} />
              <button className="pill relative !h-[34px] !px-3 !text-[16px] before:absolute before:-inset-y-1.5 before:inset-x-0">
                {t("home.questionAsk")}
                <Icon name="chevron" size={14} strokeWidth={2} />
              </button>
            </form>
            <form action={muteAbout}>
              <input type="hidden" name="contactId" value={asked.contactId} />
              <button className="relative text-[14px] text-muted underline decoration-dotted underline-offset-4 before:absolute before:-inset-2">{t("home.questionMute")}</button>
            </form>
          </div>
        </section>
      ) : null}
      {answered || muted ? (
        <p role="status" className="mx-5 mt-2 flex items-center gap-2 text-[16px] text-muted">
          <Icon name="check" size={16} className="text-accent" />
          {t(muted ? "home.muted" : "home.answered")}
        </p>
      ) : null}

      <section aria-label={t("home.people")} className="card relative mx-4 mt-2 px-3 pb-2 pt-2">
        <div className="flex h-[26px] items-center justify-between pl-1">
          <h2 className="flex items-baseline gap-2 text-[18px] font-normal">
            {t("home.people")}
            <span className="num text-[14px] text-muted">{people.length}</span>
          </h2>
          {people.length ? (
            <Link href="/people" className="relative flex items-center gap-0.5 pr-0.5 text-[15px] text-muted before:absolute before:-inset-2">
              {t("home.seeAll")}
              <Icon name="chevron" size={16} strokeWidth={2} />
            </Link>
          ) : null}
        </div>
        {people.length ? (
          <div className="-mx-3 flex gap-1 overflow-x-auto px-3.5 pb-0.5 pt-2.5 [scrollbar-width:none]">
            {strip.map(({ p, label, badge }) => (
              <Link key={p.contactId} href={`/people/${p.contactId}`} aria-label={badge ? `${label} ${badge}` : label} className="relative flex w-[62px] shrink-0 flex-col items-center gap-0.5">
                <Avatar config={p.avatar} size={46} label={label} decorative />
                <span className="w-full truncate text-center text-[15px] leading-[1.2]">{displayName(p)}</span>
                {badge ? <span className="num absolute -right-1 -top-2 rotate-[8deg] whitespace-nowrap rounded-full bg-sky px-1.5 pb-px pt-px text-[13px] leading-[1.25] shadow-[0_0_0_1.5px_var(--color-ink)]">{badge}</span> : null}
              </Link>
            ))}
            <Link href="/request" className="flex w-[62px] shrink-0 flex-col items-center gap-0.5 text-muted">
              <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-[1.8px] border-dashed border-ink text-ink">
                <Icon name="plus" size={20} strokeWidth={2} />
              </span>
              <span className="text-[15px] leading-[1.2]">{t("home.request")}</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 px-1 pt-2">
            <p className="text-[16px] leading-[1.45] text-muted">{t("home.empty")}</p>
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
      </section>

      <div className="h-1" />
    </>
  );
}
