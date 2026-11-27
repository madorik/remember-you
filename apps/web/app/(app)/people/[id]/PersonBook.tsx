"use client";

import { formatDayFull, weekdayShort, type EffectLine, type Locale, type YMD } from "@readme/core";
import { useCallback, useId, useState } from "react";
import { removeNote, restoreNote } from "@/app/actions/capture";
import AppLink from "@/components/AppLink";
import { BinderPage } from "@/components/Binder";
import { Icon } from "@/components/marks";
import { SectionIcon } from "@/components/SectionIcon";
import { Sheet } from "@/components/Sheet";
import { useUndoToast } from "@/components/UndoToast";

export interface BookNote {
  id: string;
  body: string;
  /** 적은 날(내 시간대) */
  date: YMD;
  /** 같이 지우기로 지금 되돌려지는 것(이 메모가 사람 기록에 더한 것 중 지금도 그대로 남은 것). 없으면 메모만 지우는 단추 하나 */
  adds: EffectLine[];
}

export interface BookLabels {
  /** 탭 이름: 메모장 · 기억해 둔 것 */
  memo: string;
  remembered: string;
  today: string;
  /** "엄마 이야기 적기" */
  write: string;
  close: string;
  del: string;
  /** 지우는 시트: 더해진 것 상자 이름 · 메모만 지우기 · 같이 지우기 */
  added: string;
  delOnly: string;
  delWith: string;
  edit: string;
  error: string;
}

type Tab = "memo" | "remembered";

/** 메모 한 줄의 달 라벨(올해가 아니면 연도도) */
function monthLabel(d: YMD, today: YMD, locale: Locale): string {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = locale === "ko" ? `${d.m}월` : names[d.m - 1]!;
  if (d.y === today.y) return m;
  return locale === "ko" ? `${d.y}년 ${m}` : `${m} ${d.y}`;
}

/** 달 이름표: 양 끝이 톱니로 뜯긴 망고빛 마스킹테이프 */
function MonthTape({ label }: { label: string }) {
  return (
    <div className="ml-[1.8px] flex items-center gap-[7.2px]" style={{ height: 32.4 }}>
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
 * 메모장은 점 모눈 위 세로 점선 타임라인(맨 위 ‘오늘 … 이야기 적기’ 줄 → 최근 메모부터 달별로, 누르면 시트에서 전부 보고 지운다).
 * 기억해 둔 것은 흰 속지에 기록 목록(remembered, 서버가 그린 RememberedList)이고 칸막이 줄 오른쪽 끝 연필이 고치는 화면으로 간다.
 * 메모를 지우면 목록에서 바로 사라지고(서버에서도 바로 지운다) 5초 동안 되돌릴 수 있다.
 * 그 메모가 사람 기록에 더한 것이 아직 남아 있으면 시트에 '이 메모로 더해진 것'이 보이고, '같이 지우기'는 그것도 되돌린다(되돌리기는 메모와 되돌린 칸을 되살린다)
 */
export function PersonBook({
  contactId,
  name,
  locale,
  today,
  notes,
  initialTab,
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
  /** 메모 쓰기(/voice)를 열 수 있다(AI가 켜져 있을 때) */
  canWrite: boolean;
  remembered: React.ReactNode;
  labels: BookLabels;
}) {
  const uid = useId();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [open, setOpen] = useState<BookNote | null>(null);
  // 지운(5초 되돌릴 수 있는) 메모 id. 서버가 새 목록을 주면 목록에서 이미 빠져 있다
  const [gone, setGone] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const undo = useUndoToast(locale);
  const close = useCallback(() => setOpen(null), []);
  const shown = notes.filter((n) => !gone.includes(n.id));

  const pick = (next: Tab) => {
    setTab(next);
    // 고치러 갔다 돌아와도(뒤로) 같은 칸이 열리게 주소에 남긴다
    const q = new URLSearchParams(window.location.search);
    if (next === "remembered") q.set("tab", "remembered");
    else q.delete("tab");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
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
    <div className="relative mb-1 ml-[21.6px] mr-[14.4px] mt-[41.4px]">
      {/* 칸막이: 속지 윗선 밑으로 3px 파묻혀(속지가 위에 얹힌다) 윗선이 이어져 보인다. 켜진 칸이 더 높다 */}
      <div role="tablist" aria-label={name} className="absolute left-[41.4px] flex items-end gap-[16.2px]" style={{ bottom: "calc(100% - 2.7px)" }}>
        <button type="button" role="tab" id={`${uid}-memo`} aria-selected={tab === "memo"} aria-controls={panelId} onClick={() => pick("memo")} className={tabClass(tab === "memo", "bg-[#FFD978]", "bg-[#FFF4D6]")}>
          {labels.memo}
          {shown.length ? <span className="text-[10.8px] text-muted">{shown.length}</span> : null}
        </button>
        <button type="button" role="tab" id={`${uid}-remembered`} aria-selected={tab === "remembered"} aria-controls={panelId} onClick={() => pick("remembered")} className={tabClass(tab === "remembered", "bg-[#CDEBDD]", "bg-[#E8F6EF]")}>
          {labels.remembered}
        </button>
      </div>
      {tab === "remembered" ? (
        <AppLink href={`/people/${contactId}/edit`} aria-label={labels.edit} className="absolute right-0 flex h-11 w-11 items-center justify-center" style={{ bottom: "calc(100% - 2.7px)" }}>
          <Icon name="pencil" size={21} strokeWidth={1.8} />
        </AppLink>
      ) : null}

      <BinderPage dots={tab === "memo"} left={tab === "memo" ? 40 : 42} pageClassName="min-h-[270px]">
        <div role="tabpanel" id={panelId} aria-labelledby={`${uid}-${tab}`}>
          {tab === "memo" ? (
            <div className="relative pb-[16.2px] pt-[12.6px]">
              {/* 세로 점선 타임라인 */}
              <span aria-hidden="true" className="absolute bottom-[18px] top-[27px] border-l-[1.35px] border-dashed border-ink/30" style={{ left: 44.1 }} />
              {canWrite ? (
                <AppLink href={`/voice?to=${contactId}`} className="relative grid h-[43.2px] grid-cols-[34.2px_1fr] items-center gap-x-[21.6px]">
                  <span className="hand text-center text-[16.2px] text-mango-deep">{labels.today}</span>
                  <span aria-hidden="true" className="absolute left-[39.6px] top-[16.2px] box-border h-[9.9px] w-[9.9px] rounded-full border border-ink bg-white" />
                  <span className="flex items-center gap-[6.3px] border-b border-dashed border-ink/30 pb-[3.6px]">
                    <Icon name="pencil" size={16} strokeWidth={1.8} className="shrink-0 text-muted" />
                    <span className="hand truncate text-[18px] leading-none text-ink/45">{labels.write}</span>
                  </span>
                </AppLink>
              ) : null}
              {failed ? (
                <p role="alert" className="py-1 text-[12.6px] text-red">
                  {labels.error}
                </p>
              ) : null}
              {groups.map((g) => (
                <div key={g.key}>
                  <MonthTape label={g.label} />
                  {g.items.map((n) => (
                    <button key={n.id} type="button" onClick={() => setOpen(n)} aria-haspopup="dialog" className="relative grid w-full grid-cols-[34.2px_1fr] gap-x-[21.6px] py-[9px] text-left">
                      <span className="flex flex-col items-center gap-[1.8px]">
                        <span className="hand text-[23.4px] leading-[23.4px]">{n.date.d}</span>
                        <span className="text-[9.9px] leading-none text-muted">{weekdayShort(n.date, locale)}</span>
                      </span>
                      <span aria-hidden="true" className="absolute left-[39.6px] top-[16.2px] box-border h-[9.9px] w-[9.9px] rounded-full border border-ink bg-sky" />
                      <span className="hand-written line-clamp-6 whitespace-pre-line text-[18.5px] leading-[1.45]">{n.body}</span>
                    </button>
                  ))}
                </div>
              ))}
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
            open.adds.length ? (
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
          <p className="hand-written whitespace-pre-line px-6 pb-3 pt-2 text-[20.7px] leading-[1.4]">{open.body}</p>
          {open.adds.length ? (
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
  );
}
