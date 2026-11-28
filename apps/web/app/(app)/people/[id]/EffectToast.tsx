"use client";

import type { EffectLine, Locale } from "@readme/core";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { revertNoteEffects } from "@/app/actions/notes";
import { useUndoToast } from "@/components/UndoToast";
import { ORGANIZING_KEY, TOASTED_KEY, addToasted, editToastKey, effectToastText, newEditLines, organizedMark, parseToasted, pickEffectNote } from "@/lib/organizing";

/** 알림이 뜨기까지 잠깐 기다린다(화면이 막 새로 그려진 직후이고, 개발 모드의 이중 실행이 알림을 지우지 않게) */
const SETTLE_MS = 300;

/**
 * 메모를 막 저장하고 이 사람 화면으로 와서 AI 정리가 끝난 뒤 새로 받은 화면에 '방금 저장한 메모'가 더한 것이 보이면, 아래 토스트로 한 번만 알린다
 * ("좋아하는 음식에 마라탕 넣었어요", 여럿이면 첫 줄 + 외 n개). 되돌리기는 그 메모가 더한 것만 되돌리고 메모는 그대로 둔다(revertNoteEffects).
 * 메모를 고쳐 다시 정리한 뒤(저장 표시에 고친 메모가 들어 있다)에는 그 메모에 새로 생긴 줄만 알리고, 되돌리기도 새로 붙은 일만 되돌린다(전에 더해진 것은 그대로).
 * 알린 메모는 탭 저장소에 적어 두어 다시 오거나 새로 받아도 같은 메모로는 뜨지 않고, 저장 표시(lib/organizing)가 없으면(나중에 들른 사람) 뜨지 않는다. 더한 것이 없으면 아무것도 안 한다.
 * 아무것도 그리지 않고 토스트 영역(role=status)만 단다
 */
export function EffectToast({ contactId, locale, notes }: { contactId: string; locale: Locale; notes: { id: string; createdAt: string; adds: EffectLine[] }[] }) {
  const router = useRouter();
  const { show, toast } = useUndoToast(locale);

  useEffect(() => {
    let found: ReturnType<typeof organizedMark> = null;
    try {
      found = organizedMark(sessionStorage.getItem(ORGANIZING_KEY), contactId);
    } catch {
      /* 저장소를 못 쓰면 알리지 않는다 */
    }
    if (!found) return;
    const mark = found.at;
    const edit = found.edit;
    const timer = window.setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(TOASTED_KEY);
      } catch {
        return;
      }
      if (edit) {
        // 고친 메모: 다시 정리해 새로 생긴 줄만, 고칠 때마다 한 번
        const lines = newEditLines(notes, edit);
        const key = editToastKey(edit, mark);
        if (!lines.length || parseToasted(raw).includes(key)) return;
        try {
          sessionStorage.setItem(TOASTED_KEY, addToasted(raw, key));
        } catch {
          return;
        }
        show({
          text: effectToastText(lines, locale),
          onUndo: () =>
            void (async () => {
              await revertNoteEffects(contactId, edit.note, edit.base).catch(() => null);
              router.refresh();
            })(),
        });
        return;
      }
      const hit = pickEffectNote(
        notes.map((n) => ({ id: n.id, createdAt: n.createdAt, count: n.adds.length })),
        mark,
        parseToasted(raw),
      );
      if (!hit) return;
      try {
        sessionStorage.setItem(TOASTED_KEY, addToasted(raw, hit.id));
      } catch {
        return; // 알린 표시를 못 남기면 새로 받을 때마다 또 뜨니 알리지 않는다
      }
      show({
        text: effectToastText(notes.find((n) => n.id === hit.id)?.adds ?? [], locale),
        onUndo: () =>
          void (async () => {
            await revertNoteEffects(contactId, hit.id).catch(() => null);
            router.refresh();
          })(),
      });
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [notes, contactId, locale, show, router]);

  return toast;
}
