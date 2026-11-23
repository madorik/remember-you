import { TopBar } from "@/components/chrome";
import { NameChip, Star } from "@/components/diary";
import { SectionForm } from "@/components/editors/SectionForm";
import type { PersonEditSectionData } from "@/lib/pages/person-edit-section.data";
import { makeT } from "@/lib/t";

// 사람 기록의 항목 하나 고치기(내 리드미 편집과 같은 편집기). 답받은 항목도 고친다
export function PersonEditSectionView({ locale, contactId, name, avatar, section, card }: PersonEditSectionData) {
  const t = makeT(locale);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back={`/people/${contactId}`} label={t("common.back")} />
      <div className="relative px-6 pt-1.5">
        <NameChip avatar={avatar} name={name} />
        <h1 className="mt-2.5 text-[32px] leading-[1.3]">
          <span className="hl px-1">{t(`section.${section}` as "section.safety")}</span>
        </h1>
        <Star size={22} rotate={14} className="right-9 top-1.5" />
      </div>
      <SectionForm section={section} initial={card[section] ?? null} locale={locale} contactId={contactId} />
    </div>
  );
}
