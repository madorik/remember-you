import type { AvatarConfig } from "@readme/core";
import { Avatar } from "@/components/Avatar";
import { Heart } from "@/components/diary";
import { Icon } from "@/components/marks";
import { u } from "@/lib/ui-scale";

// 물어보기 화면의 그림 조각: 받는 사람 폴라로이드 · 말풍선

/** 얼굴 폴라로이드: 사람이면 얼굴, 새 이름이면 첫 글자, 아직 아무도 없으면 점선 빈 사진. photo는 사진 칸 한 변(px) */
export function FacePolaroid({ who, photo = 72, rotate = -4 }: { who: { avatar: AvatarConfig | null; label: string } | null; photo?: number; rotate?: number }) {
  const box = u(photo);
  return (
    <figure className={`relative m-0 flex shrink-0 flex-col items-center border border-edge bg-white px-[5.4px] pb-[12.6px] pt-[5.4px] ${who ? "" : "border-dashed"}`} style={{ transform: `rotate(${rotate}deg)` }}>
      <span className="flex items-center justify-center overflow-hidden" style={{ width: box, height: box, background: who ? "#fff" : "#FFF9E8" }}>
        {who ? (
          <Avatar config={who.avatar} size={photo - 6} label={who.label} decorative />
        ) : (
          <span className="flex items-center justify-center rounded-full border border-dashed border-edge text-muted" style={{ width: box - 10, height: box - 10 }}>
            <Icon name="personAdd" size={photo * 0.34} strokeWidth={1.8} />
          </span>
        )}
      </span>
      {who ? (
        <span aria-hidden="true" className="absolute bottom-[2.7px] flex">
          <Heart size={10} inline />
        </span>
      ) : null}
      <figcaption className="sr-only">{who?.label ?? ""}</figcaption>
    </figure>
  );
}

/** 캐릭터가 하는 말(작은 말풍선): 오른쪽 꼬리가 캐릭터를 가리킨다 */
export function SpeechBubble({ children }: { children: React.ReactNode }) {
  return (
    <p className="hand-written relative min-w-0 flex-1 rounded-[14px] border border-edge bg-sky-soft px-3 py-[7px] text-[16px] leading-[1.3]">
      {children}
      <span aria-hidden="true" className="absolute -right-[4.5px] top-1/2 -mt-[4px] h-2 w-2 rotate-45 border-r border-t border-edge bg-sky-soft" />
    </p>
  );
}
