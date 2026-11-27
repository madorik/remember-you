"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";

const SHOW_MS = 4200;

/**
 * 온보딩에서 첫 메모를 저장하고 이 화면으로 왔을 때(?welcome=1) 한 번만 뜨는 알림: 캐릭터와 "○○ 메모장이 생겼어요".
 * 주소의 welcome은 바로 지운다(새로 고침해도 다시 뜨지 않게). 알림 영역(role=status)은 늘 달아 두고 그 안에 나타나야 스크린리더가 읽어 준다
 */
export function WelcomeToast({ text }: { text: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const welcome = useSearchParams().get("welcome") === "1";
  // 처음 그릴 때 주소에 welcome이 있었으면 뜬다(주소를 지워도 이 값은 그대로, 시간이 지나면 걷는다)
  const [open, setOpen] = useState(welcome);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!welcome) return;
    const q = new URLSearchParams(window.location.search);
    q.delete("welcome");
    router.replace(q.size ? `${pathname}?${q}` : pathname);
  }, [welcome, pathname, router]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setOn(true));
    const timer = window.setTimeout(() => setOpen(false), SHOW_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4" style={{ bottom: "calc(var(--above-tab) + 14px)" }}>
      {open ? (
        <div
          className={`flex items-center gap-[7.2px] whitespace-nowrap rounded-full bg-ink text-[12.6px] text-white shadow-[0_9px_16px_-9px_rgb(31_35_64/0.6)] motion-safe:transition-[opacity,transform] motion-safe:duration-200 ${on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          style={{ height: "39.6px", padding: "0 16.2px 0 7.2px" }}
        >
          <Mascot pose={4} size={25} />
          {text}
        </div>
      ) : null}
    </div>
  );
}
