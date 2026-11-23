import type { AvatarConfig } from "@readme/core";
import { COLOR_FILL, ICON_PATH, type FolderColor, type FolderIcon } from "@/lib/folders";
import { Avatar } from "./Avatar";
import { u } from "@/lib/ui-scale";

// 폴더 그림(플래너 시안): 뒤판(탭 달린) → 들어 있는 사람 얼굴(앞에서 셋까지, 없으면 빈 종이) → 앞주머니 순서로 겹쳐서 얼굴이 주머니 위로 빼꼼 보인다.
// 크기는 폭 기준(높이는 폭의 0.78). 시안의 66px(사람들 칸)과 120px(폴더 화면)가 같은 비율이다. 서버·화면이 같이 쓴다

const INK = "#1F2340";

export function FolderArt({
  icon,
  color,
  size: sizeIn = 66,
  faces,
  showIcon = false,
}: {
  icon: FolderIcon;
  color: FolderColor;
  /** 폭(px). 높이는 폭의 0.78 */
  size?: number;
  /** 들어 있는 사람 얼굴(앞에서 셋까지). 없거나 비면 빈 종이 */
  faces?: { key: string; avatar: AvatarConfig | null; label: string }[];
  /** 앞주머니 가운데에 고른 모양 그림(폴더 만들기·고치기 미리보기에서만) */
  showIcon?: boolean;
}) {
  const size = u(sizeIn);
  const fill = COLOR_FILL[color];
  const h = Math.round(size * 0.78);
  const shown = (faces ?? []).slice(0, 3);
  const face = Math.round(sizeIn * 0.34);
  const tabH = Math.min(14.4, Math.round(size * 0.24));
  const pocket = Math.round(h * 0.52);
  const line = sizeIn < 50 ? 1.2 : 1.5;
  return (
    <span aria-hidden="true" className="relative block shrink-0" style={{ width: size, height: h }}>
      <span
        className="absolute box-border border-b-0"
        style={{ left: Math.round(size * 0.1), top: 0, width: Math.round(size * 0.42), height: tabH, borderRadius: "7.2px 7.2px 0 0", border: `${line}px solid ${INK}`, borderBottom: 0, background: fill.back }}
      />
      <span className="absolute box-border" style={{ left: 0, right: 0, bottom: 0, top: Math.round(tabH * 0.75), borderRadius: 9, border: `${line}px solid ${INK}`, background: fill.back }} />
      {shown.length ? (
        shown.map((f, i) => (
          <span key={f.key} className="absolute" style={{ left: Math.round(size * (0.1 + i * 0.25)), top: Math.round(h * 0.2) }}>
            <Avatar config={f.avatar} size={face} label={f.label} />
          </span>
        ))
      ) : (
        <span className="absolute box-border bg-white" style={{ left: Math.round(size * 0.14), right: Math.round(size * 0.14), top: Math.round(h * 0.22), height: Math.round(h * 0.3), borderRadius: 3.6, border: `${line}px solid ${INK}` }} />
      )}
      <span className="absolute box-border" style={{ left: 0, right: 0, bottom: 0, height: pocket, borderRadius: 9, border: `${line}px solid ${INK}`, background: fill.front }} />
      {showIcon ? (
        <svg viewBox="27.5 28 17 17" width={Math.round(size * 0.22)} height={Math.round(size * 0.22)} className="absolute block" style={{ left: "50%", bottom: Math.round(pocket / 2 - size * 0.11), marginLeft: -Math.round(size * 0.11) }}>
          <path d={ICON_PATH[icon]} fill="#fff" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : null}
    </span>
  );
}

/** 작은 폴더(칩·목록 앞): 모양 없이 색만 */
export function FolderMini({ color, size: sizeIn = 20 }: { color: FolderColor; size?: number }) {
  const size = u(sizeIn);
  const fill = COLOR_FILL[color];
  return (
    <svg aria-hidden="true" viewBox="0 0 20 16" width={size} height={(size * 16) / 20} className="block shrink-0">
      <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h4l1.5 1.5H17A1.5 1.5 0 0 1 18.5 5v8.5A1.5 1.5 0 0 1 17 15H3a1.5 1.5 0 0 1-1.5-1.5z" fill={fill.back} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M1 6.5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1l-.5 7A1.5 1.5 0 0 1 17 15H3a1.5 1.5 0 0 1-1.5-1.5z" fill={fill.front} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** 모양 고르기 칸에 쓰는 그림만(앞주머니 없이) */
export function FolderIconGlyph({ icon, size: sizeIn = 26 }: { icon: FolderIcon; size?: number }) {
  const size = u(sizeIn);
  return (
    <svg aria-hidden="true" viewBox="27.5 28 17 17" width={size} height={size} className="block">
      <path d={ICON_PATH[icon]} fill="#fff" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
