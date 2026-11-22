import { AVATAR_BG_FILLS, AVATAR_INK, BODY_OUTLINE, BODY_PATHS, FACE_SHAPES, GLASSES_PATHS, HAIR_PATHS, ITEM_PATHS, type AvatarConfig } from "@readme/core";

const INK = AVATAR_INK;
const PINK = "#FF9DB0";

/** 선 캐릭터 그림만(배경 없음). 캐릭터 만들기의 큰 미리보기·고르기 칸에서 쓴다. bold: 작게 그릴 때 선이 가늘어 보이지 않게 선을 굵게 */
export function AvatarArt({ config, size, label, bold = false }: { config: AvatarConfig; size: number; label?: string; bold?: boolean }) {
  const k = bold ? 1.3 : 1;
  const [back, front] = HAIR_PATHS[config.hair];
  const body = BODY_PATHS[config.body];
  const [glassFill, glassLine] = GLASSES_PATHS[config.glasses];
  const item = ITEM_PATHS[config.item];
  const face = FACE_SHAPES[config.face];
  const skin = config.skin;
  // 짙은 옷 위의 옷 선은 흰색으로
  const detail = config.cloth.toUpperCase() === INK ? "#FFFFFF" : INK;
  const stroke = { stroke: INK, strokeWidth: 3.2 * k, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="block">
      {back ? <path d={back} fill={config.hairColor} {...stroke} /> : null}
      <path d="M91 116 V158 H109 V116" fill={skin} {...stroke} />
      <path d={BODY_OUTLINE} fill={config.cloth} {...stroke} />
      {body.band ? <path d={body.band} fill={detail} /> : null}
      {body.fill ? <path d={body.fill} fill={config.cloth} {...stroke} /> : null}
      {body.white ? <path d={body.white} fill="#FFFFFF" {...stroke} /> : null}
      {body.tie ? <path d={body.tie} fill={config.cloth.toUpperCase() === INK ? "#FFC23D" : INK} {...stroke} strokeWidth={2.4 * k} /> : null}
      <path d={body.line} fill="none" {...stroke} stroke={detail} />
      <path d="M70 88 C58 84 56 108 70 109 Z" fill={skin} {...stroke} transform={face.ear ? `translate(${face.ear} 0)` : undefined} />
      <path d="M130 88 C142 84 144 108 130 109 Z" fill={skin} {...stroke} transform={face.ear ? `translate(${-face.ear} 0)` : undefined} />
      <path d={face.d} fill={skin} {...stroke} />
      <path d={front} fill={config.hairColor} {...stroke} />
      <circle cx="88" cy="101" r={3.9 * (bold ? 1.1 : 1)} fill={INK} />
      <circle cx="112" cy="101" r={3.9 * (bold ? 1.1 : 1)} fill={INK} />
      {glassFill ? <path d={glassFill} fill={INK} {...stroke} strokeWidth={3 * k} /> : null}
      {glassLine ? <path d={glassLine} fill="none" {...stroke} strokeWidth={3 * k} /> : null}
      {item.a ? <path d={item.a} fill={item.color} {...stroke} strokeWidth={3 * k} /> : null}
      {item.b ? <path d={item.b} fill={PINK} {...stroke} strokeWidth={3 * k} /> : null}
      {item.w ? <path d={item.w} fill="#FFFFFF" {...stroke} strokeWidth={3 * k} /> : null}
      {item.l ? <path d={item.l} fill="none" {...stroke} /> : null}
    </svg>
  );
}

export function avatarBackground(config: AvatarConfig): string {
  const [a, b] = AVATAR_BG_FILLS[config.bg];
  return a === b ? a : `linear-gradient(140deg, ${a}, ${b})`;
}

/**
 * 동그라미 안의 선 캐릭터(남색 1.5px 테두리). 얼굴이 없으면 가는 테두리 동그라미에 첫 글자.
 * decorative: 같은 링크·단추 안에 이름이 이미 있어 읽어 줄 필요가 없을 때(스크린리더에서 숨긴다. label은 첫 글자 만들 때만 쓴다)
 */
export function Avatar({ config, size = 44, label, decorative = false }: { config: AvatarConfig | null; size?: number; label: string; decorative?: boolean }) {
  if (!config) {
    const initial = label.trim().slice(0, 1) || "?";
    return (
      <span
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative ? true : undefined}
        className="flex shrink-0 items-center justify-center rounded-full bg-sky-soft text-accent shadow-[0_0_0_1.5px_var(--color-ink)]"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      >
        {initial}
      </span>
    );
  }
  return (
    <span className="block shrink-0 overflow-hidden rounded-full leading-none shadow-[0_0_0_1.5px_var(--color-ink)]" style={{ width: size, height: size, background: avatarBackground(config) }}>
      <AvatarArt config={config} size={size} label={decorative ? undefined : label} />
    </span>
  );
}
