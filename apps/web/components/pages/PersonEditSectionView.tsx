import Link from "@/components/AppLink";
import { SaveButton } from "@/components/editors/SaveButton";
import { SectionForm } from "@/components/editors/SectionForm";
import { Icon } from "@/components/marks";
import { PersonNameChip } from "@/components/PersonNameChip";
import type { PersonEditSectionData } from "@/lib/pages/person-edit-section.data";
import { makeT } from "@/lib/t";

/** 긴 제목은 가운데에 가장 가까운 띄어쓰기에서 두 줄로(밑줄 낙서가 글자 너비에 맞게 한 줄 폭으로 그려진다) */
function splitTitle(title: string): [string, string | null] {
  if (title.length <= 9) return [title, null];
  const spaces = [...title].map((c, i) => (c === " " ? i : -1)).filter((i) => i > 0);
  if (!spaces.length) return [title, null];
  const mid = title.length / 2;
  const at = spaces.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
  return [title.slice(0, at), title.slice(at + 1)];
}

// 사람 기록의 항목 하나 고치기(내 리드미 편집과 같은 편집기). 답받은 항목도 고친다.
// 머리 줄(뒤로 · 저장) 아래에 이름표와 제목(밑줄 낙서), 흰 카드 안에 편집기
export function PersonEditSectionView({ locale, contactId, name, avatar, section, card }: PersonEditSectionData) {
  const t = makeT(locale);
  const [first, second] = splitTitle(t(`section.${section}` as "section.safety"));
  return (
    <div className="flex flex-1 flex-col">
      <SectionForm
        section={section}
        initial={card[section] ?? null}
        locale={locale}
        contactId={contactId}
        header={
          <>
            <div className="flex h-12 items-center justify-between pl-1.5 pr-2.5">
              <Link href={`/people/${contactId}`} prefetch={false} aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center">
                <Icon name="back" size={26} strokeWidth={2} />
              </Link>
              <SaveButton label={t("common.save")} />
            </div>
            <div className="flex flex-col gap-3 px-5">
              <PersonNameChip avatar={avatar} name={name} />
              <h1 className="scribble self-start text-[36px] leading-[1.05]">
                {first}
                {second ? (
                  <>
                    <br />
                    {second}
                  </>
                ) : null}
              </h1>
            </div>
          </>
        }
      />
    </div>
  );
}
