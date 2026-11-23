"use client";

import { translate } from "@readme/core";
import { useCallback, useState } from "react";
import { useFormStatus } from "react-dom";
import { addNote, deleteNote } from "@/app/actions/people";
import { Icon } from "@/components/marks";
import { Sheet } from "@/components/Sheet";
import { useUndoToast } from "@/components/UndoToast";

export interface NoteItem {
  id: string;
  body: string;
  /** 적은 때(직접 단 이름이 있으면 그것) */
  when: string;
}

function AddButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn-primary !h-[41.4px] !min-h-0 shrink-0 !rounded-[10.8px] !py-0 px-[14.4px] !text-[18.9px] !leading-none">
      {label}
    </button>
  );
}

const NOTE_ICON = (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="16.2" height="16.2" fill="none" stroke="#1F2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M6 3.5h9l3.5 3.5v13.5H6z" fill="#FFF4D6" />
    <path d="M15 3.5V7h3.5M9 12h6M9 15.5h4" />
  </svg>
);

/**
 * 사람 화면 프로필 카드의 메모 줄: 메모 아이콘 + 가장 최근 나만 보는 메모 한 줄(넘치면 …) + '+more' 알약.
 * 알약을 누르면 아래에서 시트가 올라와 메모를 모두 보고 적는다(메모가 없으면 줄에는 '+ 메모' 알약만).
 * 적으면 서버가 사람 화면을 다시 그려 목록이 바로 바뀐다(시트는 열린 채로).
 * 지우면 목록에서는 바로 사라지고, 5초 동안 '되돌리기'를 누르면 돌아온다(서버에서 지우는 건 그 뒤에)
 */
export function NotesButton({
  contactId,
  notes,
  labels,
}: {
  contactId: string;
  notes: NoteItem[];
  labels: { more: string; moreText: string; addShort: string; title: string; add: string; placeholder: string; body: string; del: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // 지운(5초 되돌릴 수 있는) 메모 id. 서버가 새 목록을 주면 목록에서 이미 빠져 있다
  const [gone, setGone] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const undo = useUndoToast();
  const shown = notes.filter((n) => !gone.includes(n.id));

  // 되돌리지 않고 끝났을 때 서버에서 지운다. 실패하면 목록에 다시 보인다
  const commit = async (id: string) => {
    const fd = new FormData();
    fd.set("contactId", contactId);
    fd.set("noteId", id);
    try {
      await deleteNote(fd);
    } catch {
      setGone((g) => g.filter((x) => x !== id));
      setFailed(true);
    }
  };
  const remove = (id: string) => {
    setFailed(false);
    setGone((g) => [...g, id]);
    undo.show({
      onUndo: () => setGone((g) => g.filter((x) => x !== id)),
      onCommit: () => void commit(id),
    });
  };

  return (
    <>
      <div className="flex w-full min-w-0 items-center gap-1.5">
        {shown.length ? (
          <>
            {NOTE_ICON}
            <span className="hand-written min-w-0 flex-1 truncate text-[18.9px] leading-[1.2]">{shown[0]!.body}</span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-label={labels.more}
              className="relative flex h-[23.4px] shrink-0 items-center whitespace-nowrap rounded-full border border-edge bg-[#FFF7CF] px-2 text-[11.7px] before:absolute before:-inset-y-[10px] before:-inset-x-[4px] active:scale-95"
            >
              {labels.moreText}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="relative flex h-[23.4px] shrink-0 items-center whitespace-nowrap rounded-full border border-edge bg-[#FFF7CF] px-2 text-[11.7px] before:absolute before:-inset-y-[10px] before:-inset-x-[4px] active:scale-95"
          >
            {labels.addShort}
          </button>
        )}
      </div>

      {open ? (
        <Sheet
          id="notes-title"
          title={labels.title}
          icon={<Icon name="lock" size={18} strokeWidth={1.8} />}
          titleClassName="text-[23.4px] leading-none"
          badge={shown.length ? shown.length : undefined}
          handle
          closeLabel={labels.close}
          onClose={close}
          footer={
            <form action={addNote} className="flex items-end gap-[7.2px]">
              <input type="hidden" name="contactId" value={contactId} />
              <textarea name="body" required maxLength={1000} rows={1} placeholder={labels.placeholder} aria-label={labels.body} className="field max-h-40 !min-h-[41.4px] flex-1 resize-none !rounded-[10.8px] !py-[7.2px] [field-sizing:content]" />
              <AddButton label={labels.add} />
            </form>
          }
        >
          {failed ? (
            <p role="alert" className="px-6 pb-1 text-[14.4px] text-red">
              {translate(document.documentElement.lang === "en" ? "en" : "ko", "common.error")}
            </p>
          ) : null}
          {shown.length ? (
            <ul className="px-6 pb-2 pt-1">
              {shown.map((n) => (
                <li key={n.id} className="flex items-baseline gap-[9px] border-t border-dashed border-ink/30 py-[10.8px] first:border-t-0">
                  <span className="hand-written min-w-0 flex-1 whitespace-pre-line text-[20.7px] leading-[1.25]">{n.body}</span>
                  <span className="shrink-0 text-[10.8px] text-muted">{n.when}</span>
                  {/* 눌리는 칸은 44px, 보이는 건 작은 ×(줄 높이는 그대로) */}
                  <button type="button" aria-label={labels.del} onClick={() => remove(n.id)} className="-my-3 -mr-3 flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center self-center text-muted">
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {/* 시트가 열려 있으면 토스트도 그 안에(열린 시트 밖은 키보드로 갈 수 없다) */}
          {undo.toast}
        </Sheet>
      ) : (
        undo.toast
      )}
    </>
  );
}
