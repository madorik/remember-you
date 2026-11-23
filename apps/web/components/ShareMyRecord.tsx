"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shareMyRecord } from "@/app/actions/share";
import type { SharePart } from "@/lib/share-record";
import { DrawnCheck, Icon } from "./marks";
import { Sheet } from "./Sheet";
import { copyText, nativeShare } from "./ShareButtons";

type Status = "idle" | "busy" | "shared" | "copied" | "failed" | "limit";

/**
 * 내 기록을 링크로 보내기: 누르면 아래에서 시트가 올라와 보낼 항목을 고르고(적어 둔 것만, 처음엔 모두), 누르면 짧은 링크가 만들어져 휴대폰 공유창(카카오톡·문자 등)이 열린다.
 * 글에는 링크와 인사말만 나가고 내 정보는 없다: 받는 사람이 앱에서 열면 그제야 보이고, 어디에 저장할지는 그 사람이 고른다
 */
export function ShareMyRecord({
  parts,
  labels,
  className = "",
}: {
  parts: SharePart[];
  labels: { open: string; title: string; send: string; shared: string; copied: string; failed: string; busy: string; text: string; close: string };
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [picked, setPicked] = useState<string[]>(() => parts.map((p) => p.section));
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const toggle = (section: string) => setPicked((cur) => (cur.includes(section) ? cur.filter((x) => x !== section) : [...cur, section]));

  const send = async () => {
    if (status === "busy" || !picked.length) return;
    setStatus("busy");
    let next: Status = "failed";
    try {
      const r = await shareMyRecord(picked);
      if (!r.ok) next = r.reason === "busy" ? "limit" : "failed";
      else if (await nativeShare(labels.text, r.url)) next = "shared";
      else next = (await copyText(`${labels.text}\n${r.url}`)) ? "copied" : "failed";
    } catch {
      next = "failed";
    }
    setStatus(next);
    // 결과 글은 2초만 보이고 처음 글자로 돌아온다
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2000);
  };

  const label = { idle: labels.send, busy: labels.send, shared: labels.shared, copied: labels.copied, failed: labels.failed, limit: labels.busy }[status];

  return (
    <>
      <button
        type="button"
        aria-label={labels.open}
        aria-haspopup="dialog"
        disabled={!parts.length}
        onClick={() => setOpen(true)}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-muted shadow-[inset_0_0_0_1.5px_var(--color-edge)] active:bg-fill disabled:opacity-40 ${className}`}
      >
        <Icon name="share" size={21} strokeWidth={1.8} />
      </button>
      {open ? (
        <Sheet
          id="share-record-title"
          title={labels.title}
          closeLabel={labels.close}
          onClose={close}
          footer={
            <button type="button" onClick={send} disabled={status === "busy" || !picked.length} aria-live="polite" className="btn-primary w-full disabled:opacity-50">
              {label}
            </button>
          }
        >
          <ul className="flex flex-col px-6 pb-3">
            {parts.map((p) => {
              const on = picked.includes(p.section);
              return (
                <li key={p.section} className="border-t-[1.5px] border-dashed border-ink/[0.18] first:border-t-0">
                  <button type="button" aria-pressed={on} onClick={() => toggle(p.section)} className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left">
                    <DrawnCheck on={on} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="hand truncate text-[22px] leading-[1.15]">{p.title}</span>
                      <span className="truncate text-[12px] text-muted">{p.lines[0]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      ) : null}
    </>
  );
}
