"use client";

import { QUESTIONS, QUESTION_SECTION, canAnswerOwn, type AvatarConfig, type DailyQuestion, type Locale } from "@readme/core";
import { useActionState, useEffect, useRef, useState } from "react";
import type { AnswerState } from "@/app/actions/request";
import { AnswerSent } from "@/components/AnswerSent";
import { Avatar } from "@/components/Avatar";
import { ChiliMeter } from "@/components/Chili";
import { useT } from "@/components/editors/shared";
import { CheckGlyph, Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { TornTape } from "@/components/TornTape";

const INITIAL: AnswerState = { sent: false, savedMine: false, error: null };

/**
 * 한 질문만 묻는 링크의 답하는 화면(로그인 없이): 질문 하나와 보기 칩, 보기에 없는 답은 직접 적기(음료·꽃·향·음악·영화).
 * 고른 값이 물어본 사람 기록의 그 칸에 들어간다(오늘의 질문과 같은 칸)
 */
export function AnswerQuestion({
  locale,
  token,
  from,
  fromAvatar,
  message,
  question: id,
  signedIn,
  submit,
}: {
  locale: Locale;
  token: string;
  from: string;
  fromAvatar: AvatarConfig | null;
  message: string;
  question: DailyQuestion["id"];
  signedIn: boolean;
  submit: (prev: AnswerState, form: FormData) => Promise<AnswerState>;
}) {
  const t = useT(locale);
  const question = QUESTIONS.find((x) => x.id === id)!;
  const own = canAnswerOwn(id);
  const [picked, setPicked] = useState("");
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState(submit, INITIAL);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (writing) input.current?.focus();
  }, [writing]);

  if (state.sent) return <AnswerSent locale={locale} from={from} topics={[QUESTION_SECTION[id]]} signedIn={signedIn} savedMine={false} />;

  // 직접 적는 중이면 적은 말, 아니면 고른 보기
  const value = writing ? text.trim() : picked;
  const spicy = id === "spicy";

  return (
    <form action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="question" value={id} />
      <input type="hidden" name="value" value={value} />

      <section className="relative flex flex-col gap-5 px-5 pt-8">
        <div className="flex items-center gap-4">
          <figure className="m-0 shrink-0 -rotate-[4deg] border border-edge bg-white px-[5.4px] pb-[16.2px] pt-[5.4px]">
            <span className="flex h-[72.9px] w-[72.9px] items-center justify-center overflow-hidden bg-white">
              {fromAvatar ? <Avatar config={fromAvatar} size={66} label={from} decorative /> : <Mascot pose={6} size={70} />}
            </span>
          </figure>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <h1 className="hand-written !font-normal text-[23.5px] leading-[1.2]">{t("answer.titleOne", { from })}</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/30 bg-paper px-2.5 py-[3px] text-[11.7px]">
              <Icon name="lock" size={13} strokeWidth={1.9} className="shrink-0" />
              {t("answer.onlyFrom", { from })}
            </span>
          </div>
        </div>
        {message ? <p className="-rotate-[0.6deg] whitespace-pre-line rounded-[3.2px_3.2px_13px_3.2px] border border-edge bg-[#fff3b0] px-3.5 py-2.5 hand-written text-[18.6px] leading-[1.3]">{message}</p> : null}
      </section>

      <section className="card relative mx-4 mt-9 flex flex-col gap-4 px-3.5 pb-4 pt-3.5">
        <TornTape color="mint" w={66} h={21} rotate={6} className="-top-3 right-6" />
        <h2 className="hand-written !font-normal text-[25px] leading-[1.25]">{question.prompt[locale]}</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label={question.prompt[locale]}>
          {question.options.map((o) => {
            const on = !writing && picked === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setWriting(false);
                  setPicked(on ? "" : o.value);
                }}
                className={`relative inline-flex items-center justify-center gap-1.5 rounded-xl border border-edge px-4 text-[14.4px] before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] ${spicy ? "min-h-11 flex-col gap-0 py-1" : "h-11 whitespace-nowrap"} ${on ? "bg-sky" : "bg-white"}`}
              >
                {on && !spicy ? <CheckGlyph /> : null}
                {o.label[locale]}
                {spicy ? <ChiliMeter level={Number(o.value)} size={14} /> : null}
              </button>
            );
          })}
          {own ? (
            <button
              type="button"
              aria-pressed={writing}
              onClick={() => {
                setWriting(!writing);
                setPicked("");
              }}
              className={`relative inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 text-[14.4px] before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] ${writing ? "border-edge bg-sky" : "border-edge bg-transparent"}`}
            >
              <Icon name="pencil" size={16} strokeWidth={1.9} />
              {t("answer.own")}
            </button>
          ) : null}
        </div>
        {writing ? (
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={60}
            enterKeyHint="send"
            aria-label={t("answer.own")}
            placeholder={t("answer.own")}
            className="hand-written h-11 w-full min-w-0 rounded-none border-0 border-b border-dashed border-ink/30 bg-transparent p-0 text-[20px] outline-none placeholder:font-sans placeholder:text-[13.5px] placeholder:text-muted focus:border-edge"
          />
        ) : null}
        <span className="text-[10.8px] leading-[1.45] text-muted">{t("answer.footer", { from })}</span>
      </section>

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {state.error ? (
          <p role="alert" className="px-1 text-[12.6px] text-red">
            {t(state.error === "closed" ? "accept.expired" : state.error === "self" ? "answer.self" : state.error === "empty" ? "answer.needOne" : "common.error")}
          </p>
        ) : null}
        <button disabled={pending || !value} className="btn-primary !min-h-[45px] w-full !text-[19.4px]">
          {t("answer.send")}
        </button>
      </div>
    </form>
  );
}
