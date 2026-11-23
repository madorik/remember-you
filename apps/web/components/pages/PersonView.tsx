import { formatMonthDay, formatSpec, nextOccurrence, parseYmd, SECTIONS_BY_IMPORTANCE, solarToLunar } from "@readme/core";
import Link from "@/components/AppLink";
import { AskOnButton } from "@/app/(app)/people/[id]/AskOnButton";
import { FavoriteStar } from "@/app/(app)/people/[id]/FavoriteStar";
import { NameEditor } from "@/app/(app)/people/[id]/NameEditor";
import { NotesButton } from "@/app/(app)/people/[id]/NotesButton";
import { PersonMenu } from "@/app/(app)/people/[id]/PersonMenu";
import { ViewBeacon } from "@/app/(app)/people/[id]/ViewBeacon";
import { QuickNote } from "@/app/(app)/people/[id]/QuickNote";
import { ResendLink } from "@/components/ResendLink";
import { TagEditor } from "@/app/(app)/people/[id]/TagEditor";
import { cancelInvite } from "@/app/actions/request";
import { Avatar } from "@/components/Avatar";
import { lunarDots } from "@/components/BirthdayLine";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { SectionBody } from "@/components/SectionBody";
import { CAKE_ART, SectionIcon } from "@/components/SectionIcon";
import { ReviewMoment } from "@/components/ReviewAsk";
import { SeeAnswers } from "@/components/SeeAnswers";
import { TornTape } from "@/components/TornTape";
import { personFolderLabels } from "@/lib/folders";
import type { T } from "@/lib/i18n";
import type { PersonData } from "@/lib/pages/person.data";
import { makeT } from "@/lib/t";

function dayLeft(daysUntil: number, t: T) {
  return daysUntil === 0 ? t("start.today") : `D-${daysUntil}`;
}

export function PersonView({ locale, back, today, person: p, name, notes, folders, answered, waiting, ai }: PersonData) {
  const t = makeT(locale);
  // 적어 둔 항목만(중요한 순서). 생일·기념일도 이 목록의 첫 칸
  const filled = SECTIONS_BY_IMPORTANCE.map((section) => ({ section, body: SectionBody({ section, card: p.card, today, locale, t, variant: "rich" }) })).filter((x) => x.body != null);
  const birthday = p.card.dates?.birthday ?? null;
  const nextBirthday = birthday ? nextOccurrence(birthday, today) : null;
  // 프로필 생일 줄: 양력 날짜 · 음력(음력 생일이면 적은 그대로, 양력 생일이면 그 날의 음력)
  const birthdayLunar = !birthday ? null : birthday.calendar === "lunar" ? { m: birthday.month, d: birthday.day, leap: birthday.leap } : nextBirthday ? solarToLunar(nextBirthday.date) : null;
  const editDates = `/people/${p.contactId}/edit?open=dates`;
  const displayName = p.name || name;

  return (
    <>
      {answered ? <SeeAnswers contactId={p.contactId} /> : null}
      {/* 물어본 답장을 확인하는 순간이 가장 좋을 때: 답을 읽을 틈을 두고 스토어 리뷰 부탁(앱에서만, 며칠 써 본 사람에게만).
          열자마자 읽음 처리로 화면이 다시 그려져 answered가 false가 되니, 조건부로 붙이지 않고 늘 붙여 둔다 */}
      <ReviewMoment source="answer" delay={4000} armed={answered} />
      {/* 말로·글로 적기를 저장하고 이 화면으로 왔을 때도 리뷰를 부탁할 좋은 순간(앱에서만, 기록을 막 저장한 직후에만) */}
      <ReviewMoment source="saved" when="saved" delay={4000} />
      {/* 위 줄: 뒤로 … 즐겨찾기 별 · ··· 메뉴(물어보기 · 선물 고르기 · 폴더 · 지우기). 사람 기록 공유하기는 개인정보 우려로 껐다(2026-11-21) */}
      <div className="flex h-11 items-center justify-between pl-1.5 pr-2">
        <Link href={back} prefetch={false} aria-label={t("common.back")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center">
          <Icon name="back" size={26} strokeWidth={2} />
        </Link>
        <div className="flex items-center gap-0.5">
          <FavoriteStar contactId={p.contactId} initial={p.favorite} label={t("person.favorite")} />
          <PersonMenu
            contactId={p.contactId}
            name={name}
            folders={folders}
            mine={p.folderIds}
            labels={{
              more: t("person.moreMenu"),
              ask: t("person.askMore"),
              gift: t("person.pickGift"),
              folder: t("folder.label"),
              remove: t("common.delete"),
              folderSheet: personFolderLabels(t),
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

      {/* 프로필 카드(시안 Q-Person): 폴라로이드 얼굴(누르면 얼굴·부르는 말 꾸미기) · 이름(형광펜) 줄 끝에 캐릭터 · 생일 줄(양력 · 음력 · D-day) · 가장 최근 나만 보는 메모 한 줄 + '+more'(메모 시트).
          폴더는 칩으로 두지 않고 ··· 메뉴의 '폴더'에서 */}
      <section aria-label={displayName} className="card relative mx-4 mt-3 flex items-center gap-4 py-3.5 pl-4 pr-3.5">
        <TornTape color="pink" w={66.6} h={19.8} rotate={7} className="-top-3 right-[23.4px]" />
        <Link href={`/people/${p.contactId}/profile`} aria-label={t("me.face")} className="block shrink-0 -rotate-3 border border-edge bg-white px-1.5 pb-[16.2px] pt-1.5">
          <Avatar config={p.avatar} size={80} label={t("avatar.of", { name: displayName })} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 pr-[5.4px]">
          <div className="flex w-full items-end justify-between gap-2">
            {/* 이어지지 않은 사람은 이름이 곧 내가 부르는 말이라 이름을 눌러 그 자리에서 고친다(이어진 사람의 이름은 그 사람 것이라 아래 태그로). 긴 이름은 두 줄까지 */}
            {p.personId ? (
              <h1 className="hl line-clamp-2 min-w-0 break-words px-0.5 text-[36.9px] leading-none">{displayName}</h1>
            ) : (
              <NameEditor contactId={p.contactId} initial={displayName} labels={{ edit: t("person.renameName"), save: t("common.save"), cancel: t("common.cancel"), error: t("common.error") }} />
            )}
            <Mascot pose={4} size={40.6} />
          </div>
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
          {/* 생일(적어 뒀을 때만): 케이크 · 양력 날짜 · 음력 · D-day */}
          {birthday ? (
            <span className="inline-flex flex-wrap items-center gap-x-[5.4px] gap-y-1 text-[13.5px]">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16.2" height="16.2" fill="none" stroke="#1F2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                {CAKE_ART}
              </svg>
              <span>
                {nextBirthday ? formatMonthDay(nextBirthday.date, locale) : formatSpec(birthday, locale)}
                {birthdayLunar && nextBirthday ? <span className="text-muted"> · {lunarDots(birthdayLunar, locale, t)}</span> : null}
              </span>
              {nextBirthday ? (
                <span className="hand inline-flex h-[21.6px] items-center rounded-full border border-edge bg-sky px-[7.2px] text-[14.4px] leading-none">{dayLeft(nextBirthday.daysUntil, t)}</span>
              ) : null}
            </span>
          ) : null}
          {/* 가장 최근 나만 보는 메모 한 줄 + '+more'(없으면 '+ 메모') */}
          <NotesButton
            contactId={p.contactId}
            notes={notes.map((n) => ({ id: n.id, body: n.body, when: n.label || formatMonthDay(parseYmd(n.createdAt.slice(0, 10)) ?? today, locale) }))}
            labels={{
              more: t("person.memoMore"),
              moreText: t("person.memoMoreShort"),
              addShort: t("person.memoAdd"),
              title: t("person.notes"),
              add: t("person.addNote"),
              placeholder: t("person.noteBodyPlaceholder"),
              body: t("person.noteBody"),
              del: t("common.delete"),
              close: t("common.close"),
            }}
          />
        </div>
      </section>

      {/* 물어보고 답을 기다리는 중: 아직 아무도 안 연 링크는 여기서 취소한다 */}
      {waiting ? (
        <div className="mx-4 mt-3 flex min-h-12 items-center gap-2 rounded-[12.6px] border border-edge bg-sky-soft pl-4 pr-1.5">
          <Icon name="link" size={17} strokeWidth={2} className="shrink-0 text-accent" />
          <span className="flex min-w-0 flex-1 flex-col py-1.5">
            <span className="text-[12.6px] leading-[1.25]">{t("home.waiting")}</span>
            <span className="text-[10.8px] leading-[1.3] text-muted">{t("person.waitingDays", { n: waiting.days })}</span>
          </span>
          <ResendLink locale={locale} contactId={p.contactId} className="flex min-h-11 shrink-0 items-center px-2 text-[12.6px] text-accent underline decoration-[1.5px] underline-offset-4 disabled:opacity-50" />
          <form action={cancelInvite}>
            <input type="hidden" name="id" value={waiting.inviteId} />
            <input type="hidden" name="back" value={`/people/${p.contactId}`} />
            <button className="flex min-h-11 items-center px-2 text-[12.6px] text-red">{t("privacy.linkCancel")}</button>
          </form>
        </div>
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
            created: t("voice.createdPerson", { name: displayName }),
            aiOff: t("voice.aiOff"),
            holdTitle: t("quick.holdTitle"),
            holdApply: t("quick.holdApply"),
            holdCancel: t("common.cancel"),
          }}
        />
      ) : null}

      {/* 기억해 둔 것: 적어 둔 항목마다 제목 줄(누르면 그 항목이 펼쳐진 고치는 화면)과 그 밑에 적어 둔 내용 전부. 연필(수정)은 모든 항목을 고치는 화면 */}
      <section aria-labelledby="mine-title" className="relative mx-4 mt-[19.8px] flex flex-col">
        <div className="flex h-11 items-center justify-between pl-[7.2px]">
          <h2 id="mine-title" className="text-[23.4px] leading-none">
            {t("person.mineList")}
          </h2>
          <Link href={`/people/${p.contactId}/edit`} aria-label={t("me.edit")} className="-mr-0 flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center">
            <Icon name="pencil" size={21} strokeWidth={1.8} />
          </Link>
        </div>
        {filled.length ? (
          <div className="card relative px-4">
            <TornTape color="pink" w={59.4} h={18} rotate={34} className="-right-[9px] -top-[7.2px]" />
            <ul className="flex flex-col">
              {filled.map(({ section, body }) => (
                <li key={section} className="border-t border-dashed border-ink/30 first:border-t-0">
                  <Link href={`/people/${p.contactId}/edit?open=${section}`} className="flex min-h-[48.6px] items-center gap-[10.8px] pt-[5.4px]">
                    <SectionIcon section={section} size={38} cake={section === "dates"} />
                    <span className={`min-w-0 flex-1 text-[16.2px] ${section === "safety" ? "text-red" : ""}`}>{t(`section.${section}` as "section.safety")}</span>
                    {/* 그 사람이 물어보기에 직접 답한 항목(내가 고치면 이 표시는 빠진다) */}
                    {p.answered[section] ? (
                      <span className="inline-flex h-[21.6px] max-w-[48%] shrink-0 items-center gap-1 rounded-full bg-sky-soft pl-1.5 pr-2 text-[10.8px] leading-none shadow-[inset_0_0_0_1px_var(--color-mango-edge)]">
                        <Icon name="check" size={12} strokeWidth={2.6} className="shrink-0 text-accent" />
                        <span className="truncate">{t("person.toldBy", { name: displayName })}</span>
                      </span>
                    ) : null}
                    <Icon name="chevron" size={16} strokeWidth={2} className="shrink-0 text-muted" />
                  </Link>
                  <div className="pb-[12.6px] pt-[3.6px]">{body}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          // 아직 아무것도 없을 때: 직접 적거나, 그 사람에게 물어보거나(물어보기 화면이 이 사람으로 열린다)
          <div className="grid grid-cols-2 gap-2.5">
            <Link href={editDates} className="btn-outline">
              <Icon name="plus" size={17} strokeWidth={2.2} />
              {t("person.write")}
            </Link>
            <Link href={`/request?to=${p.contactId}`} className="btn-primary">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <rect x="3" y="6" width="18" height="13" rx="2" fill="#F9CBD5" />
                <path d="M3.8 7l8.2 6.2L20.2 7" />
              </svg>
              {t("person.askMore")}
            </Link>
          </div>
        )}
      </section>

      <div className="page-end" />
    </>
  );
}
