"use client";

import { useState } from "react";
import { Icon } from "@/components/marks";
import { ShareTextButton } from "@/components/ShareButtons";

/** 메뉴 고르기·선물 고르기 아래 공유하기. named가 있으면 "이름도 같이" 칸을 보여 준다 */
export function ShareBar({ plain, named, label, doneLabel, namesLabel }: { plain: string; named?: string; label: string; doneLabel: string; namesLabel?: string }) {
  const [withNames, setWithNames] = useState(false);
  return (
    <div className="bottom-bar mt-auto flex items-center justify-between gap-3 bg-bg/95 px-4 pt-3 backdrop-blur">
      {named && namesLabel ? (
        <button type="button" aria-pressed={withNames} onClick={() => setWithNames(!withNames)} className="flex min-h-11 shrink-0 items-center gap-2 text-[11.7px]">
          <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-[4.5px] border border-edge ${withNames ? "bg-sky" : "bg-white"}`}>
            {withNames ? <Icon name="check" size={12} strokeWidth={2.6} /> : null}
          </span>
          {namesLabel}
        </button>
      ) : (
        <span />
      )}
      <ShareTextButton
        key={String(withNames)}
        text={withNames && named ? named : plain}
        label={label}
        doneLabel={doneLabel}
        icon={<Icon name="share" size={17} strokeWidth={1.7} />}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-edge bg-sky pl-3 pr-4 text-[13.5px]"
      />
    </div>
  );
}
