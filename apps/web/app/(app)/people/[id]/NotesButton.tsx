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
    <button disabled={pending} className="btn-primary !h-12 shrink-0 !rounded-[12.6px] px-4 !text-[14.6px]">
      {label}
    </button>
  );
}

/**
 * 사람 화면 '기억해 둔 것' 제목 옆 '메모 N' 버튼(연필 옆): 누르면 아래에서 시트가 올라와 나만 보는 메모를 보고 적는다.
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
  labels: { button: string; title: string; add: string; placeholder: string; body: string; del: string; close: string };
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-[9px] border border-edge bg-sky-soft pl-[6.3px] pr-2.5 text-[11.7px] active:scale-95"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="15.3" height="15.3" fill="none" stroke="#1F2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M6 3.5h9l3.5 3.5v13.5H6z" fill="#FFF4D6" />
          <path d="M15 3.5V7h3.5M9 12h6M9 15.5h4" />
        </svg>
        {shown.length ? `${labels.button} ${shown.length}` : labels.button}
      </button>

      {open ? (
        <Sheet
          id="notes-title"
          title={labels.title}
          icon={<Icon name="lock" size={15} strokeWidth={2.2} />}
          closeLabel={labels.close}
          onClose={close}
          footer={
            <form action={addNote} className="flex items-end gap-2">
              <input type="hidden" name="contactId" value={contactId} />
              <textarea name="body" required maxLength={1000} rows={1} placeholder={labels.placeholder} aria-label={labels.body} className="field max-h-40 flex-1 resize-none [field-sizing:content]" />
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
            <ul className="px-6 pb-2">
              {shown.map((n) => (
                <li key={n.id} className="flex items-start gap-2 border-t border-rule py-3 text-[16.2px] leading-[1.4] first:border-t-0">
                  <span className="min-w-0 flex-1 whitespace-pre-line">{n.body}</span>
                  <span className="shrink-0 pt-[2px] text-[13.5px] text-muted">{n.when}</span>
                  {/* 눌리는 칸은 44px, 보이는 건 작은 ×(줄 높이는 그대로) */}
                  <button type="button" aria-label={labels.del} onClick={() => remove(n.id)} className="-my-3 -mr-3 flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center text-muted">
                    <Icon name="close" size={15} />
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
