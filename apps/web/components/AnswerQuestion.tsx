"use client";

import { QUESTIONS, QUESTION_SECTION, canAnswerOwn, type AvatarConfig, type DailyQuestion, type Locale } from "@readme/core";
import { useActionState, useEffect, useRef, useState } from "react";
import type { AnswerState } from "@/app/actions/request";
import { AnswerSent } from "@/components/AnswerSent";
import { AnswerIntro } from "@/components/AnswerIntro";
import { ChiliMeter } from "@/components/Chili";
import { CircleOption, UNDERLINE_INPUT, useT } from "@/components/editors/shared";
import { Icon } from "@/components/marks";
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

      <AnswerIntro title={t("answer.titleOne", { from })} from={from} fromAvatar={fromAvatar} message={message} onlyFrom={t("answer.onlyFrom", { from })} />

      <section className="card relative mx-4 mt-3.5 flex flex-col gap-3.5 px-3.5 pb-3.5 pt-3">
        <TornTape color="mint" w={66} h={21} rotate={6} className="-top-3 right-6" />
        <h2 className="hand scribble self-start text-[19.4px] leading-[1.3]" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
          {question.prompt[locale]}
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label={question.prompt[locale]}>
          {question.options.map((o) => {
            const on = !writing && picked === o.value;
            const pick = () => {
              setWriting(false);
              setPicked(on ? "" : o.value);
            };
            return spicy ? (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={pick}
                className={`relative inline-flex min-h-9 flex-col items-center justify-center rounded-xl border border-edge px-3 py-1 text-[12.6px] before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] ${on ? "bg-sky" : "bg-white"}`}
              >
                {o.label[locale]}
                <ChiliMeter level={Number(o.value)} size={14} />
              </button>
            ) : (
              <CircleOption key={o.value} label={o.label[locale]} on={on} onToggle={pick} />
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
              className={`relative inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-dashed px-3 text-[12.6px] before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] ${writing ? "border-edge bg-sky" : "border-ink/30 bg-transparent text-muted"}`}
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
            className={`${UNDERLINE_INPUT} h-10`}
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
        <button disabled={pending || !value} className="btn-primary w-full">
          {t("answer.send")}
        </button>
      </div>
    </form>
  );
}
