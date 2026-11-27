import { redirect } from "next/navigation";
import { safeNext } from "@/lib/site";

// 예전 온보딩 단계 주소(/onboarding/avatar · food · birthday)는 첫 메모(/onboarding)로. 가려던 곳(?next)은 그대로 이어 간다
export default async function OldOnboardingStep({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  redirect(next !== "/home" ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
}
