import type { MetadataRoute } from "next";
import { BRAND } from "@readme/core";

// 홈 화면에 추가해 웹앱으로 쓰기(PWA). 아이폰은 홈 화면에 추가한 웹앱에서만 웹 푸시(브라우저 알림)를 받으므로, 이 파일이 있어야 설정에서 알림을 켤 수 있다.
// 이 주소(/manifest.webmanifest)는 로그인 없이 열려야 해서 proxy.ts 제외 목록에 있다(manifest로 시작하는 주소). 한국어 하나로 둔다(정적 파일이라 사람마다 언어를 바꿀 수 없다)
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.ko.name,
    short_name: BRAND.ko.name,
    description: BRAND.ko.tagline,
    lang: "ko",
    // 로그인 안 한 사람은 proxy가 시작 화면으로 보낸다(?next로 /home을 기억)
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffdf8",
    theme_color: "#fffdf8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
