"use client";

import Link from "@/components/AppLink";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { addToFolder, createFolder, removeFromFolder, setPersonFolders } from "@/app/actions/people";
import { FolderArt } from "@/components/FolderArt";
import { DrawnCheck, Icon } from "@/components/marks";
import { Sheet } from "@/components/Sheet";
import { useUndoToast } from "@/components/UndoToast";
import { FOLDER_COLORS, type FolderView } from "@/lib/folders";

interface Labels {
  /** "+" 버튼·시트 제목 */
  put: string;
  /** 칩 오른쪽 '×'의 이름 "{name} 폴더에서 빼기"(이름 자리는 "{name}") */
  removeFrom: string;
  /** 뺀 뒤 토스트 글 */
  removed: string;
  /** "{name} · 폴더" */
  title: string;
  done: string;
  newFolder: string;
  namePlaceholder: string;
  create: string;
  /** "{n}명" */
  count: string;
  close: string;
  error: string;
}

/**
 * 사람 화면 이름 밑: 그 사람이 든 폴더 칩(누르면 그 폴더, 오른쪽 ×를 누르면 그 폴더에서만 뺀다) + "+"(폴더 고르기 시트).
 * 빼면 칩이 바로 사라지고(서버에도 바로 반영) 5초 동안 '되돌리기'를 누르면 돌아온다.
 * 시트에서 체크한 폴더로 맞추고, 맨 끝에서 새 폴더를 바로 만들어 넣을 수 있다
 */
export function PersonFolders({ contactId, name, folders, mine, labels }: { contactId: string; name: string; folders: FolderView[]; mine: string[]; labels: Labels }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // 든 폴더(빼기·되돌리기는 서버가 답하기 전에 먼저 보인다)
  const [now, apply] = useOptimistic(mine, (cur, op: { type: "remove" | "add"; id: string }) =>
    op.type === "remove" ? cur.filter((x) => x !== op.id) : cur.includes(op.id) ? cur : [...cur, op.id],
  );
  const [, startMove] = useTransition();
  const [moveFailed, setMoveFailed] = useState(false);
  const undo = useUndoToast();
  // 빼기와 되돌리기가 서로 앞서지 않게 하나씩 차례로 보낸다
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [picked, setPicked] = useState<string[]>(mine);
  const [making, setMaking] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const inFolders = folders.filter((f) => now.includes(f.id));
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  const move = (type: "remove" | "add", id: string) => {
    setMoveFailed(false);
    startMove(async () => {
      apply({ type, id });
      const job = () => (type === "remove" ? removeFromFolder(id, contactId) : addToFolder(id, contactId));
      const p = queue.current.then(job).catch(() => ({ ok: false }));
      queue.current = p;
      // 실패하면 서버 목록 그대로(사라졌던 칩이 돌아온다)
      if (!(await p).ok) setMoveFailed(true);
    });
  };
  const takeOut = (id: string) => {
    move("remove", id);
    undo.show({ text: labels.removed, onUndo: () => move("add", id) });
  };

  function openSheet() {
    setPicked(now);
    setMaking(false);
    setFailed(false);
    setOpen(true);
  }

  function make() {
    const n = newName.replace(/\s+/g, " ").trim();
    if (!n) return;
    start(async () => {
      const r = await createFolder({ name: n, icon: "star", color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length] });
      if (!r) return setFailed(true);
      setPicked((p) => (p.includes(r.id) ? p : [...p, r.id]));
      setNewName("");
      setMaking(false);
      router.refresh();
    });
  }

  function save() {
    setFailed(false);
    start(async () => {
      const r = await setPersonFolders(contactId, picked);
      if (r.ok) setOpen(false);
      else setFailed(true);
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {inFolders.map((f) => (
          // 보이는 칩은 34px, 누르는 자리는 위아래 5px씩 넓혀 44px(before). 오른쪽 ×는 가로도 5px씩 넓혀 44×44
          <span key={f.id} className="flex h-[34px] min-w-0 max-w-full items-center rounded-[10px] border-[1.5px] border-ink bg-white">
            <Link href={`/people/folder/${f.id}`} className="hand relative flex h-full min-w-0 items-center gap-[5px] pl-2 pr-1.5 text-[22px] leading-none before:absolute before:-inset-y-[5px] before:inset-x-0">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#1F2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="#FFF4D6" />
              </svg>
              <span className="truncate">{f.name}</span>
            </Link>
            <button
              type="button"
              aria-label={labels.removeFrom.replace("{name}", f.name)}
              onClick={() => takeOut(f.id)}
              className="relative flex h-full w-7 shrink-0 items-center justify-center text-muted before:absolute before:-inset-[5px] active:text-ink"
            >
              <Icon name="close" size={12} strokeWidth={2.2} />
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label={labels.put}
          onClick={openSheet}
          // 보이는 네모는 34px, 누르는 자리는 44px(before)
          className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-ink text-ink before:absolute before:-inset-[5px]"
        >
          <Icon name="plus" size={16} strokeWidth={2.2} />
        </button>
      </div>
      {moveFailed ? (
        <p role="alert" className="pt-1 text-[16px] text-red">
          {labels.error}
        </p>
      ) : null}
      {undo.toast}

      {open ? (
        <Sheet
          id="person-folders"
          title={labels.title.replace("{name}", name)}
          closeLabel={labels.close}
          onClose={() => setOpen(false)}
          footer={
            <>
              {failed ? (
                <p role="alert" className="pb-1 text-[16px] text-red">
                  {labels.error}
                </p>
              ) : null}
              <button type="button" disabled={busy} onClick={save} className="btn-primary">
                {labels.done}
              </button>
            </>
          }
        >
          <ul className="flex flex-col px-6 pb-2">
            {folders.map((f) => {
              const on = picked.includes(f.id);
              return (
                <li key={f.id} className="border-t border-rule first:border-t-0">
                  <button type="button" aria-pressed={on} onClick={() => toggle(f.id)} className="flex min-h-[62px] w-full items-center gap-3.5 text-left">
                    <FolderArt icon={f.icon} color={f.color} size={44} />
                    <span className="hand min-w-0 flex-1 truncate text-[22px]">{f.name}</span>
                    <span className="text-[13px] text-muted">{labels.count.replace("{n}", String(f.memberIds.length))}</span>
                    <DrawnCheck on={on} />
                  </button>
                </li>
              );
            })}
            <li className="border-t border-rule first:border-t-0">
              {making ? (
                <form
                  className="flex gap-2 py-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    make();
                  }}
                >
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={30}
                    autoFocus
                    placeholder={labels.namePlaceholder}
                    aria-label={labels.namePlaceholder}
                    className="field min-w-0 flex-1"
                  />
                  <button disabled={busy || !newName.trim()} className="btn-primary !min-h-12 shrink-0 px-5">
                    {labels.create}
                  </button>
                </form>
              ) : (
                <button type="button" onClick={() => setMaking(true)} className="flex min-h-[62px] w-full items-center gap-3.5 text-left text-accent">
                  <span className="flex h-[31px] w-10 items-center justify-center rounded-[9px] shadow-[inset_0_0_0_2px_var(--color-mango-edge)]">
                    <Icon name="plus" size={18} strokeWidth={2.4} />
                  </span>
                  <span className="text-[19px]">{labels.newFolder}</span>
                </button>
              )}
            </li>
          </ul>
        </Sheet>
      ) : null}
    </>
  );
}
