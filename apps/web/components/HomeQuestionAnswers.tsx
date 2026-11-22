"use client";

import { useState } from "react";
import { answerAbout } from "@/app/actions/people";
import { ChiliMeter } from "@/components/Chili";
import { CheckGlyph, Icon } from "@/components/marks";

/**
 * 오늘의 질문 카드의 보기 칩 한 줄: 고를 수 있는 칩 → (직접 적을 수 있는 질문이면) 점선 연필 칩 → (없음이 있으면) 아이콘 칩.
 * 연필 칩을 누르면 칩 줄 아래에 직접 적는 칸이 열린다(한 화면에 들어가게 평소엔 접어 둔다)
 */
export function HomeQuestionAnswers({
  contactId,
  questionId,
  options,
  none,
  canOwn,
  labels,
}: {
  contactId: string;
  questionId: string;
  options: { value: string; label: string }[];
  none: { value: string; label: string } | null;
  canOwn: boolean;
  labels: { own: string; save: string };
}) {
  const [open, setOpen] = useState(false);
  const spicy = questionId === "spicy";
  const small = "relative before:absolute before:-inset-y-1.5 before:inset-x-0";
  return (
    <>
      <form action={answerAbout} className="mt-1.5 flex flex-wrap gap-[5px]">
        <input type="hidden" name="contactId" value={contactId} />
        <input type="hidden" name="id" value={questionId} />
        {options.map((o) => (
          <button key={o.value} name="value" value={o.value} className={`chip ${small} transition-transform hover:bg-sky-soft active:scale-95 ${spicy ? "!flex-col !gap-0 !py-1" : ""} !min-h-[34px] !px-[8px] !text-[15.5px]`}>
            {o.label}
            {/* 매운맛 질문은 고추 개수로도(값이 단계 0–4) */}
            {spicy ? <ChiliMeter level={Number(o.value)} size={15} /> : null}
          </button>
        ))}
        {canOwn ? (
          <button
            type="button"
            aria-label={labels.own}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`${small} flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-ink bg-white transition-transform active:scale-95 ${open ? "!bg-sky-soft" : ""}`}
          >
            <Icon name="pencil" size={16} strokeWidth={2} />
          </button>
        ) : null}
        {none ? (
          <button name="value" value={none.value} aria-label={none.label} className={`${small} flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white text-muted shadow-[inset_0_0_0_1.5px_var(--color-ink)] transition-transform hover:bg-sky-soft active:scale-95`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </form>
      {canOwn && open ? (
        <form action={answerAbout} className="mt-1.5 flex items-center gap-2">
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="id" value={questionId} />
          <input
            name="value"
            required
            autoFocus
            maxLength={60}
            enterKeyHint="send"
            placeholder={labels.own}
            aria-label={labels.own}
            className="h-11 min-w-0 flex-1 border-0 border-b-[1.5px] border-dashed border-ink bg-transparent px-0.5 text-[18px] placeholder:text-muted"
          />
          <button aria-label={labels.save} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_var(--color-ink)] active:scale-95">
            <CheckGlyph size={20} />
          </button>
        </form>
      ) : null}
    </>
  );
}
