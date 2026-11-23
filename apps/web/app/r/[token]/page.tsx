import { sanitizeSections, translate } from "@readme/core";
import { Wordmark } from "@/components/chrome";
import { TornTape } from "@/components/TornTape";
import { getSession, readCard } from "@/lib/data";
import { makeT, requestLocale } from "@/lib/i18n";
import { readAskOnce } from "@/lib/ask";
import { ogMetadata, previewLocale } from "@/lib/og";
import { submitAnswer } from "@/app/actions/request";
import { AnswerForm } from "@/components/AnswerForm";

/** 주소 조각을 풀어 토큰으로. 깨진 %가 있으면 있는 그대로(없는 링크로 처리된다) */
function tokenOf(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 링크 미리보기: "○○님이 물어봐요" */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const token = tokenOf((await params).token);
  const locale = await requestLocale((await getSession())?.profile.locale);
  // 화면과 같은 읽기를 나눠 쓴다(요청 안에서 DB는 한 번만)
  const ask = await readAskOnce(token).catch(() => null);
  const from = ask?.row.inviter_name?.trim();
  const lang = previewLocale(locale, from);
  return ogMetadata(lang, from ? translate(lang, "og.requestTitle", { name: from }) : translate(lang, "request.title"));
}

// 물어보기에 답하는 화면(로그인 없이 열린다). 답은 물어본 사람의 기록에 들어간다(그 뒤로는 그 사람이 고친다)
export default async function AnswerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = tokenOf(raw);
  const session = await getSession();
  const locale = await requestLocale(session?.profile.locale);
  const t = makeT(locale);
  // 로그인 없이 여는 화면이라 시스템 권한으로 읽는다. 토큰 해시가 맞는 요청 한 줄만 돌아온다(미리 채운 값은 상대에게 보일 것만)
  const { row, prefill } = await readAskOnce(token);
  const from = row.inviter_name || translate(locale, "app.name");

  const header = (
    <div className="flex min-h-12 items-center justify-between px-5">
      <Wordmark size={24} locale={locale} />
      <span className="rounded-full border-[1.5px] border-dashed border-ink/40 bg-paper px-3 py-1 text-[12px] text-ink [transform:rotate(-2deg)]">{t("answer.noInstall")}</span>
    </div>
  );

  if (row.state === "active") {
    const mine = session ? (await session.tx((q) => readCard(q, session.user.id))).card : {};
    return (
      <main className="screen !pb-0">
        {header}
        <AnswerForm
          locale={locale}
          token={token}
          from={from}
          message={row.message ?? ""}
          sections={sanitizeSections(row.sections).sort((a, b) => Number(!prefill[a]) - Number(!prefill[b]))}
          prefill={prefill}
          mine={mine}
          signedIn={!!session}
          submit={submitAnswer}
        />
      </main>
    );
  }

  const key = row.state === "expired" ? "accept.expired" : row.state === "canceled" ? "accept.canceled" : row.state === "used" ? "accept.used" : "accept.notFound";
  return (
    <main className="screen">
      {header}
      <section className="card relative mx-4 mt-10 px-5 pb-8 pt-8">
        <TornTape color="pink" w={66} h={21} rotate={6} className="-top-3 right-6" />
        <p className="hand text-[28px] leading-[1.3]">{t(key)}</p>
      </section>
    </main>
  );
}
