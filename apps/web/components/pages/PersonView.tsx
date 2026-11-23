import { formatMonthDay, parseYmd, SECTIONS_BY_IMPORTANCE } from "@readme/core";
import Link from "@/components/AppLink";
import { AskOnButton } from "@/app/(app)/people/[id]/AskOnButton";
import { FavoriteStar } from "@/app/(app)/people/[id]/FavoriteStar";
import { NotesButton } from "@/app/(app)/people/[id]/NotesButton";
import { PersonFolders } from "@/app/(app)/people/[id]/PersonFolders";
import { ViewBeacon } from "@/app/(app)/people/[id]/ViewBeacon";
import { QuickNote } from "@/app/(app)/people/[id]/QuickNote";
import { TagEditor } from "@/app/(app)/people/[id]/TagEditor";
import { cancelInvite } from "@/app/actions/request";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/chrome";
import { Heart, Sparkle, SKY_STAR, Squiggle, Star, Tape } from "@/components/diary";
import { Icon } from "@/components/marks";
import { RemovePersonButton } from "@/components/RemovePersonButton";
import { SectionBody } from "@/components/SectionBody";
import { SectionIcon } from "@/components/SectionIcon";
import { ReviewMoment } from "@/components/ReviewAsk";
import { SeeAnswers } from "@/components/SeeAnswers";
import type { PersonData } from "@/lib/pages/person.data";
import { makeT } from "@/lib/t";

export function PersonView({ locale, back, today, person: p, name, notes, folders, answered, waiting, ai }: PersonData) {
  const t = makeT(locale);
  // 적어 둔 항목만(중요한 순서)
  const filled = SECTIONS_BY_IMPORTANCE.map((section) => ({ section, body: SectionBody({ section, card: p.card, today, locale, t }) })).filter((x) => x.body != null);
  // 보낼 수 있는 글(적어 둔 항목만). 선물 칸의 '해주고 싶은 선물'은 몰래 준비하는 것이라 뺀다

  return (
    <>
      {answered ? <SeeAnswers contactId={p.contactId} /> : null}
      {/* 물어본 답장을 확인하는 순간이 가장 좋을 때: 답을 읽을 틈을 두고 스토어 리뷰 부탁(앱에서만, 며칠 써 본 사람에게만).
          열자마자 읽음 처리로 화면이 다시 그려져 answered가 false가 되니, 조건부로 붙이지 않고 늘 붙여 둔다 */}
      <ReviewMoment source="answer" delay={4000} armed={answered} />
      <TopBar
        back={back}
        label={t("common.back")}
        right={
          <div className="flex items-center gap-2 pr-1.5">
            {/* 사람 기록 공유하기는 개인정보 우려로 껐다(2026-11-21). 내 기록만 링크로 보낸다(나 화면 위쪽) */}
            {/* 사람들에서 지우기: 누르면 누구를 지우는지 한 번 더 묻고, 지우면 사람들 화면으로 */}
            <RemovePersonButton
              variant="icon"
              contactId={p.contactId}
              labels={{
                open: t("person.remove"),
                title: t("person.removeTitle", { name: p.name || name }),
                body: t("person.removeBody", { name: p.name || name }),
                remove: t("common.delete"),
                cancel: t("common.cancel"),
                close: t("common.close"),
              }}
            />
            <FavoriteStar contactId={p.contactId} initial={p.favorite} label={t("person.favorite")} />
          </div>
        }
      />

      <ViewBeacon contactId={p.contactId} />
      {p.askOff ? (
        <div className="px-6 pt-3">
          <AskOnButton contactId={p.contactId} label={t("person.askOn")} />
        </div>
      ) : null}

      <div className="relative flex items-start gap-5 px-6 pt-4">
        {/* 얼굴을 누르면 내 프로필처럼 그 사람의 얼굴·부르는 말을 꾸민다. 폴라로이드 한 장 */}
        <Link
          href={`/people/${p.contactId}/profile`}
          className="relative block shrink-0 -rotate-3 bg-white px-[7px] pb-5 pt-[7px] shadow-[0_1px_2px_rgb(31_35_64/0.12),0_8px_16px_-10px_rgb(31_35_64/0.5)]"
        >
          <span className="flex h-[86px] w-[86px] items-center justify-center bg-[#fff1cc]">
            <Avatar config={p.avatar} size={80} label={t("avatar.of", { name: p.name || name })} />
          </span>
          <Tape color="mango" w={48} h={18} rotate={-6} alpha={0.62} className="-top-[9px] left-[22px]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center">
            {/* 긴 이름은 두 줄까지 */}
            <h1 className="hl line-clamp-2 min-w-0 break-words px-1 text-[40px] leading-[1.15]">{p.name || name}</h1>
            <Link href={`/people/${p.contactId}/profile`} aria-label={t("me.face")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-fill">
              <Icon name="pencil" size={19} strokeWidth={1.9} />
            </Link>
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
          {/* 든 폴더(여러 개) + 폴더 고르기, 같은 줄 오른쪽 끝에 나만 보는 메모(누르면 아래에서 올라오는 시트에서 보고 적는다) */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
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
          </div>
        </div>
        <Heart size={22} rotate={14} className="right-6 top-2" />
        <Heart size={24} rotate={-14} className="left-[92px] top-[98px]" />
      </div>

      {/* 물어보고 답을 기다리는 중: 아직 아무도 안 연 링크는 여기서 취소한다 */}
      {waiting ? (
        <div className="mx-6 mt-5 flex min-h-[52px] items-center gap-2.5 rounded-[10px] bg-sky-soft pl-4 pr-1.5">
          <Icon name="link" size={17} strokeWidth={2} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 text-[17px]">{t("home.waiting")}</span>
          <form action={cancelInvite}>
            <input type="hidden" name="id" value={waiting.inviteId} />
            <input type="hidden" name="back" value={`/people/${p.contactId}`} />
            <button className="flex min-h-11 items-center px-2.5 text-[17px] text-red">{t("privacy.linkCancel")}</button>
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
            aiOff: t("voice.aiOff"),
            holdTitle: t("quick.holdTitle"),
            holdApply: t("quick.holdApply"),
            holdCancel: t("common.cancel"),
          }}
        />
      ) : null}

      {/* 기억해 둔 것: 적어 둔 항목만 미리 보기. 연필(수정)을 누르면 모든 항목을 고치는 화면, 항목을 누르면 그 항목이 펼쳐진 채로 */}
      <section aria-labelledby="mine-title" className="relative mx-4 mt-3.5 flex flex-col">
        <div className="flex min-h-11 items-center justify-between pl-2">
          <h2 id="mine-title" className="text-[22px]">
            {t("person.mineList")}
          </h2>
          <Link href={`/people/${p.contactId}/edit`} aria-label={t("me.edit")} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 active:bg-fill">
            <Icon name="pencil" size={21} strokeWidth={1.9} />
          </Link>
        </div>
        {filled.length ? (
          <div className="card relative mt-1 px-4">
            <Tape color="pink" rotate={34} className="-right-2.5 -top-1.5" />
            <ul className="flex flex-col">
            {filled.map(({ section, body }) => (
              <li key={section} className="border-t border-dashed border-rule first:border-t-0">
                <Link href={`/people/${p.contactId}/edit?open=${section}`} className="flex min-h-[56px] items-center gap-3 pt-2">
                  <SectionIcon section={section} size={40} />
                  <span className={`min-w-0 flex-1 text-[20px] ${section === "safety" ? "text-red" : ""}`}>{t(`section.${section}` as "section.safety")}</span>
                  <Icon name="chevron" size={17} className="shrink-0 text-muted" />
                </Link>
                <div className="pb-3.5 pt-1">{body}</div>
              </li>
            ))}
            </ul>
            <Star size={20} rotate={-12} color={SKY_STAR} className="-left-[7px] top-44" />
            <Squiggle w={54} width={2.4} className="-bottom-2 left-[30px]" />
            <Sparkle size={18} className="bottom-[60px] right-2" />
          </div>
        ) : (
          <Link href={`/people/${p.contactId}/edit?open=dates`} className="card mt-1 flex min-h-[72px] items-center justify-center gap-1.5 text-[19px] text-accent">
            <Icon name="plus" size={17} strokeWidth={2.4} />
            {t("person.write")}
          </Link>
        )}
      </section>

      <div className="h-6" />
      <div className="bottom-bar mt-auto grid grid-cols-2 gap-2.5 bg-bg px-6 pt-4">
        <Link href={`/request?to=${encodeURIComponent(p.contactId)}`} className="btn-outline btn-outline-lift">
          {t("person.askMore")}
        </Link>
        <Link href={`/people/${p.contactId}/reminder`} className="btn-primary">
          {t("person.pickGift")}
        </Link>
      </div>
    </>
  );
}
