"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/data";
import { markOnboarded } from "@/lib/onboarding";
import { safeNext } from "@/lib/site";
import { track } from "@/lib/track";

/** 온보딩 건너뛰기: 첫 메모 없이 온보딩을 마치고 가려던 곳(next, 없으면 홈)으로 */
export async function skipOnboarding(tz: string, next: string): Promise<void> {
  const s = await requireSession({ onboarding: true });
  if (!s.profile.onboardedAt) {
    await s.tx((q) => markOnboarded(q, s.user.id, tz));
    track("onboarding_skip", { userId: s.user.id });
  }
  redirect(safeNext(next));
}
