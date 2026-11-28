import { MemoView } from "@/components/pages/MemoView";
import { firstParams } from "@/lib/pages/routes";
import { loadVoice } from "@/lib/pages/settings";

// 저장 직후 AI 정리(organizeSaved)를 서버 동작이 기다린다: AI 호출이 길어질 수 있다
export const maxDuration = 60;

export default async function Voice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MemoView {...await loadVoice({ params: {}, searchParams: firstParams(await searchParams) })} />;
}
