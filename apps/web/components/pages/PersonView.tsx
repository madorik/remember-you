import { formatMonthDay, formatSpec, milestoneOf, monthName, nextOccurrence, parseYmd, SECTIONS_BY_IMPORTANCE, weekdayLong, yearsAt, type DateSpec, type Locale, type YMD } from "@readme/core";
import Link from "@/components/AppLink";
import { AskOnButton } from "@/app/(app)/people/[id]/AskOnButton";
import { FavoriteStar } from "@/app/(app)/people/[id]/FavoriteStar";
import { NotesButton } from "@/app/(app)/people/[id]/NotesButton";
import { PersonFolders } from "@/app/(app)/people/[id]/PersonFolders";
import { PersonMenu } from "@/app/(app)/people/[id]/PersonMenu";
import { ViewBeacon } from "@/app/(app)/people/[id]/ViewBeacon";
import { QuickNote } from "@/app/(app)/people/[id]/QuickNote";
import { TagEditor } from "@/app/(app)/people/[id]/TagEditor";
import { cancelInvite } from "@/app/actions/request";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { sectionSummary } from "@/components/SectionSummary";
import { SectionIcon } from "@/components/SectionIcon";
import { ReviewMoment } from "@/components/ReviewAsk";
import { SeeAnswers } from "@/components/SeeAnswers";
import { TornTape } from "@/components/TornTape";
import type { T } from "@/lib/i18n";
import type { PersonData } from "@/lib/pages/person.data";
import { makeT } from "@/lib/t";

/** 한 번에 보여 줄 '기억해 둔 것' 줄 수(나머지는 'N개 더 보기'로 고치는 화면에서) */
const SHOWN = 5;
const DAY_LEFT = "font-hand tracking-[-0.01em] text-[#A8481A]";

/** 한 장 뜯어 쓰는 작은 달력: 위 망고 띠에 달, 아래 큰 날(시안). 위에 고리 두 개 */
function CalendarLeaf({ m, d, locale }: { m: number; d: number; locale: Locale }) {
  return (
    <span aria-hidden="true" className="relative block h-[48.6px] w-[41.4px] shrink-0">
      <span className="absolute left-0 top-[2.7px] flex h-[45.9px] w-[41.4px] flex-col overflow-hidden rounded-[8.1px] border border-edge bg-white">
        <span className="flex h-4 shrink-0 items-center justify-center border-b border-edge bg-sky text-[9.9px] leading-none">{monthName(m, locale)}</span>
        <span className="hand flex flex-1 items-center justify-center text-[25.1px] leading-none">{d}</span>
      </span>
      <span className="absolute left-2 top-0 h-[8.1px] w-1 rounded-[2.7px] bg-ink" />
      <span className="absolute left-[30.6px] top-0 h-[8.1px] w-1 rounded-[2.7px] bg-ink" />
    </span>
  );
}

function dayLeft(daysUntil: number, t: T) {
  return daysUntil === 0 ? t("start.today") : `D-${daysUntil}`;
}

/** 다음 날짜가 아직 안 정해진(연도만 있는 등) 날짜도 이름 옆에 적을 말 */
function whenText(spec: DateSpec, date: YMD, locale: Locale) {
  return spec.calendar === "lunar" ? formatSpec(spec, locale) : formatMonthDay(date, locale);
}

export function PersonView({ locale, back, today, person: p, name, notes, folders, answered, waiting, ai }: PersonData) {
  const t = makeT(locale);
  // 적어 둔 항목만(중요한 순서). 생일·기념일은 위 날짜 카드에 따로
  const filled = SECTIONS_BY_IMPORTANCE.filter((section) => section !== "dates")
    .map((section) => ({ section, line: sectionSummary(section, p.card, locale, t) }))
    .filter((x) => x.line != null);
  const shown = filled.slice(0, SHOWN);
  const hidden = filled.length - shown.length;
  const birthday = p.card.dates?.birthday ?? null;
  const nextBirthday = birthday ? nextOccurrence(birthday, today) : null;
  const milestone = birthday && nextBirthday ? milestoneOf(yearsAt(birthday, nextBirthday.date)) : null;
  const birthdayTitle = milestone ? (locale === "ko" ? `${milestone.ko} ${t("dates.birthday")}` : milestone.en) : t("dates.birthday");
  const anniversaries = (p.card.dates?.anniversaries ?? []).slice(0, 3);
  const hasDates = !!birthday || anniversaries.length > 0;
  const editDates = `/people/${p.contactId}/edit?open=dates`;
  const displayName = p.name || name;

  return (
    <>
      {answered ? <SeeAnswers contactId={p.contactId} /> : null}
      {/* 물어본 답장을 확인하는 순간이 가장 좋을 때: 답을 읽을 틈을 두고 스토어 리뷰 부탁(앱에서만, 며칠 써 본 사람에게만).
          열자마자 읽음 처리로 화면이 다시 그려져 answered가 false가 되니, 조건부로 붙이지 않고 늘 붙여 둔다 */}
      <ReviewMoment source="answer" delay={4000} armed={answered} />
      {/* 위 줄: 뒤로 … 즐겨찾기 별 · ··· 메뉴(물어보기 · 선물 고르기 · 지우기). 사람 기록 공유하기는 개인정보 우려로 껐다(2026-11-21) */}
      <div className="flex h-11 items-center justify-between pl-1.5 pr-2">
        <Link href={back} prefetch={false} aria-label={t("common.back")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center">
          <Icon name="back" size={26} strokeWidth={2} />
        </Link>
        <div className="flex items-center gap-0.5">
          <FavoriteStar contactId={p.contactId} initial={p.favorite} label={t("person.favorite")} />
          <PersonMenu
            contactId={p.contactId}
            labels={{
              more: t("person.moreMenu"),
              ask: t("person.askMore"),
              gift: t("person.pickGift"),
              remove: t("common.delete"),
              sheet: {
                open: t("person.remove"),
                title: t("person.removeTitle", { name: displayName }),
                body: t("person.removeBody", { name: displayName }),
                remove: t("common.delete"),
                cancel: t("common.cancel"),
                close: t("common.close"),
              },
            }}
          />
        </div>
      </div>

      <ViewBeacon contactId={p.contactId} />
      {p.askOff ? (
        <div className="px-4 pt-2">
          <AskOnButton contactId={p.contactId} label={t("person.askOn")} />
        </div>
      ) : null}

      {/* 프로필 카드: 폴라로이드 얼굴(누르면 얼굴·부르는 말 꾸미기) · 이름(형광펜) · 든 폴더 · 모서리에 큰 하트 든 캐릭터 */}
      <section aria-label={displayName} className="card relative mx-4 mt-3 flex items-center gap-4 py-3.5 pl-4 pr-3.5">
        <TornTape color="pink" w={74} h={22} rotate={7} className="-top-3 right-[23.4px]" />
        <Link href={`/people/${p.contactId}/profile`} aria-label={t("me.face")} className="block shrink-0 -rotate-3 border border-edge bg-white px-1.5 pb-[16.2px] pt-1.5">
          <Avatar config={p.avatar} size={80} label={t("avatar.of", { name: displayName })} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 pb-1">
          {/* 긴 이름은 두 줄까지 */}
          <h1 className="hl line-clamp-2 min-w-0 max-w-full break-words px-0.5 text-[38.9px] leading-none">{displayName}</h1>
          {/* 앱 사용자와 이어진 사람은 내가 단 태그도 이름 밑에서 바로 고친다 */}
          {p.personId ? (
            <TagEditor
              contactId={p.contactId}
              initial={p.nickname}
              nameIsTag={false}
              labels={{
                tag: t("person.relation"),
                add: t("person.addTag"),
                edit: t("common.edit"),
                rename: t("person.rename"),
                placeholder: t("person.relationPlaceholder"),
                save: t("common.save"),
                cancel: t("common.cancel"),
                error: t("common.error"),
              }}
            />
          ) : null}
          {/* 든 폴더(여러 개) + 폴더 고르기 */}
          <PersonFolders
            contactId={p.contactId}
            name={name}
            folders={folders}
            mine={p.folderIds}
            labels={{
              put: t("folder.put"),
              removeFrom: t("folder.removeFrom", { name: "{name}" }),
              removed: t("folder.removed"),
              title: t("folder.of", { name: "{name}" }),
              done: t("folder.done"),
              newFolder: t("folder.new"),
              namePlaceholder: t("folder.namePlaceholder"),
              create: t("folder.create"),
              count: t("folder.count", { n: "{n}" }),
              close: t("common.close"),
              error: t("common.error"),
            }}
          />
        </div>
        <Mascot pose={4} size={46} className="absolute bottom-1 right-1.5" />
      </section>

      {/* 물어보고 답을 기다리는 중: 아직 아무도 안 연 링크는 여기서 취소한다 */}
      {waiting ? (
        <div className="mx-4 mt-3 flex min-h-12 items-center gap-2.5 rounded-[12.6px] border border-edge bg-sky-soft pl-4 pr-1.5">
          <Icon name="link" size={17} strokeWidth={2} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 text-[12.6px]">{t("home.waiting")}</span>
          <form action={cancelInvite}>
            <input type="hidden" name="id" value={waiting.inviteId} />
            <input type="hidden" name="back" value={`/people/${p.contactId}`} />
            <button className="flex min-h-11 items-center px-2.5 text-[12.6px] text-red">{t("privacy.linkCancel")}</button>
          </form>
        </div>
      ) : null}

      {/* 생일·기념일: 작은 달력 + 며칠 남았는지. 눌러서 고친다 */}
      {hasDates ? (
        <section aria-label={t("section.dates")} className="card mx-4 mt-3 flex flex-col gap-2 px-3 pb-2 pt-2.5">
          {birthday ? (
            <Link href={editDates} className="flex items-center gap-2.5">
              <CalendarLeaf m={nextBirthday ? nextBirthday.date.m : birthday.month} d={nextBirthday ? nextBirthday.date.d : birthday.day} locale={locale} />
              <span className="flex min-w-0 flex-1 flex-col gap-[2.7px]">
                <span className="text-[10.8px] text-muted">
                  {nextBirthday
                    ? [birthday.calendar === "lunar" ? formatSpec(birthday, locale) : null, weekdayLong(nextBirthday.date, locale)].filter(Boolean).join(" · ")
                    : formatSpec(birthday, locale)}
                </span>
                <span className="hand whitespace-nowrap text-[19.4px] leading-none">
                  {birthdayTitle}
                  {nextBirthday ? <span className={`${DAY_LEFT} ml-1.5`}>{dayLeft(nextBirthday.daysUntil, t)}</span> : null}
                </span>
              </span>
            </Link>
          ) : null}
          {anniversaries.map((a, i) => {
            const next = nextOccurrence(a.spec, today);
            return (
              <Link key={i} href={editDates} className={`flex h-[27px] items-center gap-2 pt-1.5 text-[11.7px] text-muted ${birthday || i ? "border-t border-dashed border-ink/30" : ""}`}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="13.5" height="13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" />
                </svg>
                <span className="min-w-0 flex-1 truncate">
                  {a.label} · {next ? whenText(a.spec, next.date, locale) : formatSpec(a.spec, locale)}
                </span>
                {next ? <span className={`${DAY_LEFT} text-[16.2px]`}>{dayLeft(next.daysUntil, t)}</span> : null}
              </Link>
            );
          })}
        </section>
      ) : null}

      {ai ? (
        <QuickNote
          contactId={p.contactId}
          labels={{
            placeholder: t("person.quickPlaceholder", { name }),
            save: t("voice.save"),
            same: t("voice.same"),
            gone: t("voice.gone"),
            changed: t("voice.changed"),
            removed: t("voice.removed"),
            undo: t("voice.undo"),
            undone: t("voice.undone"),
            failed: t("voice.failed"),
            limit: t("voice.limit"),
            nothing: t("person.quickNothing"),
            aiOff: t("voice.aiOff"),
            holdTitle: t("quick.holdTitle"),
            holdApply: t("quick.holdApply"),
            holdCancel: t("common.cancel"),
          }}
        />
      ) : null}

      {/* 기억해 둔 것: 적어 둔 항목을 한 줄씩 미리 보기. 연필(수정)을 누르면 모든 항목을 고치는 화면, 줄을 누르면 그 항목이 펼쳐진 채로. 제목 옆에 나만 보는 메모 */}
      <section aria-labelledby="mine-title" className="card relative mx-4 mt-3 flex flex-col px-3.5 pb-1 pt-1.5">
        <div className="flex h-10 items-center justify-between">
          <h2 id="mine-title" className="scribble text-[21.1px] leading-none [--scribble:#5dbb9a]">
            {t("person.mineList")}
          </h2>
          <span className="flex items-center gap-0.5">
            <NotesButton
              contactId={p.contactId}
              notes={notes.map((n) => ({ id: n.id, body: n.body, when: n.label || formatMonthDay(parseYmd(n.createdAt.slice(0, 10)) ?? today, locale) }))}
              labels={{
                button: t("person.memo"),
                title: t("person.notes"),
                add: t("person.addNote"),
                placeholder: t("person.noteBodyPlaceholder"),
                body: t("person.noteBody"),
                del: t("common.delete"),
                close: t("common.close"),
              }}
            />
            <Link href={`/people/${p.contactId}/edit`} aria-label={t("me.edit")} className="-mr-2.5 flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center">
              <Icon name="pencil" size={20} strokeWidth={1.8} />
            </Link>
          </span>
        </div>
        {shown.length ? (
          <ul className="mt-1 flex flex-col">
            {shown.map(({ section, line }) => {
              const warn = section === "safety";
              return (
                <li key={section} className="border-t border-dashed border-ink/30">
                  <Link href={`/people/${p.contactId}/edit?open=${section}`} aria-label={`${t(`section.${section}` as "section.safety")}: ${[line!.lead, line!.text].filter(Boolean).join(" · ")}`} className="flex h-[37.8px] items-center gap-2.5">
                    <SectionIcon section={section} size={30} />
                    <span className={`w-16 shrink-0 text-[10.8px] leading-[1.2] ${warn ? "text-red" : "text-muted"}`}>{t(`person.short.${section}` as "person.short.safety")}</span>
                    <span className="hand-written min-w-0 flex-1 truncate text-[18.6px] leading-[1.1]">
                      {line!.lead ? <span className="text-red">{line!.lead}</span> : null}
                      {line!.lead && line!.text ? " · " : null}
                      {line!.text}
                    </span>
                  </Link>
                </li>
              );
            })}
            {hidden > 0 ? (
              <li className="border-t border-dashed border-ink/30">
                <Link href={`/people/${p.contactId}/edit`} className="flex h-[34.2px] items-center justify-center gap-0.5 text-[11.7px] text-muted">
                  {t("person.moreItems", { n: hidden })}
                  <Icon name="chevron" size={13} strokeWidth={2} />
                </Link>
              </li>
            ) : null}
          </ul>
        ) : (
          <Link href={editDates} className="mt-1 flex min-h-14 items-center justify-center gap-1.5 border-t border-dashed border-ink/30 text-[14.4px] text-accent">
            <Icon name="plus" size={16} strokeWidth={2.4} />
            {t("person.write")}
          </Link>
        )}
      </section>

      <div className="page-end" />
    </>
  );
}
