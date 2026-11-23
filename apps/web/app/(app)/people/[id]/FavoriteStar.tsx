"use client";

import { useState, useTransition } from "react";
import { setFavorite } from "@/app/actions/people";

const STAR = "M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z";

/** 사람 화면 오른쪽 위 별(··· 왼쪽): 누르면 즐겨찾기(사람들 맨 위에 고정, 켜면 망고). 프로필(얼굴·이름) 쪽에는 두지 않는다 */
export function FavoriteStar({ contactId, initial, label }: { contactId: string; initial: boolean; label: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await setFavorite(contactId, next);
          if (!r.ok) setOn(!next);
        });
      }}
      className="relative flex h-11 w-11 before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center active:scale-95"
    >
      <svg aria-hidden="true" width={25} height={25} viewBox="0 0 24 24">
        <path d={STAR} fill={on ? "#FFC23D" : "none"} stroke="#1F2340" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
