import { MemoPad } from "@/app/(app)/voice/MemoPad";
import { memoLabels } from "@/components/pages/MemoView";
import type { OnboardingData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 온보딩: 가입 직후 사람 한 명에 대한 첫 메모 하나를 적으면 끝난다(저장하면 그 사람 화면으로, 건너뛸 수도 있다). 화면은 메모 쓰기와 같은 메모지
export function OnboardingView({ locale, today, people, next }: OnboardingData) {
  const t = makeT(locale);
  return (
    <MemoPad
      locale={locale}
      today={today}
      people={people.map((p) => ({ ...p, hint: "" }))}
      fixed={null}
      onboarding={{
        next,
        labels: {
          title: t("onb.title"),
          skip: t("common.skip"),
          askWho: t("onb.askWho"),
          saveEnd: t("onb.saveEnd"),
          example: t("onb.example"),
          quick: [t("onb.quick.mom"), t("onb.quick.dad"), t("onb.quick.wife"), t("onb.quick.husband")],
        },
      }}
      labels={memoLabels(t, locale, today)}
    />
  );
}
