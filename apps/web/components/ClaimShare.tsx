"use client";

import type { AvatarConfig } from "@readme/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { claimSharedRecord, type ClaimResult } from "@/app/actions/share";
import type { SharePart } from "@/lib/share-record";
import { Avatar } from "./Avatar";
import { Heart, Squiggle, Star, Tape } from "./diary";

export interface ClaimPerson {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  /** 이 사람에 합치면 '유지'와 '덮어쓰기'가 달라지나(= 이미 적어 둔 같은 칸이 있다) */
  conflict: boolean;
}

type FailReason = Extract<ClaimResult, { ok: false }>["reason"];

/** 하나만 고르는 칸의 동그라미(여러 개 고르는 칸은 DrawnCheck의 네모) */
function RadioMark({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.8px] border-ink transition-colors ${on ? "bg-sky" : "bg-white"}`}>
      {on ? <span className="h-3 w-3 rounded-full bg-ink" /> : null}
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
    <button key={key} type="button" role="radio" aria-checked={on} onClick={onPick} className="flex min-h-[60px] w-full items-center gap-3 border-t border-dashed border-rule py-2 text-left first:border-t-0">
      <RadioMark on={on} />
      {content}
    </button>
  );

  return (
    <>
      <div className="flex items-center gap-4 px-6 pb-1 pt-5">
        <Avatar config={avatar} size={64} label={labels.avatarOf.replace("{name}", from)} />
        <h1 className="hl min-w-0 text-[30px] leading-[1.25]">{labels.title}</h1>
      </div>

      {/* 받은 내용(로그인한 사람에게만 보인다) */}
      <section className="card relative mx-4 mt-5 px-4 pb-1">
        <Tape color="mint" className="-left-2.5 -top-1.5" />
        <ul className="flex flex-col">
          {parts.map((p) => (
            <li key={p.section} className="border-t border-dashed border-rule py-3 first:border-t-0">
              <p className="text-[19px]">{p.title}</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {p.lines.map((line, i) => (
                  <li key={i} className="break-words text-[17px] text-ink-2">
                    {line}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <Star size={20} rotate={12} className="-right-1.5 top-6" />
      </section>

      {/* 어디에 저장할까요 */}
      <section className="relative mx-4 mb-4 mt-6">
        <h2 id="claim-where" className="pl-2 text-[22px]">
          {labels.where}
        </h2>
        <div role="radiogroup" aria-labelledby="claim-where" className="card relative mt-2 px-4">
          {row("new", target === "new", () => setTarget("new"), <span className="min-w-0 flex-1 truncate text-[20px]">{labels.newPerson}</span>)}
          {people.length ? <p className="border-t border-dashed border-rule pb-1 pt-3 text-[15px] text-muted">{labels.people}</p> : null}
          {people.map((p) =>
            row(
              p.id,
              target === p.id,
              () => setTarget(p.id),
              <>
                <Avatar config={p.avatar} size={36} label={labels.avatarOf.replace("{name}", p.name)} decorative />
                <span className="min-w-0 flex-1 truncate text-[20px]">{p.name}</span>
              </>,
            ),
          )}
          <Heart size={22} rotate={-14} className="-bottom-2 -left-2" />
        </div>
      </section>

      {/* 이미 적어 둔 값이 있으면 */}
      {asks ? (
        <section className="relative mx-4 mb-4 mt-6">
          <h2 id="claim-conflict" className="pl-2 text-[22px]">
            {labels.conflict}
          </h2>
          <div role="radiogroup" aria-labelledby="claim-conflict" className="card relative mt-2 px-4">
            {row("keep", mode === "keep", () => setMode("keep"), <span className="min-w-0 flex-1 text-[19px] leading-[1.35]">{labels.keep}</span>)}
            {row("overwrite", mode === "overwrite", () => setMode("overwrite"), <span className="min-w-0 flex-1 text-[19px] leading-[1.35]">{labels.overwrite}</span>)}
            <Squiggle w={54} width={2.4} color="#F59BAE" className="-bottom-2 right-[30px]" />
          </div>
        </section>
      ) : null}

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {error ? (
          <p role="alert" className="px-1 text-[17px] text-red">
            {labels.errors[error]}
          </p>
        ) : null}
        <button type="button" onClick={save} disabled={pending} className="btn-primary !min-h-[58px] w-full !text-[22px] disabled:opacity-60">
          {labels.save}
        </button>
      </div>
    </>
  );
}
