"use client";

import { useEffect, useRef } from "react";
import { CuteTopicIcon } from "@/components/CuteTopicIcon";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { useDialog } from "@/components/Sheet";
import { TornTape } from "@/components/TornTape";
import { lineText, resultKind, type OrganizeState, type PersonResult } from "@/lib/save-result";
import { u } from "@/lib/ui-scale";

export interface SaveCardLabels {
  /** "엄마, 아빠 메모장에 저장했어요"(이름은 이미 채워 둔다) */
  saved: string;
  organizing: string;
  added: string;
  nothing: string;
  known: string;
  failed: string;
  limit: string;
  reverted: string;
  /** "{name} 보기" */
  view: string;
  undo: string;
  /** 계속 쓰기(온보딩에는 없다) */
  more: string;
}

/** 줄 앞의 동그란 표시: 한 일은 망고 체크, 못 한 일·할 게 없던 일은 속이 빈 점선 동그라미 */
function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full border border-edge bg-sky" style={{ width: u(26), height: u(26) }}>
      <Icon name="check" size={15} strokeWidth={2.4} />
    </span>
  ) : (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-ink/40" style={{ width: u(26), height: u(26) }}>
      <span className="block rounded-full bg-ink/40" style={{ width: u(5), height: u(5) }} />
    </span>
  );
}

/**
 * 메모를 저장한 뒤 메모 화면 위에 뜨는 진행 카드: ① 저장했어요 ✓ → ② 기억해 둔 것으로 정리하는 중(캐릭터가 책을 읽으며 살짝 흔들린다. 움직임 줄이기면 멈춘다) →
 * ③ 결과(항목 아이콘과 함께 한 줄씩, 사람이 여럿이면 사람별) 또는 '새로 더할 건 없었어요'·'이미 알고 있던 내용이에요'·'정리하지 못했어요'.
 * 더했으면 '되돌리기'(그 정리가 더한 것만)·'{이름} 보기'(더한 것이 있으면 기억해 둔 것 칸, 없으면 메모장 칸)·'계속 쓰기'. 정리하는 중에는 눌러 닫을 곳이 없다
 */
export function SaveCard({
  results,
  organizing,
  state,
  reverted,
  reverting,
  labels,
  oneButton = false,
  onOpen,
  onUndo,
  onContinue,
}: {
  results: PersonResult[];
  /** 정리하는 중(결과를 기다린다) */
  organizing: boolean;
  state: OrganizeState;
  /** 더한 것을 되돌렸다 */
  reverted: boolean;
  reverting: boolean;
  labels: SaveCardLabels;
  /** 큰 단추는 하나만(온보딩에서 가려던 곳이 따로 있을 때: 사람마다 나누지 않는다) */
  oneButton?: boolean;
  /** 그 사람 화면으로(더한 것이 있었는지 같이 알린다) */
  onOpen: (personId: string, added: boolean) => void;
  onUndo: () => void;
  /** 없으면(온보딩) '계속 쓰기'를 보이지 않는다 */
  onContinue?: () => void;
}) {
  const dialog = useDialog(() => {
    if (!organizing && onContinue) onContinue();
  });
  const primary = useRef<HTMLButtonElement>(null);
  const added = !reverted && results.some((r) => r.lines.length > 0);
  const many = results.length > 1;
  // 결과가 나오면 큰 단추로 포커스를 옮긴다(키보드·스크린리더가 바로 이어 가게)
  useEffect(() => {
    if (!organizing) primary.current?.focus({ preventScroll: true });
  }, [organizing]);

  const resultText = reverted ? labels.reverted : labels[resultKind(state, added)];
  const sorry = !added && (state === "failed" || state === "ai_off" || state === "limit" || state === "timeout");

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(31,35,64,0.32)] px-4">
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={labels.saved} tabIndex={-1} className="card relative flex max-h-[calc(100dvh-72px)] w-full max-w-[378px] flex-col bg-paper outline-none">
        <TornTape color="pink" w={66} h={20} rotate={-5} className="-top-2.5 left-6" />
        {/* 책 읽는 캐릭터(카드 윗선에 걸터앉는다: 카드 안쪽만 스크롤되니 밖으로 나와도 잘리지 않는다) */}
        <div aria-hidden="true" className="pointer-events-none absolute" style={{ right: u(16), bottom: "calc(100% - 4px)" }}>
          <Mascot pose={7} size={52} className={organizing ? "origin-bottom motion-safe:animate-[save-bob_2.4s_ease-in-out_infinite]" : ""} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" style={{ padding: `${u(26)}px ${u(20)}px ${u(18)}px` }}>
          {/* ① 저장했어요 */}
          <div className="flex items-center gap-[9px]">
            <Mark ok />
            <p className="hand min-w-0 break-keep text-[20.7px] leading-[1.2]">{labels.saved}</p>
          </div>

          {/* ② 정리하는 중 → ③ 결과 */}
          {organizing ? (
            <div role="status" aria-live="polite" className="mt-3.5 flex items-center gap-[9px]">
              <Mark ok={false} />
              <p className="hand flex min-w-0 items-center text-[20.7px] leading-[1.2]">
                <span>{labels.organizing}</span>
                <span aria-hidden="true" className="organize-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </p>
            </div>
          ) : (
            <div role="status" aria-live="polite" className="mt-3.5 flex items-center gap-[9px]">
              <Mark ok={added} />
              <p className={`hand min-w-0 break-keep text-[20.7px] leading-[1.2] ${sorry ? "text-muted" : ""}`}>{resultText}</p>
            </div>
          )}

          {/* 더한 것: 항목 아이콘 + 한 줄씩(사람이 여럿이면 사람 이름 밑에) */}
          {!organizing && added ? (
            <div className="mt-3 flex flex-col" style={{ gap: u(10) }}>
              {results
                .filter((r) => r.lines.length)
                .map((r) => (
                  <div key={r.person.noteId} className="flex flex-col" style={{ gap: u(7) }}>
                    {many ? <p className="hand-written pl-[2px] text-[17.1px] leading-none text-muted">{r.person.name}</p> : null}
                    <ul className="flex flex-col" style={{ gap: u(7) }}>
                      {r.lines.map((l, i) => (
                        <li key={i} className="flex items-center gap-[9px]">
                          <CuteTopicIcon section={l.section} size={30} />
                          <span className="hand-written min-w-0 break-words text-[19.4px] leading-[1.25]">{lineText(l)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : null}

          {/* 단추: {이름} 보기(사람이 여럿이면 한 사람씩) · 되돌리기 · 계속 쓰기 */}
          {!organizing ? (
            <div className="mt-4 flex flex-col" style={{ gap: u(9) }}>
              {/* 더한 것이 있는 사람이 먼저(큰 단추) */}
              {[...results].sort((a, b) => Number(b.lines.length > 0) - Number(a.lines.length > 0)).slice(0, oneButton ? 1 : results.length).map((r, i) => {
                const text = labels.view.replace("{name}", r.person.name);
                const goes = r.lines.length > 0 && !reverted;
                return (
                  <button key={r.person.noteId} ref={i === 0 ? primary : undefined} type="button" onClick={() => onOpen(r.person.id, goes)} className={`${i === 0 ? "btn-primary" : "btn-outline"} w-full`}>
                    {text}
                  </button>
                );
              })}
              {added || onContinue ? (
                <div className="flex items-center justify-center gap-1">
                  {added ? (
                    <button type="button" onClick={onUndo} disabled={reverting} className="hand relative flex min-h-11 items-center gap-[4.5px] rounded-full px-3.5 text-[17.1px] leading-none text-muted disabled:opacity-60">
                      <Icon name="undo" size={16} strokeWidth={2} />
                      {labels.undo}
                    </button>
                  ) : null}
                  {onContinue ? (
                    <button type="button" onClick={onContinue} disabled={reverting} className="hand relative flex min-h-11 items-center rounded-full px-3.5 text-[17.1px] leading-none text-muted disabled:opacity-60">
                      {labels.more}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
