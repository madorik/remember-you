import { StepHeader } from "@/app/onboarding/StepHeader";
import { AvatarStep, BirthdayStep, FoodStep } from "@/app/onboarding/Steps";
import type { OnboardingAvatarData, OnboardingBirthdayData, OnboardingFoodData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 처음 화면 세 단계(얼굴 → 음식 → 생일). 끝나면 홈에서 실제 화면을 짚어 주는 안내(GuidedTour)가 이어진다

const nextQuery = (next: string) => (next !== "/home" ? `?next=${encodeURIComponent(next)}` : "");

export function OnboardingAvatarView({ locale, name, avatar, next }: OnboardingAvatarData) {
  const t = makeT(locale);
  return (
    <>
      <StepHeader step={1} t={t} locale={locale} title={t("onb.avatar.title")} compact />
      <AvatarStep locale={locale} name={name} avatar={avatar} next={next} />
    </>
  );
}

export function OnboardingFoodView({ locale, safety, spicy, next }: OnboardingFoodData) {
  const t = makeT(locale);
  const q = nextQuery(next);
  return (
    <>
      <StepHeader step={2} back={`/onboarding/avatar${q}`} skip={`/onboarding/birthday${q}`} t={t} locale={locale} title={t("onb.food.title")} />
      <FoodStep locale={locale} safety={safety} spicy={spicy} next={next} />
    </>
  );
}

export function OnboardingBirthdayView({ locale, birthday, offsets, next }: OnboardingBirthdayData) {
  const t = makeT(locale);
  const q = nextQuery(next);
  return (
    <>
      <StepHeader step={3} back={`/onboarding/food${q}`} t={t} locale={locale} title={t("onb.birthday.title")} />
      <BirthdayStep locale={locale} birthday={birthday} offsets={offsets} next={next} />
    </>
  );
}
