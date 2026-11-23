"use client";

import type { AvatarConfig } from "@readme/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { claimSharedRecord, type ClaimResult } from "@/app/actions/share";
import type { SharePart } from "@/lib/share-record";
import { Avatar } from "./Avatar";
import { TornTape } from "./TornTape";
import { Icon } from "./marks";
import { Mascot } from "./Mascot";
import { SectionIcon } from "./SectionIcon";

export interface ClaimPerson {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  /** 이 사람에 합치면 '유지'와 '덮어쓰기'가 달라지나(= 이미 적어 둔 같은 칸이 있다) */
  conflict: boolean;
}

type FailReason = Extract<ClaimResult, { ok: false }>["reason"];

/** 하나만 고르는 칸의 동그라미(시안: 22px 흰 바탕 + 남색 선, 고르면 안에 남색 점) */
function RadioMark({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-white">
      {on ? <span className="h-[11px] w-[11px] rounded-full bg-ink" /> : null}
    </span>
  );
}

/**
 * 링크로 받은 기록을 내 사람들에 저장하는 화면(로그인한 사람만). 받은 내용을 보여 주고, 어디에 저장할지(새 사람 / 이미 있는 사람)를 고르고,
 * 이미 적어 둔 값이 있는 사람이면 있던 값을 유지할지 덮어쓸지 한 번 묻는다
 */
export function ClaimShare({
  token,
  from,
  avatar,
  parts,
  people,
  suggestedId,
  labels,
}: {
  token: string;
  from: string;
  avatar: AvatarConfig | null;
  parts: SharePart[];
  people: ClaimPerson[];
  suggestedId: string | null;
  labels: {
    title: string;
    where: string;
    newPerson: string;
    people: string;
    conflict: string;
    keep: string;
    overwrite: string;
    save: string;
    errors: Record<FailReason, string>;
    avatarOf: string;
  };
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>(suggestedId ?? "new");
  const [mode, setMode] = useState<"keep" | "overwrite">("keep");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FailReason | null>(null);
  const chosen = people.find((p) => p.id === target);
  const asks = !!chosen?.conflict;

  const save = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const r = await claimSharedRecord(token, target, asks ? mode : "keep");
      if (r.ok) {
        router.push(`/people/${r.contactId}`);
        return;
      }
      setError(r.reason);
    } catch {
      setError("error");
    }
    setPending(false);
  };

  const row = (key: string, on: boolean, onPick: () => void, content: React.ReactNode) => (
    <button key={key} type="button" role="radio" aria-checked={on} onClick={onPick} className="flex min-h-[47px] w-full items-center gap-3 border-t-[1.5px] border-dashed border-ink/[0.18] py-2 text-left first:border-t-0">
      <RadioMark on={on} />
      {content}
    </button>
  );

  // 제목은 첫 낱말(누가)에만 형광펜, 나머지는 다음 줄로
  const [lead, ...rest] = labels.title.split(" ");
  return (
    <>
      <div className="flex items-center gap-4 px-5 pb-1 pt-3">
        <Avatar config={avatar} size={60} label={labels.avatarOf.replace("{name}", from)} />
        <h1 className="min-w-0 flex-1 text-[34px] leading-[1.15]">
          <span className="hl">{lead}</span>
          {rest.length ? (
            <>
              <br />
              {rest.join(" ")}
            </>
          ) : null}
        </h1>
        <Mascot pose={9} size={66} className="shrink-0" />
      </div>

      {/* 받은 내용(로그인한 사람에게만 보인다) */}
      <section className="card relative mx-4 mt-7 px-3.5 py-1">
        <TornTape color="mint" w={66} h={21} rotate={6} className="-top-3 right-6" />
        <ul className="flex flex-col">
          {parts.map((p) => (
            <li key={p.section} className="flex items-center gap-2.5 border-t-[1.5px] border-dashed border-ink/[0.18] py-2 first:border-t-0">
              <SectionIcon section={p.section as Parameters<typeof SectionIcon>[0]["section"]} size={30} outline />
              <span className="flex min-w-0 flex-1 flex-col">
                {p.lines.map((line, i) => (
                  <span key={i} className={`hand-written break-words text-[24px] leading-[1.15] ${p.section === "safety" ? "text-red" : ""}`}>
                    {line}
                  </span>
                ))}
                <span className="text-[12px] text-muted">{p.title}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 어디에 저장할까요 */}
      <section className="card relative mx-4 mb-4 mt-7 px-3.5 pb-1 pt-2.5">
        <h2 id="claim-where" className="hand scribble text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
          {labels.where}
        </h2>
        <div role="radiogroup" aria-labelledby="claim-where" className="relative mt-4">
          {row("new", target === "new", () => setTarget("new"), <span className="min-w-0 flex-1 truncate text-[15px]">{labels.newPerson}</span>)}
          {people.length ? <p className="border-t-[1.5px] border-dashed border-ink/[0.18] pb-1 pt-3 text-[12px] text-muted">{labels.people}</p> : null}
          {people.map((p) =>
            row(
              p.id,
              target === p.id,
              () => setTarget(p.id),
              <>
                <Avatar config={p.avatar} size={30} label={labels.avatarOf.replace("{name}", p.name)} decorative />
                <span className="hand-written min-w-0 flex-1 truncate text-[24px] leading-[1.15]">{p.name}</span>
              </>,
            ),
          )}
        </div>
      </section>

      {/* 이미 적어 둔 값이 있으면 */}
      {asks ? (
        <section className="card relative mx-4 mb-4 mt-6 px-3.5 pb-1 pt-2.5">
          <h2 id="claim-conflict" className="hand scribble text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
            {labels.conflict}
          </h2>
          <div role="radiogroup" aria-labelledby="claim-conflict" className="relative mt-4">
            {row("keep", mode === "keep", () => setMode("keep"), <span className="min-w-0 flex-1 text-[15px] leading-[1.35]">{labels.keep}</span>)}
            {row("overwrite", mode === "overwrite", () => setMode("overwrite"), <span className="min-w-0 flex-1 text-[15px] leading-[1.35]">{labels.overwrite}</span>)}
          </div>
        </section>
      ) : null}

      <div className="bottom-bar mt-auto flex flex-col items-end gap-2 bg-bg px-4 pt-4">
        {error ? (
          <p role="alert" className="w-full px-1 text-[14px] text-red">
            {labels.errors[error]}
          </p>
        ) : null}
        <button type="button" onClick={save} disabled={pending} className="inline-flex h-[46px] items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-sky pl-3 pr-3.5 text-[16px] disabled:opacity-60">
          <Icon name="check" size={17} strokeWidth={1.8} />
          {labels.save}
        </button>
      </div>
    </>
  );
}
