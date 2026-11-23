import { aboutPrompt, addDays, canAnswerOwn, daysOn, formatDayFull, formatDotted, formatMonthDay, formatSpec, holidayKey, nextHoliday, NONE, NONE_LABEL, questionsLeft, sameYmd, solarToLunar, upcomingEvents, weekday, weekdayNames, yearEnd, type UpcomingEvent, type YMD } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/chrome";
import { FaceStack } from "@/components/FaceStack";
import { HolidayArt } from "@/components/HolidayArt";
import { HomeQuestion } from "@/components/HomeQuestion";
import { Mascot } from "@/components/Mascot";
import { NotificationBell, type BellItem } from "@/components/NotificationBell";
import { ProfileMenu } from "@/components/ProfileMenu";
import { DateHead, DStamp, HeroButton, HeroFrame, HeroPolaroid, RememberedBox, WeekCard, type WeekDay } from "@/components/HomeParts";
import { Chev } from "@/components/planner";
import { ReplyAlertsPrompt } from "@/components/native";
import { SavedToast } from "@/components/SavedToast";
import { ReviewMoment } from "@/components/ReviewAsk";
import { Icon } from "@/components/marks";
import { eventName, eventsFor, peopleDates } from "@/lib/events";
import type { Person } from "@/lib/data";
import type { HomeData } from "@/lib/pages/home.data";
import { displayName } from "@/lib/person";
import { QUESTION_TOPIC } from "@/lib/question-topic";
import { makeT } from "@/lib/t";

// 홈 시안 H-Home(날짜 머리 구조): 머리(로고·종·내 얼굴) → 날짜 머리(2026년 · 음력, 큰 오늘 날짜, 요일 글자, 손으로 그은 줄)
// → 다가오는 날 큰 카드(줄무늬 망고 테이프 · D-n 도장 · 폴라로이드 · 기억해 둔 것 분홍 상자 · 망고 단추 '선물 힌트 보기')
// → 이번 주 카드(오늘부터 8칸, '챙길 날 n번!') → 오늘의 질문 3줄 카드(질문 있음) + '이어서' #해시태그 줄 / '이어서 챙길 날' 목록(질문 없음) / 체크 목록(오늘 질문 다 함).
// 큰 카드: 사람 기념일이 두 달 안에 있으면 그 사람 카드. 하나도 없을 때만 30일 안의 명절·챙기는 날, 그것도 없으면 '새 친구 추가해 봐요'. 변형들도 같은 틀(HeroFrame)에 그림·글·단추를 끼운다.
// 연말(크리스마스 45일 전~당일)엔 더 가까운 사람 기념일이 없으면(사람이 하나도 없을 때 포함) 크리스마스 카드(트리 + 감성 문구 + 상태를 따라가는 단추)가 큰 카드 자리를 채운다.
// 캐릭터: 큰 카드 위에 빼꼼(2)은 늘, 질문이 없으면 목록 카드 위에 누움(12), 다 했으면 체크 카드 위에 별(11). 화면이 한 장을 넘어도 되니 아래로 민다.

const STUB_NOTE = "rgb(31 35 64 / 0.3)";

/** 사람 기록에서 '기억해 둔 것': 꽃·마실 것·간식·좋아하는 음식·향·갖고 싶은 것(앞의 둘을 분홍 상자에 · 로 이어 적는다) */
function rememberedOf(p: Person | null, locale: "ko" | "en"): { label: string; value: string }[] {
  const c = p?.card;
  if (!c) return [];
  const ko = locale === "ko";
  const out: { label: string; value: string }[] = [];
  const add = (label: string, v: unknown) => {
    const value = typeof v === "string" ? v.trim() : "";
    if (value) out.push({ label, value });
  };
  add(ko ? "꽃" : "Flowers", c.favorites?.flowers);
  add(ko ? "마실 것" : "Drink", c.taste?.drinks);
  add(ko ? "간식" : "Treat", c.taste?.dessert);
  for (const v of c.taste?.likes ?? []) add(ko ? "음식" : "Food", v);
  add(ko ? "향" : "Scent", c.favorites?.scent);
  for (const w of c.gifts?.wishlist ?? []) add(ko ? "갖고 싶은 것" : "Wish", w.title);
  return out;
}

/** 큰 카드 제목 크기(손글씨): 시안 37px의 90%. 길면 줄인다 */
function heroTitleSize(len: number, many: boolean): number {
  if (many) return 19.8;
  return len <= 5 ? 29 : len <= 7 ? 25.2 : len <= 10 ? 21.6 : 18;
}

/** 칸막이 점선(카드 안 줄): 시안은 남색 16% */
const dashedRule = { borderColor: STUB_NOTE };

/** 그 날의 음력: '음력 10월 21일' / 'Lunar 10/21'(2050년 밖이면 빈 글) */
function lunarFull(day: YMD, locale: "ko" | "en"): string {
  const l = solarToLunar(day);
  return l ? formatSpec({ calendar: "lunar", month: l.m, day: l.d, leap: l.leap }, locale) : "";
}

/** 이번 주 칸 아래 작은 음력: 10.15 */
function lunarDots(day: YMD, locale: "ko" | "en"): string {
  const l = solarToLunar(day);
  if (!l) return "";
  return `${l.leap ? (locale === "ko" ? "윤" : "L") : ""}${String(l.m).padStart(2, "0")}.${String(l.d).padStart(2, "0")}`;
}

/** 큰 카드 폴라로이드 자리에 들어가는 그림(명절 그림·새 친구 자리) */
function ArtBox({ children, dashed = false }: { children: React.ReactNode; dashed?: boolean }) {
  return (
    <HeroPolaroid>
      {dashed ? (
        <span aria-hidden="true" className="flex h-[49.5px] w-[49.5px] items-center justify-center rounded-full border border-dashed border-edge bg-white">
          {children}
        </span>
      ) : (
        children
      )}
    </HeroPolaroid>
  );
}

export function HomeView({ locale, avatar, today, people, question: asked, questionsUsed, questionLog, answers, answered, muted, isAdmin }: HomeData) {
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
  const hintHref = (e: UpcomingEvent) => `/people/${e.contactId}/reminder?kind=${e.kind}${e.label ? `&label=${encodeURIComponent(e.label)}` : ""}`;
  const remembered = nextFaces.length === 1 ? rememberedOf(nextPerson, locale) : [];

  // 오늘의 질문: 내가 등록한 사람 중 아직 답이 없는 칸 하나. 답은 그 사람 기록에 들어간다
  const question = asked?.q ?? null;
  const askedPerson = asked ? personOf(asked.contactId) : null;
  const askedName = askedPerson ? displayName(askedPerson) : "";
  const showQuestion = !!(question && asked && askedPerson);
  // 오늘 두 번 다 처리했으면 체크 목록(질문 카드는 더 뜨지 않는다)
  const showDone = !showQuestion && people.length > 0 && questionsLeft(questionsUsed) === 0;
  // 큰 카드 다음의 날들: 큰 카드가 사람의 날이면 그보다 뒤의 날만
  const followUps = events.filter((e) => (next ? e.daysUntil > next.daysUntil : true));
  const showList = !showQuestion && !showDone && followUps.length > 0;
  const showEmptyPeople = !showQuestion && !showDone && !showList && people.length === 0;
  const showTags = (showQuestion || showDone) && followUps.length > 0;

  // 날짜 머리: 2026년 · 음력 10월 15일, 큰 오늘 날짜, 월~일 요일 글자
  const names = weekdayNames(locale);
  const todayLunar = lunarFull(today, locale);
  const dateSmall = `${locale === "ko" ? `${today.y}년` : today.y}${todayLunar ? ` · ${todayLunar}` : ""}`;

  // 이번 주 카드: 오늘부터 8칸. 챙길 날이 있는 칸은 그 사람 얼굴 + 하트, 공휴일·챙기는 날은 이름을 작게
  const weekEvents = upcomingEvents(peopleDates(people), today, 7);
  const weekDays: WeekDay[] = Array.from({ length: 8 }, (_, i) => {
    const day = addDays(today, i);
    const marks = daysOn(day);
    const mark = marks[0] ?? null;
    return {
      key: `${day.m}-${day.d}`,
      wd: weekday(day),
      d: day.d,
      lunar: lunarDots(day, locale),
      today: i === 0,
      mark: mark ? { text: mark.short[locale], off: marks.some((x) => x.off) } : null,
      faces: weekEvents.filter((e) => sameYmd(e.date, day)).map((e) => ({ key: `${e.contactId}-${e.kind}-${e.label ?? ""}`, avatar: personOf(e.contactId)?.avatar ?? null, label: eventName(e, t, locale) })),
    };
  });
  const weekCount = weekEvents.length;
  const weekCountText = weekCount === 0 ? null : weekCount <= 4 ? t(`home.weekCount${weekCount}` as "home.weekCount1") : t("home.weekCount", { n: weekCount });

  /** D-n 도장(눈으로는 도장이 알리니 읽어 줄 때만 '6 일 뒤') */
  const stamp =
    stampDays !== null ? (
      <>
        {stampDays > 0 ? (
          <span className="sr-only">
            {stampDays} {stampDays === 1 ? t("home.dayToGo") : t("home.daysToGo")}
          </span>
        ) : null}
        <DStamp fontSize={stampDays === 0 ? (locale === "ko" ? 28 : 22) : String(stampDays).length > 2 ? 22 : String(stampDays).length > 1 ? 27 : 32}>{stampDays === 0 ? t("start.today") : `D-${stampDays}`}</DStamp>
      </>
    ) : null;

  const heroTitle = (text: string, size: number) => (
    <h2 className="hand leading-[1.05]" style={{ fontSize: size }}>
      <span className="hl">{text}</span>
    </h2>
  );

  let heroCard: React.ReactNode;
  if (next) {
    const note = remembered
      .slice(0, 2)
      .map((l) => l.value)
      .join(" · ");
    const title = (nextGroup.length > 2 ? nextGroup.slice(0, 1) : nextGroup).map((e) => ({ key: `${e.contactId}-${e.kind}-${e.label ?? ""}`, text: eventName(e, t, locale) }));
    const many = nextGroup.length > 1;
    const lunar = lunarFull(next.date, locale);
    const firstName = nextPerson ? displayName(nextPerson) : next.name;
    heroCard = (
      <HeroFrame
        ariaLabel={t("home.upcoming")}
        label={t("home.upcoming")}
        stamp={stamp}
        art={
          nextFaces.length > 1 ? (
            <HeroPolaroid caption={`${firstName} ${t("home.others", { n: nextFaces.length - 1 })}`}>
              <FaceStack faces={nextFaces.map((e) => ({ key: e.contactId, avatar: personOf(e.contactId)?.avatar ?? null, label: e.name }))} size={36} />
            </HeroPolaroid>
          ) : (
            <Link href={`/people/${next.contactId}`} aria-label={firstName} className="shrink-0">
              <HeroPolaroid caption={firstName}>
                <Avatar config={nextPerson?.avatar ?? null} size={64} label={firstName} decorative />
              </HeroPolaroid>
            </Link>
          )
        }
        // 같은 날 둘까지는 한 줄씩, 셋 이상이면 첫 사람 + '외 n명'
        title={
          <>
            {title.map((x) => (
              <span key={x.key}>{heroTitle(x.text, heroTitleSize(x.text.length, many))}</span>
            ))}
            {nextGroup.length > 2 ? <span className="text-[11.7px] text-ink-2">{t("home.others", { n: nextGroup.length - 1 })}</span> : null}
          </>
        }
        // 양력 날짜를 먼저, 음력은 옆에
        sub={
          <>
            {formatDayFull(next.date, locale)}
            {lunar ? ` · ${lunar}` : ""}
          </>
        }
        inner={note ? <RememberedBox label={t("home.remembered")} text={note} /> : null}
      >
        {nextFaces.length > 1 ? (
          nextFaces.map((e, i) => <HeroButton key={e.contactId} href={hintHref(e)} label={t("home.hintsFor", { name: e.name })} first={i === 0} small />)
        ) : (
          <HeroButton href={hintHref(next)} label={t("home.hints")} />
        )}
      </HeroFrame>
    );
  } else if (xmas) {
    // 사람이 없으면: 챙기고 싶은 사람을 더하고(사람 추가) → 곧바로 그 사람에게 물어보기(받고 싶은 것) → 답이 오면 이 카드가 알려 주며 선물 고르기로. 사람이 있으면 곧장 선물 고르기
    heroCard = (
      <HeroFrame
        ariaLabel={t("home.upcoming")}
        label={t("home.upcoming")}
        stamp={stamp}
        art={
          <ArtBox>
            <HolidayArt id="christmas" size={62} />
          </ArtBox>
        }
        title={
          <h2 className="hand leading-[1.1]" style={{ fontSize: 21 }}>
            <span className="hl">{t("home.yearEnd")}</span>
          </h2>
        }
        // 답이 온 사람이 있으면 그 소식이 곧 문구(누가 답했는지), 아니면 감성 문구
        sub={
          <span className="block whitespace-pre-line leading-[1.4]">
            {answeredFirst
              ? answeredIds.length > 1
                ? t("home.yearEndAnswered", { name: displayName(answeredFirst), n: answeredIds.length - 1 })
                : t("notif.answered", { name: displayName(answeredFirst) })
              : t("home.yearEndLine")}
          </span>
        }
      >
        {people.length ? <HeroButton href={xmasGiftHref} label={t("home.yearEndGift")} /> : <HeroButton href="/people/new?xmas=1" label={t("home.yearEndAdd")} />}
      </HeroFrame>
    );
  } else if (holiday) {
    // 사람이 있으면 그 중 골라 선물 힌트로(사람들 고르기), 없으면 먼저 사람부터
    const lunar = lunarFull(holiday.date, locale);
    heroCard = (
      <HeroFrame
        ariaLabel={t("home.upcoming")}
        label={t("home.upcoming")}
        stamp={stamp}
        art={
          <ArtBox>
            <HolidayArt id={holiday.id} size={62} />
          </ArtBox>
        }
        title={heroTitle(holidayTitle, heroTitleSize(holidayTitle.length, false))}
        sub={
          <>
            {formatDayFull(holiday.date, locale)}
            {lunar ? ` · ${lunar}` : ""}
          </>
        }
      >
        {people.length ? <HeroButton href="/people?pick=1&me=0&to=gift" label={t("plan.gift")} /> : <HeroButton href="/people/new" label={t("home.addPerson")} />}
      </HeroFrame>
    );
  } else {
    heroCard = (
      <HeroFrame
        ariaLabel={t("home.upcoming")}
        label={null}
        stamp={null}
        art={
          <ArtBox dashed>
            <Icon name="personAdd" size={30} strokeWidth={1.6} className="text-muted" />
          </ArtBox>
        }
        title={
          <h2 className="hand leading-[1.1]" style={{ fontSize: 21 }}>
            <span className="hl">{t("home.newFriend")}</span>
          </h2>
        }
        // 사람은 있는데 날짜를 아는 사람이 없으면 생일·기념일을 물어볼 수도 있다
        inner={
          people.length && !events.length ? (
            <Link href="/request" className="mt-[14.4px] flex min-h-11 items-center justify-between border-t border-dashed text-[13.5px]" style={dashedRule}>
              {t("home.askDates")}
              <Chev size={16} />
            </Link>
          ) : null
        }
      >
        <HeroButton href="/people/new" label={t("home.addPerson")} />
      </HeroFrame>
    );
  }

  return (
    <>
      {/* 기록을 저장하고 돌아온 직후면(앱에서만, 며칠 써 본 사람에게만) 스토어 리뷰 부탁 */}
      <ReviewMoment source="saved" when="saved" delay={2500} />
      {/* 여러 사람 이야기를 적고 돌아왔으면 누구에게 무엇을 적었는지 토스트 */}
      <SavedToast locale={locale} />
      <header className="relative flex h-11 shrink-0 items-center justify-between pl-5 pr-2.5">
        <Wordmark size={24} locale={locale} />
        <div className="flex items-center gap-0.5">
          <NotificationBell items={bellItems} labels={{ title: t("notif.title"), empty: t("notif.empty") }} />
          <ProfileMenu avatar={avatar} admin={isAdmin} labels={{ menu: t("home.profileMenu"), profile: t("profile.title"), admin: t("home.adminMenu"), signOut: t("privacy.signOut") }} />
        </div>
      </header>
      <div className="h-[3.6px] shrink-0" />

      {/* 날짜 머리: 년 · 음력, 큰 오늘 날짜(이 화면의 제목), 요일 글자 */}
      <DateHead label={t("start.today")} small={dateSmall} big={formatMonthDay(today, locale)} todayWd={weekday(today)} names={names.map((n) => (locale === "ko" ? n : n.slice(0, 1)))} />

      <div className="h-[30.6px] shrink-0" />
      {heroCard}
      <div className="h-[27px] shrink-0" />

      {/* 이번 주: 오늘부터 8칸. 누르면 월별 달력(카드 전체가 눌린다) */}
      <WeekCard title={t("home.thisWeek")} countText={weekCountText} calendarHref="/calendar" calendarLabel={t("home.openCalendar")} names={names} days={weekDays} />

      {/* 이번 주 카드 아래 틈: 방금 답했거나 그만 묻기로 했으면 그 말을 이 틈에 적는다 */}
      <div className={`flex shrink-0 items-center ${answered || muted ? "min-h-[37.8px]" : "min-h-[23.4px]"}`}>
        {answered || muted ? (
          <p role="status" className="mx-5 flex items-center gap-2 text-[12.6px] text-muted">
            <Icon name="check" size={16} className="text-accent" />
            {t(muted ? "home.muted" : "home.answered")}
          </p>
        ) : people.some((p) => p.asking?.state === "active") ? (
          // 답장을 기다리는 중인데 아직 알림을 안 켰으면(앱에서만) 알림 켜기 단추
          <ReplyAlertsPrompt label={t("home.replyAlerts")} className="mx-5" />
        ) : null}
      </div>

      {showQuestion && question && asked && askedPerson ? (
        <>
          <HomeQuestion
            contactId={asked.contactId}
            qid={question.id}
            prompt={aboutPrompt(question.id, askedName, locale)}
            name={askedName}
            avatar={askedPerson.avatar}
            options={question.options.filter((o) => o.value !== NONE).map((o) => ({ value: o.value, label: o.label[locale], chili: question.id === "spicy" ? Number(o.value) : undefined }))}
            noneValue={question.options.some((o) => o.value === NONE) ? NONE : null}
            noneLabel={NONE_LABEL[locale]}
            canOwn={canAnswerOwn(question.id)}
            labels={{ title: t("home.question"), ask: t("home.questionAsk"), skip: t("common.skip"), more: t("home.more"), mute: t("home.questionMute"), own: t("home.questionOwn"), save: t("common.save"), dontKnow: t("home.questionDontKnow", { name: askedName }) }}
          />
        </>
      ) : null}

      {showDone ? (
        <>
          <section aria-label={t("home.questionDone", { n: questionsUsed })} className="card relative mx-4 mt-[9px] flex shrink-0 flex-col px-3.5 pb-1.5 pt-2.5">
            <span className="pointer-events-none absolute right-3.5 -top-[30.6px]">
              <Mascot pose={11} size={44.7} />
            </span>
            <div className="flex h-[30.6px] items-center gap-2">
              <h2 className="hand scribble whitespace-nowrap text-[19.4px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
                {t("home.question")}
              </h2>
              <span className="text-[10.8px] text-muted">{t("home.questionDone", { n: questionsUsed })}</span>
            </div>
            <ul className="mt-2">
              {questionLog.map((e, i) => {
                const who = personOf(e.c);
                const topic = QUESTION_TOPIC[e.q as keyof typeof QUESTION_TOPIC];
                if (!who || !topic) return null;
                const box = e.o === "a" ? "#CDEBDD" : e.o === "w" ? "#FFF4D6" : "#FFFFFF";
                return (
                  <li key={`${e.c}-${e.q}-${i}`} className="flex h-[34.2px] items-center gap-2 border-t border-dashed" style={dashedRule}>
                    <span aria-hidden="true" className={`flex h-[19.8px] w-[19.8px] shrink-0 items-center justify-center rounded-[5.4px] border border-edge ${e.o === "k" || e.o === "m" ? "border-dashed" : ""}`} style={{ background: box }}>
                      {e.o === "a" ? (
                        <svg viewBox="0 0 24 24" width="13.5" height="13.5" fill="none" stroke="#1F2340" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      ) : e.o === "w" ? (
                        <svg viewBox="0 0 24 24" width="13.5" height="13.5" fill="none" stroke="#1F2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="6" width="18" height="13" rx="2" fill="#F9CBD5" />
                          <path d="M3.8 7l8.2 6.2L20.2 7" />
                        </svg>
                      ) : null}
                    </span>
                    <span aria-hidden="true">
                      <Avatar config={who.avatar} size={22} label={displayName(who)} decorative />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.7px] text-muted">
                      {displayName(who)} · {topic[locale]}
                    </span>
                    {e.o === "a" && e.v ? (
                      <span className="hand-written max-w-[45%] truncate text-[19.4px] leading-none">{e.v}</span>
                    ) : (
                      <span className="shrink-0 text-[10.8px] text-muted">{t(e.o === "w" ? "home.questionWaiting" : e.o === "k" ? "home.questionSkipped" : "home.questionMuted")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}

      {/* 질문이 없는 날: 큰 카드 다음에 이어서 챙길 날 줄 목록 */}
      {showList ? (
        <>
          <section aria-labelledby="home-next" className="card relative mx-4 flex shrink-0 flex-col px-[12.6px] pb-[1.8px] pt-[7.2px]">
            <span className="pointer-events-none absolute right-[14.4px] -top-[28.8px]">
              <Mascot pose={12} size={40.7} />
            </span>
            <div className="flex h-[34.2px] items-center">
              <h2 id="home-next" className="hand scribble whitespace-nowrap text-[21.6px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
                {t("home.followUpDates")}
              </h2>
            </div>
            <ul className="mt-[5.4px]">
              {followUps.slice(0, 3).map((e) => {
                const who = personOf(e.contactId);
                const name = eventName(e, t, locale);
                return (
                  <li key={`${e.contactId}-${e.kind}-${e.label ?? ""}`} className="border-t border-dashed" style={dashedRule}>
                    <Link href={`/people/${e.contactId}`} className="flex h-[43.2px] items-center gap-[9px]">
                      <span className="flex w-[37.8px] flex-col items-center leading-none">
                        <span className="hand text-[18.9px]">{formatDotted(e.date)}</span>
                        <span className="mt-[2.7px] text-[9.9px] text-muted">{names[weekday(e.date)]}</span>
                      </span>
                      <Avatar config={who?.avatar ?? null} size={30} label={name} decorative />
                      <span className="hand-written min-w-0 flex-1 truncate text-[19.8px] leading-none">{name}</span>
                      <span className="hand text-[17.1px] leading-none" style={{ color: "#A8481A" }}>
                        D-{e.daysUntil}
                      </span>
                      <Chev size={14} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}

      {/* 사람이 하나도 없으면 첫 사람을 더하게 */}
      {showEmptyPeople ? (
        <>
          <section aria-label={t("home.people")} className="card relative mx-4 flex shrink-0 flex-col gap-3 px-4 pb-4 pt-3">
            <h2 className="hand scribble self-start text-[19.4px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
              {t("home.people")}
            </h2>
            <p className="text-[13.5px] leading-[1.5] text-muted">{t("home.empty")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/people/new" className="btn-outline">
                {t("people.add")}
              </Link>
              <Link href="/request" className="btn-primary">
                {t("home.ask")}
              </Link>
            </div>
          </section>
        </>
      ) : null}

      {/* 이어서: 다음 챙길 날 #해시태그(가로로 밀고, 오른쪽 끝은 흐려진다) */}
      {showTags ? (
        <>
          <div className="h-[12.6px] shrink-0" />
          <section aria-label={t("home.followUpDates")} className="flex h-[41.4px] shrink-0 items-center gap-1.5 overflow-x-auto pl-5 [-webkit-mask-image:linear-gradient(90deg,#000_86%,transparent)] [mask-image:linear-gradient(90deg,#000_86%,transparent)] [scrollbar-width:none]">
            <span className="hand shrink-0 text-[19.8px]">{t("home.followUp")}</span>
            <svg viewBox="0 0 28 20" width="25.2" height="18" fill="none" stroke="#1F2340" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <path d="M2 5 C8 16 15 17 22 11" strokeDasharray="3 3" />
              <path d="M18 9.6 L22.6 10.4 L21.4 15" />
            </svg>
            {followUps.slice(0, 8).map((e) => (
              <Link key={`${e.contactId}-${e.kind}-${e.label ?? ""}`} href={`/people/${e.contactId}`} className="hand flex h-[37.8px] shrink-0 items-center whitespace-nowrap rounded-[9px] border border-edge bg-white px-3 text-[18.6px]">
                #{eventName(e, t, locale)}
                <span className="ml-1.5" style={{ color: "#A8481A" }}>
                  D-{e.daysUntil}
                </span>
              </Link>
            ))}
            <span aria-hidden="true" className="w-8 shrink-0" />
          </section>
        </>
      ) : null}

      <div className="page-end min-h-0 flex-1" />
    </>
  );
}

