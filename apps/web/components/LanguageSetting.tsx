import type { Locale } from "@readme/core";
import { setLocale } from "@/app/actions/auth";
import type { T } from "@/lib/i18n";

/** 언어 고르기(시스템·한국어·English). 프로필(내 리드미)과 공유 관리에서 같이 쓴다. back은 고른 뒤 돌아올 화면 */
export function LanguageSetting({ choice, back, t, className = "" }: { choice: Locale | null; back: string; t: T; className?: string }) {
  return (
    // 좁은 화면(영어)에서 단어 중간이 끊기지 않게 줄바꿈을 막고, 자리가 모자라면 버튼이 아랫줄로 내려간다
    <div className={`flex min-h-[47px] flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1 ${className}`}>
      <span className="whitespace-nowrap text-[15px]">{t("privacy.language")}</span>
      <form action={setLocale} className="flex gap-0.5 rounded-xl border-[1.5px] border-ink bg-white p-[3px]">
        <input type="hidden" name="back" value={back} />
        {(["system", "ko", "en"] as const).map((l) => {
          const on = (choice ?? "system") === l;
          return (
            <button key={l} name="locale" value={l} aria-pressed={on} className={`h-[34px] whitespace-nowrap rounded-[9px] px-3.5 text-[14px] ${on ? "bg-sky text-ink" : "text-ink"}`}>
              {l === "system" ? t("privacy.languageSystem") : l === "ko" ? "한국어" : "English"}
            </button>
          );
        })}
      </form>
    </div>
  );
}
