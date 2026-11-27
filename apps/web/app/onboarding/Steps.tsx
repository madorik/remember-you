"use client";

import { type AvatarConfig, type DateSpec, type Locale, type YMD } from "@readme/core";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveAvatar } from "@/app/actions/card";
import { BirthdayLine } from "@/components/BirthdayLine";
import { AvatarBuilder, NameField } from "@/components/editors/AvatarBuilder";
import { Icon } from "@/components/marks";
import { useT } from "@/components/editors/shared";

// 내 프로필·사람 프로필 고치기가 같이 쓰는 머리 줄과 얼굴 고치기(예전 온보딩 단계들은 첫 메모 하나로 바뀌어 없다)

export function Submit({ children, disabled, className = "w-full" }: { children: React.ReactNode; disabled?: boolean; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className={`btn-primary ${className}`}>
      {children}
    </button>
  );
}

/**
 * 프로필 고치기 머리 줄: 뒤로 · 제목 · 오른쪽 끝 저장(위에 붙어 늘 보인다). 한 줄이라 아래 캐릭터 만들기가 한 화면에 들어온다.
 * 이름 칸은 캐릭터 만들기(AvatarBuilder) 미리보기 옆에 있다. 내 프로필과 사람 프로필이 같이 쓴다
 */
export function ProfileHeader({ title, back, backLabel, save }: { title: string; back: string; backLabel: string; save: string }) {
  return (
    <div className="sticky z-30 flex h-12 items-center justify-between gap-1.5 bg-bg pl-1.5 pr-2.5" style={{ top: "var(--sat)" }}>
      <div className="flex min-w-0 items-center gap-0.5">
        <Link href={back} prefetch={false} aria-label={backLabel} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center">
          <Icon name="back" size={24} />
        </Link>
        <h1 className="min-w-0 truncate text-[25.1px] leading-none">
          <span className="hl">{title}</span>
        </h1>
      </div>
      <Submit className="!h-[30.6px] !min-h-0 !w-auto shrink-0 !rounded-full !px-3.5 !py-0 !font-sans !text-[13.5px] !font-normal !tracking-normal">{save}</Submit>
    </div>
  );
}

/** 내 프로필 고치기: 한 줄 머리(뒤로 · 제목 · 저장, 위에 붙어 늘 보인다) 아래에 캐릭터 만들기(이름 칸은 미리보기 옆) */
export function AvatarStep({
  locale,
  name,
  avatar,
  title,
  back = "/me",
  today,
  birthday = null,
}: {
  locale: Locale;
  name: string;
  avatar: AvatarConfig;
  /** 머리 줄 제목(내 프로필) */
  title: string;
  /** 머리 줄의 뒤로 가기 주소 */
  back?: string;
  /** 이름 칸 밑에 보일 내 생일 줄(오늘 날짜 기준으로 올해 날짜를 낸다) */
  today?: YMD;
  birthday?: DateSpec | null;
}) {
  const t = useT(locale);
  const [value, setValue] = useState(avatar);
  const [tz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  return (
    <form action={saveAvatar} className="page-end flex flex-col">
      <input type="hidden" name="avatar" value={JSON.stringify(value)} />
      <input type="hidden" name="tz" value={tz} />
      <ProfileHeader title={title} back={back} backLabel={t("common.back")} save={t("common.save")} />
      <div className="px-4 pt-3">
        <AvatarBuilder
          value={value}
          onChange={setValue}
          locale={locale}
          side={
            <>
              <NameField label={t("profile.nickname")} value={name} />
              {today ? <BirthdayLine birthday={birthday} today={today} locale={locale} href="/me/edit?open=dates" t={t} /> : null}
            </>
          }
        />
      </div>
    </form>
  );
}
