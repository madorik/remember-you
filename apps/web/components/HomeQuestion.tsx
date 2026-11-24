"use client";

import type { AvatarConfig } from "@readme/core";
import Link from "@/components/AppLink";
import { useEffect, useId, useRef, useState } from "react";
import { answerAbout, askAbout, muteAbout, skipAbout } from "@/app/actions/people";
import { Avatar } from "@/components/Avatar";
import { ChiliMeter } from "@/components/Chili";
import { CheckGlyph } from "@/components/marks";
import { Chev, TornTape } from "@/components/planner";

// 홈 '오늘의 질문' 3줄 카드(시안 P2-Home): 제목(민트 밑줄) + 물어보기 알약 + 건너뛰기 + ··· / 얼굴 + 질문 / 답 칩 + 연필 칩.
// 연필 칩을 누르면 직접 적는 칸이 열리고(음료·꽃·향·음악·영화), ···에는 '이 사람에 대해 다시 묻지 않기'가 있다.
// 답하기·건너뛰기·물어보기·그만 묻기는 서버 동작(app/actions/people.ts)이 하루 두 번까지 세고 홈으로 돌려보낸다.

export interface HomeQuestionProps {
  contactId: string;
  /** 질문 id(drinks, spicy …) */
  qid: string;
  /** 사람 이름을 넣은 질문 문장 */
  prompt: string;
  name: string;
  avatar: AvatarConfig | null;
  /** 고르는 보기('없음' 제외). chili는 매운맛 단계 */
  options: { value: string; label: string; chili?: number }[];
  noneValue: string | null;
  noneLabel: string;
  canOwn: boolean;
  labels: { title: string; ask: string; skip: string; more: string; mute: string; own: string; save: string };
}

export function HomeQuestion({ contactId, qid, prompt, name, avatar, options, noneValue, noneLabel, canOwn, labels }: HomeQuestionProps) {
  const [own, setOwn] = useState(false);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (own) input.current?.focus();
  }, [own]);

  // ··· 메뉴: 바깥을 누르거나 Esc면 닫는다
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const hidden = (
    <>
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="id" value={qid} />
    </>
  );
  const spicy = qid === "spicy";

  return (
    <section aria-label={labels.title} className="card relative mx-4 flex flex-col px-3.5 py-3">
      <TornTape color="mint" w={60} h={18} rotate={4} className="-top-[9.9px] left-1/2 -ml-[27px]" />
      <div className="flex h-8 items-center justify-between gap-1.5">
        <span className="hand scribble whitespace-nowrap text-[19.4px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
          {labels.title}
        </span>
        <div ref={box} className="relative flex items-center gap-0.5">
          <form action={askAbout}>
            {hidden}
            <button className="flex h-[27px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-edge bg-sky-soft pl-2 pr-[9.9px] text-[11.7px]">
              <svg viewBox="0 0 24 24" width="14.4" height="14.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <rect x="3" y="6" width="18" height="13" rx="2" fill="#F9CBD5" />
                <path d="M3.8 7l8.2 6.2L20.2 7" />
              </svg>
              {labels.ask}
            </button>
          </form>
          <form action={skipAbout}>
            {hidden}
            <button className="flex h-11 items-center gap-0.5 whitespace-nowrap pl-2 pr-0.5 text-[11.7px] text-muted">
              {labels.skip}
              <Chev size={13} />
            </button>
          </form>
          <button
            type="button"
            aria-label={labels.more}
            aria-expanded={menu}
            aria-controls={menu ? menuId : undefined}
            onClick={() => setMenu(!menu)}
            className="-mr-2 flex h-11 w-[27px] items-center justify-center"
          >
            <svg viewBox="0 0 24 24" width="16.2" height="16.2" aria-hidden="true">
              <circle cx="5" cy="12" r="1.6" fill="#5B5F78" />
              <circle cx="12" cy="12" r="1.6" fill="#5B5F78" />
              <circle cx="19" cy="12" r="1.6" fill="#5B5F78" />
            </svg>
          </button>
          {menu ? (
            <div id={menuId} className="absolute right-0 top-full z-30 mt-0.5 w-max max-w-[234px] overflow-hidden rounded-[9px] bg-paper py-0.5 shadow-[0_0_0_1px_var(--color-edge),0_12px_26px_-12px_rgb(31_35_64/0.5)]">
              <form action={muteAbout}>
                {hidden}
                <button className="flex min-h-11 w-full items-center px-4 text-left text-[13.5px]">{labels.mute}</button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-1.5">
        <Link href={`/people/${contactId}`} className="mt-px shrink-0">
          <Avatar config={avatar} size={22} label={name} decorative />
          <span className="sr-only">{name}</span>
        </Link>
        <p role="heading" aria-level={2} className="min-w-0 text-[13.5px] leading-6">
          {prompt}
        </p>
      </div>

      {/* 보기는 한 줄로 두고(카드를 3줄로 지킨다) 많으면 가로로 민다: 오른쪽 끝은 흐려진다. 끝까지 밀어도 화면(뒤로 가기 몸짓)이 따라 밀리지 않게 */}
      <form action={answerAbout} className="-mx-3.5 mt-2.5 flex gap-1.5 overflow-x-auto overscroll-x-contain px-3.5[-webkit-mask-image:linear-gradient(90deg,#000_calc(100%-18px),transparent)] [mask-image:linear-gradient(90deg,#000_calc(100%-18px),transparent)] [scrollbar-width:none]">
        {hidden}
        {options.map((o) => (
          <button
            key={o.value}
            name="value"
            value={o.value}
            className={`flex shrink-0 items-center justify-center rounded-xl border border-edge bg-white px-3 text-[12.6px] transition-transform active:scale-95 ${spicy ? "min-h-[34.2px] flex-col gap-0 py-1" : "h-[34.2px] whitespace-nowrap"}`}
          >
            {o.label}
            {/* 매운맛 질문은 고추 개수로도(값이 단계 0–4) */}
            {spicy && o.chili != null ? <ChiliMeter level={o.chili} size={14} /> : null}
          </button>
        ))}
        {noneValue ? (
          <button name="value" value={noneValue} aria-label={noneLabel} className="flex h-[34.2px] w-[34.2px] shrink-0 items-center justify-center rounded-xl border border-edge bg-white text-muted transition-transform active:scale-95">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16.2" height="16.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        ) : null}
        {canOwn ? (
          <button
            type="button"
            aria-label={labels.own}
            aria-expanded={own}
            onClick={() => setOwn(!own)}
            className="flex h-[34.2px] w-[34.2px] shrink-0 items-center justify-center rounded-xl border border-dashed bg-transparent"
            style={{ borderColor: "rgba(31,35,64,.30)" }}
          >
            <svg viewBox="0 0 24 24" width="16.2" height="16.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />
            </svg>
          </button>
        ) : null}
        <span aria-hidden="true" className="w-3 shrink-0" />
      </form>

      {/* 보기에 없는 답은 직접(음료·꽃·향·음악·영화) */}
      {canOwn && own ? (
        <form action={answerAbout} className="mt-2 flex items-center gap-2">
          {hidden}
          <input
            ref={input}
            name="value"
            required
            maxLength={60}
            enterKeyHint="send"
            placeholder={labels.own}
            aria-label={labels.own}
            className="hand-written h-[34.2px] min-w-0 flex-1 border-0 border-b border-dashed border-edge bg-transparent px-0.5 text-[17.8px] placeholder:text-muted"
          />
          <button aria-label={labels.save} className="flex h-[34.2px] w-[34.2px] shrink-0 items-center justify-center rounded-full border border-edge bg-white active:scale-95">
            <CheckGlyph size={18} />
          </button>
        </form>
      ) : null}
    </section>
  );
}
