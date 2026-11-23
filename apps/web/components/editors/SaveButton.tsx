"use client";

import { useFormStatus } from "react-dom";

/** 머리 줄 오른쪽 '저장' 알약(시안): 망고 + 남색 선 + 손글씨. 감싼 form을 보낸다 */
export function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="hand flex h-9 items-center rounded-full border-[1.5px] border-ink bg-sky px-4 text-[23px] leading-none active:translate-y-px disabled:opacity-60">
      {label}
    </button>
  );
}
