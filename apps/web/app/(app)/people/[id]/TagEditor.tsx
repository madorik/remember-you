"use client";

import { useState, useTransition } from "react";
import { setNickname } from "@/app/actions/people";
import { Icon } from "@/components/marks";

/**
 * 사람 화면 이름 밑: 태그(내가 부르는 이름). 누르면 그 자리에서 고치고, 없으면 '+ 태그'로 단다.
 * 직접 적은 사람·기다리는 사람은 태그가 곧 이름이라(nameIsTag) 위 이름이 바뀌고, 비울 수 없다.
 */
export function TagEditor({
  contactId,
  initial,
  nameIsTag,
  labels,
}: {
  contactId: string;
  initial: string;
  nameIsTag: boolean;
  labels: { tag: string; add: string; edit: string; rename: string; placeholder: string; save: string; cancel: string; error: string };
}) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const clean = draft.replace(/\s+/g, " ").trim();

  function save() {
    if (nameIsTag && !clean) return;
    if (clean === value) {
      setEditing(false);
      return;
    }
    setError(false);
    start(async () => {
      const r = await setNickname(contactId, clean);
      if (!r.ok) {
        setError(true);
        return;
      }
      setValue(r.nickname);
      setDraft(r.nickname);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <form
        className="flex flex-col gap-1 pt-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      >
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={40}
            autoFocus
            enterKeyHint="done"
            placeholder={labels.placeholder}
            aria-label={labels.tag}
            className="field !h-11 !min-h-11 min-w-0 flex-1 !px-3 !text-[16.2px]"
          />
          <button disabled={pending || (nameIsTag && !clean)} className="btn-primary !min-h-11 shrink-0 !rounded-[12.6px] px-3.5 !text-[13.8px]">
            {labels.save}
          </button>
          <button
            type="button"
            aria-label={labels.cancel}
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            // 보이는 폭은 32px, 누르는 자리는 좌우 6px씩 넓혀 44px(before)
            className="relative flex h-11 w-8 shrink-0 items-center justify-center text-muted before:absolute before:-inset-x-1.5 before:inset-y-0"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-[14.4px] text-red">
            {labels.error}
          </p>
        ) : null}
      </form>
    );
  }

  // 태그가 이름이면 '이름 고치기', 따로 있으면 태그 자체를 누르고, 없으면 '+ 태그'
  return (
    <span className="flex">
      {nameIsTag ? (
        <button type="button" onClick={() => setEditing(true)} className="relative flex min-h-8 items-center gap-1 text-[14.4px] text-muted before:absolute before:-inset-x-1.5 before:-inset-y-1.5">
          <Icon name="pencil" size={14} strokeWidth={2} />
          {labels.rename}
        </button>
      ) : value ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`${labels.tag} ${value} ${labels.edit}`}
          className="relative flex max-w-full items-center gap-1 rounded-md bg-fill px-2 py-[2.7px] text-[14.4px] text-muted before:absolute before:-inset-x-1.5 before:-inset-y-2.5"
        >
          <span className="truncate">{value}</span>
          <Icon name="pencil" size={12} strokeWidth={2} className="shrink-0" />
        </button>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="relative flex items-center gap-0.5 rounded-md px-2 py-[2.7px] text-[14.4px] text-muted shadow-[inset_0_0_0_1px_var(--color-edge)] before:absolute before:-inset-x-1.5 before:-inset-y-2.5">
          <Icon name="plus" size={13} strokeWidth={2.2} />
          {labels.add}
        </button>
      )}
    </span>
  );
}
