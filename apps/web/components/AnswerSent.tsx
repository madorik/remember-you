"use client";

import type { Locale, Section } from "@readme/core";
import Link from "next/link";
import { AnswerDone } from "@/components/AnswerDone";
import { useT } from "@/components/editors/shared";
import { GetAppLink } from "@/components/GetAppLink";
import { useIsNative } from "@/components/native";

/** 편지 봉투(나도 물어보기 단추) */
function Envelope() {
  return (
    <svg aria-hidden="true" width="18.9" height="18.9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
    </svg>
  );
}

/**
 * 답을 보낸 뒤 화면(항목 여러 개를 묻는 답하기와 한 질문 답하기가 같이 쓴다).
 * 나도 그 사람에게 물어보기: 웹에서는 앱 받기(아이폰은 App Store, 안드로이드는 앱이 있으면 앱을 열고 없으면 Play 공개 전엔 웹), 앱 안에서는 바로 물어보기(로그인 안 했으면 로그인부터).
 * 로그인 링크는 여기서만 보인다(받는 사람이 답하기 전에는 로그인을 권하지 않는다)
 */
export function AnswerSent({ locale, from, topics, signedIn, savedMine }: { locale: Locale; from: string; topics: Section[]; signedIn: boolean; savedMine: boolean }) {
  const t = useT(locale);
  const inApp = useIsNative();
  const askBack = `/request?name=${encodeURIComponent(from)}`;
  const here = signedIn ? askBack : `/?next=${encodeURIComponent(askBack)}`;
  return (
    <AnswerDone
      title={t("answer.sent.title")}
      body={t("answer.sentShort", { from })}
      topics={topics}
      labels={{ sentTitle: t("answer.sentTopics", { from }), topic: (x) => t(`request.topic.${x}` as "request.topic.dates"), perksTitle: t("answer.perksTitle") }}
      perks={
        signedIn
          ? []
          : [
              { icon: "pencil", text: t("answer.perk.edit") },
              { icon: "people", text: t("answer.perk.see") },
              { icon: "bell", text: t("answer.perk.remind") },
            ]
      }
    >
      {inApp ? (
        <Link href={here} className="btn-primary w-full">
          <Envelope />
          {t("answer.askBack")}
        </Link>
      ) : (
        <GetAppLink href={`/get?from=answer&next=${encodeURIComponent(here)}`} appPath={askBack} className="btn-primary w-full">
          <Envelope />
          {t("answer.askBackApp")}
        </GetAppLink>
      )}
      {savedMine ? (
        <Link href="/me" className="flex min-h-11 items-center justify-center text-[12.6px] text-muted">
          {t("answer.openApp")}
        </Link>
      ) : signedIn ? null : (
        <Link href={`/?next=${encodeURIComponent("/home")}`} className="flex min-h-11 items-center justify-center text-[12.6px] text-muted underline decoration-[1.5px] underline-offset-4">
          {t("answer.signInDone")}
        </Link>
      )}
    </AnswerDone>
  );
}
