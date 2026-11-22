"use client";

import { androidIntentUrl } from "@/lib/app-link";

/**
 * 앱 받기 링크(/get…): 안드로이드에서는 앱이 깔려 있으면 앱을 열고(appPath 화면으로), 없으면 같은 /get 주소로 간다(Chrome이 fallback으로 보낸다).
 * 아이폰·PC는 그냥 /get으로 간다(아이폰은 App Store, 앱이 있으면 거기서 '열기'). 아이폰에서 앱 주소를 먼저 시험해 보면
 * 앱이 없는 사람(이 화면을 보는 대부분)에게 '주소가 올바르지 않다'는 오류 창이 먼저 떠서 쓰지 않는다.
 * 스크립트가 안 돌아도 href가 그대로 /get이라 길은 막히지 않는다
 */
export function GetAppLink({ href, appPath, className, children }: { href: string; appPath: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (!/Android/i.test(navigator.userAgent)) return;
        e.preventDefault();
        window.location.href = androidIntentUrl(appPath, new URL(href, window.location.origin).toString());
      }}
    >
      {children}
    </a>
  );
}
