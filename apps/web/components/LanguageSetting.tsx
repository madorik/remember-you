import type { Locale } from "@readme/core";
import { setLocale } from "@/app/actions/auth";
import type { T } from "@/lib/i18n";

/** 언어 고르기(시스템·한국어·English). 프로필(내 리드미)과 공유 관리에서 같이 쓴다. back은 고른 뒤 돌아올 화면 */
export function LanguageSetting({ choice, back, t, className = "" }: { choice: Locale | null; back: string; t: T; className?: string }) {
  return (
    // 좁은 화면(영어)에서 단어 중간이 끊기지 않게 줄바꿈을 막고, 자리가 모자라면 버튼이 아랫줄로 내려간다
    <div className={`flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1 ${className}`}>
      <span className="whitespace-nowrap pl-1 text-[19px]">{t("privacy.language")}</span>
      <form action={setLocale} className="flex gap-1">
        <input type="hidden" name="back" value={back} />
        {(["system", "ko", "en"] as const).map((l) => {
          const on = (choice ?? "system") === l;
          return (
            <button key={l} name="locale" value={l} aria-pressed={on} className={`h-10 whitespace-nowrap rounded-full px-3 text-[17px] ${on ? "bg-sky text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink),0_3px_0_var(--color-mango-deep)]" : "text-muted shadow-[inset_0_0_0_1.5px_transparent]"}`}>
              {l === "system" ? t("privacy.languageSystem") : l === "ko" ? "한국어" : "English"}
            </button>
          );
        })}
      </form>
    </div>
  );
}
