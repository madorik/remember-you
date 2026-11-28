"use client";

import { formatDayFull, weekdayShort, type EffectLine, type Locale, type YMD } from "@readme/core";
import { useCallback, useId, useLayoutEffect, useState } from "react";
import { removeNote, restoreNote } from "@/app/actions/capture";
import { updateNote } from "@/app/actions/notes";
import AppLink from "@/components/AppLink";
import { BinderPage, RULE, RULE_AT } from "@/components/Binder";
import { Icon } from "@/components/marks";
import { SectionIcon } from "@/components/SectionIcon";
import { Sheet } from "@/components/Sheet";
import { useUndoToast } from "@/components/UndoToast";
import { noteMatches, noteParts, searchNeedle } from "@/lib/note-search";
import { lineKey, markOrganizing, ORGANIZING_KEY, parseOrganizing } from "@/lib/organizing";
import type { BookTab as Tab } from "@/lib/person-tab";
import { u } from "@/lib/ui-scale";

export interface BookNote {
  id: string;
  body: string;
  /** 적은 날(내 시간대) */
  date: YMD;
  /** 같이 지우기로 지금 되돌려지는 것(이 메모가 사람 기록에 더한 것 중 지금도 그대로 남은 것). 없으면 메모만 지우는 단추 하나 */
  adds: EffectLine[];
  /** 이 메모에 저장된 '더한 것'(일)의 수. 글을 고쳐 다시 정리하면 새 일이 그 뒤에 붙는다 */
  fx: number;
}

export interface BookLabels {
  /** 탭 이름: 메모장 · 기억해 둔 것 */
  memo: string;
  remembered: string;
  /** 오른쪽 아래 연필 단추의 이름: "엄마 이야기 적기" */
  write: string;
  close: string;
  del: string;
  /** 지우는 시트: 더해진 것 상자 이름 · 메모만 지우기 · 같이 지우기 */
  added: string;
  delOnly: string;
  delWith: string;
  edit: string;
  error: string;
  /** 메모 고치기 단추 · 저장 · 취소 */
  fix: string;
  save: string;
  cancel: string;
  /** 메모 찾기(돋보기·찾는 칸의 이름) · 찾는 메모가 없을 때의 한 줄 */
  search: string;
  searchEmpty: string;
}

/** 메모장 끝에 비워 두는 높이: 연필 단추(66 × 0.9)가 하단 메뉴 위 54px에 뜨므로 마지막 메모가 그 위에서 끝나게 한다 */
const PEN_ROOM = 72;

/** 메모 한 줄의 달 라벨(올해가 아니면 연도도) */
function monthLabel(d: YMD, today: YMD, locale: Locale): string {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = locale === "ko" ? `${d.m}월` : names[d.m - 1]!;
  if (d.y === today.y) return m;
  return locale === "ko" ? `${d.y}년 ${m}` : `${m} ${d.y}`;
}

/** 메모장 속지 위쪽 여백(줄 칸이 시작하는 곳) */
const TOP = 12.6;

/** 돋보기(메모 찾기). 사람들 화면의 찾는 칸과 같은 모양 */
function MagnifierGlyph({ size, className }: { size: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

/** 달 이름표: 양 끝이 톱니로 뜯긴 망고빛 마스킹테이프. 줄 한 칸(RULE) 높이를 차지해 밑의 메모가 줄에 맞게 이어진다 */
function MonthTape({ label }: { label: string }) {
  return (
    <div className="ml-[1.8px] flex items-center gap-[7.2px]" style={{ height: RULE }}>
      <span
        className="hand inline-flex h-[21.6px] -rotate-2 items-center bg-[rgb(255_217_120/0.75)] px-[10.8px] text-[15.3px] leading-none"
        style={{ clipPath: "polygon(0 0, 100% 0, 95% 25%, 100% 50%, 95% 75%, 100% 100%, 0 100%, 5% 75%, 0 50%, 5% 25%)" }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * 사람 화면의 바인더: 프로필 카드 밑에 ‘메모장’ · ‘기억해 둔 것’ 두 칸막이가 솟은 속지 한 장.
 * 메모장은 라인 노트 줄 위 세로 점선 타임라인(최근 메모부터 달별로, 누르면 시트에서 전부 보고 지운다).
 * 줄 간격은 RULE이고 메모 글줄 높이도 RULE이다. 달 이름표는 한 칸, 메모는 위아래 반 칸씩 띄우고 글줄 칸 단위라(날짜·점은 첫 글줄 칸에 맞춘다) 글이 모두 줄 위에 앉는다.
 * 메모장 칸이 열려 있는 동안 오른쪽 아래에 둥근 연필 단추가 떠 있고(메모 쓰기 화면의 마이크와 같은 모양·자리), 누르면 이 사람이 붙은 채로 메모 쓰기가 열린다.
 * 기억해 둔 것은 흰 속지에 기록 목록(remembered, 서버가 그린 RememberedList)이고 칸막이 줄 오른쪽 끝 연필이 고치는 화면으로 간다.
 * 속지는 메모가 적어도 화면 아래(하단 메뉴 바로 위)까지 늘어나고(flex-1, 화면 틀 <main>이 세로 flex), 메모가 많으면 내용만큼 길어진다.
 * 메모를 지우면 목록에서 바로 사라지고(서버에서도 바로 지운다) 5초 동안 되돌릴 수 있다. 시트의 '고치기'는 그 자리에서 글을 고쳐 저장한다(사람 기록에 더해진 것은 그대로).
 * 메모장 칸 줄 오른쪽 끝의 돋보기는 찾는 칸을 열어, 이미 받아 온 메모를 글자로 거른다(맞는 글자에 형광펜. Esc·✕로 닫으면 비운다).
 * 그 메모가 사람 기록에 더한 것이 아직 남아 있으면 시트에 '이 메모로 더해진 것'이 보이고, '같이 지우기'는 그것도 되돌린다(되돌리기는 메모와 되돌린 칸을 되살린다)
 */
export function PersonBook({
  contactId,
  name,
  locale,
  today,
  notes,
  initialTab,
  defaultTab,
  auto,
  canWrite,
  remembered,
  labels,
}: {
  contactId: string;
  name: string;
  locale: Locale;
  today: YMD;
  notes: BookNote[];
  initialTab: Tab;
  /** 주소에 tab이 없을 때 여는 칸(메모·기록의 양으로 정한다). 이 칸이 아닌 쪽을 고르면 주소에 tab을 남긴다 */
  defaultTab: Tab;
  /** initialTab이 주소(?tab=)가 아니라 defaultTab으로 정해졌다 */
  auto: boolean;
  /** 메모 쓰기(/voice)를 열 수 있다(AI가 켜져 있을 때) */
  canWrite: boolean;
  remembered: React.ReactNode;
  labels: BookLabels;
}) {
  const uid = useId();
  const [tab, setTab] = useState<Tab>(initialTab);
  // 메모를 막 저장하고 온 화면이면(저장 표시가 있다) 기억해 둔 것이 기본이어도 방금 쓴 메모가 보이게 메모장을 연다(주소가 칸을 정했으면 그대로).
  // 그릴 틈 없이 바꾸려고 layout effect(앱 안 화면 이동은 서버가 그린 화면이 먼저 보이지 않아 깜박이지 않는다)
  useLayoutEffect(() => {
    if (!auto || initialTab !== "remembered") return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (parseOrganizing(sessionStorage.getItem(ORGANIZING_KEY), contactId) != null) setTab("memo");
    } catch {
      /* 저장소를 못 쓰면 기본 칸 그대로 */
    }
  }, [auto, initialTab, contactId]);
  const [picked, setOpen] = useState<BookNote | null>(null);
  // 지운(5초 되돌릴 수 있는) 메모 id. 서버가 새 목록을 주면 목록에서 이미 빠져 있다
  const [gone, setGone] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  // 고친 메모의 새 글(id → 글): 서버가 새 목록을 주기 전에도 바로 보이게
  const [edits, setEdits] = useState<Record<string, string>>({});
  // 시트에서 고치는 중인 글(null이면 보기만)
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editFailed, setEditFailed] = useState(false);
  // 메모 찾기: null이면 찾는 칸이 닫혀 있다
  const [find, setFind] = useState<string | null>(null);
  const undo = useUndoToast(locale);
  const close = useCallback(() => {
    setOpen(null);
    setDraft(null);
    setSaving(false);
    setEditFailed(false);
  }, []);
  const all = notes.filter((n) => !gone.includes(n.id)).map((n) => (edits[n.id] === undefined ? n : { ...n, body: edits[n.id]! }));
  // 시트에 보이는 메모는 늘 가장 새 목록의 것(고친 글·다시 정리해 새로 더해진 것이 시트를 연 채로도 보인다)
  const open = picked ? (all.find((n) => n.id === picked.id) ?? picked) : null;
  const needle = searchNeedle(find);
  const shown = needle ? all.filter((n) => noteMatches(n.body, needle)) : all;

  const pick = (next: Tab) => {
    setTab(next);
    setFind(null);
    // 고치러 갔다 돌아와도(뒤로) 같은 칸이 열리게 주소에 남긴다(기본 칸이 아닌 쪽을 골랐을 때만)
    const q = new URLSearchParams(window.location.search);
    if (next === defaultTab) q.delete("tab");
    else q.set("tab", next);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
  };

  // 시트에서 고친 글을 저장한다(앞뒤 공백은 걷는다. 같은 글이면 서버를 부르지 않는다). 실패하면 고치던 글을 그대로 두고 알린다
  const saveEdit = async () => {
    if (!open || draft === null || saving) return;
    const text = draft.trim();
    if (!text) return;
    if (text === open.body.trim()) {
      setDraft(null);
      return;
    }
    setSaving(true);
    setEditFailed(false);
    let done: Awaited<ReturnType<typeof updateNote>> = { ok: false, body: "", organizing: false };
    try {
      done = await updateNote(contactId, open.id, text);
    } catch {
      /* 아래에서 알린다 */
    }
    setSaving(false);
    if (!done.ok) {
      setEditFailed(true);
      return;
    }
    setEdits((e) => ({ ...e, [open.id]: done.body }));
    // 시트는 닫는다: 목록이 새 글로 바로 바뀌어 있고, 곧 뜰 '더한 것' 알림(되돌리기)이 시트 뒤로 막히지 않는다
    close();
    // 글이 바뀌어 서버가 다시 정리하기 시작했으면 이 화면이 곧 새로 받아 새로 더해진 것을 알리게 표시한다(고칠 때 이미 보이던 줄·일의 수를 같이 남긴다)
    if (done.organizing && canWrite) markOrganizing([contactId], Date.now(), { note: open.id, base: open.fx, seen: open.adds.map(lineKey) });
  };

  // 메모를 지운다(revert면 그 메모가 사람 기록에 더한 것도 같이). 목록에서는 바로 감추고 서버에서 바로 지운다(AI 정리가 아직 안 끝났어도 지운 메모에는 아무것도 적히지 않게).
  // 5초 안에 되돌리면 서버가 메모(같은 글·날짜·더한 것)와 같이 되돌린 칸을 되살린다. 실패하면 목록에 다시 보인다
  const removeIt = async (id: string, revert: boolean) => {
    setFailed(false);
    setGone((g) => [...g, id]);
    setOpen(null);
    let done: Awaited<ReturnType<typeof removeNote>> = { ok: false, restore: null };
    try {
      done = await removeNote(contactId, id, revert);
    } catch {
      /* 아래에서 알린다 */
    }
    if (!done.ok) {
      setGone((g) => g.filter((x) => x !== id));
      setFailed(true);
      return;
    }
    const restore = done.restore;
    if (!restore) return; // 풀 수 없는 메모라 되살릴 것이 없다
    undo.show({
      onUndo: () =>
        void (async () => {
          const back = await restoreNote(restore).catch(() => ({ ok: false }));
          if (back.ok) setGone((g) => g.filter((x) => x !== id));
          else setFailed(true);
        })(),
    });
  };

  // 달별로 묶는다(이미 최근 것부터)
  const groups: { key: string; label: string; items: BookNote[] }[] = [];
  for (const n of shown) {
    const key = `${n.date.y}-${n.date.m}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(n);
    else groups.push({ key, label: monthLabel(n.date, today, locale), items: [n] });
  }

  const tabClass = (on: boolean, color: string, soft: string) =>
    `hand relative flex items-center justify-center gap-[4.5px] whitespace-nowrap rounded-t-[10.8px] border border-b-0 border-edge px-[14.4px] pb-[5.4px] text-[18px] leading-none ${on ? "h-[36px]" : "h-[29.7px]"} ${on ? color : soft}`;
  const panelId = `${uid}-panel`;

  return (
    <>
      <div className="relative mb-1 ml-[21.6px] mr-[14.4px] mt-[41.4px] flex flex-1 flex-col">
        {/* 칸막이: 속지 윗선 밑으로 3px 파묻혀(속지가 위에 얹힌다) 윗선이 이어져 보인다. 켜진 칸이 더 높다 */}
        <div role="tablist" aria-label={name} className="absolute left-[41.4px] flex items-end gap-[16.2px]" style={{ bottom: "calc(100% - 2.7px)" }}>
          <button type="button" role="tab" id={`${uid}-memo`} aria-selected={tab === "memo"} aria-controls={panelId} onClick={() => pick("memo")} className={tabClass(tab === "memo", "bg-[#FFD978]", "bg-[#FFF4D6]")}>
            {labels.memo}
            {all.length ? <span className="text-[10.8px] text-muted">{all.length}</span> : null}
          </button>
          <button type="button" role="tab" id={`${uid}-remembered`} aria-selected={tab === "remembered"} aria-controls={panelId} onClick={() => pick("remembered")} className={tabClass(tab === "remembered", "bg-[#CDEBDD]", "bg-[#E8F6EF]")}>
            {labels.remembered}
          </button>
        </div>
        {tab === "remembered" ? (
          <AppLink href={`/people/${contactId}/edit`} aria-label={labels.edit} className="absolute right-0 flex h-11 w-11 items-center justify-center" style={{ bottom: "calc(100% - 2.7px)" }}>
            <Icon name="pencil" size={21} strokeWidth={1.8} />
          </AppLink>
        ) : all.length || find !== null ? (
          <button
            type="button"
            aria-label={labels.search}
            aria-expanded={find !== null}
            aria-controls={`${uid}-find`}
            onClick={() => setFind((f) => (f === null ? "" : null))}
            className="absolute right-0 flex h-11 w-11 before:absolute before:-inset-[2.2px] items-center justify-center"
            style={{ bottom: "calc(100% - 2.7px)" }}
          >
            <MagnifierGlyph size={21} />
          </button>
        ) : null}

        <BinderPage margin={tab === "memo"} lines={tab === "memo" ? TOP + RULE / 2 + RULE_AT : undefined} left={tab === "memo" ? 40 : 42} className="flex flex-1 flex-col" pageClassName="flex min-h-[270px] flex-1 flex-col">
          <div role="tabpanel" id={panelId} aria-labelledby={`${uid}-${tab}`}>
            {tab === "memo" ? (
              <div style={{ paddingTop: TOP }}>
                {/* 찾는 칸: 높이가 줄 두 칸(RULE × 2)이라 아래 메모가 줄에 맞게 이어진다 */}
                {find !== null ? (
                  <div id={`${uid}-find`} role="search" className="relative" style={{ height: RULE * 2 }}>
                    <MagnifierGlyph size={16.2} className="pointer-events-none absolute left-[13px] top-1/2 z-[1] -translate-y-1/2 text-muted" />
                    <input
                      type="search"
                      autoFocus
                      value={find}
                      onChange={(e) => setFind(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          setFind(null);
                        }
                      }}
                      placeholder={labels.search}
                      aria-label={labels.search}
                      enterKeyHint="search"
                      className="hand-written absolute inset-y-0 left-0 right-0 my-auto h-[44px] w-full rounded-[12.6px] border border-edge bg-white pl-[38px] pr-12 text-[18.5px] outline-none placeholder:text-muted focus:border-mango-deep [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    <button type="button" aria-label={labels.close} onClick={() => setFind(null)} className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 before:absolute before:-inset-[2.2px] items-center justify-center text-muted">
                      <Icon name="close" size={18} strokeWidth={2} />
                    </button>
                  </div>
                ) : null}
                {needle && !shown.length ? (
                  <p role="status" className="hand pl-[2px] text-[18px] text-muted" style={{ height: RULE * 2, paddingTop: RULE / 2, lineHeight: `${RULE}px` }}>
                    {labels.searchEmpty}
                  </p>
                ) : null}
                <div className="relative pb-[16.2px]">
                  {/* 세로 점선 타임라인: 첫 달 이름표 가운데에서 시작해 메모가 있을 때만 그린다 */}
                  {groups.length ? <span aria-hidden="true" className="absolute bottom-[18px] border-l-[1.35px] border-dashed border-ink/30" style={{ left: 44.1, top: RULE / 2 }} /> : null}
                  {failed ? (
                    <p role="alert" className="flex items-center text-[12.6px] text-red" style={{ height: RULE }}>
                      {labels.error}
                    </p>
                  ) : null}
                  {groups.map((g) => (
                    <div key={g.key}>
                      <MonthTape label={g.label} />
                      {g.items.map((n) => (
                        <button key={n.id} type="button" onClick={() => {
                            setDraft(null);
                            setEditFailed(false);
                            setOpen(n);
                          }}
                          aria-haspopup="dialog" className="relative grid w-full grid-cols-[34.2px_1fr] gap-x-[21.6px] text-left" style={{ paddingBlock: RULE / 2 }}>
                          {/* 날짜: 날은 첫 글줄 칸에, 요일은 그 밑(둘째 줄 쪽 빈 곳)에 걸쳐 놓는다(칸 높이는 글줄만 정한다) */}
                          <span className="flex flex-col items-center" style={{ height: RULE }}>
                            <span className="hand shrink-0 text-[23.4px]" style={{ lineHeight: `${RULE}px` }}>
                              {n.date.d}
                            </span>
                            <span className="shrink-0 text-[9.9px] leading-none text-muted">{weekdayShort(n.date, locale)}</span>
                          </span>
                          <span aria-hidden="true" className="absolute left-[39.6px] box-border h-[9.9px] w-[9.9px] rounded-full border border-ink bg-sky" style={{ top: RULE / 2 + (RULE - 9.9) / 2 }} />
                          <span className="hand-written line-clamp-6 whitespace-pre-line text-[18.5px]" style={{ lineHeight: `${RULE}px` }}>
                            {needle
                              ? noteParts(n.body, needle).map((part, i) =>
                                  part.hit ? (
                                    <mark key={i} className="hl bg-transparent text-inherit">
                                      {part.text}
                                    </mark>
                                  ) : (
                                    part.text
                                  ),
                                )
                              : n.body}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                {/* 오른쪽 아래 연필 단추(아래 PersonBook 끝)가 마지막 메모를 가리지 않게 비워 두는 자리 */}
                {canWrite ? <div aria-hidden="true" style={{ height: PEN_ROOM }} /> : null}
              </div>
            ) : (
              remembered
            )}
          </div>
        </BinderPage>

        {open ? (
          <Sheet
            id={`${uid}-note`}
            title={formatDayFull(open.date, locale)}
            titleClassName="text-[19.8px] leading-none"
            handle
            closeLabel={labels.close}
            onClose={close}
            footer={
              draft !== null ? (
                <div className="flex gap-[7.2px]">
                  <button type="button" onClick={() => setDraft(null)} disabled={saving} className="btn-outline flex-1">
                    {labels.cancel}
                  </button>
                  <button type="button" onClick={() => void saveEdit()} disabled={saving || !draft.trim()} className="btn-primary flex-1">
                    {labels.save}
                  </button>
                </div>
              ) : open.adds.length ? (
                <div className="flex gap-[7.2px]">
                  <button type="button" onClick={() => void removeIt(open.id, false)} className="btn-outline flex-1">
                    {labels.delOnly}
                  </button>
                  <button type="button" onClick={() => void removeIt(open.id, true)} className="btn-outline flex-1 !text-red !shadow-[inset_0_0_0_1px_var(--color-red)]">
                    {labels.delWith}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => void removeIt(open.id, false)} className="flex min-h-11 items-center gap-1.5 self-start rounded-full border border-edge px-4 text-[14.4px] text-red">
                  <Icon name="trash" size={16} strokeWidth={1.8} />
                  {labels.del}
                </button>
              )
            }
          >
            {draft !== null ? (
              <div className="px-6 pb-3 pt-2">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={1000}
                  rows={5}
                  aria-label={labels.fix}
                  className="hand-written block max-h-[40dvh] min-h-[8.5rem] w-full resize-none rounded-[12.6px] border border-edge bg-white px-3 py-2.5 text-[20.7px] leading-[1.4] outline-none [field-sizing:content] focus:border-mango-deep"
                />
                {editFailed ? (
                  <p role="alert" className="mt-2 text-[12.6px] text-red">
                    {labels.error}
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <p className="hand-written whitespace-pre-line px-6 pb-1 pt-2 text-[20.7px] leading-[1.4]">{open.body}</p>
                <div className="flex justify-end px-6 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditFailed(false);
                      setDraft(open.body);
                    }}
                    className="relative flex min-h-11 items-center gap-1.5 rounded-full border border-edge px-4 text-[14.4px] before:absolute before:inset-x-0 before:-inset-y-[2.2px]"
                  >
                    <Icon name="pencil" size={16} strokeWidth={1.8} />
                    {labels.fix}
                  </button>
                </div>
              </>
            )}
            {draft === null && open.adds.length ? (
              <div className="mx-6 mb-3 rounded-[12.6px] border border-edge bg-white px-[12.6px] pb-[9px] pt-[9px]">
                <p className="text-[12.6px] text-muted">{labels.added}</p>
                <ul className="mt-[7.2px] flex flex-col gap-[7.2px]">
                  {open.adds.map((a, i) => (
                    <li key={`${a.label}-${i}`} className="flex items-center gap-[9px]">
                      <SectionIcon section={a.section} size={29} />
                      <span className="min-w-0 flex-1 leading-[1.3]">
                        <span className="text-[12.6px] text-muted">{a.label}</span>
                        <span aria-hidden="true" className="text-[12.6px] text-muted">
                          {" · "}
                        </span>
                        <span className="hand-written text-[18.5px]">{a.prev ? `${a.prev} → ${a.value}` : a.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {/* 시트가 열려 있으면 토스트도 그 안에(열린 시트 밖은 키보드로 갈 수 없다) */}
            {undo.toast}
          </Sheet>
        ) : (
          undo.toast
        )}
      </div>
      {/* 오른쪽 아래 연필: 메모 쓰기 화면의 마이크와 같은 모양·자리(.memo-mic: 하단 메뉴 위로 54px). 메모장 칸에서만, 키보드가 뜨면 숨는다.
          높이 0짜리 sticky 줄이라 화면이 길어져도 같은 자리에 있다. 속지(위 flex-1)가 화면 아래까지 늘어나 이 줄도 맨 아래에 있다 */}
      {tab === "memo" && canWrite ? (
        <div className="memo-mic sticky z-20 h-0 w-full [:root[data-kb]_&]:hidden">
          <div className="absolute bottom-0" style={{ right: u(22), width: u(66), height: u(66) }}>
            <AppLink
              href={`/voice?to=${contactId}`}
              aria-label={labels.write}
              className="relative flex h-full w-full items-center justify-center rounded-full border border-edge bg-sky text-ink"
              style={{ boxShadow: `0 ${u(4)}px 0 var(--color-mango-deep), 0 ${u(16)}px ${u(22)}px -${u(12)}px rgb(31 35 64 / 0.55)` }}
            >
              <Icon name="pencil" size={30} strokeWidth={2} />
            </AppLink>
          </div>
        </div>
      ) : null}
    </>
  );
}
