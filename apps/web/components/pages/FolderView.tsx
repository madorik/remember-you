import Link from "@/components/AppLink";
import { FolderMembers } from "@/app/(app)/people/folder/[id]/FolderMembers";
import { FolderSheets } from "@/app/(app)/people/folder/[id]/FolderSheets";
import { TopBar } from "@/components/chrome";
import { FolderArt } from "@/components/FolderArt";
import { Heart, SKY_STAR, Squiggle, Star, Tape } from "@/components/diary";
import { Icon } from "@/components/marks";
import { folderSheetLabels } from "@/lib/folders";
import type { FolderData } from "@/lib/pages/folder.data";
import { makeT } from "@/lib/t";

// 폴더 하나: 큰 폴더 그림(든 사람 얼굴이 빼꼼) · 이름 · 몇 명, 생일 가까운 순/이름순, 목록 끝에 사람 넣기.
// 아래에서 이 폴더 사람들로 바로 선물 고르기·메뉴 고르기
export function FolderView({ locale, folder, rows, byName, memberIds, people, open }: FolderData) {
  const t = makeT(locale);
  const here = `/people/folder/${folder.id}${byName ? "?sort=name" : ""}`;
  const withParam = (key: string) => `${here}${byName ? "&" : "?"}${key}=1`;
  const faces = rows.map((r) => ({ key: r.contactId, avatar: r.avatar, label: r.name }));
  const picked = `?with=${memberIds.join(",")}&me=1`;
  const chip = (on: boolean) => `chip !px-[17px] ${on ? "chip-on" : ""}`;

  return (
    <>
      <TopBar
        back="/people"
        label={t("common.back")}
        right={
          <Link href={withParam("edit")} scroll={false} aria-label={t("folder.edit")} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 active:bg-fill">
            <Icon name="pencil" size={19} strokeWidth={2} />
          </Link>
        }
      />

      <div className="relative flex items-center gap-[22px] px-6 pt-3.5">
        <span className="relative shrink-0 -rotate-3">
          <FolderArt icon={folder.icon} color={folder.color} size={132} faces={faces} />
          <Tape color="pink" w={54} h={18} rotate={-38} className="-left-3.5 top-3.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="hl line-clamp-2 self-start break-words px-1 text-[40px] leading-[1.15]">{folder.name}</h1>
          <span className="pl-1 text-[19px] text-muted">{t("folder.count", { n: memberIds.length })}</span>
        </div>
        <Star size={22} rotate={14} className="right-[38px] top-0.5" />
        <Heart size={24} rotate={14} className="right-[22px] top-[82px]" />
      </div>

      {memberIds.length > 1 ? (
        <div className="flex gap-2 px-5 pb-3 pt-6">
          <Link href={`/people/folder/${folder.id}`} replace scroll={false} aria-current={!byName ? "true" : undefined} className={chip(!byName)}>
            {t("folder.sortSoon")}
          </Link>
          <Link href={`/people/folder/${folder.id}?sort=name`} replace scroll={false} aria-current={byName ? "true" : undefined} className={chip(byName)}>
            {t("folder.sortName")}
          </Link>
        </div>
      ) : (
        <div className="h-5" />
      )}

      <div className="card relative mx-4 px-3.5">
        <Tape color="mango" w={84} h={22} rotate={4} alpha={0.62} className="-top-[11px] right-[34px]" />
        <FolderMembers
          folderId={folder.id}
          rows={rows}
          here={here}
          locale={locale}
          labels={{
            remove: t("folder.removeMember", { name: "{name}" }),
            removed: t("folder.removed"),
            addPeople: t("folder.addPeople"),
            error: t("common.error"),
          }}
        />
        <Star size={20} rotate={-12} color={SKY_STAR} className="-left-[7px] top-24" />
        <Squiggle w={54} width={2.4} color="#F59BAE" className="-bottom-2 right-[26px]" />
      </div>

      {memberIds.length ? (
        <>
          <div className="h-6" />
          <div className="bottom-bar mt-auto grid grid-cols-2 gap-2.5 bg-bg px-6 pt-4">
            <Link href={`/plan/gift${picked}`} className="btn-outline btn-outline-lift">
              {t("plan.gift")}
            </Link>
            <Link href={`/plan/menu${picked}`} className="btn-primary">
              {t("plan.menu")}
            </Link>
          </div>
        </>
      ) : (
        <div className="page-end" />
      )}

      <FolderSheets
        folder={folder}
        open={open}
        back={here}
        people={people}
        sheet={folderSheetLabels(t)}
        labels={{
          title: t("folder.addPeople"),
          search: t("people.search"),
          addN: t("folder.addN", { n: "{n}" }),
          done: t("folder.done"),
          close: t("common.close"),
          error: t("common.error"),
        }}
      />
    </>
  );
}
