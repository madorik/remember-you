import { SECTIONS_BY_IMPORTANCE } from "@readme/core";
import { MyReadmeList } from "@/app/(app)/me/MyReadmeList";
import Link from "@/components/AppLink";
import { Icon } from "@/components/marks";
import { PersonNameChip } from "@/components/PersonNameChip";
import type { MeEditData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 나에 대한 기록 고치기: 모든 항목을 한 목록에. 누르면 그 자리에서 펼쳐 고치고 바로 저장된다(사람 정보 수정과 같은 모양)
export function MeEditView({ locale, name, avatar, card, open }: MeEditData) {
  const t = makeT(locale);
  return (
    <div className="page-end flex flex-1 flex-col">
      <div className="flex h-12 items-center pl-1.5 pr-2.5">
        <Link href="/me" prefetch={false} aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center">
          <Icon name="back" size={26} strokeWidth={2} />
        </Link>
      </div>
      <div className="flex flex-col gap-2 px-5">
        <PersonNameChip avatar={avatar} name={name} />
        <h1 className="scribble self-start text-[41px] leading-none">{t("me.title")}</h1>
      </div>
      <MyReadmeList
        rows={SECTIONS_BY_IMPORTANCE.map((section) => ({
          section,
          title: t(`section.${section}` as "section.safety"),
          sub: t(`section.${section}.sub` as "section.safety.sub"),
        }))}
        card={card}
        locale={locale}
        initialOpen={open}
      />
    </div>
  );
}
