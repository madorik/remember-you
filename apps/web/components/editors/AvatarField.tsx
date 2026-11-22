"use client";

import { DEFAULT_AVATAR, type AvatarConfig, type Locale } from "@readme/core";
import { useState } from "react";
import { AvatarBuilder } from "./AvatarBuilder";

/** 폼에 얹는 프로필(얼굴) 칸: 화면에 보이는 얼굴이 avatar로 같이 간다(사람 추가하기). side는 미리보기 오른쪽의 이름·폴더 칸 */
export function AvatarField({ locale, side }: { locale: Locale; side: React.ReactNode }) {
  const [value, setValue] = useState<AvatarConfig>(DEFAULT_AVATAR);
  return (
    <>
      <input type="hidden" name="avatar" value={JSON.stringify(value)} />
      <AvatarBuilder value={value} onChange={setValue} locale={locale} side={side} tape="mango" />
    </>
  );
}
