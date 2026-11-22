import { DEFAULT_AVATAR } from "@readme/core";
import { PersonProfileForm } from "@/app/(app)/people/[id]/profile/PersonProfileForm";
import type { PersonProfileData } from "@/lib/pages/person-profile.data";
import { makeT } from "@/lib/t";

// 사람 프로필: 그 사람의 얼굴과 부르는 말을 내가 꾸민다(내 프로필 고치기와 같은 화면). 뒤로·제목·저장은 한 줄 머리
export function PersonProfileView({ locale, person: p }: PersonProfileData) {
  const t = makeT(locale);
  return (
    <div className="page-end flex flex-1 flex-col">
      <PersonProfileForm
        contactId={p.contactId}
        title={t("person.profileTitle", { name: p.name || p.nickname })}
        name={p.nickname}
        avatar={p.avatar ?? DEFAULT_AVATAR}
        locale={locale}
        back={`/people/${p.contactId}`}
        labels={{ name: p.personId ? t("person.relation") : t("person.callName"), save: t("common.save"), back: t("common.back") }}
      />
      {/* 사람 지우기는 사람 화면 위 줄의 휴지통 하나로만 한다 */}
    </div>
  );
}
