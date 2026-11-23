"use client";

import { useState, useTransition } from "react";
import { captureNote, saveCapture, undoCapture, type CaptureDraftLine, type CaptureState } from "@/app/actions/capture";
import { CaptureBadge, struck, type CaptureBadgeLabels } from "@/components/CaptureBadge";
import { MarginLine } from "@/components/diary";
import { Icon } from "@/components/marks";
import { TornTape } from "@/components/TornTape";

/**
 * 그 사람 화면 맨 위 한 줄: 적으면 AI가 이 사람 이야기로 맞는 칸을 찾아 더하고("해바라기 좋아함"), 바꾸고("신발 245로 바뀌었어"),
 * 지운다("땅콩 알레르기 아니래"). 맞는 칸이 없는 새 이야기는 메모로. 바뀐 것은 바로 아래에 보이고 되돌릴 수 있다
 */
export function QuickNote({
  contactId,
  labels,
}: {
  contactId: string;
  labels: CaptureBadgeLabels & { placeholder: string; save: string; undo: string; undone: string; failed: string; limit: string; nothing: string; aiOff: string; holdTitle: string; holdApply: string; holdCancel: string };
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<CaptureState | null>(null);
  const [undone, setUndone] = useState(false);
  // 알레르기·못 먹는 것을 지우거나 바꾸는 줄: 바로 적지 않고 확인을 받는다
  const [held, setHeld] = useState<CaptureDraftLine[]>([]);
  const [pending, start] = useTransition();
  const self = `/people/${contactId}`;

  const submit = () => {
    const v = text.trim();
    if (!v || pending) return;
    start(async () => {
      const r = await captureNote(v, contactId).catch((): CaptureState => ({ lines: [], undo: [], error: "failed" }));
      setResult(r);
      setHeld(r.held ?? []);
      setUndone(false);
      if (!r.error) setText("");
    });
  };

  // 확인을 받으면 그 줄들을 저장한다(되돌리기도 생긴다). 저장할 게 이미 없어졌으면 '이미'로 알려 준다
  const confirmHeld = () => {
    if (!held.length || pending) return;
    start(async () => {
      const r = await saveCapture(held.map((l) => l.item)).catch((): CaptureState => ({ lines: [], undo: [], error: "failed" }));
      setResult(r);
      setHeld([]);
      setUndone(false);
    });
  };

  const error = result?.error === "ai_off" ? labels.aiOff : result?.error === "nothing" ? labels.nothing : result?.error === "limit" ? labels.limit : result?.error ? labels.failed : null;

  return (
    <div className="card ruled relative mx-4 mt-3 flex flex-col pb-2 pl-[42px] pr-3 pt-2">
      <MarginLine />
      <TornTape color="mint" w={60} h={18} rotate={-8} className="-top-2.5 left-3.5" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={500}
          enterKeyHint="send"
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          className="max-h-36 min-h-11 min-w-0 flex-1 resize-none border-0 border-b-[1.5px] border-dashed border-ink/40 bg-transparent px-0.5 py-[9px] text-[15px] leading-[1.3] outline-none [field-sizing:content] placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label={labels.save}
          disabled={!text.trim() || pending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-sky text-ink transition-colors disabled:bg-fill disabled:text-muted"
        >
          {pending ? <span className="h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-current border-t-transparent" /> : <Icon name="up" size={20} strokeWidth={2.4} />}
        </button>
      </form>

      {result && (result.lines.length > 0 || error) ? (
        <div role="status" aria-live="polite" className="mx-2 border-t border-rule pb-0.5 pt-1.5">
          {error ? (
            <p className="py-2 text-[16px] text-red">{error}</p>
          ) : (
            <div className="flex items-end gap-2">
              <ul className={`flex min-w-0 flex-1 flex-col py-1 ${undone ? "opacity-40" : ""}`}>
                {result.lines.map((l, i) => (
                  <li key={i} className="flex min-h-8 items-center gap-2 text-[17px]">
                    <Icon name="check" size={15} strokeWidth={2.6} className={`shrink-0 ${l.same ? "text-muted" : "text-ok"}`} />
                    <span className="shrink-0 text-muted">{l.href === self ? l.field : `${l.who} · ${l.field}`}</span>
                    <span className={`min-w-0 flex-1 truncate ${struck(l)}`}>{l.value}</span>
                    <CaptureBadge line={l} labels={labels} />
                  </li>
                ))}
              </ul>
              {result.undo.length ? (
                <button
                  type="button"
                  disabled={undone || pending}
                  onClick={() =>
                    start(async () => {
                      const r = await undoCapture(result.undo);
                      if (r.ok) setUndone(true);
                    })
                  }
                  className="flex min-h-11 shrink-0 items-center px-1.5 text-[16px] text-muted disabled:opacity-60"
                >
                  {undone ? labels.undone : labels.undo}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {held.length ? (
        <div role="group" aria-label={labels.holdTitle} className="mx-2 border-t border-rule pb-0.5 pt-1.5">
          <p className="text-[16px] text-muted">{labels.holdTitle}</p>
          <ul className="flex flex-col py-1">
            {held.map((l, i) => (
              <li key={i} className="flex min-h-8 items-center gap-2 text-[17px]">
                <span className="shrink-0 text-muted">{l.href === self ? l.field : `${l.who} · ${l.field}`}</span>
                <span className={`min-w-0 flex-1 truncate ${struck(l)}`}>{l.value}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-1">
            <button type="button" disabled={pending} onClick={() => setHeld([])} className="flex min-h-11 items-center px-3 text-[17px] text-muted disabled:opacity-60">
              {labels.holdCancel}
            </button>
            <button type="button" disabled={pending} onClick={confirmHeld} className="btn-primary !h-11 !px-5 !text-[18px] disabled:opacity-60">
              {labels.holdApply}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
