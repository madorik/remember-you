import { SECTIONS_BY_IMPORTANCE, isEmptySection, sanitizeSections, translate, type PartialCard, type Section } from "@readme/core";
import { Wordmark } from "@/components/chrome";
import { TornTape } from "@/components/TornTape";
import { getSession, readCard } from "@/lib/data";
import { makeT, requestLocale } from "@/lib/i18n";
import { readAskOnce } from "@/lib/ask";
import { ogMetadata, requestPreview } from "@/lib/og";
import { submitAnswer, submitQuestionAnswer } from "@/app/actions/request";
import { AnswerForm } from "@/components/AnswerForm";
import { AnswerQuestion } from "@/components/AnswerQuestion";

/** 주소 조각을 풀어 토큰으로. 깨진 %가 있으면 있는 그대로(없는 링크로 처리된다) */
function tokenOf(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 링크 미리보기: 제목은 보낸 사람 말투로("○○님이 궁금해해요"), 설명은 이 링크가 무엇을 묻는지("로그인 없이 3가지, 1분이면 돼요", 한 질문이면 그 질문 자체).
 * 링크가 닫혔거나 없으면 제목만 바꾸고 설명은 사이트 소개로
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const token = tokenOf((await params).token);
  const locale = await requestLocale((await getSession())?.profile.locale);
  // 화면과 같은 읽기를 나눠 쓴다(요청 안에서 DB는 한 번만)
  const ask = await readAskOnce(token).catch(() => null);
  const from = ask?.row.inviter_name?.trim();
  const active = ask && ask.row.state === "active";
  const { lang, title, description } = requestPreview(locale, from, { question: active ? (ask.questions[0] ?? null) : null, sections: active ? sanitizeSections(ask.row.sections) : [] });
  return active ? ogMetadata(lang, title, description) : ogMetadata(lang, title);
}

// 물어보기에 답하는 화면(로그인 없이 열린다). 답은 물어본 사람의 기록에 들어간다(그 뒤로는 그 사람이 고친다)
export default async function AnswerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = tokenOf(raw);
  const session = await getSession();
  const locale = await requestLocale(session?.profile.locale);
  const t = makeT(locale);
  // 로그인 없이 여는 화면이라 시스템 권한으로 읽는다. 토큰 해시가 맞는 요청 한 줄만 돌아온다(미리 채운 값은 상대에게 보일 것만)
  const { row, prefill, questions, inviterAvatar } = await readAskOnce(token);
  const named = row.inviter_name?.trim() ?? "";
  const from = named || translate(locale, "app.name");

  if (row.state === "active") {
    const mine = session ? (await session.tx((q) => readCard(q, session.user.id))).card : {};
    const header = (
      <div className="flex min-h-12 items-center justify-between px-5">
        <Wordmark size={24} locale={locale} />
        <span className="rounded-full border border-dashed border-ink/30 bg-paper px-2.5 py-[3px] text-[11.7px] text-ink [transform:rotate(-2deg)]">{t("answer.noInstall")}</span>
      </div>
    );
    const asked = questions[0];
    const asks = sanitizeSections(row.sections);
    // 보낸 사람 기록에 칸만 있고 값이 비어 있는 항목은 '알고 있어요(맞아요/달라요)'가 아니라 처음부터 질문지로 보여 준다
    const known = Object.fromEntries(Object.entries(prefill).filter(([x, v]) => !isEmptySection(x as Section, v as never))) as PartialCard;
    return (
      <main className="screen !pb-0">
        {header}
        {asked ? (
          // 한 질문만 묻는 링크
          <AnswerQuestion locale={locale} token={token} from={from} fromAvatar={inviterAvatar} message={row.message ?? ""} question={asked} signedIn={!!session} submit={submitQuestionAnswer} />
        ) : (
          <AnswerForm
            locale={locale}
            token={token}
            from={from}
            fromAvatar={inviterAvatar}
            message={row.message ?? ""}
            // 중요한 것(생일·못 먹는 것 …)부터. 보낸 사람이 이미 아는 항목(맞아요만 누르면 되는 것)이 맨 앞
            sections={SECTIONS_BY_IMPORTANCE.filter((x) => asks.includes(x)).sort((a, b) => Number(!known[a]) - Number(!known[b]))}
            prefill={known}
            mine={mine}
            signedIn={!!session}
            submit={submitAnswer}
          />
        )}
      </main>
    );
  }

  // 닫힌 링크: 누가 보낸 링크인지 알려 주고 그 사람에게 다시 보내 달라고 하게(이름이 없으면 예전 문구). 설치 없이 답하는 중 표시는 답할 수 있을 때만
  const key = row.state === "expired" ? (named ? "accept.expiredFrom" : "accept.expired") : row.state === "canceled" ? (named ? "accept.canceledFrom" : "accept.canceled") : row.state === "used" ? (named ? "accept.usedFrom" : "accept.used") : "accept.notFound";
  return (
    <main className="screen">
      <div className="flex min-h-12 items-center px-5">
        <Wordmark size={24} locale={locale} />
      </div>
      <section className="card relative mx-4 mt-6 px-3.5 pb-4 pt-4">
        <TornTape color="pink" w={66} h={21} rotate={6} className="-top-3 right-6" />
        <p className="hand text-[19.4px] leading-[1.35]">{t(key, { from: named })}</p>
      </section>
    </main>
  );
}
