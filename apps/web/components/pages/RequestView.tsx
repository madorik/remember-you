import { leaveTour } from "@/app/actions/tour";
import { RequestForm } from "@/app/(app)/request/RequestForm";
import { TopBar } from "@/components/chrome";
import { Star, TourNote } from "@/components/diary";
import type { RequestData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 물어보기: 주소록 사람에게(찾아서 고르거나 사람 화면에서 to로), 또는 새 사람(이름을 적어 새로)에게.
// 아는 사람이면 아직 안 적힌 항목을 먼저 고르고, 받은 답은 그 사람 기록에 들어간다
export function RequestView({ locale, people, fixed, initialName, defaults, xmas, initialMessage, focus, tour }: RequestData) {
  const t = makeT(locale);
  return (
    <div className="flex flex-1 flex-col">
      {/* 가입 직후 체험이면 닫기 대신 오른쪽 위 '건너뛰기'(체험을 접고 홈으로), 제목 자리에 안내 */}
      <TopBar
        close={tour ? undefined : fixed ? `/people/${fixed.id}` : "/home"}
        label={t("common.close")}
        right={
          tour ? (
            <form action={leaveTour}>
              <input type="hidden" name="kind" value="skip" />
              <input type="hidden" name="source" value="ask" />
              <button className="flex min-h-11 items-center px-3 text-[19px] text-muted">{t("common.skip")}</button>
            </form>
          ) : undefined
        }
      />
      {tour ? (
        <TourNote label={fixed ? t("request.titleTo", { name: fixed.label }) : t("tour.ask.title")} className="mt-3.5">
          <span className="num text-[17px] text-[#1f4fa3]">{t("tour.page", { n: tour.n, total: tour.total })}</span>
          <h1 className="text-[27px] leading-[1.3]">{fixed ? t("request.titleTo", { name: fixed.label }) : t("tour.ask.title")}</h1>
          <p className="text-[18px] leading-[1.5]">{t("tour.ask.body")}</p>
        </TourNote>
      ) : (
        <div className="relative px-6 pt-1.5">
          <h1 className="hl inline-block px-1 text-[34px] leading-[1.2]">{fixed ? t("request.titleTo", { name: fixed.label }) : t("request.title")}</h1>
          <Star size={22} rotate={14} className="left-[150px] top-0.5" />
        </div>
      )}
      <RequestForm locale={locale} people={people} fixed={fixed?.id ?? null} initialName={initialName} defaults={defaults} xmas={xmas} initialMessage={initialMessage} focus={focus} tour={!!tour} />
    </div>
  );
}
