"use client";

import { emptySection, type AvatarConfig, type DateSpec, type Locale, type ReminderOffset, type SafetyData } from "@readme/core";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { finishOnboarding, saveAvatar, saveFood } from "@/app/actions/card";
import { TornTape, type TornTapeColor } from "@/components/TornTape";
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
    <button type="submit" name="later" value="1" disabled={pending} className="mt-1 flex min-h-11 w-full items-center justify-center text-[14px] text-muted">
      {children}
    </button>
  );
}

/** 온보딩 단계의 흰 카드(시안): 남색 1.5px 선 + 모서리 18, 윗변 가운데에 테이프 */
const CARD = "card relative mx-4 mt-8 px-3.5 pb-3.5 pt-3";
const DASH = "border-t-[1.5px] border-dashed border-ink/20 pt-2.5";

function CardTape({ color }: { color: TornTapeColor }) {
  return <TornTape color={color} w={71} h={26} rotate={-3} className="-top-3.5 left-1/2 -ml-[35px]" />;
}

/** 아래 큰 단추의 손그림 아이콘(시안): 글자 왼쪽에 */
const CTA_ICON = {
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  next: <path d="M9 6l6 6-6 6" />,
  spark: <path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5z" />,
} as const;

function Cta({ icon, children }: { icon: keyof typeof CTA_ICON; children: React.ReactNode }) {
  return (
    <Submit className="w-full !text-[26px]">
      <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        {CTA_ICON[icon]}
      </svg>
      {children}
    </Submit>
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
        <Link href={back} prefetch={false} aria-label={backLabel} className="flex h-11 w-11 shrink-0 items-center justify-center">
          <Icon name="back" size={24} />
        </Link>
        <h1 className="min-w-0 truncate text-[31px] leading-none">
          <span className="hl">{title}</span>
        </h1>
      </div>
      <Submit className="!h-[34px] !min-h-0 !w-auto shrink-0 !rounded-full !px-3.5 !py-0 !font-sans !text-[15px] !font-normal !tracking-normal">{save}</Submit>
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
    <form action={saveAvatar} className="flex flex-1 flex-col">
      {hidden}
      {/* 캐릭터 만들기는 스스로 흰 카드(paper: 윗변에 망고 테이프) */}
      <div className="mx-4 mt-6">
        <AvatarBuilder value={value} onChange={setValue} locale={locale} side={<NameField label={t("onb.avatar.name")} value={name} />} paper />
      </div>
      {/* 시작 버튼은 늘 화면 아래에 붙어 보인다 */}
      <div className="bottom-bar mt-auto bg-bg px-4 pt-3">
        <Cta icon="check">{t("onb.avatar.cta")}</Cta>
      </div>
    </form>
  );
}

export function FoodStep({ locale, safety, spicy, next }: { locale: Locale; safety: SafetyData | null; spicy: number | null; next: string }) {
  const t = useT(locale);
  const [value, setValue] = useState<SafetyData>(safety ?? emptySection("safety"));
  const [level, setLevel] = useState<number | null>(spicy);
  return (
    <form action={saveFood} className="flex flex-1 flex-col">
      <input type="hidden" name="safety" value={JSON.stringify(value)} />
      <input type="hidden" name="spicy" value={JSON.stringify(level)} />
      <input type="hidden" name="next" value={next} />
      <div className={`${CARD} flex flex-col`}>
        <CardTape color="mint" />
        <SafetyEditor value={value} onChange={setValue} locale={locale} showNote={false} flush />
        <div className={DASH}>
          <SpicyScale value={level} onChange={setLevel} locale={locale} />
        </div>
      </div>
      <div className="bottom-bar mt-auto bg-bg px-4 pt-4">
        <Cta icon="next">{t("common.next")}</Cta>
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
    <form action={finishOnboarding} className="flex flex-1 flex-col">
      <input type="hidden" name="birthday" value={JSON.stringify(spec)} />
      <input type="hidden" name="offsets" value={JSON.stringify(when)} />
      <input type="hidden" name="next" value={next} />
      <div className={`${CARD} flex flex-col`}>
        <CardTape color="pink" />
        <DateSpecPicker value={spec} onChange={setSpec} locale={locale} year="birth" />
        <div className={`${DASH} mt-3`}>
          <ReminderPicker value={when} onChange={setWhen} locale={locale} />
        </div>
      </div>
      <div className="bottom-bar mt-auto bg-bg px-4 pt-4">
        <Cta icon="spark">{t("onb.finish")}</Cta>
        <Later>{t("onb.birthday.later")}</Later>
      </div>
    </form>
  );
}
