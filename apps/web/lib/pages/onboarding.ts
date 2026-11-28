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
  const h = await headers();
  // 첫 메모를 저장하는 서버 동작(저장 · 이어서 정리)이 응답과 함께 이 화면을 다시 그릴 때는 보내지 않는다: 저장은 온보딩을 끝내 두었지만, 저장 카드(정리하는 과정)가 떠 있는 동안
  // 화면이 홈으로 넘어가면 안 된다(카드의 단추로 간다). 서버 동작 요청에는 next-action 헤더가 붙는다. 그냥 연 사람만 보낸다
  if (s.profile.onboardedAt && !h.get("next-action")) redirect(next);
  // 아직 기기 시간대를 프로필에 남기기 전이라(첫 메모를 저장할 때 남긴다) 날짜 머리의 오늘은 접속한 곳의 시간대로(Vercel이 알려 준다), 없으면 프로필 시간대
  const zone = safeDecode(h.get("x-vercel-ip-timezone"));
  const people = (await listPeopleLite(s)).map((p) => ({ id: p.contactId, name: p.name, tag: p.nickname && p.nickname !== p.name ? p.nickname : "", avatar: p.avatar }));
  return { locale: s.profile.locale, today: todayIn(zone || s.profile.timeZone), people, next };
}
