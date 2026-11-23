import Link from "@/components/AppLink";
import { createPerson } from "@/app/actions/people";
import { AvatarField } from "@/components/editors/AvatarField";
import { NameField } from "@/components/editors/AvatarBuilder";
import { Icon } from "@/components/marks";
import type { PersonNewData } from "@/lib/pages/person-new.data";
import { makeT } from "@/lib/t";

// 직접 적어 두기: 이름(부르는 말)·프로필(얼굴)·폴더만 받고 카드를 만든다. 나머지(생일 포함)는 그 사람 화면에서 항목별로 적는다.
// 한 줄 머리(닫기 · 제목 · 만들기) 아래에 캐릭터 만들기 카드가 있고, 이름·폴더 칸은 미리보기 오른쪽에 있다. 메모 가져오기는 맨 아래 글자 링크
export function PersonNewView({ locale, folders, error, name, ai, xmas }: PersonNewData) {
  const t = makeT(locale);
  return (
    <form action={createPerson} className="flex flex-1 flex-col">
      {xmas ? <input type="hidden" name="xmas" value="1" /> : null}
      <div className="flex h-12 items-center justify-between gap-1.5 pl-1.5 pr-3">
        <div className="flex min-w-0 items-center gap-0.5">
          <Link href="/people" prefetch={false} aria-label={t("common.close")} className="flex h-11 w-11 shrink-0 items-center justify-center">
            <Icon name="close" size={24} strokeWidth={2} />
          </Link>
          <h1 className="min-w-0 truncate text-[31px] leading-none">
            <span className="hl">{t("people.newTitle")}</span>
          </h1>
        </div>
        <button className="flex h-[34px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border-[1.5px] border-ink bg-sky px-3.5 text-[15px] active:translate-y-px">{t(xmas ? "people.createAsk" : "people.create")}</button>
      </div>
      {/* 프로필: 그 사람의 얼굴(사람 화면의 프로필 고치기와 같은 만들기). 안 만져도 보이는 얼굴이 그대로 저장된다 */}
      <div className="px-4 pt-3">
        <AvatarField
          locale={locale}
          side={
            <>
              {/* 이름이나 부르는 말: 위에 작은 라벨, 칸은 점선 밑줄 */}
              <NameField label={t("people.newName")} value={(name ?? "").slice(0, 40)} autoFocus invalid={error === "name"} />
              {error === "name" || error === "limit" ? (
                <span role="alert" className="-mt-1.5 text-[13px] leading-[1.2] text-red">
                  {t(error === "limit" ? "people.newLimit" : "people.newNameError")}
                </span>
              ) : null}
              {/* 처음 넣을 폴더(드롭다운): 다른 폴더는 그 사람 화면에서 더 넣는다 */}
              <label className="flex flex-col gap-0.5">
                <span className="text-[12px] text-muted">{t("folder.label")}</span>
                <span className="relative flex">
                  <select name="folderId" defaultValue="" className="h-9 w-full min-w-0 appearance-none rounded-[10px] border-[1.5px] border-ink bg-white pl-8 pr-8 text-[14px] outline-none">
                    <option value="">{t("folder.none")}</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#1F2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="#FFF4D6" />
                  </svg>
                  <Icon name="chevron" size={16} strokeWidth={2} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-ink" />
                </span>
              </label>
            </>
          }
        />
      </div>
      {ai ? (
        <Link href="/import?new=1" className="mt-3 flex h-10 shrink-0 items-center justify-center gap-1 text-[13px] text-muted">
          <Icon name="pencil" size={15} strokeWidth={1.8} />
          {t("import.open")}
        </Link>
      ) : null}
      <div className="page-end" />
    </form>
  );
}
