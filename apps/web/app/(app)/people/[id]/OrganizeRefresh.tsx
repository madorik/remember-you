"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ORGANIZING_KEY, parseOrganizing, refreshDelays } from "@/lib/organizing";

/**
 * 메모를 막 저장하고 이 사람 화면으로 왔을 때: AI 정리(저장 응답 뒤에 돈다)가 끝날 즈음 화면을 몇 번 다시 받아 와 "기억해 둔 것"에 바로 나타나게 한다.
 * 보는 칸·쓰던 것은 그대로 두고 데이터만 새로 받는다(router.refresh). 아무것도 그리지 않는다
 */
export function OrganizeRefresh({ contactId }: { contactId: string }) {
  const router = useRouter();
  useEffect(() => {
    let at: number | null = null;
    try {
      at = parseOrganizing(sessionStorage.getItem(ORGANIZING_KEY), contactId);
    } catch {
      /* 저장소를 못 쓰면 건너뛴다 */
    }
    if (at == null) return;
    const timers = refreshDelays(at, Date.now()).map((d) => window.setTimeout(() => router.refresh(), d));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [contactId, router]);
  return null;
}
