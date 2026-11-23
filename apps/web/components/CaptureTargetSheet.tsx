"use client";

import type { AvatarConfig } from "@readme/core";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { DrawnCheck, Icon } from "@/components/marks";
import { TagChip } from "@/components/PersonRow";
import { Sheet } from "@/components/Sheet";
import { tidyName, type CaptureTarget } from "@/lib/capture-target";
import { matchesPerson } from "@/lib/search";

/** 대상으로 고를 수 있는 내 사람 */
export interface TargetPerson {
  id: string;
  name: string;
  /** 내가 붙인 부르는 말(이름과 같거나 없으면 "") */
  tag: string;
  avatar: AvatarConfig | null;
  /** 이름이 같은 사람을 가려 볼 때 곁에 작게 붙이는 기록 요약 */
  hint?: string;
}

export interface TargetSheetLabels {
  title: string;
  close: string;
  search: string;
  empty: string;
  /** "같은 이름 {n}명" */
  sameName: string;
  /** 새 사람으로 */
  asNew: string;
  /** 같은 이름 줄 모두 바꾸기 */
  all: string;
}

/**
 * 한 줄의 대상(누구의 이야기인지) 바꾸기 시트: 찾기 칸 · 내 사람 목록(같은 이름 후보가 있으면 맨 위) · 맨 아래 '새 사람으로' + 이름 칸.
 * 고르면 onPick(대상, 같은 이름 줄도 같이 바꿀지). 같은 이름 줄이 더 있을 때만 '모두 바꾸기' 스위치가 보이고 기본은 켜짐
 */
export function CaptureTargetSheet({
  people,
  current,
  candidates,
  spoken,
  siblings,
  labels,
  onPick,
  onClose,
}: {
  people: TargetPerson[];
  current: CaptureTarget;
  candidates: string[];
  spoken: string;
  siblings: number;
  labels: TargetSheetLabels;
  onPick: (to: CaptureTarget, all: boolean) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(true);
  const [name, setName] = useState(current.kind === "new" ? current.name : spoken);
  const byId = new Map(people.map((p) => [p.id, p]));
  const top = candidates.map((id) => byId.get(id)).filter((p): p is TargetPerson => !!p);
  const rest = people.filter((p) => !candidates.includes(p.id));
  const match = (p: TargetPerson) => matchesPerson(query, p.name, p.tag);
  const shownTop = top.filter(match);
  const shownRest = rest.filter(match);
  const newName = tidyName(name);

  const row = (p: TargetPerson) => {
    const on = current.kind === "person" && current.id === p.id;
    return (
      <li key={p.id} className="border-t border-ink/[0.18] first:border-t-0">
        <button type="button" aria-pressed={on} onClick={() => onPick({ kind: "person", id: p.id }, all)} className="flex min-h-[64px] w-full items-center gap-3.5 py-1 text-left">
          <span aria-hidden="true">
            <Avatar config={p.avatar} size={44} label={p.name} decorative />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate hand-written text-[24px] leading-[1.15]">{p.name}</span>
              {p.tag ? <TagChip>{p.tag}</TagChip> : null}
            </span>
            {p.hint ? <span className="truncate text-[12px] text-muted">{p.hint}</span> : null}
          </span>
          <DrawnCheck on={on} />
        </button>
      </li>
    );
  };

  return (
    <Sheet
      id="capture-target"
      title={labels.title}
      closeLabel={labels.close}
      onClose={onClose}
      footer={
        <>
          {siblings > 0 ? (
            <button type="button" role="checkbox" aria-checked={all} onClick={() => setAll(!all)} className="flex min-h-11 items-center gap-3 text-left text-[15px]">
              <DrawnCheck on={all} />
              {labels.all}
            </button>
          ) : null}
          <form
            className="flex flex-col gap-1.5 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName) onPick({ kind: "new", name: newName }, all);
            }}
          >
            <label htmlFor="capture-new-name" className="flex items-center gap-1.5 text-[13px] text-muted">
              <Icon name="personAdd" size={17} strokeWidth={2} />
              {labels.asNew}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="capture-new-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                enterKeyHint="done"
                className="field min-w-0 flex-1"
              />
              <button type="submit" disabled={!newName} aria-label={labels.asNew} className="btn-primary !w-[52px] shrink-0 !px-0">
                <Icon name="check" size={22} strokeWidth={2.6} />
              </button>
            </div>
          </form>
        </>
      }
    >
      <div className="relative px-6 pb-2 pt-2">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="absolute left-[38px] top-[23px] text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="h-12 w-full rounded-[14px] bg-fill pl-[42px] pr-3.5 text-[15px] outline-none placeholder:text-muted"
        />
      </div>
      {shownTop.length ? (
        <>
          <p className="px-6 pt-1 text-[13px] text-accent">{labels.sameName.replace("{n}", String(top.length))}</p>
          <ul className="flex flex-col px-6 pb-1">{shownTop.map(row)}</ul>
          {shownRest.length ? <div role="separator" className="mx-6 mt-1 border-t-[1.5px] border-dashed border-ink/[0.18]-strong" /> : null}
        </>
      ) : null}
      <ul className="flex flex-col px-6 pb-2">{shownRest.map(row)}</ul>
      {!shownTop.length && !shownRest.length ? <p className="px-6 py-6 text-center text-[14px] text-muted">{labels.empty}</p> : null}
    </Sheet>
  );
}
