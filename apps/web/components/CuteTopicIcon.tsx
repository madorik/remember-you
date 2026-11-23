import type { Section } from "@readme/core";
import { u } from "@/lib/ui-scale";

// 물어보기 항목 아이콘(귀여운 스티커 모양): 24 그리드, 남색 1.4 둥근 선 + 파스텔 칠, 연한 동그라미 바탕 위에.
// 지금은 물어보기 화면(/request)의 '무엇을 물어볼까요?'에서만 쓴다(다른 화면은 SectionIcon)
const N = "#1F2340";
const S = { stroke: N, strokeWidth: 1.4, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** 항목마다 연한 동그라미 바탕 */
const BG: Record<Section, string> = {
  dates: "#FFF6DA",
  safety: "#FFEDEE",
  taste: "#EAF4FD",
  gifts: "#FDEBF0",
  sizes: "#EAF2FC",
  favorites: "#FDEEF3",
  culture: "#FFF6DC",
  life: "#FFF1E0",
  pets: "#FDF0E6",
};

function Art({ section }: { section: Section }) {
  switch (section) {
    case "dates":
      // 딸기 케이크 + 초
      return (
        <>
          <rect x="4" y="11.5" width="16" height="8.5" rx="2.2" fill="#FFE7A3" {...S} />
          <path d="M4 14.2c1.6 1.5 3.1 1.5 4 0 .9 1.5 2.5 1.5 4 0 1.5 1.5 3.1 1.5 4 0 .9 1.5 2.4 1.5 4 0v-.5a2.2 2.2 0 0 0-2.2-2.2H6.2A2.2 2.2 0 0 0 4 13.7z" fill="#F7B6C6" {...S} />
          <rect x="11" y="6.6" width="2" height="4.9" rx=".8" fill="#FFFFFF" {...S} />
          <path d="M12 2.6c1.3 1.3 1.6 2.6.2 3.6-1.4-1-1.2-2.3-.2-3.6z" fill="#FFB347" {...S} />
          <circle cx="8" cy="17.2" r=".9" fill="#E2546E" />
          <circle cx="16" cy="17.2" r=".9" fill="#E2546E" />
        </>
      );
    case "safety":
      // 둥근 경고 삼각형(연분홍)
      return (
        <>
          <path d="M10.3 4.2a2 2 0 0 1 3.4 0l7.4 12.9A2 2 0 0 1 19.4 20H4.6a2 2 0 0 1-1.7-2.9z" fill="#FFD3D6" {...S} />
          <path d="M12 9v4.6" stroke="#C8283A" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16.6" r="1.15" fill="#C8283A" />
        </>
      );
    case "taste":
      // 김 나는 밥그릇 + 젓가락
      return (
        <>
          <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" fill="#BFDDF7" {...S} />
          <path d="M5.4 11.5c.6-2.4 3.3-3.6 6.6-3.6s6 1.2 6.6 3.6z" fill="#FFFFFF" {...S} />
          <path d="M3.5 11.5h17" {...S} />
          <path d="M16.5 3.2l3.2 7.4M18.4 2.8l2.4 7.6" {...S} />
          <path d="M8.6 5.6c-.7.8.5 1.5-.2 2.3M11.2 4.8c-.7.8.5 1.5-.2 2.3" stroke={N} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </>
      );
    case "gifts":
      // 분홍 상자 + 망고 리본
      return (
        <>
          <rect x="4" y="10" width="16" height="10.5" rx="1.8" fill="#F9C4D1" {...S} />
          <rect x="3" y="7.4" width="18" height="3.6" rx="1.2" fill="#FBD3DD" {...S} />
          <path d="M12 7.4v13.1" stroke="#FFC23D" strokeWidth="2.4" />
          <path d="M12 7.2c-1.7-3.4-5.5-3.6-5.5-1.3 0 1.4 3 1.3 5.5 1.3zM12 7.2c1.7-3.4 5.5-3.6 5.5-1.3 0 1.4-3 1.3-5.5 1.3z" fill="#FFC23D" {...S} />
        </>
      );
    case "sizes":
      // 하늘색 티셔츠
      return (
        <>
          <path d="M8.2 3.8 3.4 6.9l2 3.6 2-1V20h9.2V9.5l2 1 2-3.6-4.8-3.1c-.8 1.6-2.2 2.5-3.8 2.5s-3-.9-3.8-2.5z" fill="#CFE3FA" {...S} />
          <path d="M10 14.5h4M10 17h2.6" stroke={N} strokeWidth="1.2" strokeLinecap="round" />
        </>
      );
    case "favorites":
      // 튤립 한 송이
      return (
        <>
          <path d="M12 21v-8" {...S} />
          <path d="M12 17.5c-2.6-.2-4.4-1.5-5-3.8 2.6-.2 4.3 1 5 3.8zM12 18.6c2.4-.3 4-1.6 4.5-3.6-2.3-.1-3.9 1-4.5 3.6z" fill="#9FD8BC" {...S} />
          <path d="M7.6 6.4c1.2 1.4 2.6 1.5 4.4.2 1.8 1.3 3.2 1.2 4.4-.2.6 3.3-1.2 6.6-4.4 6.6S7 9.7 7.6 6.4z" fill="#F7A8C0" {...S} />
          <path d="M12 6.6c-.9-1.4-1-2.7 0-3.8 1 1.1.9 2.4 0 3.8z" fill="#F7A8C0" {...S} />
        </>
      );
    case "culture":
      // 팝콘 통(빨강 줄무늬)
      return (
        <>
          <path d="M5.5 10h13l-1.6 10.2a1.4 1.4 0 0 1-1.4 1.2h-7a1.4 1.4 0 0 1-1.4-1.2z" fill="#FFFFFF" {...S} />
          <path d="M9 10.2l.6 11M15 10.2l-.6 11" stroke="#E2546E" strokeWidth="2" />
          <path d="M5.5 10h13l-1.6 10.2a1.4 1.4 0 0 1-1.4 1.2h-7a1.4 1.4 0 0 1-1.4-1.2z" fill="none" {...S} />
          <path d="M6 10c-1-1.6.2-3.4 1.9-2.9.1-1.9 2.4-2.6 3.4-1.1 1-1.6 3.4-1.1 3.5.9 1.8-.6 3.2 1.4 2 3.1z" fill="#FFF1B8" {...S} />
        </>
      );
    case "life":
      // 살구색 여행 가방 + 하트 스티커
      return (
        <>
          <rect x="3.5" y="7.5" width="17" height="12.5" rx="2.2" fill="#FFD9A8" {...S} />
          <path d="M9 7.5V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6v1.9" fill="none" {...S} />
          <path d="M7.5 7.5v12.5M16.5 7.5v12.5" stroke={N} strokeWidth="1.2" strokeOpacity=".5" />
          <path d="M12 16.4s-2.2-1.3-2.2-2.8a1.15 1.15 0 0 1 2.2-.5 1.15 1.15 0 0 1 2.2.5c0 1.5-2.2 2.8-2.2 2.8z" fill="#F27A93" stroke={N} strokeWidth="1" />
        </>
      );
    case "pets":
      // 강아지 발바닥
      return (
        <>
          <ellipse cx="6.6" cy="10.4" rx="1.9" ry="2.3" fill="#F4C9A8" {...S} />
          <ellipse cx="10.2" cy="6.6" rx="1.9" ry="2.4" fill="#F4C9A8" {...S} />
          <ellipse cx="14.4" cy="6.6" rx="1.9" ry="2.4" fill="#F4C9A8" {...S} />
          <ellipse cx="17.8" cy="10.4" rx="1.9" ry="2.3" fill="#F4C9A8" {...S} />
          <path d="M12.2 11.6c-3.1 0-5.6 3.1-5.6 5.3 0 1.7 1.4 2.5 2.9 2.5 1.2 0 1.8-.6 2.7-.6s1.6.6 2.8.6c1.5 0 2.9-.8 2.9-2.5 0-2.2-2.6-5.3-5.7-5.3z" fill="#F7B08A" {...S} />
        </>
      );
  }
}

/** 항목의 귀여운 아이콘. size는 동그라미 지름(px, 90% 배율은 안에서), 그림은 그 안에 3/4 크기로 */
export function CuteTopicIcon({ section, size = 40 }: { section: Section; size?: number }) {
  const box = u(size);
  const art = Math.round(box * 0.75 * 10) / 10;
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full" style={{ width: box, height: box, background: BG[section] }}>
      <svg viewBox="0 0 24 24" width={art} height={art} className="block">
        <Art section={section} />
      </svg>
    </span>
  );
}
