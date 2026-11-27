import "server-only";
import { todayIn } from "@readme/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { listPeopleLite, requireSession } from "@/lib/data";
import { safeNext } from "@/lib/site";
import type { PageInput } from "./routes";
import type { OnboardingData } from "./types";

// 처음 화면: 첫 메모 하나(/onboarding). 이미 마친 사람은 가려던 곳으로 보낸다

function safeDecode(v: string | null): string {
  try {
    return v ? decodeURIComponent(v) : "";
  } catch {
    return "";
  }
}

export async function loadOnboarding({ searchParams }: PageInput): Promise<OnboardingData> {
  const next = safeNext(searchParams.next);
  const s = await requireSession({ onboarding: true });
  if (s.profile.onboardedAt) redirect(next);
  // 아직 기기 시간대를 프로필에 남기기 전이라(첫 메모를 저장할 때 남긴다) 날짜 머리의 오늘은 접속한 곳의 시간대로(Vercel이 알려 준다), 없으면 프로필 시간대
  const zone = safeDecode((await headers()).get("x-vercel-ip-timezone"));
  const people = (await listPeopleLite(s)).map((p) => ({ id: p.contactId, name: p.name, tag: p.nickname && p.nickname !== p.name ? p.nickname : "", avatar: p.avatar }));
  return { locale: s.profile.locale, today: todayIn(zone || s.profile.timeZone), people, next };
}
