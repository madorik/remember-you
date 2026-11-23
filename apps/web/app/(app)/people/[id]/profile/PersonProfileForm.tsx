"use client";

import type { AvatarConfig, Locale } from "@readme/core";
import { useState } from "react";
import { savePersonProfile } from "@/app/actions/people";
import { ProfileHeader } from "@/app/onboarding/Steps";
import { AvatarBuilder, NameField } from "@/components/editors/AvatarBuilder";

/** 사람 프로필 고치기: 내 프로필처럼 한 줄 머리(뒤로 · 제목 · 저장, 위에 붙어 늘 보인다) 아래에 캐릭터 만들기(부르는 말은 미리보기 옆) */
export function PersonProfileForm({
  contactId,
  title,
  name,
  avatar,
  locale,
  back,
  labels,
}: {
  contactId: string;
  title: string;
  name: string;
  avatar: AvatarConfig;
  locale: Locale;
  back: string;
  labels: { name: string; save: string; back: string };
}) {
  const [value, setValue] = useState(avatar);
  return (
    <form action={savePersonProfile} className="flex flex-col">
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="avatar" value={JSON.stringify(value)} />
      <ProfileHeader title={title} back={back} backLabel={labels.back} save={labels.save} />
      <div className="px-4 pt-3">
        <AvatarBuilder value={value} onChange={setValue} locale={locale} side={<NameField label={labels.name} value={name} required={false} />} />
      </div>
    </form>
  );
}
