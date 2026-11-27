"use client";

import type { Locale } from "@readme/core";
import { usePathname } from "next/navigation";
import { TabBar } from "@/components/chrome";
import { useT } from "@/components/editors/shared";
import { personOf } from "@/lib/person-path";

/** 지금 화면이 속한 탭(안쪽 화면은 그 탭 아래, 어느 탭에도 안 속하면 아무것도 켜지 않는다) */
export function tabOf(path: string): "home" | "people" | "me" | "privacy" | null {
  if (path === "/home" || path.startsWith("/calendar")) return "home";
  if (path.startsWith("/people")) return "people";
  if (path.startsWith("/me")) return "me";
  if (path.startsWith("/privacy")) return "privacy";
  return null;
}

/**
 * 하단 메뉴: 앱 화면 틀((app) 레이아웃)에 한 번만 붙어서 어느 화면으로 가도 그대로 있다.
 * 켜진 탭과 가운데 메모 단추의 도착지(사람 화면이면 그 사람)만 지금 주소를 따라 바뀐다. 아래 단추 줄(.bottom-bar)은 이 막대 바로 위에 얹힌다(globals.css의 .screen[data-tabs]).
 */
export function AppTabBar({ locale, voice }: { locale: Locale; voice: boolean }) {
  const t = useT(locale);
  const path = usePathname();
  // 사람 화면에서는 가운데 메모 단추가 그 사람에게 적는 메모 쓰기(/voice?to=)로 간다
  return <TabBar active={tabOf(path)} t={t} voice={voice} voiceTo={personOf(path)} />;
}
