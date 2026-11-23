"use client";

import type { AvatarConfig } from "@readme/core";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { setFolderMembers } from "@/app/actions/people";
import { Avatar } from "@/components/Avatar";
import { FolderMini } from "@/components/FolderArt";
import { FolderSheet } from "@/components/FolderSheet";
import { DrawnCheck } from "@/components/marks";
import { Sheet } from "@/components/Sheet";
import type { FolderSheetLabels, FolderView } from "@/lib/folders";
import { matchesPerson } from "@/lib/search";

interface PeopleLabels {
  title: string;
  search: string;
  /** "{n}명 넣기" */
  addN: string;
  done: string;
  close: string;
  error: string;
}

/**
 * 폴더 화면의 시트들. 주소로 연다: ?add=1 사람 넣기(새 폴더를 만들면 바로 이걸로 온다), ?edit=1 폴더 고치기.
 * 닫으면 주소에서 뺀다(정렬은 그대로)
 */
export function FolderSheets({
  folder,
  open,
  back,
  people,
  labels,
  sheet,
}: {
  folder: FolderView;
  open: "add" | "edit" | null;
  /** 닫을 때 갈 주소(이 폴더, 정렬 유지) */
  back: string;
  people: { contactId: string; name: string; tag: string; avatar: AvatarConfig | null }[];
  labels: PeopleLabels;
  sheet: FolderSheetLabels;
}) {
  const router = useRouter();
  const close = useCallback(() => router.replace(back, { scroll: false }), [router, back]);
  if (open === "edit") return <FolderSheet folder={folder} labels={sheet} onClose={close} />;
  if (open === "add") return <AddPeople folder={folder} people={people} labels={labels} onClose={close} />;
  return null;
}

function AddPeople({
  folder,
  people,
  labels,
  onClose,
}: {
  folder: FolderView;
  people: { contactId: string; name: string; tag: string; avatar: AvatarConfig | null }[];
  labels: PeopleLabels;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(folder.memberIds);
  const [query, setQuery] = useState("");
  const [busy, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const shown = people.filter((p) => matchesPerson(query, p.name, p.tag));
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  // 빈 폴더에 넣을 때는 "n명 넣기", 이미 사람이 있으면 고친 대로 "완료"
  const cta = !folder.memberIds.length && picked.length ? labels.addN.replace("{n}", String(picked.length)) : labels.done;

  function save() {
    setFailed(false);
    start(async () => {
      const r = await setFolderMembers(folder.id, picked);
      if (r.ok) onClose();
      else setFailed(true);
    });
  }

  return (
    <Sheet
      id="add-people"
      title={folder.name}
      icon={<FolderMini color={folder.color} size={24} />}
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
            {cta}
          </button>
        </>
      }
    >
      <div className="relative px-6 pb-2 pt-2">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16.2" height="16.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="absolute left-[34.2px] top-[20.7px] text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="h-12 w-full rounded-[12.6px] bg-fill pl-[37.8px] pr-3.5 text-[16px] outline-none placeholder:text-muted"
        />
      </div>
      <ul className="flex flex-col px-6 pb-2">
        {shown.map((p) => {
          const on = picked.includes(p.contactId);
          return (
            <li key={p.contactId} className="border-t border-rule first:border-t-0">
              <button type="button" aria-pressed={on} onClick={() => toggle(p.contactId)} className="flex min-h-[57.6px] w-full items-center gap-3.5 text-left">
                <span aria-hidden="true">
                  <Avatar config={p.avatar} size={44} label={p.name} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[17.1px] tracking-[-0.02em]">{p.name}</span>
                <DrawnCheck on={on} />
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
