import { aboutPrompt, addDays, canAnswerOwn, formatDayFull, formatDotted, holidayKey, monthName, nextHoliday, NONE, NONE_LABEL, questionsLeft, sameYmd, upcomingEvents, weekday, weekdayNames, yearEnd, type UpcomingEvent } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/chrome";
import { FaceStack } from "@/components/FaceStack";
import { HolidayArt } from "@/components/HolidayArt";
import { HomeQuestion } from "@/components/HomeQuestion";
import { Mascot } from "@/components/Mascot";
import { NotificationBell, type BellItem } from "@/components/NotificationBell";
import { ProfileMenu } from "@/components/ProfileMenu";
import { Chev, DdayStamp, GiftBox, HeartBullet, TicketStub, TornTape } from "@/components/planner";
import { ReviewMoment } from "@/components/ReviewAsk";
import { Icon } from "@/components/marks";
import { eventName, eventsFor, peopleDates } from "@/lib/events";
import type { Person } from "@/lib/data";
import type { HomeData } from "@/lib/pages/home.data";
import { displayName } from "@/lib/person";
import { QUESTION_TOPIC } from "@/lib/question-topic";
import { makeT } from "@/lib/t";

// 플래너 시안(P2-Home·NoQ·Done): 머리(로고·종·내 얼굴) → '11월 넷째 주' 한 주 띠 → 가장 가까운 날 큰 카드(분홍 테이프 · D-n 고무 도장 · 기억해 둔 것 줄노트 · 티켓 띠 '선물 힌트 보기')
// → 오늘의 질문 3줄 카드(질문 있음) / '이어서 챙길 날' 목록(질문 없음) / 체크 목록(오늘 질문 다 함) → '이어서' #해시태그 줄. 아래에 꽉 찬 단추 줄은 두지 않는다.
// 큰 카드: 사람 기념일이 두 달 안에 있으면 그 사람 카드. 하나도 없을 때만 30일 안의 명절·챙기는 날, 그것도 없으면 '새 친구 추가해 봐요'.
// 연말(크리스마스 45일 전~당일)엔 더 가까운 사람 기념일이 없으면(사람이 하나도 없을 때 포함) 크리스마스 카드(트리 + 감성 문구 + 상태를 따라가는 단추)가 큰 카드 자리를 채운다.
// 캐릭터는 한 화면에 하나: 질문 카드가 있으면 큰 카드 위에 빼꼼(2), 질문이 없으면 목록 카드 위에 누움(12), 다 했으면 체크 카드 위에 별(11).

const STUB_NOTE = "rgb(31 35 64 / 0.16)";

/** 사람 기록에서 '기억해 둔 것': 꽃·마실 것·간식·좋아하는 음식·향·갖고 싶은 것(앞의 둘을 줄노트에 적고, 전체 개수를 띠에 적는다) */
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

/** 첫째·둘째… / 1st·2nd… */
function nth(n: number, locale: "ko" | "en"): string {
  if (locale === "ko") return ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"][n - 1] ?? `${n}째`;
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

/** 음력 이름이 있는 날이면 시안처럼 짧게: 음력 10.21 */
function lunarShort(e: UpcomingEvent, locale: "ko" | "en"): string {
  if (e.spec.calendar !== "lunar") return "";
  const m = `${e.spec.leap ? (locale === "ko" ? "윤" : "leap ") : ""}${e.spec.month}.${e.spec.day}`;
  return locale === "ko" ? `음력 ${m}` : `Lunar ${m}`;
}

/** 큰 카드 제목 크기: 시안은 '엄마 칠순' 36px. 길면 줄인다 */
function heroTitleSize(len: number, many: boolean): number {
  if (many) return 24;
  return len <= 5 ? 36 : len <= 7 ? 30 : len <= 10 ? 25 : 21;
}

/** 칸막이 점선(카드 안 줄): 시안은 남색 16% */
const dashedRule = { borderColor: STUB_NOTE };

/** 큰 카드 안의 동그란 그림(명절 그림·새 친구 자리) */
function RoundArt({ children, dashed = false, tint = "#E3F4EC" }: { children: React.ReactNode; dashed?: boolean; tint?: string }) {
  return (
    <span aria-hidden="true" className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${dashed ? "border-dashed" : ""} border-ink`} style={{ background: tint }}>
      {children}
    </span>
  );
}

/** 큰 카드 맨 아래 티켓 띠가 가는 곳 하나 */
interface StubLink {
  href: string;
  label: string;
  /** 오른쪽 작은 글(기억해 둔 것 2개) */
  note?: string;
  icon: "gift" | "personAdd";
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
  const stampDate = next ? next.date : (xmas ?? holiday)?.date;
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
  const peek = !showDone && !showList;
  // 큰 카드와 그 아래 카드 사이 틈(시안의 늘어나는 빈칸)
  const slotGap = showDone || showList ? "min-h-[42px] flex-[1.2_1_0]" : showQuestion || showEmptyPeople ? (answered || muted ? "min-h-7 flex-1" : "min-h-[18px] flex-1") : "min-h-2 flex-1";

  // 이번 주(월~일): 오늘은 망고 동그라미, 챙길 날은 분홍 점선 동그라미 + 얼굴
  const names = weekdayNames(locale);
  const sinceMon = (weekday(today) + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - sinceMon));
  const weekEvents = upcomingEvents(peopleDates(people), week[0]!, 6);
  // 몇째 주: 그 주 목요일이 속한 달의 몇째 주(한국에서 흔한 센 방법)
  const thu = week[3]!;
  const weekTitle = t("home.weekOf", { month: monthName(thu.m, locale, true), nth: nth(Math.ceil(thu.d / 7), locale) });

  const stub = (s: StubLink) => (
    <TicketStub>
      <Link href={s.href} className="flex h-[50px] items-center gap-2 rounded-b-[16.5px] px-[18px]">
        {s.icon === "gift" ? <GiftBox /> : <Icon name="personAdd" size={22} strokeWidth={1.7} className="shrink-0" />}
        <span className="hand flex-1 text-[25px] leading-none">{s.label}</span>
        {s.note ? <span className="text-[12px] opacity-70">{s.note}</span> : null}
        <Chev size={15} color="#1F2340" strokeWidth={2.2} />
      </Link>
    </TicketStub>
  );

  /** 큰 카드 틀: 분홍 테이프 · (빼꼼 캐릭터) · 얼굴 + 제목·날짜 + D-n 도장 · 안쪽 줄 · 티켓 띠 */
  const hero = (opts: { face: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; inner?: React.ReactNode; bottom: React.ReactNode }) => (
    <section aria-label={t("home.upcoming")} className="card relative mx-4 flex shrink-0 flex-col px-4 pt-4">
      <TornTape color="pink" w={78} h={24} rotate={-6} className="-top-3 left-5" />
      {peek ? (
        <span className="pointer-events-none absolute right-[22px] -top-[40.5px]">
          <Mascot pose={2} size={48.3} />
        </span>
      ) : null}
      <div className="flex items-center gap-2.5">
        {opts.face}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {opts.title}
          {opts.sub ? <span className="text-[12.5px] text-muted">{opts.sub}</span> : null}
        </div>
        {stampDays !== null ? (
          <span className="-mr-0.5 -mt-1">
            {/* 눈으로는 도장(D-6)이 알리니 읽어 줄 때만 '6 일 뒤' */}
            {stampDays > 0 ? (
              <span className="sr-only">
                {stampDays} {stampDays === 1 ? t("home.dayToGo") : t("home.daysToGo")}
              </span>
            ) : null}
            <DdayStamp big={stampDays === 0 ? t("start.today") : `D-${stampDays}`} bigSize={stampDays === 0 ? (locale === "ko" ? 26 : 20) : String(stampDays).length > 2 ? 20 : String(stampDays).length > 1 ? 25 : 30} small={stampDate ? formatDotted(stampDate) : undefined} />
          </span>
        ) : null}
      </div>
      {opts.inner}
      {opts.bottom}
    </section>
  );

  let heroCard: React.ReactNode;
  if (next) {
    const lines = remembered.slice(0, 2);
    const title = (nextGroup.length > 2 ? nextGroup.slice(0, 1) : nextGroup).map((e) => ({ key: `${e.contactId}-${e.kind}-${e.label ?? ""}`, text: eventName(e, t, locale) }));
    const many = nextGroup.length > 1;
    heroCard = hero({
      face:
        nextFaces.length > 1 ? (
          <FaceStack faces={nextFaces.map((e) => ({ key: e.contactId, avatar: personOf(e.contactId)?.avatar ?? null, label: e.name }))} size={40} />
        ) : (
          <Link href={`/people/${next.contactId}`} aria-label={nextPerson ? displayName(nextPerson) : next.name} className="shrink-0">
            <Avatar config={nextPerson?.avatar ?? null} size={46} label={nextPerson ? displayName(nextPerson) : next.name} decorative />
          </Link>
        ),
      // 같은 날 둘까지는 한 줄씩, 셋 이상이면 첫 사람 + '외 n명'
      title: (
        <>
          {title.map((x) => (
            <h2 key={x.key} className="hand leading-none" style={{ fontSize: heroTitleSize(x.text.length, many) }}>
              {x.text}
            </h2>
          ))}
          {nextGroup.length > 2 ? <span className="text-[13px] text-ink-2">{t("home.others", { n: nextGroup.length - 1 })}</span> : null}
        </>
      ),
      // 양력 날짜를 먼저, 음력이면 옆에
      sub: (
        <span className="whitespace-nowrap">
          {formatDayFull(next.date, locale)}
          {nextGroup.length === 1 && lunarShort(next, locale) ? ` · ${lunarShort(next, locale)}` : ""}
        </span>
      ),
      inner: lines.length ? (
        <ul className="mt-2.5 px-0.5">
          {lines.map((l) => (
            <li key={`${l.label}-${l.value}`} className="hand-written flex h-[30px] items-center gap-2 overflow-hidden whitespace-nowrap border-b-[1.5px] border-dashed text-[23px] leading-none" style={dashedRule}>
              <HeartBullet />
              <span className="font-sans -tracking-[0.035em] text-[11px] leading-none text-muted">{l.label}</span>
              <span className="min-w-0 truncate">{l.value}</span>
            </li>
          ))}
        </ul>
      ) : null,
      bottom:
        nextFaces.length > 1 ? (
          <TicketStub>
            {nextFaces.map((e, i) => (
              <Link key={e.contactId} href={hintHref(e)} className={`flex h-[46px] items-center gap-2.5 px-[18px] ${i ? "border-t-[1.5px] border-dashed" : "rounded-t-none"} ${i === nextFaces.length - 1 ? "rounded-b-[16.5px]" : ""}`} style={i ? { borderTopColor: "rgba(31,35,64,.28)" } : undefined}>
                <span aria-hidden="true">
                  <Avatar config={personOf(e.contactId)?.avatar ?? null} size={26} label={e.name} />
                </span>
                <span className="hand min-w-0 flex-1 truncate text-[22px] leading-none">{t("home.hintsFor", { name: e.name })}</span>
                <Chev size={15} color="#1F2340" strokeWidth={2.2} />
              </Link>
            ))}
          </TicketStub>
        ) : (
          stub({ href: hintHref(next), label: t("home.hints"), note: remembered.length ? t("home.hintsCount", { n: remembered.length }) : undefined, icon: "gift" })
        ),
    });
  } else if (xmas) {
    // 사람이 없으면: 챙기고 싶은 사람을 더하고(사람 추가) → 곧바로 그 사람에게 물어보기(받고 싶은 것) → 답이 오면 이 카드가 알려 주며 선물 고르기로. 사람이 있으면 곧장 선물 고르기
    heroCard = hero({
      face: (
        <RoundArt>
          <HolidayArt id="christmas" size={34} />
        </RoundArt>
      ),
      title: (
        <h2 className="hand leading-none" style={{ fontSize: 25 }}>
          {t("home.yearEnd")}
        </h2>
      ),
      // 답이 온 사람이 있으면 그 소식이 곧 문구(누가 답했는지), 아니면 감성 문구
      sub: (
        <span className="block whitespace-pre-line text-[12.5px] leading-[1.4]">
          {answeredFirst
            ? answeredIds.length > 1
              ? t("home.yearEndAnswered", { name: displayName(answeredFirst), n: answeredIds.length - 1 })
              : t("notif.answered", { name: displayName(answeredFirst) })
            : t("home.yearEndLine")}
        </span>
      ),
      bottom: people.length
        ? stub({ href: xmasGiftHref, label: t("home.yearEndGift"), icon: "gift" })
        : stub({ href: "/people/new?xmas=1", label: t("home.yearEndAdd"), icon: "personAdd" }),
    });
  } else if (holiday) {
    // 사람이 있으면 그 중 골라 선물 힌트로(사람들 고르기), 없으면 먼저 사람부터
    heroCard = hero({
      face: (
        <RoundArt>
          <HolidayArt id={holiday.id} size={34} />
        </RoundArt>
      ),
      title: (
        <h2 className="hand leading-none" style={{ fontSize: heroTitleSize(holidayTitle.length, false) }}>
          {holidayTitle}
        </h2>
      ),
      sub: (
        <span className="whitespace-nowrap">
          {formatDayFull(holiday.date, locale)}
          {holiday.spec.calendar === "lunar" ? ` · ${locale === "ko" ? "음력" : "Lunar"} ${holiday.spec.month}.${holiday.spec.day}` : ""}
        </span>
      ),
      bottom: people.length ? stub({ href: "/people?pick=1&me=0&to=gift", label: t("plan.gift"), icon: "gift" }) : stub({ href: "/people/new", label: t("home.addPerson"), icon: "personAdd" }),
    });
  } else {
    heroCard = hero({
      face: (
        <RoundArt dashed tint="#FFFDF8">
          <Icon name="personAdd" size={22} strokeWidth={1.7} className="text-muted" />
        </RoundArt>
      ),
      title: (
        <h2 className="hand leading-none" style={{ fontSize: 25 }}>
          {t("home.newFriend")}
        </h2>
      ),
      // 사람은 있는데 날짜를 아는 사람이 없으면 생일·기념일을 물어볼 수도 있다
      inner:
        people.length && !events.length ? (
          <Link href="/request" className="mt-2 flex min-h-11 items-center justify-between border-t-[1.5px] border-dashed text-[15px]" style={dashedRule}>
            {t("home.askDates")}
            <Chev size={16} />
          </Link>
        ) : null,
      bottom: stub({ href: "/people/new", label: t("home.addPerson"), icon: "personAdd" }),
    });
  }

  return (
    <>
      {/* 기록을 저장하고 돌아온 직후면(앱에서만, 며칠 써 본 사람에게만) 스토어 리뷰 부탁 */}
      <ReviewMoment source="saved" when="saved" delay={2500} />
      <header className="relative flex h-11 shrink-0 items-center justify-between pl-5 pr-2.5">
        <Wordmark size={24} locale={locale} />
        <div className="flex items-center gap-0.5">
          <NotificationBell items={bellItems} labels={{ title: t("notif.title"), empty: t("notif.empty") }} />
          <ProfileMenu avatar={avatar} admin={isAdmin} labels={{ menu: t("home.profileMenu"), profile: t("profile.title"), admin: t("home.adminMenu"), signOut: t("privacy.signOut") }} />
        </div>
      </header>
      <div className="min-h-1 flex-[0.4_1_0]" />

      {/* 이번 주 띠: 누르면 월별 달력(카드 전체가 눌린다) */}
      <section aria-label={t("home.thisWeek")} className="shrink-0">
        <div className="mb-2 ml-5 mr-4 flex h-[30px] items-center justify-between">
          <h1 className="hand scribble text-[26px] leading-none">{weekTitle}</h1>
          <Link href="/calendar" aria-label={t("home.openCalendar")} className="relative z-20 flex h-10 items-center gap-1 px-1 text-[13px] text-muted">
            <Icon name="calendar" size={16} strokeWidth={1.8} className="shrink-0" />
            {t("home.calendar")}
            <Chev size={12} />
          </Link>
        </div>
        <div className="relative mx-4 transition-transform active:scale-[0.995]">
          <Link href="/calendar" tabIndex={-1} aria-hidden="true" className="absolute inset-0 z-10 rounded-[18px]" />
          <ol className="card grid grid-cols-7 px-1 py-2">
            {week.map((day, i) => {
              const wd = weekday(day);
              const dayEvents = weekEvents.filter((e) => sameYmd(e.date, day));
              const isToday = sameYmd(day, today);
              const has = dayEvents.length > 0;
              return (
                <li key={i} aria-current={isToday ? "date" : undefined} className={`flex flex-col items-center gap-[3px] py-0.5 ${i ? "border-l-[1.5px] border-dashed" : ""}`} style={i ? { borderColor: "rgba(31,35,64,.10)" } : undefined}>
                  <span className={`text-[11px] ${isToday ? "font-bold text-ink" : wd === 0 ? "text-red" : "text-muted"}`}>{isToday ? t("start.today") : names[wd]}</span>
                  <span
                    className={`hand flex h-[34px] w-[34px] items-center justify-center rounded-full text-[24px] leading-none ${isToday ? "box-border border-[1.5px] border-ink bg-sky shadow-[2px_2px_0_var(--color-ink)]" : has ? "box-border border-[1.5px] border-dashed bg-[#FDE6EB]" : ""} ${!isToday && wd === 0 ? "text-red" : ""}`}
                    style={has && !isToday ? { borderColor: "#A8481A" } : undefined}
                  >
                    {day.d}
                  </span>
                  <span className="flex h-5 items-center">
                    <FaceStack faces={dayEvents.map((e) => ({ key: `${e.contactId}-${e.kind}-${e.label ?? ""}`, avatar: personOf(e.contactId)?.avatar ?? null, label: eventName(e, t, locale) }))} size={20} />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className={peek ? "min-h-12 flex-[1.2_1_0]" : "min-h-6 flex-1"} />
      {heroCard}

      {/* 큰 카드 아래 틈: 방금 답했거나 그만 묻기로 했으면 그 말을 이 틈에 적는다(레이아웃을 더 밀지 않게) */}
      <div className={`flex items-center ${slotGap}`}>
        {answered || muted ? (
          <p role="status" className="mx-5 flex items-center gap-2 text-[14px] text-muted">
            <Icon name="check" size={16} className="text-accent" />
            {t(muted ? "home.muted" : "home.answered")}
          </p>
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
            labels={{ title: t("home.question"), ask: t("home.questionAsk"), skip: t("common.skip"), more: t("home.more"), mute: t("home.questionMute"), own: t("home.questionOwn"), save: t("common.save") }}
          />
        </>
      ) : null}

      {showDone ? (
        <>
          <section aria-label={t("home.questionDone", { n: questionsUsed })} className="card relative mx-4 flex shrink-0 flex-col px-3.5 pb-1.5 pt-2.5">
            <span className="pointer-events-none absolute right-3.5 -top-[34px]">
              <Mascot pose={11} size={44.7} />
            </span>
            <div className="flex h-[34px] items-center gap-2">
              <h2 className="hand scribble whitespace-nowrap text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
                {t("home.question")}
              </h2>
              <span className="text-[12px] text-muted">{t("home.questionDone", { n: questionsUsed })}</span>
            </div>
            <ul className="mt-2">
              {questionLog.map((e, i) => {
                const who = personOf(e.c);
                const topic = QUESTION_TOPIC[e.q as keyof typeof QUESTION_TOPIC];
                if (!who || !topic) return null;
                const box = e.o === "a" ? "#CDEBDD" : e.o === "w" ? "#FFF4D6" : "#FFFFFF";
                return (
                  <li key={`${e.c}-${e.q}-${i}`} className="flex h-[38px] items-center gap-2 border-t-[1.5px] border-dashed" style={dashedRule}>
                    <span aria-hidden="true" className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-ink ${e.o === "k" || e.o === "m" ? "border-dashed" : ""}`} style={{ background: box }}>
                      {e.o === "a" ? (
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1F2340" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      ) : e.o === "w" ? (
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1F2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="6" width="18" height="13" rx="2" fill="#F9CBD5" />
                          <path d="M3.8 7l8.2 6.2L20.2 7" />
                        </svg>
                      ) : null}
                    </span>
                    <span aria-hidden="true">
                      <Avatar config={who.avatar} size={22} label={displayName(who)} decorative />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                      {displayName(who)} · {topic[locale]}
                    </span>
                    {e.o === "a" && e.v ? (
                      <span className="hand-written max-w-[45%] truncate text-[24px] leading-none">{e.v}</span>
                    ) : (
                      <span className="shrink-0 text-[12px] text-muted">{t(e.o === "w" ? "home.questionWaiting" : e.o === "k" ? "home.questionSkipped" : "home.questionMuted")}</span>
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
          <section aria-labelledby="home-next" className="card relative mx-4 flex shrink-0 flex-col px-3.5 pb-0.5 pt-2">
            <span className="pointer-events-none absolute right-4 -top-8">
              <Mascot pose={12} size={40.7} />
            </span>
            <div className="flex h-9 items-center">
              <h2 id="home-next" className="hand scribble whitespace-nowrap text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
                {t("home.followUpDates")}
              </h2>
            </div>
            <ul className="mt-1.5">
              {followUps.slice(0, 3).map((e) => {
                const who = personOf(e.contactId);
                const name = eventName(e, t, locale);
                return (
                  <li key={`${e.contactId}-${e.kind}-${e.label ?? ""}`} className="border-t-[1.5px] border-dashed" style={dashedRule}>
                    <Link href={`/people/${e.contactId}`} className="flex h-[46px] items-center gap-2.5">
                      <span className="flex w-10 flex-col items-center leading-none">
                        <span className="hand text-[23px]">{formatDotted(e.date)}</span>
                        <span className="mt-0.5 text-[10px] text-muted">{names[weekday(e.date)]}</span>
                      </span>
                      <Avatar config={who?.avatar ?? null} size={30} label={name} decorative />
                      <span className="hand-written min-w-0 flex-1 truncate text-[24px] leading-none">{name}</span>
                      <span className="hand text-[20px] leading-none" style={{ color: "#A8481A" }}>
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
            <h2 className="hand scribble self-start text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
              {t("home.people")}
            </h2>
            <p className="text-[15px] leading-[1.5] text-muted">{t("home.empty")}</p>
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
          <div className="min-h-3 flex-[0.6_1_0]" />
          <section aria-label={t("home.followUpDates")} className="flex h-[46px] shrink-0 items-center gap-1.5 overflow-x-auto pl-5 [-webkit-mask-image:linear-gradient(90deg,#000_86%,transparent)] [mask-image:linear-gradient(90deg,#000_86%,transparent)] [scrollbar-width:none]">
            <span className="hand shrink-0 text-[24px]">{t("home.followUp")}</span>
            <svg viewBox="0 0 28 20" width="28" height="20" fill="none" stroke="#1F2340" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <path d="M2 5 C8 16 15 17 22 11" strokeDasharray="3 3" />
              <path d="M18 9.6 L22.6 10.4 L21.4 15" />
            </svg>
            {followUps.slice(0, 8).map((e) => (
              <Link key={`${e.contactId}-${e.kind}-${e.label ?? ""}`} href={`/people/${e.contactId}`} className="hand flex h-[42px] shrink-0 items-center whitespace-nowrap rounded-[10px] border-[1.5px] border-ink bg-white px-3 text-[23px]">
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

      <div className="min-h-2 flex-1" />
    </>
  );
}

