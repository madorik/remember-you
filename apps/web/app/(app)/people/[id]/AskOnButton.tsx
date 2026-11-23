"use client";

import { useState, useTransition } from "react";
import { setAskOff } from "@/app/actions/people";

/** '이 사람에 대해 다시 묻지 않기'를 한 사람 화면에만 보인다: 누르면 오늘의 질문을 다시 받는다 */
export function AskOnButton({ contactId, label }: { contactId: string; label: string }) {
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setAskOff(contactId, false);
          if (r.ok) setGone(true);
        })
      }
      className="pill !min-h-11 !px-4 !text-[14.4px] disabled:opacity-60"
    >
      {label}
    </button>
  );
}
