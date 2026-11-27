import { translate } from "@readme/core";
import { headers } from "next/headers";
import { preload } from "react-dom";
import { AppTabBar } from "@/components/AppTabBar";
import { SPRITE_URL } from "@/components/Mascot";
import { NativeBridge } from "@/components/native";
import { ResumeRefresh } from "@/components/ResumeRefresh";
import { ReviewDays } from "@/components/ReviewAsk";
import { SwipeTabs } from "@/components/SwipeTabs";
import { aiConfigured } from "@/lib/ai";
import { listPeople, requireSession, todayFor } from "@/lib/data";
import { eventsFor } from "@/lib/events";
import { apnsConfigured, pushConfigured } from "@/lib/push";
import { holidayLocalReminders, localReminders } from "@/lib/reminders";

// 로그인 + 온보딩까지 마친 사람만. 앱이면 생일 알림 예약·앱 잠금을 붙인다
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // 캐릭터 스프라이트(사람 화면·빈 화면 등 곳곳에 나온다)를 미리 받아 둔다
  preload(SPRITE_URL, { as: "image", type: "image/webp" });
  const s = await requireSession();
  const { locale } = s.profile;
  // 앱 웹뷰(UA에 ReadmeApp)일 때만 알림 예약용 사람 목록을 읽는다: 웹 브라우저는 쓰지 않는 값이라 읽지 않는다
  const nativeUa = /ReadmeApp/.test((await headers()).get("user-agent") ?? "");
  // 설정에서 알림을 끄면 기기 로컬 알림도 예약하지 않는다(이미 예약된 것은 NativeBridge가 지운다)
  // 사람의 생일·기념일에 더해, 명절·챙기는 날(설날·추석·크리스마스 …)도 설정에서 켜 둔 사람에게는 같이 예약한다
  const today = todayFor(s.profile);
  const reminders =
    nativeUa && s.profile.pushEnabled
      ? [
          ...localReminders(eventsFor(await listPeople(s), today), s.profile.reminderOffsets, locale),
          ...(s.profile.holidayReminders ? holidayLocalReminders(today, s.profile.reminderOffsets, locale) : []),
        ]
      : [];
  return (
    <main className="screen !pb-0 overflow-x-clip" data-tabs="">
      {children}
      {/* 하단 메뉴는 어느 화면에서도 보인다(화면 틀에 한 번만) */}
      <AppTabBar locale={locale} voice={aiConfigured()} />
      <SwipeTabs />
      <ResumeRefresh />
      <ReviewDays />
      <NativeBridge
        locale={locale}
        appLock={s.profile.appLock}
        reminders={reminders}
        pushEnabled={pushConfigured() && s.profile.pushEnabled}
        iosPushEnabled={apnsConfigured() && s.profile.pushEnabled}
        nativeUa={nativeUa}
        labels={{ title: translate(locale, "lock.title"), appName: translate(locale, "app.name"), unlock: translate(locale, "lock.unlock") }}
      />
    </main>
  );
}
