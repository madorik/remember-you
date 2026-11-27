"use server";

import { track } from "@/lib/track";
import { isSection, sanitizeAvatar, sanitizeOffsets, type Section } from "@readme/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, writeSection } from "@/lib/data";
import { validTimeZone } from "@/lib/onboarding";

function json(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v ?? "null"));
  } catch {
    return null;
  }
}

/** 내 프로필(얼굴·이름) 저장: 내 리드미의 "얼굴 고치기"가 쓴다 */
export async function saveAvatar(form: FormData): Promise<void> {
  const s = await requireSession();
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const avatar = sanitizeAvatar(json(form.get("avatar")));
  const tz = form.get("tz") ? validTimeZone(form.get("tz")) : null;
  await s.tx((q) => q("update profiles set display_name = $2, avatar = $3, time_zone = coalesce($4, time_zone) where id = $1", [s.user.id, name, JSON.stringify(avatar), tz]));
  revalidatePath("/me");
  redirect("/me");
}

export interface SaveState {
  saved: boolean;
  error: boolean;
}

/** 내 리드미 항목 하나 저장 */
export async function saveSection(_: SaveState, form: FormData): Promise<SaveState> {
  const s = await requireSession();
  const section = form.get("section");
  if (!isSection(section)) return { saved: false, error: true };
  try {
    await s.tx((q) => writeSection(q, s.user.id, section as Section, json(form.get("data"))));
  } catch {
    return { saved: false, error: true };
  }
  track("me_save", { userId: s.user.id, source: section as string });
  revalidatePath("/me");
  revalidatePath("/me/edit");
  revalidatePath("/home");
  return { saved: true, error: false };
}

/** 생일 알림 시점(공유 관리에서) */
export async function saveOffsets(form: FormData): Promise<void> {
  const s = await requireSession();
  await s.tx((q) => q("update profiles set reminder_offsets = $2 where id = $1", [s.user.id, sanitizeOffsets(json(form.get("offsets")))]));
  revalidatePath("/privacy");
}
