"use client";

import { useRef, useState, useTransition } from "react";
import { setNickname } from "@/app/actions/people";
import { Icon } from "@/components/marks";

/**
 * 사람 화면 프로필 카드의 이름(망고 형광펜): 누르면 그 자리에서 고친다. 입력 칸에 ✓(저장)·×(취소)가 붙고 Enter는 저장, Esc는 취소.
 * 저장은 프로필 고치기의 '부르는 말'과 같은 필드(setNickname)라 비울 수 없다. 이름 글자는 이름 줄 크기 그대로 두고 칸만 바꿔 줄 높이가 흔들리지 않는다.
 * 제목(h1)은 그대로 두고 그 위에 투명한 단추를 얹어, 제목 이름이 사람 이름 그대로 읽힌다.
 */
export function NameEditor({
  contactId,
  initial,
  labels,
}: {
  contactId: string;
  initial: string;
  labels: { edit: string; save: string; cancel: string; error: string };
}) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);
  const clean = draft.replace(/\s+/g, " ").trim();

  const close = () => {
    setEditing(false);
    setError(false);
    // 닫은 뒤 키보드 사용자가 이름 단추로 돌아오게
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const cancel = () => {
    setDraft(value);
    close();
  };
  const save = () => {
    if (pending || !clean) return;
    if (clean === value) return close();
    setError(false);
    start(async () => {
      const r = await setNickname(contactId, clean).catch(() => ({ ok: false, nickname: clean }));
      if (!r.ok) return setError(true);
      setValue(r.nickname);
      setDraft(r.nickname);
      close();
    });
  };

  if (editing) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`flex h-11 min-w-0 items-center border-b border-dashed ${error || !clean ? "border-red" : "border-ink/40"}`}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            maxLength={40}
            autoFocus
            enterKeyHint="done"
            aria-label={labels.edit}
            aria-invalid={!clean || error || undefined}
            className="hand-written h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[22.5px] leading-none outline-none"
          />
          <button
            type="button"
            aria-label={labels.save}
            disabled={pending || !clean}
            onClick={save}
            className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge bg-sky text-ink before:absolute before:-inset-2 disabled:opacity-40"
          >
            <Icon name="check" size={15} strokeWidth={2.2} />
          </button>
          <button type="button" aria-label={labels.cancel} onClick={cancel} className="relative ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted before:absolute before:-inset-1.5">
            <Icon name="close" size={15} strokeWidth={2} />
          </button>
        </div>
        {error ? (
          <p role="alert" className="pt-0.5 text-[12.6px] leading-none text-red">
            {labels.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      {/* 긴 이름은 두 줄까지 */}
      <h1 className="hl line-clamp-2 min-w-0 break-words px-0.5 text-[36.9px] leading-none">{value}</h1>
      <button
        ref={trigger}
        type="button"
        aria-label={labels.edit}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="absolute -inset-1.5"
      />
    </div>
  );
}
