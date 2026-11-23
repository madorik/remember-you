import { SECTIONS_BY_IMPORTANCE } from "@readme/core";
import Link from "@/components/AppLink";
import { MyReadmeList } from "@/app/(app)/me/MyReadmeList";
import { TopBar } from "@/components/chrome";
import { NameChip, Star } from "@/components/diary";
import { Icon } from "@/components/marks";
import type { PersonEditData } from "@/lib/pages/person-edit.data";
import { makeT } from "@/lib/t";

// 사람 정보 수정: 모든 항목을 한 목록에. 누르면 그 자리에서 펼쳐 고치고 바로 저장된다(나에 대한 기록과 같은 모양)
export function PersonEditView({ locale, contactId, name, avatar, card, ai, open }: PersonEditData) {
  const t = makeT(locale);
  return (
    <div className="page-end flex flex-1 flex-col">
      <TopBar
        back={`/people/${contactId}`}
        label={t("common.back")}
        right={
          ai ? (
            <Link href={`/import?to=${contactId}`} className="flex min-h-11 items-center gap-1 px-3 text-[19px] text-accent">
              <Icon name="pencil" size={18} strokeWidth={2} />
              {t("import.open")}
            </Link>
          ) : undefined
        }
      />
      <div className="relative px-6 pt-1.5">
        <NameChip avatar={avatar} name={name} />
        <div>
          <h1 className="hl mt-2.5 inline-block px-1 text-[36px] leading-[1.2]">{t("person.mineList")}</h1>
        </div>
        <Star size={22} rotate={14} className="right-11 top-[52px]" />
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
