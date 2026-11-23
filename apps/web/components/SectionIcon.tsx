import type { Section } from "@readme/core";
import { u } from "@/lib/ui-scale";

// 항목 아이콘(플래너 시안): 남색 가는 선 그림을 연한 색 타일(남색 1.5px 선, 모서리 둥근 네모) 위에
const INK = "#1F2340";

/** 항목마다 연한 색 타일(받은 항목 목록의 칸 바탕도 같은 색) */
export const SECTION_TILE: Record<Section, string> = {
  dates: "#FFF4D6",
  safety: "#FDE3E5",
  taste: "#FFF4D6",
  gifts: "#FBE1E8",
  sizes: "#E4ECFA",
  favorites: "#F1ECFD",
  culture: "#E3F4EC",
  life: "#FFF4D6",
  pets: "#E3F4EC",
};

/** 케이크 한 조각(사람 화면 시안의 생일 그림): 프로필 카드 생일 줄과 '생일과 기념일' 항목 타일이 같이 쓴다 */
export const CAKE_ART = (
  <>
    <path d="M4 20.5h16M5.5 20.5v-6.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v6.5" />
    <path d="M5.5 16c1.2 1 2.6 1 3.8 0s2.6-1 3.8 0 2.6 1 3.8 0" />
    <path d="M12 12.5V9.5M12 6.5c-.9-1 .1-2.2 0-3 1 .9 1.4 2.3 0 3z" />
  </>
);

function Art({ section, cake }: { section: Section; cake: boolean }) {
  switch (section) {
    case "dates":
      if (cake) return CAKE_ART;
      // 달력
      return (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </>
      );
    case "safety":
      // 주의 삼각형
      return (
        <>
          <path d="M12 4 L21 19.5 H3 Z" />
          <path d="M12 10v4.5M12 17.2v.3" />
        </>
      );
    case "taste":
      // 김 나는 밥그릇
      return (
        <>
          <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
          <path d="M9 4.5c-1 1.2 1 2.3 0 3.5M13 4.5c-1 1.2 1 2.3 0 3.5" />
        </>
      );
    case "gifts":
      // 리본 맨 선물 상자
      return (
        <>
          <rect x="4" y="10.5" width="16" height="10" rx="1.6" />
          <rect x="3" y="7" width="18" height="3.5" rx="1.2" />
          <path d="M12 7v13.5" />
          <path d="M12 7c-1.6-3.2-5.4-3.6-5.4-1.3C6.6 7 9.6 7 12 7zM12 7c1.6-3.2 5.4-3.6 5.4-1.3C17.4 7 14.4 7 12 7z" />
        </>
      );
    case "sizes":
      // 티셔츠
      return <path d="M8 4l-4.5 3 2 3.5L7.5 9.5V20h9V9.5l2 1 2-3.5L16 4c-.8 1.6-2.2 2.5-4 2.5S8.8 5.6 8 4z" />;
    case "favorites":
      // 꽃
      return (
        <>
          <circle cx="12" cy="6.5" r="2.6" />
          <circle cx="16.6" cy="9.8" r="2.6" />
          <circle cx="14.8" cy="15" r="2.6" />
          <circle cx="9.2" cy="15" r="2.6" />
          <circle cx="7.4" cy="9.8" r="2.6" />
        </>
      );
    case "culture":
      // 음표
      return (
        <>
          <path d="M9 18V6l10-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
        </>
      );
    case "life":
      // 가방
      return (
        <>
          <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
          <path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17" />
        </>
      );
    case "pets":
      // 발바닥
      return (
        <>
          <circle cx="7" cy="10" r="1.8" />
          <circle cx="10.5" cy="6.5" r="1.8" />
          <circle cx="14.5" cy="6.5" r="1.8" />
          <circle cx="18" cy="10" r="1.8" />
          <path d="M12 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.3 2.3 2.8 2.3 1.2 0 1.8-.6 2.7-.6s1.5.6 2.7.6c1.5 0 2.8-.7 2.8-2.3C17.5 15 15 12 12 12z" />
        </>
      );
  }
}

/** bare: 타일 없이 그림만(받은 것 목록처럼 바탕이 따로 있을 때). round: 동그란 타일. cake: 생일과 기념일을 달력 대신 케이크로(사람 화면) */
export function SectionIcon({ section, size: sizeIn = 44, round = false, bare = false, cake = false }: { section: Section; size?: number; round?: boolean; outline?: boolean; bare?: boolean; cake?: boolean }) {
  const size = u(sizeIn);
  const art = (
    <svg
      width={bare ? size : Math.round(size * 0.62)}
      height={bare ? size : Math.round(size * 0.62)}
      viewBox="0 0 24 24"
      fill="none"
      stroke={INK}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <Art section={section} cake={cake} />
    </svg>
  );
  if (bare) return art;
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center border border-edge ${round ? "rounded-full" : ""}`}
      style={{ width: size, height: size, background: SECTION_TILE[section], borderRadius: round ? undefined : Math.round(size * 0.28) }}
    >
      {art}
    </span>
  );
}
