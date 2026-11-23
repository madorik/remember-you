"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFolder, setPersonFolders } from "@/app/actions/people";
import { FolderArt } from "@/components/FolderArt";
import { DrawnCheck, Icon } from "@/components/marks";
import { Sheet } from "@/components/Sheet";
import { FOLDER_COLORS, type FolderView } from "@/lib/folders";

export interface PersonFolderLabels {
  /** 시트 제목 "{name} · 폴더"(이름 자리는 "{name}") */
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
 * 사람 화면 ··· 메뉴의 '폴더'가 여는 시트: 그 사람이 들어갈 폴더를 체크해서 맞추고, 맨 끝에서 새 폴더를 바로 만들어 넣을 수 있다.
 * (프로필 카드에는 폴더 칩을 두지 않는다 — 폴더는 이 시트에서만 고친다). 열려 있을 때만 그려진다
 */
export function PersonFoldersSheet({ contactId, name, folders, mine, labels, onClose }: { contactId: string; name: string; folders: FolderView[]; mine: string[]; labels: PersonFolderLabels; onClose: () => void }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(mine);
  const [making, setMaking] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

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
      if (r.ok) onClose();
      else setFailed(true);
    });
  }

  return (
    <Sheet
      id="person-folders"
      title={labels.title.replace("{name}", name)}
      closeLabel={labels.close}
      onClose={onClose}
      footer={
        <>
          {failed ? (
            <p role="alert" className="pb-1 text-[14.4px] text-red">
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
              <button type="button" aria-pressed={on} onClick={() => toggle(f.id)} className="flex min-h-[55.8px] w-full items-center gap-3.5 text-left">
                <FolderArt icon={f.icon} color={f.color} size={44} />
                <span className="hand min-w-0 flex-1 truncate text-[17.8px]">{f.name}</span>
                <span className="text-[11.7px] text-muted">{labels.count.replace("{n}", String(f.memberIds.length))}</span>
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
            <button type="button" onClick={() => setMaking(true)} className="flex min-h-[55.8px] w-full items-center gap-3.5 text-left text-accent">
              <span className="flex h-[27.9px] w-10 items-center justify-center rounded-[8.1px] shadow-[inset_0_0_0_2px_var(--color-mango-edge)]">
                <Icon name="plus" size={18} strokeWidth={2.4} />
              </span>
              <span className="text-[17.1px]">{labels.newFolder}</span>
            </button>
          )}
        </li>
      </ul>
    </Sheet>
  );
}
