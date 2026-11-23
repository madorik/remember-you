"use client";

import { COLOR_FILL, type FolderView } from "@/lib/folders";
import { Icon } from "../marks";

/**
 * 프로필 고치기의 폴더 줄: 작은 라벨 밑에 그 사람이 들어 있는 폴더 칩들과 끝의 '+'(없으면 '+ 폴더'). 줄 전체가 하나의 단추라 어디를 눌러도 폴더 시트가 열린다.
 * 칩 모양은 칩 하나하나 누르는 자리가 아니라(작아서) 줄 전체를 44px 가까이 눌리게 둔다
 */
export function FolderChips({ folders, label, edit, onOpen }: { folders: FolderView[]; label: string; edit: string; onOpen: () => void }) {
  return (
    <button type="button" aria-haspopup="dialog" aria-label={`${label}: ${edit}`} onClick={onOpen} className="relative flex w-full flex-col items-start gap-0.5 text-left before:absolute before:-inset-x-1 before:-inset-y-1">
      <span className="text-[10.8px] text-muted">{label}</span>
      <span className="flex min-h-[26px] flex-wrap items-center gap-1">
        {folders.map((f) => (
          <span key={f.id} className="inline-flex h-[24.3px] max-w-full items-center gap-1 rounded-full border border-edge bg-white pl-1.5 pr-2 text-[11.7px]">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="12.6" height="12.6" fill="none" stroke="#1F2340" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill={COLOR_FILL[f.color].front} />
            </svg>
            <span className="min-w-0 truncate">{f.name}</span>
          </span>
        ))}
        <span aria-hidden="true" className={`inline-flex h-[24.3px] items-center justify-center rounded-full border border-dashed border-ink/40 text-accent ${folders.length ? "w-[24.3px]" : "gap-0.5 px-2 text-[11.7px]"}`}>
          <Icon name="plus" size={13} strokeWidth={2.4} />
          {folders.length ? null : label}
        </span>
      </span>
    </button>
  );
}
