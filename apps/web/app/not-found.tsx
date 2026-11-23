import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { getSession } from "@/lib/data";
import { makeT, requestLocale } from "@/lib/i18n";

// 없는 주소(또는 notFound())일 때: 리디 + 짧은 제목 + 처음으로
export default async function NotFound() {
  const session = await getSession();
  const t = makeT(await requestLocale(session?.profile.locale));
  return (
    <main className="screen">
      <div className="page-end flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Mascot pose={10} size={108} />
        <h1 className="text-[30px] leading-[1.2]">{t("notFound.title")}</h1>
        <Link href="/" className="btn-primary w-full max-w-[320px]">
          {t("error.home")}
        </Link>
      </div>
    </main>
  );
}
