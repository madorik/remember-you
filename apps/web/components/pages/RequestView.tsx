import { RequestForm } from "@/app/(app)/request/RequestForm";
import Link from "next/link";
import { Icon } from "@/components/marks";
import type { RequestData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 물어보기: 주소록 사람에게(찾아서 고르거나 사람 화면에서 to로), 또는 새 사람(이름을 적어 새로)에게.
// 아는 사람이면 아직 안 적힌 항목을 먼저 고르고, 받은 답은 그 사람 기록에 들어간다
export function RequestView({ locale, people, fixed, initialName, defaults, xmas, focus, question, webPushKey }: RequestData) {
  const t = makeT(locale);
  const title = fixed ? t("request.titleTo", { name: fixed.label }) : t("request.title");
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-1.5 pl-1.5 pr-2.5">
        <div className="flex min-w-0 items-center gap-0.5">
          <Link href={fixed ? `/people/${fixed.id}` : "/home"} prefetch={false} aria-label={t("common.close")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center">
            <Icon name="close" size={22} strokeWidth={1.8} />
          </Link>
          <h1 className="min-w-0 truncate text-[27.5px] leading-none">
            <span className="hl">{title}</span>
          </h1>
        </div>
      </div>
      <RequestForm locale={locale} people={people} fixed={fixed?.id ?? null} initialName={initialName} defaults={defaults} xmas={xmas} focus={focus} question={question} webPushKey={webPushKey} />
    </div>
  );
}
