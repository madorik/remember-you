import { SECTIONS_BY_IMPORTANCE } from "@readme/core";
import Link from "@/components/AppLink";
import { MyReadmeList } from "@/app/(app)/me/MyReadmeList";
import { Icon } from "@/components/marks";
import { PersonNameChip } from "@/components/PersonNameChip";
import type { PersonEditData } from "@/lib/pages/person-edit.data";
import { makeT } from "@/lib/t";

// 사람 정보 수정: 모든 항목을 한 목록에. 누르면 그 자리에서 펼쳐 고치고 바로 저장된다(나에 대한 기록과 같은 모양)
export function PersonEditView({ locale, contactId, name, avatar, card, ai, open }: PersonEditData) {
  const t = makeT(locale);
  return (
    <div className="page-end flex flex-1 flex-col">
      <div className="flex h-12 items-center justify-between pl-1.5 pr-2.5">
        <Link href={`/people/${contactId}`} prefetch={false} aria-label={t("common.back")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center">
          <Icon name="back" size={26} strokeWidth={2} />
        </Link>
        {ai ? (
          <Link href={`/import?to=${contactId}`} className="flex h-8 items-center gap-[4.5px] rounded-full border border-edge bg-sky-soft pl-2.5 pr-3.5 text-[11.7px]">
            <Icon name="pencil" size={16} strokeWidth={1.7} />
            {t("import.open")}
          </Link>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 px-5">
        <PersonNameChip avatar={avatar} name={name} />
        <h1 className="scribble self-start text-[33.2px] leading-none">{t("person.mineList")}</h1>
      </div>
      <MyReadmeList
        rows={SECTIONS_BY_IMPORTANCE.map((section) => ({
          section,
          title: t(`section.${section}` as "section.safety"),
          sub: section === "gifts" ? t("section.gifts.subOther") : t(`section.${section}.sub` as "section.safety.sub"),
        }))}
        card={card}
        locale={locale}
        initialOpen={open}
        contactId={contactId}
      />
    </div>
  );
}
