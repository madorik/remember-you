import Link from "@/components/AppLink";
import { createPerson } from "@/app/actions/people";
import { AvatarField } from "@/components/editors/AvatarField";
import { NameField } from "@/components/editors/AvatarBuilder";
import { Icon } from "@/components/marks";
import type { PersonNewData } from "@/lib/pages/person-new.data";
import { makeT } from "@/lib/t";

// 직접 적어 두기: 이름(부르는 말)·프로필(얼굴)·폴더만 받고 카드를 만든다. 나머지(생일 포함)는 그 사람 화면에서 항목별로 적는다.
// 한 화면에 다 보이게: 한 줄 머리(닫기 · 제목 · 메모 가져오기) 아래에 캐릭터 만들기가 있고, 이름·폴더 칸은 미리보기 오른쪽에 있다
export function PersonNewView({ locale, folders, error, name, ai, xmas }: PersonNewData) {
  const t = makeT(locale);
  return (
    <form action={createPerson} className="flex flex-1 flex-col">
      {xmas ? <input type="hidden" name="xmas" value="1" /> : null}
      <div className="flex min-h-11 items-center gap-1 pl-3 pr-2">
        <Link href="/people" prefetch={false} aria-label={t("common.close")} className="flex h-11 w-11 shrink-0 items-center justify-center">
          <Icon name="close" size={22} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[28px] font-normal leading-[1.25]">
          <span className="hl px-1">{t("people.newTitle")}</span>
        </h1>
        {ai ? (
          <Link href="/import?new=1" className="flex min-h-11 shrink-0 items-center gap-1 px-2 text-[17px] text-accent">
            <Icon name="pencil" size={16} strokeWidth={2} />
            {t("import.open")}
          </Link>
        ) : null}
      </div>
      {/* 프로필: 그 사람의 얼굴(사람 화면의 프로필 고치기와 같은 만들기). 안 만져도 보이는 얼굴이 그대로 저장된다 */}
      <div className="px-4 pt-2">
        <AvatarField
          locale={locale}
          side={
            <>
              {/* 이름이나 부르는 말: 라벨 줄 없이 칸 안의 안내글로(스크린리더에는 라벨 글자) */}
              <NameField
                label={t("people.newName")}
                placeholder={t("people.newName")}
                value={(name ?? "").slice(0, 40)}
                hideLabel
                autoFocus
                invalid={error === "name"}
              />
              {error === "name" || error === "limit" ? (
                <span role="alert" className="text-[16px] leading-[1.2] text-red">
                  {t(error === "limit" ? "people.newLimit" : "people.newNameError")}
                </span>
              ) : null}
              {/* 처음 넣을 폴더(드롭다운): 문구 없이 칸 하나(안에 '폴더 없음', 스크린리더용 aria-label). 다른 폴더는 그 사람 화면에서 더 넣는다 */}
              <span className="relative flex">
                <select
                  name="folderId"
                  defaultValue=""
                  aria-label={t("folder.label")}
                  className="h-[52px] w-full min-w-0 appearance-none rounded-2xl bg-white pl-3.5 pr-10 text-[21px] shadow-[inset_0_0_0_1.5px_var(--color-ink)] outline-none"
                >
                  <option value="">{t("folder.none")}</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-muted" />
              </span>
            </>
          }
        />
      </div>
      <div className="bottom-bar mt-auto bg-bg px-6 pt-3">
        <button className="btn-primary w-full">{t(xmas ? "people.createAsk" : "people.create")}</button>
      </div>
    </form>
  );
}
