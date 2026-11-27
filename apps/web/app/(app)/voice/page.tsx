import { MemoView } from "@/components/pages/MemoView";
import { VoiceView } from "@/components/pages/VoiceView";
import { firstParams } from "@/lib/pages/routes";
import { loadVoice } from "@/lib/pages/settings";

// 체험(?tour=…)은 예전 말로 적기(VoiceView), 그 밖의 /voice는 메모 쓰기(MemoView)
export default async function Voice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadVoice({ params: {}, searchParams: firstParams(await searchParams) });
  return data.tour ? <VoiceView {...data} /> : <MemoView {...data} />;
}
