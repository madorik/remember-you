import { MemoView } from "@/components/pages/MemoView";
import { firstParams } from "@/lib/pages/routes";
import { loadVoice } from "@/lib/pages/settings";

export default async function Voice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MemoView {...await loadVoice({ params: {}, searchParams: firstParams(await searchParams) })} />;
}
