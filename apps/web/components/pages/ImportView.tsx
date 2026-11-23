import { IMPORT_MAX } from "@readme/core";
import { ImportMemo } from "@/app/(app)/import/ImportMemo";
import { TopBar } from "@/components/chrome";
import { Heart, Star } from "@/components/diary";
import type { ImportData } from "@/lib/pages/import.data";
import { makeT } from "@/lib/t";

// 메모 가져오기: 적어 둔 메모를 붙여 넣거나 말하면 읽어서 새 사람을 더하거나 있는 사람에 없는 것만 더한다
export function ImportView({ locale, scope, people, back }: ImportData) {
  const t = makeT(locale);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar close={back} label={t("common.close")} />
      <div className="relative px-6 pt-1.5 [html[data-kb]_&]:hidden">
        <h1 className="hl inline-block px-1 text-[34px] leading-[1.2]">{t("import.title")}</h1>
        <Star size={22} rotate={14} className="right-[42px] top-0" />
        <Heart size={20} rotate={-14} className="right-[96px] top-9" />
      </div>
      <ImportMemo
        key={scope.kind === "person" ? scope.id : scope.kind}
        locale={locale}
        scope={scope}
        people={people}
        max={IMPORT_MAX}
        labels={{
          method: t("import.method"),
          write: t("import.modeWrite"),
          speak: t("import.modeSpeak"),
          placeholder: scope.kind === "person" ? t("import.placeholderOne", { name: scope.name }) : scope.kind === "new" ? t("import.placeholderNew") : t("import.placeholder"),
          count: t("import.count", { n: "{n}", max: String(IMPORT_MAX) }),
          analyze: t("import.analyze"),
          steps: [t("import.steps1"), t("import.steps2"), t("import.steps3")],
          review: t("import.review"),
          name: t("import.name"),
          nameNeeded: t("import.nameNeeded"),
          pickNeeded: t("import.pickNeeded"),
          listen: t("import.listen"),
          listening: t("import.listening"),
          micError: t("voice.micError"),
          saveN: t("import.saveN", { n: "{n}" }),
          savedN: t("import.savedN", { n: "{n}" }),
          undo: t("voice.undo"),
          undone: t("import.undone"),
          done: t("common.next"),
          again: t("import.again"),
          same: t("voice.same"),
          newPerson: t("voice.newPerson"),
          sameName: t("voice.sameName", { n: "{n}" }),
          asNew: t("voice.asNew"),
          pickTitle: t("voice.pickTitle"),
          memo: t("voice.memo"),
          wishMe: t("gift.wishTitle"),
          me: t("voice.me"),
          allSame: t("import.allSame"),
          avatarOf: t("avatar.of", { name: "{name}" }),
          image: t("import.modeImage"),
          pickImage: t("import.pickImage"),
          imageNotice: t("import.imageNotice"),
          removeImage: t("import.removeImage"),
          preparing: t("import.preparing"),
          imageChip: t("import.imageChip"),
          skipped: t("import.skipped", { n: "{n}" }),
          micDenied: t("import.micDenied"),
          imageProblems: {
            type: t("import.img.type"),
            big: t("import.img.big"),
            unreadable: t("import.img.unreadable"),
            small: t("import.img.small"),
            ratio: t("import.img.ratio"),
            blank: t("import.img.blank"),
            heavy: t("import.img.heavy"),
            many: t("import.img.many"),
          },
          errors: {
            ai_off: t("import.aiOff"),
            failed: t("import.failed"),
            limit: t("import.limit"),
            nothing: t("import.nothing"),
            bad_image: t("import.badImage"),
            not_memo: t("import.notMemo"),
            unreadable: t("import.unreadable"),
            sensitive: t("import.sensitive"),
          },
        }}
      />
    </div>
  );
}
