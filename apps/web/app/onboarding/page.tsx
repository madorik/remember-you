import { OnboardingView } from "@/components/pages/OnboardingView";
import { loadOnboarding } from "@/lib/pages/onboarding";
import { firstParams } from "@/lib/pages/routes";

export default async function Onboarding({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <OnboardingView {...await loadOnboarding({ params: {}, searchParams: firstParams(await searchParams) })} />;
}
