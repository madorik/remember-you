"use client";

import { translate, type Locale } from "@readme/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { undoCapture } from "@/app/actions/capture";
import { planAfterSave, takeSaved, type SavedNote } from "@/lib/capture-saved";
import { useUndoToast } from "./UndoToast";

/**
 * 말로·글로 적기를 여러 사람 이야기로 저장하고 홈으로 돌아왔을 때 한 번: 누구에게 몇 줄 적었는지 아래 토스트로 알리고 되돌리기를 준다.
 * (한 사람 이야기뿐이면 그 사람 화면이 알린다 — 그 화면의 QuickNote)
 */
export function SavedToast({ locale }: { locale: Locale }) {
  const router = useRouter();
  const { show, toast } = useUndoToast(locale);
  // 저장소에서 한 번만 꺼내 두고(꺼내면 지워진다), 효과가 다시 돌아도(개발 모드의 두 번 실행) 같은 것을 보인다
  const taken = useRef<SavedNote | null | undefined>(undefined);
  useEffect(() => {
    if (taken.current === undefined) taken.current = takeSaved(null);
    const note = taken.current;
    if (!note) return;
    const plan = planAfterSave(note.lines);
    if (plan.kind !== "many") return;
    const list = plan.who.map((w) => translate(locale, "voice.savedCount", { who: w.name, n: w.n })).join(" · ");
    show({
      text: translate(locale, "voice.savedMany", { list }),
      onUndo: () => void undoCapture(note.undo).then((r) => r.ok && router.refresh()),
    });
  }, [locale, show, router]);
  return toast;
}
