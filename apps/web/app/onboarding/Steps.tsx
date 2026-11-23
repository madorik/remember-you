"use client";

import { emptySection, type AvatarConfig, type DateSpec, type Locale, type ReminderOffset, type SafetyData } from "@readme/core";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { finishOnboarding, saveAvatar, saveFood } from "@/app/actions/card";
import { Heart, SKY_STAR, Sparkle, Squiggle, Star, Tape, type TapeColor } from "@/components/diary";
import { AvatarBuilder, NameField } from "@/components/editors/AvatarBuilder";
import { DateSpecPicker, ReminderPicker } from "@/components/editors/DatesEditor";
import { Icon } from "@/components/marks";
import { SafetyEditor } from "@/components/editors/SafetyEditor";
import { SpicyScale } from "@/components/editors/TasteEditor";
import { useT } from "@/components/editors/shared";

export function Submit({ children, disabled, className = "w-full" }: { children: React.ReactNode; disabled?: boolean; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className={`btn-primary ${className}`}>
      {children}
    </button>
  );
}

/** 글자만 있는 보조 단추(이 단계는 건너뛰기): 같은 폼을 later=1로 보낸다 */
function Later({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="later" value="1" disabled={pending} className="mt-1 flex min-h-11 w-full items-center justify-center text-[19px] text-muted">
      {children}
    </button>
  );
}

/** 온보딩 단계의 종이 시트: 머리 아래에서 화면 끝까지, 윗변 가운데에 테이프 */
const SHEET = "relative z-10 mt-4 flex flex-1 flex-col rounded-t-[28px] bg-paper shadow-[0_-1px_0_rgb(31_35_64/0.1),0_-14px_28px_-18px_rgb(31_35_64/0.4)]";

function SheetTape({ color, vertical = false }: { color: TapeColor; vertical?: boolean }) {
  return <Tape color={color} w={104} h={26} rotate={-3} alpha={color === "mint" ? 0.55 : color === "pink" ? 0.6 : 0.62} vertical={vertical} className="-top-3 left-1/2 -ml-[52px]" />;
}

/**
 * 프로필 고치기 머리 줄: 뒤로 · 제목 · 오른쪽 끝 저장(위에 붙어 늘 보인다). 한 줄이라 아래 캐릭터 만들기가 한 화면에 들어온다.
 * 이름 칸은 캐릭터 만들기(AvatarBuilder) 미리보기 옆에 있다. 내 프로필과 사람 프로필이 같이 쓴다
 */
export function ProfileHeader({ title, back, backLabel, save }: { title: string; back: string; backLabel: string; save: string }) {
  return (
    <div className="sticky z-30 flex items-center gap-1 bg-bg pb-2 pl-2 pr-4 pt-1.5" style={{ top: "var(--sat)" }}>
      <Link href={back} prefetch={false} aria-label={backLabel} className="flex h-11 w-11 shrink-0 items-center justify-center">
        <Icon name="back" size={24} />
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-[32px] leading-[1.25]">
        <span className="hl px-1">{title}</span>
      </h1>
      <Submit className="!h-11 shrink-0 !rounded-full !px-[22px] !text-[19px] !shadow-[0_3px_0_var(--color-mango-deep)]">{save}</Submit>
    </div>
  );
}

export function AvatarStep({
  locale,
  name,
  avatar,
  next,
  mode = "onboarding",
  title = "",
  back = "/me",
}: {
  locale: Locale;
  name: string;
  avatar: AvatarConfig;
  next: string;
  mode?: "onboarding" | "edit";
  /** 고칠 때 머리 줄 제목(내 프로필) */
  title?: string;
  /** 고칠 때 머리 줄의 뒤로 가기 주소 */
  back?: string;
}) {
  const t = useT(locale);
  const [value, setValue] = useState(avatar);
  const [tz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  const onboarding = mode === "onboarding";
  const hidden = (
    <>
      <input type="hidden" name="avatar" value={JSON.stringify(value)} />
      <input type="hidden" name="tz" value={tz} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value={mode} />
    </>
  );
  // 고칠 때: 한 줄 머리(뒤로 · 제목 · 저장, 위에 붙어 늘 보인다) 아래에 캐릭터 만들기(이름 칸은 미리보기 옆)
  if (!onboarding)
    return (
      <form action={saveAvatar} className="page-end flex flex-col">
        {hidden}
        <ProfileHeader title={title} back={back} backLabel={t("common.back")} save={t("common.save")} />
        <div className="px-4 pt-3">
          <AvatarBuilder value={value} onChange={setValue} locale={locale} side={<NameField label={t("profile.nickname")} value={name} />} />
        </div>
      </form>
    );
  return (
    <form action={saveAvatar} className={`${SHEET} !mt-2.5`}>
      {hidden}
      <div className="px-4 pt-4">
        <AvatarBuilder value={value} onChange={setValue} locale={locale} side={<NameField label={t("onb.avatar.name")} value={name} />} tape="mango" paper />
      </div>
      {/* 시작 버튼은 늘 화면 아래에 붙어 보인다 */}
      <div className="bottom-bar mt-auto bg-paper px-4 pt-3">
        <Submit>{t("onb.avatar.cta")}</Submit>
      </div>
    </form>
  );
}

export function FoodStep({ locale, safety, spicy, next }: { locale: Locale; safety: SafetyData | null; spicy: number | null; next: string }) {
  const t = useT(locale);
  const [value, setValue] = useState<SafetyData>(safety ?? emptySection("safety"));
  const [level, setLevel] = useState<number | null>(spicy);
  return (
    <form action={saveFood} className={SHEET}>
      <SheetTape color="mint" vertical />
      <input type="hidden" name="safety" value={JSON.stringify(value)} />
      <input type="hidden" name="spicy" value={JSON.stringify(level)} />
      <input type="hidden" name="next" value={next} />
      <div className="relative flex flex-col gap-7 px-5 pt-8">
        <SafetyEditor value={value} onChange={setValue} locale={locale} showNote={false} />
        <SpicyScale value={level} onChange={setLevel} locale={locale} />
        <Heart size={26} rotate={16} className="right-3 top-2" />
        <Squiggle w={54} width={2.4} className="right-[30px] top-[214px]" />
        <Sparkle size={18} className="left-px top-[380px]" />
        <Star size={20} rotate={-12} color={SKY_STAR} className="right-2 top-[436px]" />
      </div>
      <div className="bottom-bar mt-auto bg-paper px-4 pt-4">
        <Submit>{t("common.next")}</Submit>
      </div>
    </form>
  );
}

export function BirthdayStep({ locale, birthday, offsets, next }: { locale: Locale; birthday: DateSpec | null; offsets: ReminderOffset[]; next: string }) {
  const t = useT(locale);
  // 가짜 생일을 넣지 않는다: 고르기 전에는 비워 두고, 나중에 해도 된다
  const [spec, setSpec] = useState<DateSpec | null>(birthday);
  const [when, setWhen] = useState<ReminderOffset[]>(offsets);
  return (
    <form action={finishOnboarding} className={SHEET}>
      <SheetTape color="pink" />
      <input type="hidden" name="birthday" value={JSON.stringify(spec)} />
      <input type="hidden" name="offsets" value={JSON.stringify(when)} />
      <input type="hidden" name="next" value={next} />
      <div className="relative flex flex-col gap-7 px-5 pt-8">
        <DateSpecPicker value={spec} onChange={setSpec} locale={locale} year="birth" />
        <ReminderPicker value={when} onChange={setWhen} locale={locale} />
        <Heart size={26} rotate={16} className="right-3.5 top-2.5" />
        <Star size={22} rotate={12} color={SKY_STAR} className="bottom-[52px] right-[18px]" />
        <Sparkle size={18} className="right-[74px] top-[62px]" />
        <Squiggle w={54} width={2.4} className="-bottom-2.5 right-5" />
      </div>
      <div className="bottom-bar mt-auto bg-paper px-4 pt-4">
        <Submit>{t("onb.finish")}</Submit>
        <Later>{t("onb.birthday.later")}</Later>
      </div>
    </form>
  );
}
