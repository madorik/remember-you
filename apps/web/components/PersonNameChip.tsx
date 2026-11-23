import type { AvatarConfig } from "@readme/core";
import { Avatar } from "./Avatar";

/** 고치기 화면 머리의 이름표(플래너 시안): 작은 얼굴 + 이름을 흰 알약에 */
export function PersonNameChip({ avatar, name }: { avatar: AvatarConfig | null; name: string }) {
  return (
    <span className="inline-flex h-8 max-w-full items-center gap-[4.5px] self-start rounded-full border border-edge bg-white pl-1 pr-2.5 text-[12.6px]">
      <Avatar config={avatar} size={24} label={name} decorative />
      <span className="truncate">{name}</span>
    </span>
  );
}
