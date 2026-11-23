import { TopBar } from "@/components/chrome";
import { Star } from "@/components/diary";
import { SectionForm } from "@/components/editors/SectionForm";
import type { MeEditSectionData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

export function MeEditSectionView({ locale, section, card }: MeEditSectionData) {
  const t = makeT(locale);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back={`/me/edit?open=${section}`} label={t("common.back")} />
      <div className="relative px-6 pt-1.5">
        <h1 className="text-[32px] leading-[1.3]">
          <span className="hl px-1">{t(`section.${section}` as "section.safety")}</span>
        </h1>
        <Star size={22} rotate={14} className="right-9 top-1.5" />
      </div>
      <SectionForm section={section} initial={card[section] ?? null} locale={locale} />
    </div>
  );
}
