"use client";

import { IMAGE_MAX_COUNT, weekday, weekdayLong, weekdayNames, type AvatarConfig, type Locale, type YMD } from "@readme/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { saveFirstMemo, saveMemo } from "@/app/actions/capture";
import { transcribeMemoImages, type PhotoTextError } from "@/app/actions/memo-photo";
import { skipOnboarding } from "@/app/actions/onboarding";
import AppLink from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { BinderPage, RULE, RULE_AT, ruledLines } from "@/components/Binder";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { markSaved } from "@/components/ReviewAsk";
import { prepareImage, type PrepProblem } from "@/lib/image-prep";
import { appendBlock } from "@/lib/memo-append";
import { markOrganizing } from "@/lib/organizing";
import { NEW_NAME_MAX, tidyName } from "@/lib/capture-target";
import { startListenGuard, type ListenGuard, type StopReason } from "@/lib/listen-guard";
import { insertMention, mentionAt, mentionLabel, mentionWord, tagKey, tagsForSave, type MentionTag } from "@/lib/mention";
import { matchesPerson } from "@/lib/search";
import { nativeSpeech, startDictation, webCtor, type Dictation, type WebRecognition } from "@/lib/speech";
import { u } from "@/lib/ui-scale";
import { ImportMenu, type ImportMenuLabels } from "./ImportMenu";

/** 이름 칩에 쓰는 사람 한 명 */
export interface MemoPerson {
  id: string;
  name: string;
  /** 내가 붙인 태그(부르는 말). 이름과 같거나 없으면 "" */
  tag: string;
  avatar: AvatarConfig | null;
  /** 이름이 같은 사람을 가려 볼 때 곁에 붙이는 기록 요약(없으면 생략) */
  hint?: string;
}

export interface MemoLabels {
  close: string;
  importNotes: string;
  save: string;
  /** 한 사람을 골랐을 때의 안내 글({name}) */
  placeholderOf: string;
  placeholder: string;
  addPerson: string;
  /** 이름 칸 이름 */
  name: string;
  /** 이름을 치면 뜨는 목록 이름 */
  people: string;
  /** "'{name}' 새로 추가" */
  newOption: string;
  /** 새 사람 칩의 작은 표시(새로) */
  newBadge: string;
  /** "{name} 빼기" */
  removeTag: string;
  pickWho: string;
  /** "{names} 메모장에 적었어요" */
  savedTo: string;
  error: string;
  micError: string;
  mic: string;
  stopListening: string;
  /** 공유로 받은 글이 1000자를 넘어 앞부분만 담았다 */
  sharedClipped: string;
  month: string;
  /** '메모 가져오기' 메뉴(메모 앱에서 · 사진에서) */
  menu: ImportMenuLabels;
  /** 사진에서 글을 읽어 오는 동안 */
  photoReading: string;
  /** 사진에서 글을 못 읽어 온 이유 */
  photoErrors: Record<PhotoTextError, string>;
  /** 고른 사진을 서버에 보내기 전에 걸린 이유 */
  photoProblems: Record<PrepProblem | "many", string>;
  /** "읽지 못한 사진 {n}장은 건너뛰었어요" */
  photoSkipped: string;
}

/** 온보딩(첫 메모)으로 열렸다: 하단 메뉴 없이 머리 줄(첫 메모 · 건너뛰기 · 저장)과 캐릭터가 붙고, 저장하면 온보딩이 끝난다 */
export interface MemoOnboarding {
  /** 끝나고 가려던 곳(/home이면 그 사람 화면으로) */
  next: string;
  labels: {
    title: string;
    skip: string;
    /** 아직 아무도 안 골랐을 때 캐릭터 말풍선 */
    askWho: string;
    /** 사람을 고르고 글을 적었을 때 캐릭터 말풍선 */
    saveEnd: string;
    /** 본문 칸 안내 글(예시 문장) */
    example: string;
    /** 바로 고르는 이름들(고르면 그 이름의 새 사람) */
    quick: string[];
  };
}

/** 이야기의 주인공: 이미 있는 사람(id) 또는 이번에 새로 더할 사람(이름) */
type Tag = MentionTag;

/** 이름 목록의 한 줄: 맞는 내 사람 또는 '새로 추가' */
type Option = { kind: "person"; p: MemoPerson } | { kind: "new"; name: string };

/** 본문에서 @를 치면 한 번에 보이는 내 사람 수(이름을 치면 맞는 사람 전부) */
const AT_LIST = 5;

const MAX = 1000;
/** 앱의 '공유 받기'가 받은 글을 넘겨 두는 곳(sessionStorage) */
const SHARED_KEY = "rm_shared_memo";
const INK = "#1F2340";

/** 글 두 덩이를 이을 때 사이에 띄어쓰기 하나(앞이 비었거나 이미 공백으로 끝나면 그대로) */
function join(a: string, b: string): string {
  if (!a || !b) return a + b;
  return /\s$/.test(a) ? a + b : `${a} ${b}`;
}

const nameOf = (p: MemoPerson) => mentionLabel(p);

/** 이 기기의 시간대(온보딩이 끝날 때 프로필에 남긴다) */
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";

/** 받아 적는 글: 확정된 부분과 아직 바뀔 수 있는 부분(중간 결과) */
interface Heard {
  final: string;
  interim: string;
}
const NOTHING: Heard = { final: "", interim: "" };

/** 사진에서 글을 읽는 동안 돌아가는 작은 고리(움직임 줄이기면 멈춘 채) */
function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={u(17)} height={u(17)} fill="none" strokeWidth="2.6" strokeLinecap="round" className="shrink-0 motion-safe:animate-spin">
      <circle cx="12" cy="12" r="8.5" stroke={INK} strokeOpacity=".16" />
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke="#E09A12" />
    </svg>
  );
}

const IMPORT_ICON = (
  <>
    <rect x="5" y="4.5" width="14" height="16" rx="2.5" />
    <path d="M9 4.5V3.5h6v1M12 9v6.5M9 13l3 3 3-3" />
  </>
);

function Svg({ size, strokeWidth = 1.7, children }: { size: number; strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={u(size)} height={u(size)} fill="none" stroke={INK} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {children}
    </svg>
  );
}

/** 오늘 요일을 손으로 동그라미 친 월~일 줄(토 파랑 · 일 빨강) */
function WeekStrip({ today, locale }: { today: YMD; locale: Locale }) {
  const names = weekdayNames(locale);
  const now = weekday(today);
  return (
    <div aria-label={weekdayLong(today, locale)} className="flex gap-px">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <span
          key={d}
          className={`relative flex items-center justify-center text-[11.25px] ${d === now ? "text-ink" : d === 6 ? "text-sat" : d === 0 ? "text-red" : "text-muted"}`}
          style={{ width: u(24), height: u(28) }}
        >
          {d === now ? (
            <svg aria-hidden="true" viewBox="0 0 30 30" width={u(30)} height={u(30)} className="absolute" style={{ left: -u(3), top: -u(1) }}>
              <path d="M15 3.5c7 0 11.5 4.6 11 11.2-.5 6.4-5.6 11-12 10.6C7.6 24.9 3.4 20.6 4 14.2 4.6 8.4 9.5 4 16.5 4.2" fill="none" stroke="#F2A7B5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : null}
          <span className="relative">{locale === "ko" ? names[d] : names[d]!.slice(0, 2)}</span>
        </span>
      ))}
    </div>
  );
}

/** 이름 칩 안의 얼굴 + 손글씨 이름 */
function Face({ p }: { p: MemoPerson }) {
  return <Avatar config={p.avatar} size={24} label={nameOf(p)} decorative />;
}

/** 새로 더할 사람의 자리표시 얼굴: 동그라미에 이름 첫 글자(얼굴은 나중에 사람 화면에서) */
function NewFace({ name, size = 24, dashed = false }: { name: string; size?: number; dashed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`hand flex shrink-0 items-center justify-center rounded-full bg-[#FFF7E6] leading-none text-mango-deep ${dashed ? "border-[1.1px] border-dashed border-ink/40" : "border border-edge"}`}
      style={{ width: u(size), height: u(size), fontSize: u(size * 0.54) }}
    >
      {name.trim().slice(0, 1)}
    </span>
  );
}

const PLUS = <path d="M12 6v12M6 12h12" />;

/** 이름을 치면 뜨는 목록(이름 칸 밑·본문 @ 밑이 같이 쓴다): 맞는 내 사람들, 맨 끝에 '새로 추가'(같은 이름이 있어도 새 사람으로 더할 수 있다) */
function OptionList({
  id,
  label,
  options,
  current,
  newOption,
  onPick,
  style,
  innerRef,
}: {
  id: string;
  label: string;
  options: Option[];
  current: number;
  newOption: string;
  onPick: (o: Option) => void;
  style: React.CSSProperties;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={innerRef} id={id} role="listbox" aria-label={label} className="relative z-[3] border border-edge bg-white" style={style}>
      {options.map((o, i) => (
        <div
          key={o.kind === "person" ? o.p.id : "new"}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === current}
          // 눌러도 이름 칸·본문이 포커스를 잃지 않게(잃으면 목록이 먼저 닫혀 누른 게 안 먹는다)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(o)}
          className={`flex cursor-pointer items-center gap-[8.1px] ${i === current ? "bg-sky-soft" : ""}`}
          style={{ height: u(44), padding: `0 ${u(8)}px`, borderRadius: u(10) }}
        >
          {o.kind === "person" ? <Avatar config={o.p.avatar} size={28} label={nameOf(o.p)} decorative /> : <NewFace name={o.name} size={28} dashed />}
          <span className="hand text-[18px] leading-none">{o.kind === "person" ? nameOf(o.p) : newOption.replace("{name}", o.name)}</span>
          {o.kind === "person" && (o.p.hint || o.p.tag) ? <span className="truncate text-[10.8px] text-muted">{o.p.hint || o.p.tag}</span> : null}
        </div>
      ))}
    </div>
  );
}

/** 듣는 동안의 알약: 일곱 막대가 마이크 소리에 맞춰 오르내리고(재지 못하면 부드럽게) 경과 시간 m:ss. 움직임 줄이기면 막대는 가만히 */
const BAR_BASE = [9, 17, 25, 14, 21, 11, 7];
function ListenPill({ measure }: { measure: boolean }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let stopped = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let data = new Uint8Array(0);
    let level = 0;
    const paint = (t: number) => {
      let target = 0.35 + 0.15 * Math.sin(t / 380);
      if (analyser) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        target = Math.min(1, Math.sqrt(sum / data.length) * 7);
      }
      level += (target - level) * 0.18;
      bars.current.forEach((bar, i) => {
        if (!bar) return;
        const wave = still ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(t / 260 + i * 1.25));
        bar.style.transform = `scaleY(${Math.max(0.28, Math.min(1, (0.25 + level) * wave * 1.25))})`;
      });
    };
    const loop = (t: number) => {
      paint(t);
      raf = requestAnimationFrame(loop);
    };
    void (async () => {
      if (measure && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
          if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
          ctx = new AudioContext();
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          ctx.createMediaStreamSource(stream).connect(analyser);
          data = new Uint8Array(analyser.frequencyBinCount);
        } catch {
          analyser = null;
        }
      }
      if (stopped) return;
      if (still) paint(0);
      else raf = requestAnimationFrame(loop);
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      void ctx?.close().catch(() => {});
    };
  }, [measure]);
  return (
    <div
      role="status"
      className="absolute z-[5] flex items-center gap-[9px] rounded-full border border-edge bg-white shadow-[0_7.2px_12.6px_-9px_rgb(31_35_64/0.4)]"
      style={{ right: u(114), bottom: u(13), height: u(40), padding: `0 ${u(14)}px 0 ${u(12)}px` }}
    >
      <span aria-hidden="true" className="flex items-center gap-[2.7px]" style={{ height: u(26) }}>
        {BAR_BASE.map((h, i) => (
          <span key={i} ref={(el) => void (bars.current[i] = el)} className="block origin-center rounded-[1.8px] bg-[#FF7A8A]" style={{ width: u(4), height: u(h), transform: "scaleY(0.6)" }} />
        ))}
      </span>
      <span className="hand text-[18px] leading-none">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

/** 오른쪽 위 망고 저장 알약 */
function SaveButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="hand inline-flex items-center gap-[4.5px] rounded-full border border-edge bg-sky text-[17.1px] leading-none disabled:opacity-60" style={{ height: u(36), padding: `0 ${u(15)}px 0 ${u(11)}px` }}>
      <Svg size={16} strokeWidth={2.2}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </Svg>
      {label}
    </button>
  );
}

/** 위에서 잠깐 떴다 사라지는 알림 줄(하단 메뉴 위). 오류는 role=alert */
function Toast({ text, error }: { text: string; error: boolean }) {
  return (
    <div role={error ? "alert" : "status"} aria-live={error ? undefined : "polite"} className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4" style={{ bottom: "calc(max(var(--pb), var(--kb, 0px)) + 72px)" }}>
      <div className="pointer-events-auto flex min-h-12 w-full max-w-[378px] items-center rounded-2xl bg-ink px-4 text-[15.3px] text-white shadow-[0_8px_24px_rgba(31,35,64,0.28)]">{text}</div>
    </div>
  );
}

/**
 * 메모 쓰기(하단 가운데 메모 단추): 바인더 속지 한 장에 날짜 머리 · @ 사람 칩 · 손글씨 본문. 말로 적으면(오른쪽 아래 마이크) 받아 쓴 말이 그대로 본문에 들어간다.
 * 저장하면 고른 사람마다 메모로 남고(한 사람이면 그 사람 화면으로), AI가 뒤에서 그 사람의 항목으로 정리한다(saveMemo)
 */
export function MemoPad({
  locale,
  today,
  people,
  fixed,
  shared = false,
  onboarding = null,
  labels,
}: {
  locale: Locale;
  today: YMD;
  people: MemoPerson[];
  fixed: MemoPerson | null;
  /** 앱의 '공유 받기'로 열렸다(?shared=1): 받은 글을 본문에 채우고 사람은 비워 둔다 */
  shared?: boolean;
  /** 온보딩의 첫 메모로 열렸다(/onboarding) */
  onboarding?: MemoOnboarding | null;
  labels: MemoLabels;
}) {
  const router = useRouter();
  const canListen = useSyncExternalStore(
    () => () => {},
    () => !!webCtor() || !!nativeSpeech(),
    () => false,
  );
  const [text, setText] = useState("");
  const [tags, setTags] = useState<Tag[]>(fixed && !shared ? [{ kind: "person", id: fixed.id }] : []);
  // 이미 고른 사람이 있어도 '+'로 다른 사람을 더 고를 때만 펼치는 목록
  const [picking, setPicking] = useState(false);
  // 이름 칸(새 사람·찾기): '+'로 열고, 온보딩은 처음부터 열려 있다
  const [naming, setNaming] = useState(!!onboarding);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [active, setActive] = useState(0);
  // 본문 @이름: 커서 자리, 목록에서 고르는 줄, Esc로 닫아 둔 @의 자리
  const [caret, setCaret] = useState(0);
  const [atActive, setAtActive] = useState(0);
  const [atClosed, setAtClosed] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  // 앱: 멈춘 뒤 마지막 말까지 든 최종 결과를 기다리는 중
  const [settling, setSettling] = useState(false);
  const [heard, setHeard] = useState<Heard>(NOTHING);
  const [micError, setMicError] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string; error: boolean } | null>(null);
  const [saving, startSave] = useTransition();
  const [skipping, startSkip] = useTransition();
  // 사진에서 글을 읽어 오는 중
  const [reading, setReading] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  // 사진을 읽는 사이에도 글을 고칠 수 있어서, 다 읽으면 그때의 본문 뒤에 붙인다
  const textRef = useRef("");
  const nameBox = useRef<HTMLInputElement>(null);
  const atList = useRef<HTMLDivElement>(null);
  // 본문 @목록에서 고른 뒤 커서를 둘 자리(글이 바뀐 화면이 그려진 직후 한 번 놓는다)
  const nextCaret = useRef<number | null>(null);
  // 칩의 ×로 일부러 뺀 사람의 열쇠(본문에 @이름이 남아 있어도 저장할 때 다시 넣지 않는다)
  const dropped = useRef(new Set<string>());
  const alive = useRef(false);
  const guard = useRef<ListenGuard | null>(null);
  const web = useRef<WebRecognition | null>(null);
  const native = useRef<Dictation | null>(null);
  const liveRef = useRef<Heard>(NOTHING);
  // 말로 적은 글이 들어 있나(저장 기록에 말로·글로를 가른다)
  const voiced = useRef(false);
  const toastTimer = useRef(0);
  const listId = useId();
  const atId = useId();

  const byId = new Map(people.map((p) => [p.id, p]));
  // 고른 사람들(이미 있는 사람은 얼굴과 함께, 새 사람은 이름만). 내 사람이 아닌 id는 뺀다
  const chosen = tags
    .map((t) => (t.kind === "person" ? { key: tagKey(t), person: byId.get(t.id) ?? null, name: "", valid: byId.has(t.id) } : { key: tagKey(t), person: null, name: t.name, valid: true }))
    .filter((c) => c.valid);
  const pickedIds = new Set(tags.flatMap((t) => (t.kind === "person" ? [t.id] : [])));
  const rest = people.filter((p) => !pickedIds.has(p.id));
  // 아무도 안 골랐으면 목록을 바로 보이고, 골랐으면 '+'를 눌렀을 때만
  const listOpen = rest.length > 0 && (!chosen.length || picking);
  const busy = listening || settling;
  // 지금 화면에 보이는 글 전부(받아 적는 중인 말까지)
  const shown = join(join(text, heard.final), heard.interim);
  const hasText = !!shown.trim();
  // 듣는 동안 이미 확정된 글(본문 + 확정된 받아쓰기)
  const settled = join(text, heard.final);
  // 이름 칸 밑 목록: 치는 이름과 맞는 내 사람들, 맨 끝에 언제나 '새로 추가'
  const typed = tidyName(query);
  const options: Option[] = typed ? [...rest.filter((p) => matchesPerson(typed, p.name, p.tag)).map((p) => ({ kind: "person" as const, p })), { kind: "new" as const, name: typed }] : [];
  const dropOpen = naming && typing && options.length > 0;
  const current = Math.min(active, Math.max(options.length - 1, 0));
  // 본문에서 @를 치면 같은 목록이 본문 밑에 뜬다: 이미 고른 사람도 포함해 맞는 내 사람들(@만이면 몇 명), 이름을 쳤으면 맨 끝에 '새로 추가'.
  // 듣는 동안은 본문 칸이 없어 열지 않는다
  const at = busy ? null : mentionAt(text, caret);
  const atWord = at ? mentionWord(at.query) : "";
  const atName = tidyName(atWord);
  const atOptions: Option[] =
    at && at.start !== atClosed
      ? [...people.filter((p) => !atWord || matchesPerson(atWord, p.name, p.tag)).slice(0, atWord ? undefined : AT_LIST).map((p) => ({ kind: "person" as const, p })), ...(atName ? [{ kind: "new" as const, name: atName }] : [])]
      : [];
  const atOpen = atOptions.length > 0;
  const atCurrent = Math.min(atActive, Math.max(atOptions.length - 1, 0));
  // 온보딩에서 아무도 안 골랐을 때만 바로 고르는 이름과 큰 이름 칸을 보인다
  const starting = !!onboarding && !chosen.length;

  useEffect(() => {
    textRef.current = text;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(toastTimer.current);
      guard.current?.dispose();
      guard.current = null;
      web.current?.stop();
      native.current?.cancel();
    };
  }, []);

  // 온보딩의 이름 칸: 마우스·터치패드 기기에서만 열자마자 커서를 둔다(터치 기기는 키보드가 저절로 뜨지 않게)
  useEffect(() => {
    if (onboarding && window.matchMedia?.("(pointer: fine)").matches) nameBox.current?.focus();
    // 처음 열릴 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = (message: string, error = false) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text: message, error });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  // 앱이 '공유 받기'로 넘긴 글(sessionStorage)을 꺼내 본문에 채우고, 키와 주소의 shared=1을 지운다(새로고침해도 다시 채우지 않게).
  // 이 화면이 이미 열려 있을 때 두 번째 공유가 와도(같은 주소로 다시 /voice?shared=1) shared=1이 다시 나타나는 때마다 읽는다:
  // 본문이 비었으면 그 글로 채우고, 쓰던 글이 있으면 빈 줄 하나 띄우고 뒤에 붙인다(합쳐 1000자를 넘으면 앞에서부터 1000자만 담고 알린다).
  // 저장소는 화면을 그릴 때 읽을 수 없어(서버 그림과 어긋난다) 열린 뒤에 읽는다
  const params = useSearchParams();
  const sharedNow = params.get("shared") === "1";
  // 사람 화면 ··· 메뉴의 '메모 가져오기'로 열렸다(?import=1): 메모 가져오기 메뉴를 열어 둔 채 시작하고 주소에서 import=1을 지운다(새로고침해도 다시 열지 않게)
  const importNow = params.get("import") === "1";
  useEffect(() => {
    if (!sharedNow) return;
    let got = "";
    try {
      got = sessionStorage.getItem(SHARED_KEY) ?? "";
      sessionStorage.removeItem(SHARED_KEY);
    } catch {
      /* 저장소를 못 쓰면 빈 채로 연다 */
    }
    if (got.trim()) {
      const next = appendBlock(text, got, MAX);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(next.text);
      if (next.clipped) say(labels.sharedClipped);
    }
    const q = new URLSearchParams(window.location.search);
    q.delete("shared");
    // import=1이 함께 와도 주소는 여기서 한 번에 정리한다(둘이 따로 replace하면 나중 것이 앞의 지움을 되살린다)
    q.delete("import");
    router.replace(q.size ? `/voice?${q}` : "/voice");
    // say·labels·text는 shared=1이 나타난 그때의 값을 한 번 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedNow, router]);

  useEffect(() => {
    if (!importNow || sharedNow) return;
    const q = new URLSearchParams(window.location.search);
    q.delete("import");
    router.replace(q.size ? `/voice?${q}` : "/voice");
  }, [importNow, sharedNow, router]);

  // ── 사진에서: 고른 사진(1~3장)을 줄여 서버로 보내 글만 읽어 오고, 본문 뒤에 붙인다(사람 고르기·저장은 그대로 사람이 한다) ──
  const readPhotos = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (photoInput.current) photoInput.current.value = "";
    if (!list.length || reading) return;
    setReading(true);
    const picked = list.slice(0, IMAGE_MAX_COUNT);
    let problem: PrepProblem | "many" | null = list.length > IMAGE_MAX_COUNT ? "many" : null;
    const blobs: Blob[] = [];
    for (const file of picked) {
      const r = await prepareImage(file);
      if (r.ok) blobs.push(r.blob);
      else problem = r.problem;
    }
    if (!alive.current) return;
    if (!blobs.length) {
      setReading(false);
      return say(labels.photoProblems[problem ?? "unreadable"], true);
    }
    let res: Awaited<ReturnType<typeof transcribeMemoImages>>;
    try {
      // 줄인 사진을 파일로(글자로 바꾸지 않는다: 서버 동작 본문 크기 한도를 피한다)
      const form = new FormData();
      blobs.forEach((b, n) => form.append("image", b, `photo-${n + 1}.jpg`));
      res = await transcribeMemoImages(form);
    } catch {
      res = { text: "", error: "failed", skipped: 0 };
    }
    if (!alive.current) return;
    setReading(false);
    if (res.error || !res.text.trim()) return say(labels.photoErrors[res.error ?? "unreadable"], true);
    const next = appendBlock(textRef.current, res.text, MAX);
    setText(next.text);
    const skipped = res.skipped + (picked.length - blobs.length);
    if (next.clipped) say(labels.sharedClipped);
    else if (skipped > 0) say(labels.photoSkipped.replace("{n}", String(skipped)));
    else if (problem === "many") say(labels.photoProblems.many);
  };

  // 본문 칸은 글이 늘어나는 만큼 키운다
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    // 타이머로 늦게 놓으면 곧바로 이어 치는 글자가 먼저 들어가 커서가 되돌려지니, 글이 바뀐 이 자리에서 바로 놓는다
    if (nextCaret.current != null) {
      el.focus();
      el.setSelectionRange(nextCaret.current, nextCaret.current);
      nextCaret.current = null;
    }
  }, [text, listening]);

  // @ 목록이 뜨면 화면 안으로(긴 글이면 본문 맨 밑이라 아래 메뉴에 가리지 않게 조금 여유를 둔다)
  useEffect(() => {
    if (atOpen) atList.current?.scrollIntoView({ block: "nearest" });
  }, [atOpen, atOptions.length]);

  // ── 말로 적기: 받아 쓴 말을 본문에 그대로 이어 붙인다 ──
  const hear = (h: Heard) => {
    liveRef.current = h;
    setHeard(h);
  };
  /** 듣기가 끝났다: 받아 적은 말 전부를 본문 뒤에 붙인다 */
  const commit = (finalText?: string) => {
    const got = finalText ?? join(liveRef.current.final, liveRef.current.interim);
    hear(NOTHING);
    if (!got.trim()) return;
    voiced.current = true;
    setText((cur) => join(cur, got.trim()).slice(0, MAX));
  };
  const endGuard = () => {
    guard.current?.dispose();
    guard.current = null;
  };
  // 멈추기: 웹은 멈추면 최종 결과 뒤에 onend가 온다. 앱은 최종 결과를 기다렸다가 onDone(lib/speech)
  const halt = () => {
    endGuard();
    web.current?.stop();
    native.current?.stop();
  };
  // 아무 말도 없어 끄는 앱 듣기는 기다릴 최종 결과가 없으니 바로 끝낸다
  const discard = () => {
    endGuard();
    native.current?.cancel();
    native.current = null;
    setListening(false);
    setSettling(false);
    commit();
  };
  // 타이머가 멈추라고 한다(조용해짐·아무 말 없음·시간 다 됨)
  const onGuardStop = (reason: StopReason) => {
    if (reason === "no-speech" && native.current) return discard();
    halt();
  };

  const listen = async () => {
    if (settling || saving) return;
    if (listening) return halt();
    setMicError(false);
    hear(NOTHING);
    const lang = locale === "ko" ? "ko-KR" : "en-US";
    const plugin = nativeSpeech();
    if (plugin) {
      try {
        const perm = await plugin.requestPermissions();
        if (perm.speechRecognition !== "granted") throw new Error("denied");
        guard.current = startListenGuard({ onStop: onGuardStop });
        setListening(true);
        native.current = await startDictation(plugin, {
          language: lang,
          // 앱 기기 인식은 말이 끝나야 확정되니 받는 동안은 모두 '아직 바뀔 수 있는 말'로 보인다
          onText: (t) => {
            hear({ final: "", interim: t });
            guard.current?.heard(t);
          },
          onSettling: () => {
            endGuard();
            setListening(false);
            setSettling(true);
          },
          onDone: (t) => {
            native.current = null;
            endGuard();
            if (!alive.current) return;
            setSettling(false);
            commit(t || join(liveRef.current.final, liveRef.current.interim));
          },
        });
      } catch {
        endGuard();
        native.current = null;
        setListening(false);
        setSettling(false);
        hear(NOTHING);
        setMicError(true);
      }
      return;
    }
    const Ctor = webCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    // 듣기가 실제로 시작된 때부터 잰다(브라우저의 마이크 허락을 기다리는 동안은 세지 않는다)
    const arm = () => {
      if (!guard.current && web.current === r) guard.current = startListenGuard({ onStop: onGuardStop });
    };
    r.onstart = arm;
    r.onresult = (e) => {
      const list = Array.from(e.results);
      const part = (final: boolean) =>
        list
          .filter((res) => !!res.isFinal === final)
          .map((res) => res[0]?.transcript ?? "")
          .join(" ")
          .trim();
      const next = { final: part(true), interim: part(false) };
      hear(next);
      arm();
      guard.current?.heard(join(next.final, next.interim));
    };
    r.onerror = (e) => {
      if (e.error !== "aborted" && e.error !== "no-speech") setMicError(true);
    };
    r.onend = () => {
      endGuard();
      if (web.current === r) web.current = null;
      setListening(false);
      commit();
    };
    web.current = r;
    setListening(true);
    r.start();
  };

  // ── 저장 ──
  const save = () => {
    // 듣는 중에 눌렀으면 지금까지 들은 말까지 붙여 바로 저장한다
    const body = shown.trim().slice(0, MAX);
    if (!body || saving || settling) return;
    // 이야기의 주인공: 칩으로 고른 사람 + 본문에 적은 @이름(있는 사람이면 그 사람, 아니면 새 사람) + 아무도 안 골랐고 @도 없으면 본문에 적힌 내 사람의 이름. 본문은 적은 그대로 보낸다
    const picked = tagsForSave(
      body,
      people,
      tags.filter((t) => t.kind === "new" || byId.has(t.id)),
      dropped.current,
    );
    const ids = picked.flatMap((t) => (t.kind === "person" ? [t.id] : []));
    const newNames = picked.flatMap((t) => (t.kind === "new" ? [t.name] : []));
    // 아무도 못 정했으면 추천 사람 칩이나 이름 칸이 이미 보이는 상태라 알리기만 한다
    if (!ids.length && !newNames.length) return say(labels.pickWho, true);
    setTags(picked);
    if (listening) {
      halt();
      web.current = null;
      native.current?.cancel();
      native.current = null;
      setListening(false);
      hear(NOTHING);
      setText(body);
    }
    const via = voiced.current ? "voice" : "text";
    startSave(async () => {
      if (onboarding) {
        // 첫 메모: 저장하면 온보딩이 끝난다. 가려던 곳이 있으면 거기로, 아니면 방금 만든 사람 화면(환영 표시)으로
        const r = await saveFirstMemo(body, ids, via, newNames, browserZone()).catch(() => null);
        if (!r?.ok) return say(labels.error, true);
        voiced.current = false;
        markOrganizing(r.ids);
        return router.push(onboarding.next !== "/home" ? onboarding.next : `/people/${r.ids[0]}?welcome=1`);
      }
      const r = await saveMemo(body, ids, via, newNames).catch(() => null);
      if (!r?.ok) return say(labels.error, true);
      markSaved();
      markOrganizing(r.ids);
      voiced.current = false;
      if (r.ids.length === 1) return router.push(`/people/${r.ids[0]}`);
      // 여러 사람이면 이 화면에 남아 누구 메모장에 적었는지 알리고, 다음 메모를 위해 비운다
      const names = r.ids.map((id) => (byId.has(id) ? nameOf(byId.get(id)!) : (r.created.find((c) => c.id === id)?.name ?? ""))).filter(Boolean);
      setText("");
      setTags([]);
      dropped.current.clear();
      setPicking(false);
      closeNaming();
      say(labels.savedTo.replace("{names}", names.join(", ")));
      // 방금 더한 사람이 다음 메모의 추천에 보이게
      if (r.created.length) router.refresh();
    });
  };

  // 건너뛰기: 첫 메모 없이 온보딩을 마친다(가려던 곳이 있으면 거기로, 아니면 홈)
  const skip = () => {
    if (!onboarding || saving || skipping) return;
    startSkip(async () => {
      await skipOnboarding(browserZone(), onboarding.next).catch(() => say(labels.error, true));
    });
  };

  // ── 사람 고르기 ──
  /** 이름 칸을 닫고 비운다(온보딩에서 아무도 안 골랐으면 늘 열려 있다) */
  const closeNaming = () => {
    setQuery("");
    setTyping(false);
    setActive(0);
    setNaming(!!onboarding && !tags.length);
  };
  const openNaming = () => {
    setNaming(true);
    setPicking(true);
    window.setTimeout(() => nameBox.current?.focus(), 0);
  };
  const addTag = (tag: Tag) => {
    dropped.current.delete(tagKey(tag));
    setTags((cur) => (cur.some((t) => tagKey(t) === tagKey(tag)) ? cur : [...cur, tag]));
    setQuery("");
    setTyping(false);
    setActive(0);
    setNaming(false);
  };
  const dropTag = (key: string) => {
    dropped.current.add(key);
    const left = tags.filter((t) => tagKey(t) !== key);
    setTags(left);
    // 온보딩에서 다 빼면 처음 모습(이름 칸과 바로 고르는 이름)으로
    if (onboarding && !left.length) setNaming(true);
  };
  const tagOf = (o: Option): Tag => (o.kind === "person" ? { kind: "person", id: o.p.id } : { kind: "new", name: o.name });
  const pick = (o: Option | undefined) => {
    if (!o) return;
    addTag(tagOf(o));
  };
  // 본문 @목록에서 고르면 '@이름 '으로 바꿔 넣고(커서는 그 뒤) 그 사람을 칩에 더한다
  const pickAt = (o: Option | undefined) => {
    if (!o || !at) return;
    const done = insertMention(text, at.start, box.current?.selectionStart ?? caret, o.kind === "person" ? nameOf(o.p) : o.name);
    setText(done.text.slice(0, MAX));
    setCaret(done.caret);
    setAtClosed(null);
    setAtActive(0);
    nextCaret.current = done.caret;
    addTag(tagOf(o));
  };
  const onBodyKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!atOpen || !at) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAtActive((atCurrent + (e.key === "ArrowDown" ? 1 : atOptions.length - 1)) % atOptions.length);
    } else if (e.key === "Enter") {
      // 한글을 조합하는 중의 엔터는 글자를 확정하는 것뿐(고르는 게 아니다). 줄바꿈(Shift+엔터)도 그대로 둔다
      if (e.nativeEvent.isComposing || e.keyCode === 229 || e.shiftKey) return;
      e.preventDefault();
      pickAt(atOptions[atCurrent]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAtClosed(at.start);
    }
  };
  const onNameKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setTyping(true);
      setActive((current + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(options[current]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else closeNaming();
    }
  };

  const placeholder = onboarding ? onboarding.labels.example : chosen.length === 1 && chosen[0]!.person ? labels.placeholderOf.replace("{name}", nameOf(chosen[0]!.person)) : labels.placeholder;
  const [month, day, weekdayName] = [labels.month, today.d, weekdayLong(today, locale)];

  return (
    <div className="flex flex-1 flex-col">
      {/* 위 줄: 닫기 · (글이 없으면) 메모 가져오기 알약 / (글이 있으면) 가져오기 아이콘 + 저장.
          온보딩(첫 메모)은 닫기 대신 손글씨 제목, 오른쪽에 건너뛰기와(글이 있으면) 저장 */}
      {onboarding ? (
        <div className="flex h-12 shrink-0 items-center justify-between pl-[18px] pr-[10.8px]">
          <h1 className="text-[23.4px] leading-none">{onboarding.labels.title}</h1>
          <div className="flex items-center gap-[3.6px]">
            <button type="button" onClick={skip} disabled={skipping || saving} className="flex min-h-11 items-center px-[9px] text-[12.6px] text-muted disabled:opacity-60">
              {onboarding.labels.skip}
            </button>
            {hasText ? <SaveButton onClick={save} disabled={saving || skipping} label={labels.save} /> : null}
          </div>
        </div>
      ) : (
        <div className="flex h-12 shrink-0 items-center justify-between pl-1.5 pr-3">
          <AppLink href={fixed ? `/people/${fixed.id}` : "/home"} aria-label={labels.close} className="relative flex h-11 w-11 items-center justify-center before:absolute before:-inset-[2.2px]">
            <Icon name="close" size={22} strokeWidth={1.8} />
          </AppLink>
          {hasText ? (
            <div className="flex items-center gap-1">
              <ImportMenu
                locale={locale}
                labels={labels.menu}
                disabled={busy || saving || reading}
                autoOpen={importNow}
                onPhoto={() => photoInput.current?.click()}
                triggerLabel={labels.importNotes}
                className="relative flex h-11 w-11 items-center justify-center rounded-full before:absolute before:-inset-[2.2px]"
              >
                <Svg size={21}>{IMPORT_ICON}</Svg>
              </ImportMenu>
              <SaveButton onClick={save} disabled={saving} label={labels.save} />
            </div>
          ) : (
            <ImportMenu
              locale={locale}
              labels={labels.menu}
              disabled={busy || saving || reading}
              autoOpen={importNow}
              onPhoto={() => photoInput.current?.click()}
              className="inline-flex items-center gap-[4.5px] whitespace-nowrap rounded-full border border-edge bg-white text-[12.15px]"
              style={{ height: u(34), padding: `0 ${u(13)}px 0 ${u(10)}px` }}
            >
              <Svg size={17}>{IMPORT_ICON}</Svg>
              {labels.importNotes}
            </ImportMenu>
          )}
        </div>
      )}

      <div className="relative ml-[21.6px] mr-[14.4px] flex flex-1 flex-col" style={onboarding ? { marginTop: u(62), marginBottom: "max(calc(var(--sab) + 12px), 46.8px)" } : { marginTop: u(16), marginBottom: u(18) }}>
        {onboarding ? (
          <>
            {/* 캐릭터(아직 이야기할 사람이 없으면 책 읽는 모습, 사람을 고르고 글을 적었으면 하트) + 말풍선 한 줄 */}
            <div aria-hidden="true" className="absolute z-[5] flex items-end" style={{ right: u(10), top: -u(56), height: u(53.5) }}>
              <Mascot pose={chosen.length && hasText ? 4 : 7} size={48.4} />
            </div>
            {!chosen.length || hasText ? (
              <div
                className="hand absolute z-[5] break-keep rounded-[14.4px] border border-edge bg-white text-[17.1px] leading-[1.25] shadow-[0_7.2px_12.6px_-9px_rgb(31_35_64/0.4)]"
                style={{ right: u(92), top: -u(54), maxWidth: u(250), padding: `${u(9)}px ${u(14)}px ${u(10)}px` }}
              >
                {chosen.length ? onboarding.labels.saveEnd : onboarding.labels.askWho}
                <svg aria-hidden="true" viewBox="0 0 18 12" className="absolute" width={u(18)} height={u(12)} style={{ right: -u(11), bottom: u(10), transform: "rotate(-90deg)" }}>
                  <path d="M1 0 L9 11 L17 0" fill="#FFFFFF" stroke="rgb(31 35 64 / 0.28)" strokeWidth="1" />
                  <path d="M1.5 -0.6 H16.5" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
              </div>
            ) : null}
          </>
        ) : (
          /* 모서리에 붙은 해 스티커 */
          <svg aria-hidden="true" viewBox="0 0 40 40" className="absolute z-[4]" width={u(38)} height={u(38)} style={{ right: u(14), top: -u(16), transform: "rotate(10deg)" }}>
            <circle cx="20" cy="20" r="8" fill="#FFD978" stroke={INK} strokeWidth="1.4" />
            <path d="M20 4v5M20 31v5M4 20h5M31 20h5M8.7 8.7l3.5 3.5M27.8 27.8l3.5 3.5M8.7 31.3l3.5-3.5M27.8 12.2l3.5-3.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
        <BinderPage margin className="flex flex-1 flex-col" pageClassName="flex flex-1 flex-col">
          {/* 날짜 머리 */}
          <div className="flex items-end justify-between border-b-[1.35px] border-dashed border-ink/30" style={{ padding: `${u(20)}px 0 ${u(12)}px` }}>
            <div className="flex items-end gap-[7.2px]">
              <span className="hand text-[54px] leading-[.82]">{day}</span>
              <span className="flex flex-col gap-[2.7px] pb-[1.8px]">
                <span className="text-[11.25px] text-muted">{month}</span>
                <span className="hand text-[18px] leading-none">{weekdayName}</span>
              </span>
            </div>
            <WeekStrip today={today} locale={locale} />
          </div>

          {/* @ 이야기의 주인공: 고른 사람 칩 · 이름 칸 / + · (고르는 목록) */}
          <div className="-mr-[14.4px] flex items-center gap-[6.3px] overflow-x-auto overflow-y-hidden [-webkit-mask-image:linear-gradient(90deg,#000_80%,transparent)] [mask-image:linear-gradient(90deg,#000_80%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ height: u(starting ? 54 : 52) }}>
            <span aria-hidden="true" className="hand shrink-0 pr-[0.9px] text-[24.3px] leading-none text-mango-deep">
              @
            </span>
            {chosen.map((c) => {
              const label = c.person ? nameOf(c.person) : c.name;
              return (
                <span key={c.key} className="inline-flex shrink-0 items-center gap-[5.4px] rounded-full border border-edge bg-sky-soft pl-[2.7px] pr-[2.7px]" style={{ height: u(30) }}>
                  {c.person ? <Face p={c.person} /> : <NewFace name={label} />}
                  <span className="hand text-[18px] leading-none">{label}</span>
                  {c.person ? null : (
                    <span className="inline-flex items-center rounded-full border border-edge bg-white text-mango-deep" style={{ height: u(18), padding: `0 ${u(6)}px`, fontSize: u(10.5) }}>
                      {labels.newBadge}
                    </span>
                  )}
                  <button type="button" aria-label={labels.removeTag.replace("{name}", label)} onClick={() => dropTag(c.key)} className="relative flex items-center justify-center rounded-full before:absolute before:-inset-[6px]" style={{ width: u(24), height: u(24) }}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" width={u(12)} height={u(12)} fill="none" stroke="#5B5F78" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              );
            })}
            {naming ? (
              <label className="relative inline-flex shrink-0 items-center rounded-full border-[1.35px] border-sky bg-white shadow-[0_0_0_2.7px_rgb(255_194_61/0.22)]" style={{ height: u(34), minWidth: u(starting ? 168 : 118), padding: `0 ${u(12)}px` }}>
                {/* 글자 수만큼 넓어지는 입력 칸: 같은 칸에 겹친 보이지 않는 글자가 폭을 정한다 */}
                <span className="inline-grid">
                  <span aria-hidden="true" className="hand invisible col-start-1 row-start-1 whitespace-pre text-[18px] leading-none">
                    {query || labels.name}
                  </span>
                  <input
                    ref={nameBox}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setTyping(true);
                      setActive(0);
                    }}
                    onFocus={() => setTyping(true)}
                    onBlur={() => {
                      setTyping(false);
                      if (onboarding) return;
                      // 비어 있는 채로 포커스를 잃으면 닫는다. 곧바로 닫으면 줄이 줄어들어 방금 누른 사람 칩의 자리가 옮겨 가 눌림이 빗나가니 잠깐 둔다
                      window.setTimeout(() => {
                        const el = nameBox.current;
                        if (el && document.activeElement !== el && !el.value.trim()) setNaming(false);
                      }, 300);
                    }}
                    onKeyDown={onNameKey}
                    maxLength={NEW_NAME_MAX}
                    placeholder={labels.name}
                    aria-label={labels.name}
                    role="combobox"
                    aria-expanded={dropOpen}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={dropOpen ? `${listId}-${current}` : undefined}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    className="hand col-start-1 row-start-1 w-full min-w-0 border-0 bg-transparent p-0 text-[18px] leading-none caret-mango-deep outline-none placeholder:text-ink/[.38]"
                  />
                </span>
              </label>
            ) : (
              <button
                type="button"
                aria-label={labels.addPerson}
                onClick={openNaming}
                className={`relative flex shrink-0 items-center justify-center rounded-full border border-dashed border-ink/40 before:absolute before:-inset-[6px] ${picking ? "bg-sky-soft" : ""}`}
                style={{ width: u(30), height: u(30) }}
              >
                <Svg size={14} strokeWidth={2}>
                  {PLUS}
                </Svg>
              </button>
            )}
            {listOpen
              ? rest.map((p) => (
                  <button key={p.id} type="button" onClick={() => addTag({ kind: "person", id: p.id })} className="inline-flex shrink-0 items-center gap-[5.4px] rounded-full border border-edge bg-white pl-[2.7px] pr-[9.9px]" style={{ height: u(30) }}>
                    <Face p={p} />
                    <span className="hand text-[18px] leading-none">{nameOf(p)}</span>
                  </button>
                ))
              : null}
          </div>

          {/* 이름을 치면 뜨는 목록: 맞는 내 사람들, 맨 끝에 '새로 추가'(같은 이름이 있어도 새 사람으로 더할 수 있다) */}
          {dropOpen ? (
            <OptionList
              id={listId}
              label={labels.people}
              options={options}
              current={current}
              newOption={labels.newOption}
              onPick={pick}
              style={{ margin: `-${u(2)}px 0 ${u(10)}px ${u(22)}px`, width: u(248), padding: u(6), borderRadius: u(14), boxShadow: `0 ${u(14)}px ${u(22)}px -${u(16)}px rgb(31 35 64 / 0.55)` }}
            />
          ) : null}

          {/* 온보딩의 처음: 바로 고르는 이름들(고르면 그 이름의 새 사람) */}
          {starting ? (
            <div className="flex flex-wrap pb-[10.8px] pt-[1.8px]" style={{ gap: u(7) }}>
              {onboarding!.labels.quick.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addTag({ kind: "new", name })}
                  className="hand inline-flex shrink-0 items-center gap-[4.5px] rounded-full border border-dashed border-ink/40 bg-white text-[17.1px] leading-none"
                  style={{ height: u(32), padding: `0 ${u(12)}px 0 ${u(8)}px` }}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width={u(13)} height={u(13)} fill="none" stroke="#E09A12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    {PLUS}
                  </svg>
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          {/* 본문: 라인 노트 줄 위에 손글씨로(줄이 본문 칸에서 시작해 글줄 높이 RULE마다 되풀이되니 글이 줄 위에 앉고, 글이 늘면 줄도 같이 늘어난다. 속지 양 끝까지 닿게 안쪽 여백만큼 밖으로 펼친다).
              듣는 동안은 받아 적는 말(아직 바뀔 수 있는 부분은 연하게 + 망고 밑줄)이 보이는 글로 */}
          <div
            className="relative flex-1 cursor-text pb-[28px]"
            style={{ marginLeft: -u(40), marginRight: -u(16), paddingLeft: u(40), paddingRight: u(16), ...ruledLines(RULE_AT) }}
            onClick={() => box.current?.focus()}
          >
            {reading ? (
              // 글줄 한 칸(RULE) 높이를 차지해 밑의 글이 줄 위에 그대로 앉는다
              <div className="flex items-start" style={{ height: RULE }}>
                <div role="status" className="hand inline-flex items-center gap-[7px] rounded-full border border-edge bg-white text-[17.1px] leading-none" style={{ height: u(32), padding: `0 ${u(14)}px 0 ${u(11)}px` }}>
                  <Spinner />
                  {labels.photoReading}
                </div>
              </div>
            ) : null}
            {listening || settling ? (
              <div className="hand-written whitespace-pre-wrap text-[20.7px] leading-[30.6px]">
                {settled}
                {heard.interim ? (
                  <span style={{ color: "rgb(31 35 64 / 0.55)", backgroundImage: "linear-gradient(transparent 62%, rgb(255 194 61 / 0.45) 62%, rgb(255 194 61 / 0.45) 90%, transparent 90%)" }}>{join(settled, heard.interim).slice(settled.length)}</span>
                ) : null}
                <span aria-hidden="true" className="inline-block bg-[#FF7A8A] motion-safe:animate-[memo-caret_1s_steps(1)_infinite]" style={{ width: u(2), height: u(25), marginLeft: u(2), verticalAlign: -u(5) }} />
              </div>
            ) : (
              <textarea
                ref={box}
                value={text}
                onChange={(e) => {
                  voiced.current = voiced.current && e.target.value.length > 0;
                  setText(e.target.value);
                  setCaret(e.target.selectionStart);
                  setAtActive(0);
                  // Esc로 닫아 둔 @는 그 @를 지우거나 다른 @로 옮겨 가면 풀린다
                  if (!mentionAt(e.target.value, e.target.selectionStart)) setAtClosed(null);
                }}
                onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
                onKeyDown={onBodyKey}
                rows={1}
                maxLength={MAX}
                placeholder={placeholder}
                aria-label={placeholder}
                aria-controls={atOpen ? atId : undefined}
                aria-activedescendant={atOpen ? `${atId}-${atCurrent}` : undefined}
                className={`hand-written block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[20.7px] leading-[30.6px] caret-mango-deep outline-none ${onboarding ? "placeholder:text-ink/[.34]" : "placeholder:text-ink/40"}`}
              />
            )}
            {/* 본문에서 @를 치면 뜨는 목록: 글 바로 밑(아래 메뉴에 가리지 않게 여유) */}
            {atOpen ? (
              <OptionList
                innerRef={atList}
                id={atId}
                label={labels.people}
                options={atOptions}
                current={atCurrent}
                newOption={labels.newOption}
                onPick={pickAt}
                style={{ marginTop: u(6), width: u(248), maxWidth: "100%", padding: u(6), borderRadius: u(14), boxShadow: `0 ${u(14)}px ${u(22)}px -${u(16)}px rgb(31 35 64 / 0.55)`, scrollMarginBottom: u(110) }}
              />
            ) : null}
          </div>
        </BinderPage>
      </div>

      {micError ? (
        <p role="alert" className="px-6 pb-2 text-center text-[12.2px] text-red">
          {labels.micError}
        </p>
      ) : null}

      {/* 오른쪽 아래 마이크: 하단 메뉴 위로 띄워 둔다(.memo-mic). 높이 0짜리 sticky 줄이라 화면이 길어져도 같은 자리에 있다 */}
      {canListen ? (
        <div className="memo-mic sticky z-20 h-0 w-full" data-onboarding={onboarding ? "" : undefined}>
          <div className="absolute bottom-0" style={{ right: u(22), width: u(66), height: u(66) }}>
            {busy ? (
              <>
                <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-[rgb(255_122_138/0.1)] motion-safe:animate-[memo-breathe_1.8s_ease-in-out_infinite]" style={{ width: u(128), height: u(128), transform: "translate(-50%,-50%)" }} />
                <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-[rgb(255_122_138/0.18)] motion-safe:animate-[memo-breathe_1.8s_ease-in-out_0.3s_infinite]" style={{ width: u(98), height: u(98), transform: "translate(-50%,-50%)" }} />
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void listen()}
              disabled={saving}
              aria-label={busy ? labels.stopListening : labels.mic}
              className="relative flex h-full w-full items-center justify-center rounded-full border border-edge transition-colors disabled:opacity-60"
              style={{ background: busy ? "#FF7A8A" : "#FFC23D", boxShadow: `0 ${u(4)}px 0 ${busy ? "#D9566A" : "#E09A12"}, 0 ${u(16)}px ${u(22)}px -${u(12)}px rgb(31 35 64 / 0.55)` }}
            >
              {busy ? (
                <span aria-hidden="true" className="block bg-ink" style={{ width: u(20), height: u(20), borderRadius: u(5) }} />
              ) : (
                <Svg size={30} strokeWidth={2}>
                  <rect x="9" y="3.5" width="6" height="11" rx="3" />
                  <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
                </Svg>
              )}
            </button>
          </div>
          {listening ? <ListenPill measure={!nativeSpeech()} /> : null}
        </div>
      ) : null}

      {/* '사진에서'가 여는 사진 고르기(카메라를 따로 켜지 않는다). 메뉴가 닫혀도 남아 있어야 고른 사진이 들어온다 */}
      <input ref={photoInput} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void readPhotos(e.target.files)} />

      {toast ? <Toast key={toast.id} text={toast.text} error={toast.error} /> : null}
    </div>
  );
}
