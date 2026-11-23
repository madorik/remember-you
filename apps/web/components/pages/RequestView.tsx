import { leaveTour } from "@/app/actions/tour";
import { RequestForm } from "@/app/(app)/request/RequestForm";
import Link from "next/link";
import { TourNote } from "@/components/diary";
import { Icon } from "@/components/marks";
import type { RequestData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 물어보기: 주소록 사람에게(찾아서 고르거나 사람 화면에서 to로), 또는 새 사람(이름을 적어 새로)에게.
// 아는 사람이면 아직 안 적힌 항목을 먼저 고르고, 받은 답은 그 사람 기록에 들어간다
export function RequestView({ locale, people, fixed, initialName, defaults, xmas, focus, question, webPushKey, tour }: RequestData) {
  const t = makeT(locale);
  const title = fixed ? t("request.titleTo", { name: fixed.label }) : t("request.title");
  return (
    <div className="flex flex-1 flex-col">
      {/* 가입 직후 체험이면 닫기 대신 오른쪽 위 '건너뛰기'(체험을 접고 홈으로), 제목 자리에 안내 */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-1.5 pl-1.5 pr-2.5">
        <div className="flex min-w-0 items-center gap-0.5">
          {tour ? null : (
            <Link href={fixed ? `/people/${fixed.id}` : "/home"} prefetch={false} aria-label={t("common.close")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center">
              <Icon name="close" size={22} strokeWidth={1.8} />
            </Link>
          )}
          {tour ? null : (
            <h1 className="min-w-0 truncate text-[27.5px] leading-none">
              <span className="hl">{title}</span>
            </h1>
          )}
        </div>
        {tour ? (
          <form action={leaveTour} className="ml-auto">
            <input type="hidden" name="kind" value="skip" />
            <input type="hidden" name="source" value="ask" />
            <button className="flex min-h-11 items-center px-3 text-[12.6px] text-muted">{t("common.skip")}</button>
          </form>
        ) : null}
      </div>
      {tour ? (
        <TourNote label={fixed ? t("request.titleTo", { name: fixed.label }) : t("tour.ask.title")} className="mt-1">
          <span className="num rounded-full bg-sky-soft px-2.5 text-[11.9px] leading-[1.5]">{t("tour.page", { n: tour.n, total: tour.total })}</span>
          <h1 className="text-[24.3px] leading-[1.2]">{fixed ? t("request.titleTo", { name: fixed.label }) : t("tour.ask.title")}</h1>
          <p className="text-[13.5px] leading-[1.5]">{t("tour.ask.body")}</p>
        </TourNote>
      ) : null}
      <RequestForm locale={locale} people={people} fixed={fixed?.id ?? null} initialName={initialName} defaults={defaults} xmas={xmas} focus={focus} question={question} webPushKey={webPushKey} tour={!!tour} />
    </div>
  );
}
