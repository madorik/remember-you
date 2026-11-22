import type { AvatarConfig } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { Heart, Polaroid } from "@/components/diary";

// 홈 '다가오는 날' 왼쪽 그림: 그 사람 얼굴을 끼운 폴라로이드(이름 + 하트). 같은 날 여럿이면 폴라로이드를 겹치고,
// 다가오는 날이 없으면 점선 사진 칸에 사람 + 더하기(새 친구)를 둔다. 명절 그림은 HolidayArt.

const QUIET = "#C3C7D4";

/** 사람 하나 + 더하기의 연한 선(챙길 날이 없을 때 '새 친구'를 부르는 빈 사진 칸) */
function QuietFriend({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="block">
      <g fill="none" stroke={QUIET} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="18" r="7.5" />
        <path d="M6 41 C6 31 12 27.5 20 27.5 C28 27.5 34 31 34 41" />
      </g>
      <path d="M38 8 V20 M32 14 H44" fill="none" stroke="#E09A12" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** 다가오는 날의 주인공: 얼굴을 누르면 그 사람 화면으로. 아래 '내 사람들'에 같은 링크가 있어 보조기기에는 숨긴다 */
export function EventPortrait({ href, avatar, name }: { href: string; avatar: AvatarConfig | null; name: string; kind: "birthday" | "anniversary" }) {
  return (
    <Link href={href} aria-hidden="true" tabIndex={-1} className="block shrink-0 py-2 pl-1 pr-2">
      <Polaroid
        rotate={-4}
        caption={
          <>
            <span className="max-w-[72px] truncate">{name}</span>
            <Heart size={13} inline />
          </>
        }
      >
        <Avatar config={avatar} size={74} label={name} />
      </Polaroid>
    </Link>
  );
}

/** 같은 날 챙길 사람이 여럿: 폴라로이드 둘을 서로 다른 쪽으로 기울여 겹치고, 셋 이상이면 '+n' */
export function EventPortraits({ faces }: { faces: { avatar: AvatarConfig | null; name: string }[]; kind: "birthday" | "anniversary" }) {
  const [a, b] = faces;
  if (!a || !b) return null;
  const rest = faces.length - 2;
  return (
    <span aria-hidden="true" className="relative block h-[122px] w-[112px] shrink-0">
      <Polaroid rotate={-6} photo={64} className="absolute left-1 top-0">
        <Avatar config={a.avatar} size={58} label={a.name} />
      </Polaroid>
      <Polaroid rotate={6} photo={64} className="absolute right-0 top-[34px]">
        <Avatar config={b.avatar} size={58} label={b.name} />
      </Polaroid>
      {rest > 0 ? <span className="grad num absolute bottom-0 left-0 rounded-full px-2 py-[2px] text-[14px] shadow-[0_0_0_1.5px_var(--color-ink)]">+{rest}</span> : null}
    </span>
  );
}

/** 챙길 날이 없을 때: 점선 사진 칸과 사람 + 더하기 */
export function EmptyPortrait() {
  return (
    <span aria-hidden="true" className="block shrink-0 py-2 pl-1 pr-2">
      <Polaroid rotate={-4} dashed>
        <QuietFriend />
      </Polaroid>
    </span>
  );
}
