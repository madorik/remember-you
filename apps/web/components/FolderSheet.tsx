"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFolder, deleteFolder, updateFolder } from "@/app/actions/people";
import { COLOR_FILL, FOLDER_COLORS, FOLDER_ICONS, type FolderColor, type FolderIcon, type FolderSheetLabels, type FolderView } from "@/lib/folders";
import { FolderArt, FolderIconGlyph } from "./FolderArt";
import { Sheet } from "./Sheet";

/**
 * 새 폴더 만들기·폴더 고치기 시트: 이름 · 모양 · 색(위 그림이 바로 바뀐다).
 * 만들면 그 폴더 화면으로 가서 바로 사람 넣기 시트를 연다. 기본 폴더는 이름을 못 바꾸고 못 지운다
 */
export function FolderSheet({ folder, labels, onClose }: { folder?: FolderView | null; labels: FolderSheetLabels; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(folder?.name ?? "");
  const [icon, setIcon] = useState<FolderIcon>(folder?.icon ?? "star");
  const [color, setColor] = useState<FolderColor>(folder?.color ?? "lavender");
  const [busy, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const builtin = !!folder?.builtin;
  const ready = builtin || !!name.trim();

  function submit() {
    if (!ready) return;
    setFailed(false);
    start(async () => {
      if (folder) {
        const r = await updateFolder(folder.id, { name, icon, color });
        if (r.ok) onClose();
        else setFailed(true);
        return;
      }
      const r = await createFolder({ name, icon, color });
      if (r) router.push(`/people/folder/${r.id}?add=1`);
      else setFailed(true);
    });
  }

  function remove() {
    if (!folder || !window.confirm(labels.deleteConfirm.replace("{name}", folder.name))) return;
    start(async () => {
      const r = await deleteFolder(folder.id);
      if (r.ok) router.replace("/people");
      else setFailed(true);
    });
  }

  return (
    <Sheet
      id="folder-sheet"
      title={folder ? labels.edit : labels.new}
      closeLabel={labels.close}
      onClose={onClose}
      footer={
        <>
          {failed ? (
            <p role="alert" className="pb-1 text-[16px] text-red">
              {labels.error}
            </p>
          ) : null}
          <button type="button" disabled={busy || !ready} onClick={submit} className="btn-primary">
            {folder ? labels.save : labels.create}
          </button>
          {folder && !builtin ? (
            <button type="button" disabled={busy} onClick={remove} className="flex min-h-11 items-center justify-center text-[17px] text-red">
              {labels.del}
            </button>
          ) : null}
        </>
      }
    >
      <div className="flex justify-center pb-3.5 pt-1.5">
        <FolderArt icon={icon} color={color} size={120} showIcon />
      </div>
      <form
        className="flex flex-col gap-2 px-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="folder-name" className="label">
          {labels.name}
        </label>
        <input
          id="folder-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={builtin}
          maxLength={30}
          autoFocus={!folder}
          placeholder={labels.namePlaceholder}
          className="field disabled:bg-fill disabled:text-muted"
        />
      </form>
      <div className="flex flex-col gap-2 px-6 pt-5">
        <span className="label">{labels.icon}</span>
        <div className="grid grid-cols-4 gap-2">
          {FOLDER_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              aria-label={labels.icons[i]}
              aria-pressed={icon === i}
              onClick={() => setIcon(i)}
              className={`flex h-14 items-center justify-center rounded-2xl transition-colors ${icon === i ? "bg-sky-soft shadow-[inset_0_0_0_2px_var(--color-ink)]" : "bg-fill"}`}
            >
              <FolderIconGlyph icon={i} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-6 pb-2 pt-5">
        <span className="label">{labels.color}</span>
        <div className="flex flex-wrap gap-3.5 pl-1">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={labels.colors[c]}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              // 보이는 동그라미는 40px, 누르는 자리는 44px(before)
              className="relative h-10 w-10 rounded-full before:absolute before:-inset-0.5"
              style={{
                background: COLOR_FILL[c].front,
                boxShadow: color === c ? "0 0 0 3px #fff, 0 0 0 5px var(--color-ink)" : "inset 0 0 0 1.5px rgb(31 35 64 / 0.16)",
              }}
            />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
