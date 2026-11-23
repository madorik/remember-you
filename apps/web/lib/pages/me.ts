import "server-only";
import { isSection } from "@readme/core";
import { notFound, redirect } from "next/navigation";
import { aiConfigured } from "@/lib/ai";
import { readCard, requireSession, todayFor } from "@/lib/data";
import type { PageInput } from "./routes";
import type { MeAvatarData, MeData, MeEditData, MeEditSectionData } from "./types";

/** 나: 내가 적어 둔 것 */
export async function loadMe({ searchParams }: PageInput): Promise<MeData> {
  // 예전 주소(/me?open=…)는 그 항목을 펼친 고치기 화면으로
  if (isSection(searchParams.open)) redirect(`/me/edit?open=${searchParams.open}`);
  const s = await requireSession();
  const { card } = await s.tx((q) => readCard(q, s.user.id));
  return { locale: s.profile.locale, name: s.profile.displayName, avatar: s.profile.avatar, card, today: todayFor(s.profile), ai: aiConfigured() };
}

/** 나에 대한 기록 고치기(open이면 그 항목을 펼쳐서) */
export async function loadMeEdit({ searchParams }: PageInput): Promise<MeEditData> {
  const s = await requireSession();
  const { card } = await s.tx((q) => readCard(q, s.user.id));
  return { locale: s.profile.locale, name: s.profile.displayName, avatar: s.profile.avatar, card, open: isSection(searchParams.open) ? searchParams.open : null };
}

/** 항목 하나 고치기 */
export async function loadMeEditSection({ params }: PageInput): Promise<MeEditSectionData> {
  const { section } = params;
  if (!isSection(section)) notFound();
  const s = await requireSession();
  const { card } = await s.tx((q) => readCard(q, s.user.id));
  return { locale: s.profile.locale, section, card };
}

/** 내 프로필(얼굴·이름) */
export async function loadMeAvatar(): Promise<MeAvatarData> {
  const s = await requireSession();
  const { card } = await s.tx((q) => readCard(q, s.user.id));
  return { locale: s.profile.locale, name: s.profile.displayName, avatar: s.profile.avatar, today: todayFor(s.profile), birthday: card.dates?.birthday ?? null };
}
