import type { AvatarConfig } from "@readme/core";
import { Avatar } from "@/components/Avatar";
import { Heart } from "@/components/diary";
import { Icon } from "@/components/marks";
import { OG_IMAGE } from "@/lib/og";
import { u } from "@/lib/ui-scale";

// 물어보기 화면의 그림 조각: 받는 사람 폴라로이드 · 말풍선 · 우표 붙은 엽서의 장식 · 메신저로 받는 링크 미리보기

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

const HEART_PATH = "M12 20 C4 14 2 9 5.5 6.5 C8 4.7 11 6 12 8.5 C13 6 16 4.7 18.5 6.5 C22 9 20 14 12 20 Z";

/** 엽서 오른쪽 위 우표: 망고색 가장자리를 점점이 도려낸 톱니 + 가운데 하트. 부모는 relative */
export function PostageStamp({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 44 52" width={u(46)} height={u(54)} className={`pointer-events-none absolute ${className}`} style={{ transform: "rotate(4deg)" }}>
      <rect x="1.5" y="1.5" width="41" height="49" fill="#FFC23D" stroke="#1F2340" strokeWidth="1.3" />
      <rect x="1.5" y="1.5" width="41" height="49" fill="none" stroke="#FFFDF6" strokeWidth="3.4" strokeDasharray="0 5.6" strokeLinecap="round" />
      <rect x="7" y="7" width="30" height="31" fill="#FFE9A8" stroke="#1F2340" strokeWidth="1" />
      <path d={HEART_PATH} fill="#F59BAE" stroke="#1F2340" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" transform="translate(10 8) scale(1)" />
      <path d="M10 43 H34 M14 46.6 H30" stroke="#1F2340" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** 소인(우체국 도장)처럼 우표 옆에 걸친 물결 세 줄 */
export function PostMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 60 30" width={u(52)} height={u(26)} fill="none" stroke="#1F2340" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" className={`pointer-events-none absolute ${className}`}>
      <path d="M3 6 q6 -6 12 0 t12 0 t12 0 t12 0" />
      <path d="M3 15 q6 -6 12 0 t12 0 t12 0 t12 0" />
      <path d="M3 24 q6 -6 12 0 t12 0 t12 0 t12 0" />
    </svg>
  );
}

/** 엽서 윗변의 항공우편 줄무늬(분홍·하늘) */
export const AIRMAIL = "repeating-linear-gradient(135deg, #F59BAE 0 9px, #FFFDF6 9px 14px, #8FD2EC 14px 23px, #FFFDF6 23px 28px)";

/**
 * 받는 사람이 메신저에서 보는 모양: 보낸 사람 얼굴 + 링크 미리보기 말풍선(그림·제목·설명·주소).
 * 제목·설명은 /r/<토큰>의 링크 미리보기와 같은 함수(lib/og.ts requestPreview)에서 온다
 */
export function LinkPreview({ avatar, name, title, description, host }: { avatar: AvatarConfig; name: string; title: string; description: string; host: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[14px] bg-[#EEF3FB] p-2.5">
      <Avatar config={avatar} size={34} label={name || title} decorative />
      <div className="min-w-0 max-w-[270px] flex-1 overflow-hidden rounded-[4px_16px_16px_16px] border border-edge bg-white">
        <div aria-hidden="true" className="h-[92px] w-full border-b border-edge bg-cover" style={{ backgroundImage: `url(${OG_IMAGE.url})`, backgroundPosition: "center 36%" }} />
        <div className="px-3 pb-2 pt-[7px]">
          <p className="truncate text-[14px] leading-[1.3]">{title}</p>
          <p className="mt-px line-clamp-2 text-[12.2px] leading-[1.4] text-muted">{description}</p>
          <p className="mt-1 truncate text-[10.8px] leading-none text-muted/80">{host}</p>
        </div>
      </div>
    </div>
  );
}
