import { AvatarStep } from "@/app/onboarding/Steps";
import type { MeAvatarData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 내 프로필: 얼굴과 이름(저장 버튼)만, 한 화면에. 뒤로·제목·저장은 AvatarStep의 한 줄 머리. 언어·계정 삭제는 설정 탭, 로그아웃은 홈 오른쪽 위 내 얼굴 메뉴
export function MeAvatarView({ locale, name, avatar, today, birthday }: MeAvatarData) {
  const t = makeT(locale);
  return (
    <div className="flex flex-1 flex-col">
      <AvatarStep locale={locale} name={name} avatar={avatar} next="/me" mode="edit" title={t("profile.title")} back="/me" today={today} birthday={birthday} />
    </div>
  );
}
