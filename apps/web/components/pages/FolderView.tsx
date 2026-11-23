import Link from "@/components/AppLink";
import { FolderMembers } from "@/app/(app)/people/folder/[id]/FolderMembers";
import { FolderSheets } from "@/app/(app)/people/folder/[id]/FolderSheets";
import { TopBar } from "@/components/chrome";
import { FolderArt } from "@/components/FolderArt";
import { Icon } from "@/components/marks";
import { TornTape } from "@/components/TornTape";
import { folderSheetLabels } from "@/lib/folders";
import type { FolderData } from "@/lib/pages/folder.data";
import { makeT } from "@/lib/t";

// 폴더 하나: 큰 폴더 그림(든 사람 얼굴이 빼꼼) · 이름 · 몇 명, 생일 가까운 순/이름순, 목록 끝에 사람 넣기
export function FolderView({ locale, folder, rows, byName, memberIds, people, open }: FolderData) {
  const t = makeT(locale);
  const here = `/people/folder/${folder.id}${byName ? "?sort=name" : ""}`;
  const withParam = (key: string) => `${here}${byName ? "&" : "?"}${key}=1`;
  const faces = rows.map((r) => ({ key: r.contactId, avatar: r.avatar, label: r.name }));
  // 정렬 토글(카드 맨 위 알약 두 칸): 고른 쪽은 망고
  const seg = (on: boolean) => `flex h-[30.6px] flex-1 items-center justify-center whitespace-nowrap rounded-[8.1px] text-[12.6px] ${on ? "bg-sky" : ""}`;

  return (
    <>
      <TopBar
        back="/people"
        label={t("common.back")}
        right={
          <Link href={withParam("edit")} scroll={false} aria-label={t("folder.edit")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center rounded-full active:bg-fill">
            <Icon name="pencil" size={21} strokeWidth={1.8} />
          </Link>
        }
      />

      <div className="relative flex items-center gap-4 px-5 pt-4">
        <span className="shrink-0 -rotate-4">
          <FolderArt icon={folder.icon} color={folder.color} size={120} faces={faces} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="hl line-clamp-2 self-start break-words text-[38.9px] leading-none">{folder.name}</h1>
          <span className="text-[11.7px] leading-[1.3] text-muted">{t("folder.count", { n: memberIds.length })}</span>
        </div>
      </div>

      <div className="card relative mx-4 mt-7 flex flex-col px-3.5 pb-1.5 pt-3">
        <TornTape color="mango" w={70} h={21} rotate={6} className="-top-3 right-6" />
        {memberIds.length > 1 ? (
          <div className="mb-1 flex gap-0.5 rounded-xl border border-edge bg-white p-[2.7px]">
            <Link href={`/people/folder/${folder.id}`} replace scroll={false} aria-current={!byName ? "true" : undefined} className={seg(!byName)}>
              {t("folder.sortSoon")}
            </Link>
            <Link href={`/people/folder/${folder.id}?sort=name`} replace scroll={false} aria-current={byName ? "true" : undefined} className={seg(byName)}>
              {t("folder.sortName")}
            </Link>
          </div>
        ) : null}
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
      </div>

      <div className="page-end" />

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
