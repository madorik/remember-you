"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ORGANIZING_EVENT, ORGANIZING_KEY, parseOrganizing, refreshDelays } from "@/lib/organizing";

/**
 * 메모를 고쳐 다시 정리를 시작했을 때(markOrganizing이 남기는 표시·보내는 이벤트): AI 정리(고친 응답 뒤에 돈다)가 끝날 즈음 화면을 몇 번 다시 받아 와 "기억해 둔 것"에 바로 나타나게 한다.
 * 새 메모를 저장할 때는 저장 카드가 정리를 끝까지 기다리므로 이 표시를 남기지 않는다(그 길에서는 하는 일이 없다).
 * 보는 칸·쓰던 것은 그대로 두고 데이터만 새로 받는다(router.refresh). 아무것도 그리지 않는다
 */
export function OrganizeRefresh({ contactId }: { contactId: string }) {
  const router = useRouter();
  useEffect(() => {
    let timers: number[] = [];
    const arm = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
      let at: number | null = null;
      try {
        at = parseOrganizing(sessionStorage.getItem(ORGANIZING_KEY), contactId);
      } catch {
        /* 저장소를 못 쓰면 건너뛴다 */
      }
      if (at == null) return;
      timers = refreshDelays(at, Date.now()).map((d) => window.setTimeout(() => router.refresh(), d));
    };
    arm();
    window.addEventListener(ORGANIZING_EVENT, arm);
    return () => {
      window.removeEventListener(ORGANIZING_EVENT, arm);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [contactId, router]);
  return null;
}
