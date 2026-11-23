import type { AvatarConfig } from "@readme/core";
import { Avatar } from "./Avatar";
import { u } from "@/lib/ui-scale";

/** 한 날에 챙길 사람들: 둘까지는 얼굴을 겹치고, 셋 이상이면 첫 얼굴 + '+n' 동그라미(칸 폭이 좁은 달력·이번 주 줄용) */
export function FaceStack({ faces, size: sizeIn }: { faces: { key: string; avatar: AvatarConfig | null; label: string }[]; size: number }) {
  if (!faces.length) return null;
  const size = u(sizeIn);
  const shown = faces.length > 2 ? faces.slice(0, 1) : faces;
  const rest = faces.length - shown.length;
  return (
    <span className="flex">
      {shown.map((f, i) => (
        <span key={f.key} className="rounded-full shadow-[0_0_0_1.5px_#fff]" style={{ marginLeft: i ? -size * 0.36 : 0 }}>
          <Avatar config={f.avatar} size={sizeIn} label={f.label} />
        </span>
      ))}
      {rest ? (
        <span
          role="img"
          aria-label={faces
            .slice(shown.length)
            .map((f) => f.label)
            .join(", ")}
          className="num flex items-center justify-center rounded-full bg-ink text-white shadow-[0_0_0_1.5px_#fff]"
          style={{ width: size, height: size, marginLeft: -size * 0.36, fontSize: Math.round(size * 0.42) }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
