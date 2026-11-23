"use client";

import type { Locale } from "@readme/core";
import Link from "@/components/AppLink";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { addToFolder, removeFromFolder } from "@/app/actions/people";
import { Icon } from "@/components/marks";
import { RowBody, type PersonRow } from "@/components/PersonRow";
import { useUndoToast } from "@/components/UndoToast";

interface Labels {
  /** "{name} 폴더에서 빼기"(이름 자리는 "{name}") */
  remove: string;
  /** 뺀 뒤 토스트 글 */
  removed: string;
  addPeople: string;
  error: string;
}

type Op = { type: "remove"; id: string } | { type: "restore"; row: PersonRow; at: number };

/**
 * 폴더 안 사람 목록: 줄을 누르면 그 사람 화면, 줄 오른쪽 끝 '−'를 누르면 이 폴더에서만 뺀다(사람은 그대로).
 * 빼면 바로 목록에서 사라지고(서버에도 바로 반영) 5초 동안 '되돌리기'를 누르면 제자리에 돌아온다. 끝 줄은 사람 넣기
 */
export function FolderMembers({
  folderId,
  rows,
  here,
  locale,
  labels,
}: {
  folderId: string;
  rows: PersonRow[];
  /** 사람 화면에서 돌아올 이 폴더 주소 */
  here: string;
  locale: Locale;
  labels: Labels;
}) {
  const [shown, apply] = useOptimistic(rows, (cur, op: Op) => {
    if (op.type === "remove") return cur.filter((r) => r.contactId !== op.id);
    if (cur.some((r) => r.contactId === op.row.contactId)) return cur;
    return [...cur.slice(0, op.at), op.row, ...cur.slice(op.at)];
  });
  const [, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const undo = useUndoToast(locale);
  // 빼기와 되돌리기가 서로 앞서지 않게 하나씩 차례로 보낸다
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const send = (job: () => Promise<{ ok: boolean }>) => {
    const p = queue.current.then(job).catch(() => ({ ok: false }));
    queue.current = p;
    return p;
  };

  const restore = (row: PersonRow, at: number) => {
    setFailed(false);
    start(async () => {
      apply({ type: "restore", row, at });
      const r = await send(() => addToFolder(folderId, row.contactId));
      if (!r.ok) setFailed(true);
    });
  };

  const remove = (row: PersonRow) => {
    const at = shown.findIndex((r) => r.contactId === row.contactId);
    setFailed(false);
    start(async () => {
      apply({ type: "remove", id: row.contactId });
      const r = await send(() => removeFromFolder(folderId, row.contactId));
      // 실패하면 서버 목록 그대로(사라졌던 줄이 돌아온다)
      if (!r.ok) setFailed(true);
    });
    undo.show({ text: labels.removed, onUndo: () => restore(row, at) });
  };

  return (
    <>
      <ul className="flex flex-col">
        {shown.map((r) => (
          <li key={r.contactId} className="flex items-center border-t border-dashed border-ink/30 first-of-type:border-t-0">
            <Link href={`/people/${r.contactId}?back=${encodeURIComponent(here)}`} className="flex min-h-[50.4px] min-w-0 flex-1 items-center gap-2.5">
              <RowBody row={r} />
            </Link>
            <button
              type="button"
              aria-label={labels.remove.replace("{name}", r.name)}
              onClick={() => remove(r)}
              // 보이는 동그라미는 26px, 누르는 자리는 44px
              className="-mr-1.5 flex h-11 w-[27px] shrink-0 items-center justify-center text-ink active:bg-fill"
            >
              <span className="flex h-[19.8px] w-[19.8px] items-center justify-center rounded-full border border-edge">
                <Icon name="close" size={11} strokeWidth={2.4} />
              </span>
            </button>
          </li>
        ))}
        <li className="border-t border-dashed border-ink/30 first-of-type:border-t-0">
          <Link href={`${here}${here.includes("?") ? "&" : "?"}add=1`} scroll={false} className="flex min-h-[48.6px] items-center gap-2.5 text-muted">
            <span className="flex h-10 w-10 relative before:absolute before:-inset-[3.6px] shrink-0 items-center justify-center rounded-full border border-dashed border-ink/30 text-muted">
              <Icon name="plus" size={18} strokeWidth={1.8} />
            </span>
            <span className="text-[13.5px] leading-[1.35]">{labels.addPeople}</span>
          </Link>
        </li>
      </ul>
      {failed ? (
        <p role="alert" className="pb-3 text-[14.4px] text-red">
          {labels.error}
        </p>
      ) : null}
      {undo.toast}
    </>
  );
}
