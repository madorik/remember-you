import { TopBar } from "@/components/chrome";
import { SectionForm } from "@/components/editors/SectionForm";
import type { MeEditSectionData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

export function MeEditSectionView({ locale, section, card }: MeEditSectionData) {
  const t = makeT(locale);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back={`/me/edit?open=${section}`} label={t("common.back")} />
      <div className="relative px-6 pt-1.5">
        <h1 className="scribble text-[36px] leading-none">{t(`section.${section}` as "section.safety")}</h1>
      </div>
      <SectionForm section={section} initial={card[section] ?? null} locale={locale} />
    </div>
  );
}
