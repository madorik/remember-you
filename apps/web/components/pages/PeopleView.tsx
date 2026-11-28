import { PeopleBoard } from "@/app/(app)/people/PeopleBoard";
import { folderSheetLabels } from "@/lib/folders";
import type { PeopleData } from "@/lib/pages/people.data";
import { makeT } from "@/lib/t";

// 내 사람들: 폴더 칸 + 폴더 없는 사람(끌어서 폴더에 넣는다). 오른쪽 위에 사람 더하기(직접 적기)와 선택(사람을 골라 메뉴 고르기·폴더에 넣기·지우기)
export function PeopleView({ locale, rows, recent, folders, meAvatar, initialPick, initial, initialMe, initialGift, initialXmas }: PeopleData) {
  const t = makeT(locale);
  return (
    <>
      <PeopleBoard
        locale={locale}
        rows={rows}
        recent={recent}
        folders={folders}
        meAvatar={meAvatar}
        initialPick={initialPick}
        initial={initial}
        initialMe={initialMe}
        initialGift={initialGift}
        initialXmas={initialXmas}
        sheet={folderSheetLabels(t)}
        labels={{
          title: t("home.people"),
          summary: t("people.summary", { n: "{n}", f: "{f}" }),
          bannerTitle: t("people.bannerTitle"),
          bannerCta: t("home.ask"),
          pick: t("people.pick"),
          add: t("people.add"),
          addRow: t("home.addPerson"),
          cancel: t("people.pickCancel"),
          withMe: t("plan.withMe"),
          meName: t("plan.me"),
          pickedTitle: t("people.pickedTitle", { n: "{n}" }),
          selectAll: t("people.selectAll"),
          selectNone: t("people.selectNone"),
          menu: t("plan.menu"),
          gift: t("plan.gift"),
          avatarOf: t("avatar.of", { name: "{name}" }),
          pickOne: t("people.pickOne", { name: "{name}" }),
          empty: t("people.empty"),
          folders: t("folder.label"),
          favorites: t("people.favorites"),
          recent: t("people.recent"),
          unfiled: t("folder.none"),
          search: t("people.search"),
          searchEmpty: t("people.searchEmpty"),
          clear: t("common.close"),
          newFolder: t("folder.new"),
          count: t("folder.count", { n: "{n}" }),
          pickFolder: t("people.pickGroup", { name: "{name}" }),
          addNamed: t("people.addNamed", { name: "{name}" }),
          sort: t("people.sort"),
          sortName: t("folder.sortName"),
          sortSoon: t("folder.sortSoon"),
          sortRecent: t("people.sortRecent"),
          put: t("folder.put"),
          putDone: t("people.putDone", { n: "{n}", name: "{name}" }),
          remove: t("people.remove"),
          removeTitle: t("people.removeTitle", { n: "{n}" }),
          removeBody: t("people.removeBody", { n: "{n}" }),
          removed: t("people.removed", { n: "{n}" }),
          removeConfirm: t("common.delete"),
          removeCancel: t("common.cancel"),
          error: t("common.error"),
        }}
      />
    </>
  );
}
