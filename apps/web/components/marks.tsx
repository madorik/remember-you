import { u } from "@/lib/ui-scale";
// 표시들(시안 v3 맹고색). 고른 것·챙길 날은 연한 망고 바탕 + 망고 테두리, 경고(알레르기)만 분홍.

/**
 * 감싼 글자 둘레의 둥근 강조(예전 손그림 동그라미 자리). 부모는 position: relative 여야 한다.
 * 글자 위에 겹쳐도 글자가 흐려지지 않게 옅은 색을 곱하기로 섞는다. warn이면 분홍(알레르기)
 */
export function MarkerCircle({ color = "red", pad = [11, 9], width = 2 }: { color?: "red" | "ink" | "warn"; pad?: [number, number]; width?: number }) {
  const warn = color === "warn";
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute rounded-full mix-blend-multiply"
      style={{
        left: -pad[0],
        top: -pad[1],
        right: -pad[0],
        bottom: -pad[1],
        background: warn ? "rgba(255, 170, 186, 0.28)" : "rgba(255, 194, 61, 0.24)",
        boxShadow: `inset 0 0 0 ${width}px ${warn ? "#f2a7b6" : "var(--color-sky)"}`,
      }}
    />
  );
}

/** 글자에 둥근 강조를 칠 수 있는 자리 */
export function Circled({ on, color = "red", pad, width, children, className = "" }: { on: boolean; color?: "red" | "ink" | "warn"; pad?: [number, number]; width?: number; children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative ${className}`}>
      {children}
      {on ? <MarkerCircle color={color} pad={pad} width={width} /> : null}
    </span>
  );
}

/** 둥근 네모 체크 칸: 남색 테두리, 켜면 망고 바탕에 남색 체크 */
export function DrawnCheck({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-[1.8px] border-ink text-ink transition-colors ${on ? "bg-sky" : "bg-white"}`}
    >
      {on ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : null}
    </span>
  );
}

/** 켜고 끄는 스위치의 모양(누르는 건 감싼 button이 한다). 꺼진 바탕은 흰 바탕과 3:1 이상 */
export function SwitchLook({ on }: { on: boolean }) {
  return (
    <span className={`flex h-8 w-[48.6px] items-center rounded-full border-2 border-ink p-0.5 transition-colors ${on ? "justify-end bg-sky" : "justify-start bg-[#ece7d8]"}`}>
      <span className="h-6 w-6 rounded-full border-2 border-ink bg-white" />
    </span>
  );
}

/** 작은 체크 표시(칩 안) */
export function CheckGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={u(size)} height={u(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

type IconName =
  | "back" | "close" | "lock" | "alert" | "mic" | "camera" | "link" | "copy" | "share" | "gift" | "external" | "bell"
  | "plus" | "check" | "calendar" | "people" | "card" | "globe" | "personAdd" | "chevron" | "trash" | "pick" | "map" | "eye" | "settings" | "star" | "pencil" | "up" | "undo" | "arrow" | "stop";

const ICONS: Record<IconName, React.ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  undo: (
    <>
      <path d="M4 12a8 8 0 1 0 2.34-5.66" />
      <path d="M4 4v5h5" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  alert: (
    <>
      <path d="M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
    </>
  ),
  camera: (
    <>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  share: <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />,
  gift: <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />,
  external: <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />,
  bell: <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6L9 17l-5-5" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <circle cx="15.5" cy="15" r="2.6" />
    </>
  ),
  people: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  card: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  personAdd: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  chevron: <path d="M9 18l6-6-6-6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />,
  pencil: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />,
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />,
  pick: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7 9.5l1.8 1.8L12 8M7 15.5l1.8 1.8L12 14M15 10h3M15 16h3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),  star: <path d="M12 3.6l2.55 5.2 5.7.82-4.13 4.03.98 5.69L12 16.66l-5.1 2.68.98-5.69L3.75 9.62l5.7-.82z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};

export function Icon({ name, size = 22, strokeWidth = 1.7, className = "" }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={u(size)} height={u(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {ICONS[name]}
    </svg>
  );
}

