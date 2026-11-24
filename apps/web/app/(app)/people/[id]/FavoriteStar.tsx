"use client";

import { useState, useTransition } from "react";
import { setFavorite } from "@/app/actions/people";

// 사람들 목록 줄·즐겨찾기 제목의 분홍 하트와 같은 모양(조금 더 크게)
const HEART = "M12 20.5s-8-4.9-8-10.8a4.6 4.6 0 0 1 8-3.1 4.6 4.6 0 0 1 8 3.1c0 5.9-8 10.8-8 10.8z";

/** 사람 화면 오른쪽 위 하트(··· 왼쪽): 누르면 즐겨찾기(사람들 즐겨찾기 칸에 모인다, 켜면 분홍으로 채움). 프로필(얼굴·이름) 쪽에는 두지 않는다 */
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
        <path d={HEART} fill={on ? "#E8627C" : "none"} stroke="#1F2340" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
