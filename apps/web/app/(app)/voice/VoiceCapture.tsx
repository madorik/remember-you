"use client";

import { CAPTURE_FIELDS, SECTIONS, captureField, describeCapture, parseCaptureEdit, type AvatarConfig, type Locale, type Section } from "@readme/core";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { draftCapture, previewCapture, saveCapture, type CaptureDraft, type CaptureDraftLine, type CaptureState } from "@/app/actions/capture";
import { trackTour } from "@/app/actions/tour";
import { Avatar } from "@/components/Avatar";
import { PointArrow, TourNote } from "@/components/diary";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { CaptureBadge, struck, type CaptureBadgeLabels } from "@/components/CaptureBadge";
import { CaptureTargetSheet, type TargetSheetLabels } from "@/components/CaptureTargetSheet";
import { OrganizeScene } from "@/components/OrganizeScene";
import { TagChip } from "@/components/PersonRow";
import { markSaved } from "@/components/ReviewAsk";
import type { CaptureItem } from "@/lib/capture-ai";
import { planAfterSave, stashSaved } from "@/lib/capture-saved";
import { firstPick, retarget, sameTarget, siblingCount, whoOf, type CaptureTarget } from "@/lib/capture-target";
import { insertMention, mentionAt, mentionLabel, resolveMentions, type MentionPerson } from "@/lib/mention";
import { matchesPerson } from "@/lib/search";
import { setOrbListening, setOrbLevel } from "@/lib/orb";
import { startListenGuard, type ListenGuard, type StopReason } from "@/lib/listen-guard";
import { commonPrefix, nativeSpeech, nextTyped, startDictation, webCtor, type Dictation, type WebRecognition } from "@/lib/speech";

/** @로 부를 수 있는 사람(즐겨찾기가 먼저) */
export type MentionOption = MentionPerson & { avatar: AvatarConfig | null; /** 이름이 같은 사람을 가려 볼 때 곁에 붙이는 기록 요약 */ hint?: string };

/**
 * 가운데 물방울. 깨끗하고 투명한 물이 동그라미 안에서 출렁이는 느낌:
 * 속은 거의 투명하고 가장자리만 빛이 꺾이듯 푸르스름하며, 왼쪽 위에 흰 반짝임과 가장자리를 따라 비친 초승달 빛, 오른쪽 아래에 모인 빛, 바닥에 그림자와 물을 지난 밝은 빛.
 * 테두리 모양(border-radius)을 조금씩 바꿔 말랑하게 흔들리고, 속물이 출렁인다. 목소리가 클수록 크고 빠르게 흔들린다.
 * 브라우저는 마이크 소리 크기(AnalyserNode)를, 잴 수 없는 곳(앱의 기기 인식)은 듣는 동안 부드럽게 오르내리는 값을 쓴다.
 * 듣는 동안에는 물방울에서 물결 고리가 퍼져 나가고(소리가 클수록 진하게), 밑에 음성 막대가 소리 크기에 맞춰 오르내린다.
 * 소리를 잴 수 없는 앱에서는 받아 적은 글자가 들어올 때마다(beat) 출렁인다.
 * 소리 크기는 아래 메뉴 가운데 구슬(lib/orb.ts의 --mic)에도 같이 보낸다(live=마이크가 열려 있는 동안만).
 * 처음 들어와 아직 아무 말도 안 했을 때(cue)는 망고빛 고리가 천천히 퍼져 "여기를 누르세요"를 알린다(움직임 줄이기면 멈춘 고리 하나).
 * 움직임 줄이기를 켠 사람에게는 멈춘다. 값은 그릴 때마다 DOM에 바로 넣는다(화면을 다시 그리지 않게).
 * 듣는 동안(active)에만 프레임 루프를 돌리고, 가만히 있을 때는 한 번 그리고 멈춘다. 음성 막대는 높이 대신 scaleY(합성만)로 오르내린다
 */
const BARS = [0.55, 0.8, 1, 0.8, 0.55];
const BAR_ROW = 32;
/** 음성 막대 한 줄의 가장 큰 높이(px). 이보다 작게는 scaleY로 */
const BAR_MAX = 31;
const BAR_MIN = 5;

function WaterDrop({ active, live, measure, cue = false, beat = 0, size = 189 }: { active: boolean; live: boolean; measure: boolean; cue?: boolean; beat?: number; size?: number }) {
  const body = useRef<HTMLDivElement>(null);
  const slosh = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const ripples = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const kick = useRef(0);
  const firstBeat = useRef(true);
  useEffect(() => {
    if (firstBeat.current) {
      firstBeat.current = false;
      return;
    }
    kick.current = 1;
  }, [beat]);
  useEffect(() => {
    const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let stopped = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let data = new Uint8Array(0);
    let level = 0;
    let phase = 0;
    let last = 0;
    // 한 프레임 그리기(루프는 아래 loop가 돈다)
    const paint = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      let target = 0;
      if (active && analyser) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        target = Math.min(1, Math.sqrt(sum / data.length) * 7);
      } else if (active) {
        target = Math.min(1, 0.3 + 0.12 * Math.sin(t / 380) + 0.6 * kick.current);
      }
      kick.current *= 0.9;
      level += (target - level) * 0.14;
      if (live) setOrbLevel(still ? 0 : level);
      if (!still) phase += dt * (1.1 + 3.2 * level);
      const a = still ? 0 : 2.2 + 7 * level; // 테두리 출렁임(%)
      const w = (k: number, o: number) => 50 + a * Math.sin(phase * k + o);
      const radius = `${w(1.0, 0)}% ${w(1.3, 1.1)}% ${w(0.9, 2.3)}% ${w(1.2, 3.7)}% / ${w(1.1, 0.6)}% ${w(0.8, 2.0)}% ${w(1.4, 2.9)}% ${w(1.0, 4.4)}%`;
      const squash = still ? 0 : (0.012 + 0.05 * level) * Math.sin(phase * 1.6);
      const grow = 1 + (still ? 0 : 0.06 * level);
      if (body.current) {
        body.current.style.borderRadius = radius;
        body.current.style.transform = `scale(${grow * (1 + squash)}, ${grow * (1 - squash)})`;
      }
      if (slosh.current)
        slosh.current.style.transform = `translate(${Math.sin(phase * 0.9) * (6 + 14 * level)}px, ${Math.cos(phase * 1.2) * (4 + 10 * level)}px) rotate(${Math.sin(phase * 0.7) * 12}deg)`;
      if (shine.current) shine.current.style.transform = `translate(${-Math.sin(phase * 0.9) * 3}px, ${-Math.cos(phase * 1.2) * 2}px) rotate(-28deg)`;
      if (shadow.current) shadow.current.style.transform = `translateX(-50%) scale(${grow * (1 + squash * 1.5)}, 1)`;
      if (ripples.current) ripples.current.style.opacity = String(0.6 + 0.4 * level);
      bars.current.forEach((bar, i) => {
        if (!bar) return;
        const wave = still ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(phase * 1.9 + i * 1.25));
        const h = active ? BAR_MIN + (BAR_MAX - BAR_MIN) * Math.min(1, (0.25 + level) * wave) * BARS[i]! : BAR_MIN;
        bar.style.transform = `scaleY(${h / BAR_MAX})`;
      });
    };
    const loop = (t: number) => {
      paint(t);
      raf = requestAnimationFrame(loop);
    };
    void (async () => {
      if (active && measure && navigator.mediaDevices?.getUserMedia) {
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
      // 듣는 동안만 계속 그린다. 가만히 있을 때는 한 번만 그려 두고 멈춘다(페인트·배터리 아낌)
      if (active) raf = requestAnimationFrame(loop);
      else paint(0);
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (live) setOrbLevel(0);
      stream?.getTracks().forEach((tr) => tr.stop());
      void ctx?.close().catch(() => {});
    };
  }, [active, live, measure]);
  return (
    <div aria-hidden="true" className="relative" style={{ width: size, height: size + 23 + BAR_ROW }}>
      {/* 듣는 동안 물방울에서 퍼져 나가는 물결 고리 */}
      {active ? (
        <div ref={ripples} className="pointer-events-none absolute left-0 top-0" style={{ width: size, height: size }}>
          {[0, 0.8, 1.6].map((delay) => (
            <span
              key={delay}
              className="absolute inset-0 rounded-full opacity-0 motion-safe:animate-[drop-ripple_2.4s_cubic-bezier(0.2,0.6,0.35,1)_infinite]"
              style={{
                animationDelay: `${delay}s`,
                border: "2.5px solid rgba(80,160,230,0.75)",
                background: "radial-gradient(circle, rgba(150,210,250,0) 58%, rgba(150,210,250,0.22) 100%)",
                boxShadow: "0 0 16px rgba(120,195,250,0.4), inset 0 0 20px rgba(140,205,250,0.3)",
              }}
            />
          ))}
        </div>
      ) : cue ? (
        <div className="pointer-events-none absolute left-0 top-0" style={{ width: size, height: size }}>
          {[0, 1.3].map((delay) => (
            <span key={delay} className="cue-ring" style={{ "--d": `${delay}s` } as React.CSSProperties} />
          ))}
        </div>
      ) : null}
      {/* 바닥 그림자와, 물을 지나 모인 밝은 빛 */}
      <div
        ref={shadow}
        className="absolute left-1/2 rounded-[50%]"
        style={{
          bottom: BAR_ROW,
          width: size * 0.72,
          height: 20,
          transform: "translateX(-50%)",
          background: "radial-gradient(ellipse at 50% 50%, rgba(160,230,255,0.85) 0%, rgba(120,190,235,0.35) 28%, rgba(40,90,150,0.22) 55%, rgba(40,90,150,0) 75%)",
          filter: "blur(5px)",
        }}
      />
      {/* 물방울 몸 */}
      <div
        ref={body}
        className="absolute left-0 top-0 overflow-hidden will-change-transform"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 48%, rgba(255,255,255,0.06) 0%, rgba(214,240,255,0.16) 45%, rgba(140,200,240,0.5) 78%, rgba(70,145,215,0.8) 100%)",
          boxShadow:
            "inset 0 0 0 1.5px rgba(255,255,255,0.75), inset 0 14px 26px rgba(40,110,180,0.22), inset 0 -18px 30px rgba(255,255,255,0.75), inset 0 -2px 10px rgba(120,200,255,0.5), 0 22px 40px -22px rgba(30,90,160,0.4)",
        }}
      >
        {/* 속에서 출렁이는 물빛 */}
        <div
          ref={slosh}
          className="absolute will-change-transform"
          style={{
            inset: "-15%",
            background:
              "radial-gradient(ellipse 55% 40% at 50% 78%, rgba(80,170,235,0.28), rgba(80,170,235,0) 70%), radial-gradient(ellipse 40% 30% at 38% 40%, rgba(255,255,255,0.25), rgba(255,255,255,0) 70%)",
          }}
        />
        {/* 오른쪽 아래에 모인 빛(꺾인 빛) */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 34% 22% at 66% 84%, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)" }} />
      </div>
      {/* 왼쪽 위 반짝임 */}
      <div
        ref={shine}
        className="absolute"
        style={{
          left: size * 0.2,
          top: size * 0.13,
          width: size * 0.28,
          height: size * 0.15,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 30%, rgba(255,255,255,0) 62%)",
          transform: "rotate(-28deg)",
        }}
      />
      {/* 가장자리를 따라 비친 가는 초승달 빛 */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          left: size * 0.07,
          top: size * 0.07,
          width: size * 0.86,
          height: size * 0.86,
          borderTop: `${Math.round(size * 0.022)}px solid rgba(255,255,255,0.7)`,
          borderLeft: `${Math.round(size * 0.012)}px solid rgba(255,255,255,0.35)`,
          borderRight: "0 solid transparent",
          borderBottom: "0 solid transparent",
          transform: "rotate(-20deg)",
          filter: "blur(1.5px)",
        }}
      />
      <div className="absolute rounded-full bg-white/90" style={{ left: size * 0.47, top: size * 0.12, width: size * 0.045, height: size * 0.045, filter: "blur(0.5px)" }} />
      {/* 음성 막대: 듣는 동안 소리 크기에 맞춰 */}
      <div className={`absolute bottom-0 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}>
        {BARS.map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              bars.current[i] = el;
            }}
            className="w-1.5 rounded-full will-change-transform"
            style={{ height: BAR_MAX, transform: `scaleY(${BAR_MIN / BAR_MAX})`, background: "linear-gradient(to top, rgba(70,145,215,0.9), rgba(150,210,250,0.95))" }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 받아 적는 글을 한 글자씩 타자 치듯(on일 때만, 기기는 말을 덩어리로 보낸다). 고쳐 들어 앞이 달라지면 같은 앞부분까지 바로 지우고 다시 친다.
 * 움직임 줄이기를 켠 사람에게는 바로 보인다
 */
function useTyped(target: string, on: boolean): string {
  const [typed, setTyped] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (!on) {
      cur.current = target;
      return;
    }
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = still ? target : nextTyped(cur.current.slice(0, commonPrefix(cur.current, target)), target);
      if (next === cur.current) return;
      cur.current = next;
      setTyped(next);
      timer = setTimeout(tick, 42);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [target, on]);
  return on ? typed.slice(0, commonPrefix(typed, target)) : target;
}

const MODE_KEY = "remember-you.capture-mode";

type Labels = CaptureBadgeLabels & {
  mode: string;
  modeVoice: string;
  modeText: string;
  speak: string;
  clear: string;
  /** 처음 들어왔을 때 구슬 아래 한 줄 */
  cue: string;
  listening: string;
  /** 자동으로 멈춘 뒤 상태 줄 */
  heard: string;
  /** 듣는 동안 마이크 단추의 이름(멈추기) */
  stop: string;
  placeholder: string;
  placeholderText: string;
  mention: string;
  mentionList: string;
  /** 기억해 두기(나누기를 시작하는 단추) */
  save: string;
  /** 나눈 결과 위 제목(이렇게 기억해 둘게요) */
  saved: string;
  /** 나눈 결과를 실제로 저장하는 단추 */
  confirm: string;
  /** 저장하고 더 말하러 돌아왔을 때 */
  savedDone: string;
  /** 정리하는 동안 바뀌는 문구(분류하고 있어요 → 적고 있어요 → 정리하고 있어요) */
  steps: string[];
  /** 잘못 나뉜 줄 빼기 */
  removeLine: string;
  isNew: string;
  /** 줄 대상 바꾸기 시트 */
  target: TargetSheetLabels;
  /** 줄 항목 바꾸기(고르는 칸의 이름) */
  changeField: string;
  /** 사람 화면에서 왔을 때 위 태그의 이름표('{name}의 기록으로 적는 중')와 × 단추('{name} 정하기 풀기') */
  to: string;
  toClear: string;
  /** 항목 이름: 메모, 내 리드미에서 선물 목록 */
  memo: string;
  wishMe: string;
  /** 항목 고르기의 묶음 이름(칸 묶음별) */
  sections: Record<Section, string>;
  more: string;
  aiOff: string;
  failed: string;
  limit: string;
  nothing: string;
  micError: string;
  /** 적지 못한 말이 있을 때(제목 · 메모로 남기기 · 다시 하기) */
  leftover: string;
  leftoverMemo: string;
  leftoverRetry: string;
};

/** 가입 직후 체험(?tour=)일 때 위에 붙는 안내: "이렇게 말해보세요 / 써보세요 + 예시 문장", 끝나면 다음(물어보기)으로 */
export interface VoiceTour {
  /** "1 / 2" */
  page: string;
  say: string;
  write: string;
  /** 예시 문장(엄마는 장미꽃을 좋아해) */
  example: string;
  next: string;
}

/**
 * 확인 화면의 한 줄: AI가 나눈 줄(line)과 고치는 중인 항목(item)·입력 글(input). bad는 고친 글을 값으로 읽을 수 없을 때.
 * target은 누구의 이야기로 적을지(못 정했으면 pick: 고르기 전에는 저장할 수 없다), spoken은 말한 이름, candidates는 같은 이름 후보.
 * same은 지금 대상·항목에 이미 그대로 적혀 있는지(바꿀 때마다 서버가 다시 따진다), rev는 줄을 바꿀 때마다 오르는 번호(늦게 온 답이 옛 줄에 얹히지 않게)
 */
interface DraftRow {
  key: number;
  line: CaptureDraftLine;
  item: CaptureItem;
  input: string;
  bad: boolean;
  target: CaptureTarget;
  spoken: string;
  candidates: string[];
  same: boolean;
  rev: number;
}

/** 칸 고르기: 칸 묶음별 */
const FIELD_GROUPS = SECTIONS.map((section) => ({ section, fields: CAPTURE_FIELDS.filter((f) => f.section === section) }));

/** 줄 대상 칩의 동그란 얼굴: 내 사람은 얼굴, 새 사람은 사람 더하기, 못 정함은 물음표 */
function TargetFace({ target, avatar, name }: { target: CaptureTarget; avatar: AvatarConfig | null; name: string }) {
  if (target.kind === "person") return <Avatar config={avatar} size={26} label={name} decorative />;
  if (target.kind === "new")
    return (
      <span aria-hidden="true" className="flex h-[23.4px] w-[23.4px] shrink-0 items-center justify-center rounded-full bg-sky-soft text-accent shadow-[0_0_0_1px_var(--color-edge)]">
        <Icon name="personAdd" size={14} strokeWidth={2.2} />
      </span>
    );
  return (
    <span aria-hidden="true" className="flex h-[23.4px] w-[23.4px] shrink-0 items-center justify-center rounded-full border border-dashed border-mango-deep bg-white text-[15.3px] text-accent">
      ?
    </span>
  );
}

/**
 * 사람 화면의 구슬에서 들어왔을 때 위에 붙는 태그: 그 사람의 작은 얼굴 + 이름(× 를 누르면 정하기를 풀고 예전처럼 이름으로 찾는다).
 * onClear가 없으면(확인 화면) × 없이 보여 주기만 한다
 */
function FixedTag({ person, labels, onClear, className = "" }: { person: MentionOption; labels: Pick<Labels, "to" | "toClear">; onClear?: () => void; className?: string }) {
  const name = mentionLabel(person);
  return (
    <div className={`flex justify-center ${className}`}>
      <span role="group" aria-label={labels.to.replace("{name}", name)} data-capture-tag="" className="inline-flex h-[34.2px] max-w-full items-center gap-1.5 rounded-full border border-ink bg-white pl-[3.6px] pr-2.5">
        <Avatar config={person.avatar} size={26} label={name} decorative />
        <span className="hand-written min-w-0 truncate text-[18px] leading-none">{name}</span>
        {onClear ? (
          <button
            type="button"
            aria-label={labels.toClear.replace("{name}", name)}
            onClick={onClear}
            className="relative -mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted before:absolute before:-inset-2"
          >
            <Icon name="close" size={15} strokeWidth={2} />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** 말로·글로 적기 아래의 기억해 두기 알약(시안: 높이 48, 망고 + 남색 선). 꺼지면 눌러 앉힌 바탕 */
const SAVE_PILL = "inline-flex h-12 items-center gap-1.5 rounded-full border border-edge bg-sky pl-3.5 pr-[16.2px] text-[15.3px] disabled:border-ink/[0.22] disabled:bg-[#e8e1cf] disabled:text-[#5a5f78]";

/** 첫 문구가 번쩍 사라지지 않게, 나누기가 아무리 빨라도 이 시간(ms)은 정리하는 화면을 보인다 */
const MIN_SCENE_MS = 600;

export function VoiceCapture({ locale, labels, people = [], fixed = null, tour = null }: { locale: Locale; labels: Labels; people?: MentionOption[]; /** 사람 화면의 구슬에서 왔을 때(?to=) 적을 사람 */ fixed?: MentionOption | null; tour?: VoiceTour | null }) {
  const canListen = useSyncExternalStore(
    () => () => {},
    () => !!webCtor() || !!nativeSpeech(),
    () => false,
  );
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  // 앱: 멈춘 뒤 마지막 말까지 든 최종 결과를 기다리는 중(길어야 1.5초)
  const [settling, setSettling] = useState(false);
  const [micError, setMicError] = useState(false);
  // 말이 멈춰 스스로 끈 뒤 받아 적은 글이 남았다(저장은 하지 않는다): 기억해 두기를 누를 차례
  const [ready, setReady] = useState(false);
  // 나누기(draftCapture)가 돌려준 초안과, 화면에서 고치고 뺀 줄들. 저장(saveCapture)을 눌러야 실제 기록에 들어간다
  const [result, setResult] = useState<CaptureDraft | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [saveError, setSaveError] = useState<CaptureState["error"]>(null);
  // 나눴는데 어느 줄에도 안 들어간 안전한 말(알레르기·못 먹는 것): 메모로 남기거나 다시 하게 보인다
  const [leftover, setLeftover] = useState<string[]>([]);
  // 저장하고 더 말하러 돌아왔다 / 저장을 마치고 다음 화면으로 가는 중
  const [flash, setFlash] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();
  const router = useRouter();
  // 사람 화면에서 왔으면 말하는 것·적는 것 모두 그 사람 기록으로(태그의 ×로 풀면 예전처럼 이름으로 찾는다)
  const [pinned, setPinned] = useState(true);
  const target = fixed && pinned ? fixed : null;
  const via = useRef<"voice" | "text">("text");
  // 말로 적는 동안(듣기·최종 결과 기다리기·나눠 적기) 받아 적은 글은 한 글자씩
  const shown = useTyped(text, listening || settling || pending);
  const web = useRef<WebRecognition | null>(null);
  const native = useRef<Dictation | null>(null);
  const alive = useRef(true);
  const heard = useRef("");
  // 말이 멈추는 때를 재는 타이머(lib/listen-guard). 웹 브라우저·앱 모두 같은 규칙
  const guard = useRef<ListenGuard | null>(null);
  // 사람이 구슬·마이크를 눌러 멈췄다: 끝나면 바로 적는다. 스스로 멈춘 것(조용해짐·시간 다 됨·기기가 끝냄)이면 글만 남기고 기억해 두기를 기다린다
  const pressedStop = useRef(false);
  // 스스로 멈춘 글에 이어 말하면 그 뒤에 이어 붙인다
  const prefix = useRef("");
  // 말로(물방울) / 글로(적는 칸). 마지막에 고른 방식을 기억한다(이 기기에서만). 음성 인식을 못 쓰는 기기는 글로만
  const stored = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(MODE_KEY) === "text" ? "text" : "voice";
      } catch {
        return "voice";
      }
    },
    () => "voice",
  );
  const [picked, setPicked] = useState<"voice" | "text" | null>(null);
  const mode = canListen ? (picked ?? stored) : "text";
  const choose = (m: "voice" | "text") => {
    if (m === "text" && listening) void stopListening();
    setPicked(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      /* 다음에는 기본값 */
    }
  };
  const box = useRef<HTMLTextAreaElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // @부름: 커서 앞이 '@낱말'이면 이름·태그로 찾은 사람을 칸 바로 밑에 보이고, 고르면 '@부름 '으로 넣는다
  const [tagged, setTagged] = useState<{ id: string; label: string }[]>([]);
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const mention = dismissed || !people.length || target ? null : mentionAt(text, caret);
  const options = mention ? people.filter((p) => matchesPerson(mention.query, p.name, p.tag)).slice(0, 6) : [];
  const listOpen = options.length > 0;
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));
  const who = resolveMentions(text, people, tagged)
    .ids.map((id) => people.find((p) => p.id === id))
    .filter((p): p is MentionOption => !!p);

  // 글을 바꾼 바로 그 그리기에서 커서를 놓는다(다음 글자가 먼저 들어와도 엉뚱한 자리에 끼지 않게)
  const pendingCaret = useRef<{ el: HTMLTextAreaElement | null; at: number } | null>(null);
  useLayoutEffect(() => {
    const p = pendingCaret.current;
    if (!p) return;
    pendingCaret.current = null;
    p.el?.focus();
    p.el?.setSelectionRange(p.at, p.at);
  }, [text, caret]);
  const placeCaret = (el: HTMLTextAreaElement | null, at: number) => {
    pendingCaret.current = { el, at };
    setCaret(at);
  };
  const pick = (el: HTMLTextAreaElement | null, o: MentionOption) => {
    if (!mention) return;
    const label = mentionLabel(o);
    const r = insertMention(text, mention.start, caret, label);
    setText(r.text);
    setTagged((prev) => [...prev.filter((m) => m.id !== o.id), { id: o.id, label }]);
    setActive(0);
    placeCaret(el, r.caret);
  };
  /** @ 단추: 커서 자리에 @를 넣고 목록을 연다(한글 자판에서는 @가 멀다) */
  const startMention = () => {
    const el = field.current;
    const at = el ? el.selectionStart : text.length;
    const before = text.slice(0, at);
    const ins = before && !/\s$/.test(before) ? " @" : "@";
    setText(before + ins + text.slice(at));
    setDismissed(false);
    setActive(0);
    placeCaret(el, at + ins.length);
  };
  /** 아래 사람 줄에서 얼굴을 누르면 커서 자리에 '@부름 '을 넣는다. 이미 부른 사람이면 글에서 그 부름을 뺀다 */
  const togglePerson = (p: MentionOption) => {
    const el = field.current;
    const label = mentionLabel(p);
    if (who.some((w) => w.id === p.id)) {
      const next = text.replace(new RegExp(`@${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s?`, "g"), "");
      setText(next);
      setTagged((prev) => prev.filter((m) => m.id !== p.id));
      placeCaret(el, Math.min(caret, next.length));
      return;
    }
    // 이름 바로 뒤에 커서(띄어쓰기 없이): '@아내는 …'처럼 조사를 바로 붙여 적는다. 찾기 줄은 다음 글자를 적을 때까지 닫아 둔다
    const at = el ? el.selectionStart : text.length;
    const before = text.slice(0, at);
    const ins = `${before && !/\s$/.test(before) ? " " : ""}@${label}`;
    setText(before + ins + text.slice(at));
    setTagged((prev) => [...prev.filter((m) => m.id !== p.id), { id: p.id, label }]);
    setDismissed(true);
    placeCaret(el, at + ins.length);
  };
  const mentionProps = {
    onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart),
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!listOpen || e.nativeEvent.isComposing) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((activeIndex + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(e.currentTarget, options[activeIndex]!);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
      }
    },
    "aria-autocomplete": "list" as const,
    "aria-controls": listOpen ? "mention-list" : undefined,
    "aria-activedescendant": listOpen ? `mention-${options[activeIndex]!.id}` : undefined,
  };
  const onType = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFlash(false);
    setText(e.target.value);
    setCaret(e.target.selectionStart);
    setDismissed(false);
    setActive(0);
  };
  const mentionList = (which: "field" | "box") =>
    listOpen ? (
      <ul id="mention-list" role="listbox" aria-label={labels.mentionList} className="card flex w-full flex-col p-1.5 text-left">
        {options.map((o, i) => (
          <li key={o.id} role="presentation">
            <button
              type="button"
              id={`mention-${o.id}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(which === "field" ? field.current : box.current, o)}
              className={`flex min-h-[46.8px] w-full items-center gap-3 rounded-[14.4px] px-2.5 text-left ${i === activeIndex ? "bg-fill" : ""}`}
            >
              <Avatar config={o.avatar} size={34} label={mentionLabel(o)} />
              <span className="hand-written min-w-0 truncate text-[17.8px] leading-[1.15]">{o.name}</span>
              {o.tag && o.tag !== o.name ? <TagChip>{o.tag}</TagChip> : null}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [shown, result]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      guard.current?.dispose();
      guard.current = null;
      web.current?.stop();
      native.current?.cancel();
    };
  }, []);

  // 듣는 동안 아래 메뉴 가운데 구슬을 활발하게(<html data-listening>, lib/orb.ts). 멈추거나 화면을 떠나면(cleanup) 끈다
  useEffect(() => {
    if (!listening) return;
    setOrbListening(true);
    return () => setOrbListening(false);
  }, [listening]);

  // 체험일 때만: 이 화면을 봤다는 기록(한 번)
  const seen = useRef(false);
  useEffect(() => {
    if (!tour || seen.current) return;
    seen.current = true;
    void trackTour("view", "voice");
  }, [tour]);

  // how: 말로(마이크) 적었나 글로 적었나. 나누기만 하고 저장은 confirm에서 한다. 체험이면 실패 이유는 여기서, 적음은 저장할 때 이용 기록에 남긴다
  const submit = (value: string, how: "voice" | "text") => {
    const v = value.trim();
    if (!v || pending) return;
    setReady(false);
    setFlash(false);
    via.current = how;
    start(async () => {
      const began = Date.now();
      const r = await draftCapture(v, target?.id, target ? [] : tagged, !!target).catch((): CaptureDraft => ({ lines: [], error: "failed" }));
      const wait = MIN_SCENE_MS - (Date.now() - began);
      if (wait > 0) await new Promise((done) => setTimeout(done, wait));
      if (!alive.current) return;
      setSaveError(null);
      setLeftover(r.leftover ?? []);
      setRows(r.lines.map((line, key) => ({ key, line, item: line.item, input: line.value, bad: false, target: line.target, spoken: line.spoken, candidates: line.candidates, same: !!line.same, rev: 0 })));
      setResult(r);
      if (tour && r.error) void trackTour("fail", r.error);
    });
  };

  // 고친 값 글자를 칸의 값으로 읽어 그 줄의 항목에 반영한다. 못 읽으면 그 줄은 틀린 값으로 보이고 저장할 수 없다.
  // 값을 고치면 '이미 알고 있어요'는 내려 둔다(다음에 대상·항목을 바꿀 때 서버가 다시 따진다)
  const editRow = (key: number, input: string) =>
    setRows((all) =>
      all.map((r) => {
        if (r.key !== key) return r;
        const f = r.item.target === "memo" ? null : captureField(r.item.target);
        const text = input.replace(/\s+/g, " ").trim();
        const next = f ? parseCaptureEdit(f, input, locale, r.item) : text ? { text } : null;
        return next ? { ...r, input, bad: false, same: false, rev: r.rev + 1, item: { ...r.item, ...next } } : { ...r, input, bad: true, same: false, rev: r.rev + 1 };
      }),
    );
  // 칸을 벗어나면 읽은 값 그대로의 글로 정리한다(245mm → 245)
  const tidyRow = (key: number) =>
    setRows((all) =>
      all.map((r) => {
        if (r.key !== key || r.bad) return r;
        const f = r.item.target === "memo" ? null : captureField(r.item.target);
        return { ...r, input: f ? describeCapture(f, r.item, locale) : (r.item.text ?? r.input) };
      }),
    );
  const removeRow = (key: number) => setRows((all) => all.filter((r) => r.key !== key));

  // 적지 못한 말: 줄들이 모두 한 사람(내 사람·새 사람) 이야기일 때만 그 사람 메모로 남길 수 있다(여럿이면 어느 쪽인지 몰라 다시 하게만)
  const memoTarget = (() => {
    const t = rows.map((r) => r.target).filter((x) => x.kind === "person" || x.kind === "new");
    return t.length === rows.length && t.length > 0 && t.every((x) => sameTarget(x, t[0]!)) ? { target: t[0]!, row: rows[0]! } : null;
  })();
  const keepLeftover = () => {
    if (!memoTarget || !leftover.length) return;
    const { target, row } = memoTarget;
    const next: DraftRow[] = leftover.map((text, i) => {
      const item: CaptureItem = { who: whoOf(target, row.spoken), target: "memo", op: "add", text, codes: null, number: null, date: null, label: null };
      const line: CaptureDraftLine = { who: row.line.who, isNew: target.kind === "new", op: "add", field: labels.memo, value: text, href: "", item, idx: -1, target, spoken: row.spoken, candidates: [] };
      return { key: Math.max(-1, ...rows.map((r) => r.key)) + 1 + i, line, item, input: text, bad: false, target, spoken: row.spoken, candidates: [], same: false, rev: 0 };
    });
    setRows((all) => [...all, ...next]);
    setLeftover([]);
  };
  // 다시 하기: 받아 적은 글은 그대로 두고 처음 화면으로(고쳐서 다시 기억해 두기)
  const retryLeftover = () => {
    setResult(null);
    setRows([]);
    setLeftover([]);
    setTargetOf(null);
  };

  // 대상·항목을 바꾼 줄들을 서버에 물어 '이미 알고 있어요'를 다시 그린다(저장도 AI도 아니다). 늦게 온 답은 그새 또 바뀐 줄에는 얹지 않는다
  const recheck = (list: DraftRow[]) => {
    const sent = list.filter((r) => r.target.kind !== "pick" && !r.bad);
    if (!sent.length) return;
    const revs = new Map(sent.map((r) => [r.key, r.rev]));
    void previewCapture(sent.map((r) => ({ ...r.item, who: whoOf(r.target, r.spoken) }))).then((res) => {
      if (!res.ok || !alive.current) return;
      const same = new Map(res.lines.map((l) => [sent[l.idx]?.key, l.same]));
      setRows((all) =>
        all.map((r) => {
          if (revs.get(r.key) !== r.rev) return r;
          // 줄이 안 돌아왔다: 메모는 그 사람에게 이미 같은 메모가 있는 것, 그 밖에는 저장해도 적히지 않는 줄
          if (!same.has(r.key)) return r.item.target === "memo" ? { ...r, same: true } : { ...r, bad: true };
          return { ...r, same: same.get(r.key)! };
        }),
      );
    });
  };
  const touch = (r: DraftRow): DraftRow => ({ ...r, same: false, rev: r.rev + 1 });

  // 대상 바꾸기: 같은 이름 줄도 같이(all)나 그 줄만. 바꾼 대상 기준으로 '이미 알고 있어요'를 다시 따진다
  const [targetOf, setTargetOf] = useState<number | null>(null);
  const changeTarget = (key: number, to: CaptureTarget, all: boolean) => {
    const { rows: next, changed } = retarget(rows, key, to, all);
    const list = next.map((r) => (changed.includes(r.key) ? touch(r) : r));
    setRows(list);
    setTargetOf(null);
    recheck(list);
  };

  // 항목 바꾸기: 고친 값 글자를 새 항목 기준으로 다시 읽는다(안 맞으면 틀린 값 표시). 반려동물 칸끼리는 이름을 가져간다
  const changeField = (key: number, to: string) => {
    const cur = rows.find((r) => r.key === key);
    if (!cur || to === cur.item.target) return;
    const from = cur.item.target === "memo" ? null : captureField(cur.item.target);
    const f = to === "memo" ? null : captureField(to);
    const text = cur.input.replace(/\s+/g, " ").trim();
    const carry = from && f && from.kind === "pet" && f.kind === "pet" ? { label: cur.item.label } : {};
    const next = f ? parseCaptureEdit(f, cur.input, locale, carry) : text ? { text } : null;
    const item: CaptureItem = { who: cur.item.who, target: to as CaptureItem["target"], op: to === "memo" ? "add" : cur.item.op, text: null, codes: null, number: null, date: null, label: null, ...next };
    const list = rows.map((r) => (r.key === key ? { ...touch(r), item, bad: !next } : r));
    setRows(list);
    recheck(list);
  };

  // 저장을 눌렀는데 대상을 못 정한 줄이 있다: 그 줄로 가서 칩을 반짝인다
  const [flashKey, setFlashKey] = useState<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), []);
  const jumpTo = (key: number) => {
    const el = document.getElementById(`draft-who-${key}`);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashKey(null);
    requestAnimationFrame(() => {
      setFlashKey(key);
      flashTimer.current = setTimeout(() => setFlashKey(null), 1600);
    });
  };

  const backToStart = () => {
    setResult(null);
    setRows([]);
    setLeftover([]);
    setTargetOf(null);
    setText("");
    setTagged([]);
    heard.current = "";
  };

  // 저장: 고치고 뺀 줄들을 기록에 넣는다. 끝나면 완료로(체험이면 다음 단계로), more면 새로 말하러 돌아간다
  const confirm = (more: boolean) => {
    if (saving || leaving || rows.some((r) => r.bad)) return;
    if (!rows.length) {
      if (more) backToStart();
      return;
    }
    // 같은 이름이 여럿이라 누구인지 못 정한 줄이 있으면 저장하지 않고 그 줄로
    const pick = firstPick(rows);
    if (pick) return jumpTo(pick.key);
    setSaveError(null);
    startSave(async () => {
      const r = await saveCapture(rows.map((x) => ({ ...x.item, who: whoOf(x.target, x.spoken) }))).catch((): CaptureState => ({ lines: [], undo: [], error: "failed" }));
      if (r.error) {
        setSaveError(r.error);
        if (tour) void trackTour("fail", r.error);
        return;
      }
      if (tour) void trackTour("capture", via.current);
      if (more) {
        backToStart();
        setFlash(true);
        return;
      }
      setLeaving(true);
      // 체험이 아닌 저장이 끝나 홈(또는 그 사람 화면)으로 가면, 그 화면이 이 표시를 보고 스토어 리뷰를 부탁할 수 있다
      if (!tour) markSaved();
      // 체험: 방금 적은 사람이 있으면 그 사람에게 물어보기로(없으면 사람 고르기부터)
      const first = r.lines.map((l) => /^\/people\/([0-9a-f-]{36})$/i.exec(l.href)?.[1]).find(Boolean);
      if (tour) return router.push(`/request?tour=2${first ? `&to=${first}` : ""}`);
      // 적은 게 한 사람 이야기뿐이면 그 사람 화면으로(무엇을 적었는지 알리고 되돌릴 수 있게), 여러 사람이면 홈에서 누구에게 무엇을 적었는지 알린다
      const plan = planAfterSave(r.lines);
      if (plan.kind === "person") {
        stashSaved({ contactId: plan.id, created: plan.created, lines: r.lines, undo: r.undo });
        return router.push(`/people/${plan.id}`);
      }
      if (plan.kind === "many") stashSaved({ contactId: null, created: null, lines: r.lines, undo: r.undo });
      router.push("/home");
    });
  };

  // 멈춘 뒤 받아 적은 글이 있으면: 사람이 멈췄으면 바로 적고, 스스로 멈췄으면 글만 남기고 기억해 두기를 기다린다
  const afterListening = () => {
    if (!heard.current.trim()) return;
    if (pressedStop.current) submit(heard.current, "voice");
    else setReady(true);
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
  // 사람이 누른 멈춤
  const stopListening = async () => {
    pressedStop.current = true;
    halt();
  };
  // 아무 말도 없어 끄는 앱 듣기는 기다릴 최종 결과가 없으니 바로 끝낸다(멈춘 뒤 최종 결과를 1.5초까지 기다리지 않고)
  const discardListening = () => {
    endGuard();
    native.current?.cancel();
    native.current = null;
    setListening(false);
    setSettling(false);
    // 이어 말하려던 앞선 글이 있으면 그대로 남기고 기억해 두기를 기다린다
    if (heard.current.trim()) setReady(true);
  };
  // 타이머가 멈추라고 한다(조용해짐·아무 말 없음·시간 다 됨): 사람이 멈춘 게 아니라서 끝나도 저장하지 않는다
  const onGuardStop = (reason: StopReason) => {
    if (reason === "no-speech" && native.current) return discardListening();
    halt();
  };

  const listen = async () => {
    if (settling) return;
    if (listening) return stopListening();
    // 스스로 멈추고 글이 남았으면 이어 말한 것을 그 뒤에 붙인다. 아니면 새로 시작
    prefix.current = ready && text.trim() ? `${text.trim()} ` : "";
    pressedStop.current = false;
    setMicError(false);
    setReady(false);
    setFlash(false);
    setResult(null);
    heard.current = prefix.current;
    if (!prefix.current) {
      setText("");
      setTagged([]);
    }
    const lang = locale === "ko" ? "ko-KR" : "en-US";
    const plugin = nativeSpeech();
    if (plugin) {
      try {
        const perm = await plugin.requestPermissions();
        if (perm.speechRecognition !== "granted") throw new Error("denied");
        // 기기가 알려 주는 중간 결과(partialResults)로 말이 멈춘 때를 잰다
        guard.current = startListenGuard({ onStop: onGuardStop });
        setListening(true);
        // 말이 끝나 기기가 스스로 멈추거나 멈춤을 누르면, 마지막 말까지 받은 뒤 받아 적은 말로 나눠 적는다
        const options = {
          language: lang,
          onText: (t: string) => {
            heard.current = prefix.current + t;
            setText(heard.current);
            guard.current?.heard(t);
          },
          onSettling: () => {
            endGuard();
            setListening(false);
            setSettling(true);
          },
          onDone: (t: string) => {
            native.current = null;
            endGuard();
            if (!alive.current) return;
            setSettling(false);
            if (t) heard.current = prefix.current + t;
            setText(heard.current);
            afterListening();
          },
        };
        native.current = await startDictation(plugin, options);
      } catch {
        endGuard();
        native.current = null;
        setListening(false);
        setSettling(false);
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
      const fresh = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ");
      heard.current = prefix.current + fresh;
      setText(heard.current);
      arm();
      guard.current?.heard(fresh);
    };
    r.onerror = (e) => {
      if (e.error !== "aborted" && e.error !== "no-speech") setMicError(true);
    };
    r.onend = () => {
      endGuard();
      if (web.current === r) web.current = null;
      setListening(false);
      afterListening();
    };
    web.current = r;
    setListening(true);
    r.start();
  };

  const errorOf = (code: CaptureState["error"]) => (code === "ai_off" ? labels.aiOff : code === "failed" ? labels.failed : code === "limit" ? labels.limit : code === "nothing" ? labels.nothing : "");
  const error = errorOf(result?.error ?? null) || (micError ? labels.micError : "");

  // 나눈 초안이 떠 있는 동안은 화면 위 제목·메모 가져오기를 접는다(html[data-draft], VoiceView가 이 값으로 숨긴다)
  const drafting = !!result && !result.error && !pending;
  useEffect(() => {
    if (!drafting) return;
    document.documentElement.dataset.draft = "1";
    return () => {
      delete document.documentElement.dataset.draft;
    };
  }, [drafting]);

  // 정리하는 중: 버튼 안 스피너 대신 적은 문장이 조각으로 나뉘어 카드에 쌓이는 그림과 단계 문구(분류하고 있어요 → 적고 있어요 → 정리하고 있어요)
  if (pending) return <OrganizeScene text={text.trim()} steps={labels.steps} />;

  // 나눈 뒤: 아직 저장하지 않은 초안. 값 글자를 그 자리에서 고치고, 잘못 나뉜 줄은 빼고, 저장을 눌러야 기록에 들어간다. 아래에는 더 말하기·저장
  if (result && !result.error) {
    const bad = rows.some((r) => r.bad);
    const locked = saving || leaving;
    return (
      <div className="flex flex-1 flex-col">
        {/* 별 든 캐릭터가 말풍선으로 알려 준다(시안) */}
        <div className="flex items-center gap-1.5 pl-1.5 pr-4 pt-1">
          <Mascot pose={11} size={62} className="shrink-0" />
          <p className="hand-written relative min-w-0 flex-1 rounded-[19.8px] border border-edge bg-white px-[16.2px] py-2 text-[21.1px] leading-[1.3]">
            {labels.saved}!
            <span aria-hidden="true" className="absolute -left-[6.3px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-edge bg-white" />
          </p>
        </div>
        {target ? <FixedTag person={target} labels={labels} className="mt-3" /> : null}
        <section className={`card relative mx-4 px-3.5 pb-1 pt-2.5 ${target ? "mt-3" : "mt-6"}`} aria-live="polite" aria-relevant="additions text">
          <h2 className="hand scribble mb-3 text-[19.4px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
            {labels.saved}
          </h2>
          <ul className="flex flex-col">
            {rows.map((r) => {
              const l = { ...r.line, op: r.item.op, same: r.same };
              const me = r.target.kind === "me";
              const person = r.target.kind === "person" ? people.find((p) => p.id === (r.target as { id: string }).id) : undefined;
              const who = me ? r.line.who : r.target.kind === "new" ? r.target.name : r.target.kind === "pick" ? r.spoken : person ? person.tag || person.name : r.line.who;
              const memo = r.item.target === "memo";
              const spec = memo ? null : captureField(r.item.target);
              const fieldLabel = memo ? labels.memo : me && spec?.key === "gifts.wishlist" ? labels.wishMe : (spec?.label[locale] ?? r.line.field);
              const pick = r.target.kind === "pick";
              return (
                <li key={r.key} className="flex items-start gap-1 border-t border-dashed border-ink/30 py-2 first:border-t-0">
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[10.8px] text-muted">
                      {me ? (
                        <span className="py-2.5">{who}</span>
                      ) : (
                        <button
                          type="button"
                          id={`draft-who-${r.key}`}
                          disabled={locked}
                          aria-haspopup="dialog"
                          onClick={() => setTargetOf(r.key)}
                          className="flex min-h-11 max-w-full items-center text-ink disabled:opacity-60"
                        >
                          <span
                            className={`flex h-7 max-w-full items-center gap-1 rounded-full border pl-0.5 pr-2 text-[10.8px] ${
                              pick ? "border-mango-deep bg-sky-soft" : "border-ink bg-white"
                            } ${flashKey === r.key ? "chip-flash" : ""}`}
                          >
                            <TargetFace target={r.target} avatar={person?.avatar ?? null} name={who} />
                            <span className="min-w-0 truncate">{who}</span>
                            {r.target.kind === "new" ? <span className="chip-on shrink-0 rounded-full px-2 pb-px text-[9.9px]">{labels.isNew}</span> : null}
                            {pick ? <span className="shrink-0 text-[10.8px] text-accent">{labels.target.sameName.replace("{n}", String(r.candidates.length))}</span> : null}
                            <Icon name="chevron" size={12} strokeWidth={2.4} className="shrink-0 rotate-90 text-muted" />
                          </span>
                        </button>
                      )}
                                            {r.line.value ? (
                        <span className="relative inline-flex h-7 items-center gap-1 rounded-full border border-edge bg-white px-2.5 text-[10.8px] text-ink">
                          {fieldLabel}
                          <Icon name="chevron" size={12} strokeWidth={2.4} className="shrink-0 rotate-90 text-muted" />
                          <select
                            aria-label={`${labels.changeField}: ${fieldLabel}`}
                            value={r.item.target}
                            disabled={locked}
                            onChange={(e) => changeField(r.key, e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          >
                            {FIELD_GROUPS.map((g) => (
                              <optgroup key={g.section} label={labels.sections[g.section]}>
                                {g.fields.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {me && f.key === "gifts.wishlist" ? labels.wishMe : f.label[locale]}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                            {me ? null : <option value="memo">{labels.memo}</option>}
                          </select>
                        </span>
                      ) : (
                        <span className="py-2.5">{fieldLabel}</span>
                      )}
                      <CaptureBadge line={l} labels={labels} />
                    </span>
                    {l.value ? (
                      <div className="relative">
                        <textarea
                          value={r.input}
                          onChange={(e) => editRow(r.key, e.target.value)}
                          onBlur={() => tidyRow(r.key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          rows={1}
                          maxLength={200}
                          enterKeyHint="done"
                          disabled={locked}
                          aria-label={`${who} · ${fieldLabel}`}
                          aria-invalid={r.bad}
                          className={`hand-written peer block min-h-11 w-full resize-none border-0 bg-transparent py-[6.3px] pl-0 pr-8 text-[21.1px] leading-[1.2] outline-none [field-sizing:content] focus:border-solid ${
                            r.bad ? "text-red" : struck(l)
                          }`}
                        />
                        
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`${labels.removeLine}: ${who} · ${fieldLabel}`}
                    title={labels.removeLine}
                    disabled={locked}
                    onClick={() => removeRow(r.key)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted active:bg-fill disabled:opacity-40"
                  >
                    <Icon name="close" size={15} strokeWidth={2} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        {/* 적지 못한 말(알레르기·못 먹는 것이 줄에서 빠졌을 때): 말을 그대로 보이고 메모로 남기거나 다시 하게 한다 */}
        {leftover.length ? (
          <div role="status" className="mx-4 mt-3 rounded-[12.6px] border border-dashed border-mango-deep bg-sky-soft px-3.5 pb-1.5 pt-2.5">
            <p className="text-[12.6px] text-red">{labels.leftover}</p>
            <ul className="mt-1 flex flex-col">
              {leftover.map((text, i) => (
                <li key={i} className="hand-written break-words text-[19.4px] leading-[1.25]">
                  “{text}”
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-end gap-1">
              <button type="button" disabled={locked} onClick={retryLeftover} className="flex min-h-11 items-center px-3 text-[13.5px] text-muted disabled:opacity-50">
                {labels.leftoverRetry}
              </button>
              {memoTarget ? (
                <button type="button" disabled={locked} onClick={keepLeftover} className="inline-flex h-9 items-center rounded-full border border-edge bg-white px-3.5 text-[13.5px] disabled:opacity-50">
                  {labels.leftoverMemo}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex min-h-8 items-center justify-center px-4 pt-3">
          {saveError ? (
            <p role="alert" className="text-center text-[12.6px] text-red">
              {errorOf(saveError)}
            </p>
          ) : null}
        </div>
        {/* 더 말하기(마이크·연필 아이콘: 저장하고 새로 말하러) · 저장(망고 주 버튼). 체험이면 더 말하기 없이 저장하면 다음(방금 적은 사람에게 물어보기로) */}
        <div className="bottom-bar mt-auto flex items-center justify-center gap-2.5 bg-bg px-5 pt-3.5">
          {tour ? null : (
            <button
              type="button"
              aria-label={labels.more}
              disabled={locked || bad}
              onClick={() => confirm(true)}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-edge bg-sky-soft pl-3 pr-4 text-[13.5px] disabled:opacity-40"
            >
              <Icon name="mic" size={17} strokeWidth={1.8} />
              {labels.more}
            </button>
          )}
          <button type="button" disabled={locked || bad || !rows.length} aria-busy={locked} onClick={() => confirm(false)} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-edge bg-sky pl-3 pr-4 text-[13.5px] disabled:border-ink/[0.22] disabled:bg-[#e8e1cf] disabled:text-[#5a5f78]">
            <Icon name="check" size={17} strokeWidth={1.8} />
            {labels.confirm}
          </button>
        </div>
        {(() => {
          const row = rows.find((x) => x.key === targetOf);
          if (!row) return null;
          return (
            <CaptureTargetSheet
              people={people}
              current={row.target}
              candidates={row.candidates}
              spoken={row.spoken}
              siblings={siblingCount(rows, row.key)}
              labels={labels.target}
              onPick={(to, all) => changeTarget(row.key, to, all)}
              onClose={() => setTargetOf(null)}
            />
          );
        })()}
      </div>
    );
  }

  // 말로: 가운데 물방울(누르면 듣기·멈추기), 바로 밑에 받아 적는 글, 아래 둥근 마이크 · 기억해 두기
  // 글로: 적는 칸 하나와 기억해 두기
  const idle = !!text && !listening && !settling && !pending;
  // 처음 들어와(또는 말이 없어 꺼져) 아직 아무 말도 안 했다: 구슬·마이크를 누르라는 표시. 누르면(듣기 시작) 사라진다
  const cue = canListen && !listening && !settling && !pending && !text.trim() && !micError;
  // 스스로 멈춘 뒤 글이 남았다: 기억해 두기를 누를 차례
  const nudgeSave = ready && !!text.trim() && !listening && !settling && !pending;
  const toggle = canListen ? (
    <div role="radiogroup" aria-label={labels.mode} className={`relative z-10 mx-auto flex w-fit ${target ? "mt-3" : "mt-6"} shrink-0 rounded-xl border border-edge bg-white p-[2.7px]`}>
      {(["voice", "text"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => choose(m)}
          className={`relative flex h-[30.6px] w-[80.1px] items-center justify-center rounded-[8.1px] text-[12.6px] transition-colors ${mode === m ? "bg-sky text-ink" : "text-ink"}`}
        >
          {m === "voice" ? labels.modeVoice : labels.modeText}
        </button>
      ))}
    </div>
  ) : null;
  // 사람 화면의 구슬에서 왔으면 위에 '누구에게 적는지' 태그(×로 풀기)
  const tagBar = target ? <FixedTag person={target} labels={labels} onClear={() => setPinned(false)} className="mt-4" /> : null;
  // 체험: 마이크면 "이렇게 말해보세요", 글이면 "이렇게 써보세요" + 예시 문장. 키보드가 뜨면 접어 적는 칸이 한 화면에 보이게
  const tourPrompt = tour ? (
    <TourNote label={mode === "voice" ? tour.say : tour.write} className="mt-[16.2px]">
      <span className="num rounded-full bg-sky-soft px-2.5 text-[11.9px] leading-[1.5]">{tour.page}</span>
      <h1 className="text-[24.3px] leading-[1.2]">{mode === "voice" ? tour.say : tour.write}</h1>
      <p className="hand-written mt-0.5 text-[24.3px] leading-[1.25]">
        <span className="hl">“{tour.example}”</span>
      </p>
    </TourNote>
  ) : null;
  const errorLine = error ? (
    <p role="alert" className="text-center text-[12.6px] text-red">
      {error}
    </p>
  ) : flash ? (
    <p role="status" className="flex items-center justify-center gap-1.5 text-center text-[13.5px]">
      <Icon name="check" size={18} strokeWidth={2.6} className="text-accent" />
      {labels.savedDone}
    </p>
  ) : null;

  // 글로: 적는 칸은 위에, 사람 줄(@ · 얼굴들)과 기억해 두기는 아래 막대에 붙여 키보드가 떠도 바로 위에 보인다.
  // '@낱말'을 적는 동안은 같은 줄이 찾은 사람으로 바뀐다(줄 높이가 그대로라 적는 칸을 가리지 않는다)
  if (mode === "text") {
    const row = listOpen ? options : people.filter((p, i) => i < 12 || who.some((w) => w.id === p.id));
    return (
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text, "text");
        }}
      >
        {tagBar}
        {toggle}
        {tourPrompt}
        <div className="flex flex-col gap-2 px-4 pt-5">
          <section className="card relative px-3.5 py-2.5">
          <textarea
            ref={field}
            value={text}
            onChange={onType}
            {...mentionProps}
            rows={5}
            maxLength={500}
            autoFocus={canListen}
            placeholder={target ? labels.placeholder : labels.placeholderText}
            aria-label={target ? labels.placeholder : labels.placeholderText}
            className="hand-written block min-h-[135px] w-full resize-none border-0 bg-transparent p-0 text-[19.4px] leading-[27px] outline-none [background-image:repeating-linear-gradient(180deg,transparent_0_26px,#d5e1f3_26px_27px)] placeholder:text-muted/80 [html[data-kb]_&]:h-32 [html[data-kb]_&]:min-h-32"
          />
          </section>
          <div className="flex min-h-8 items-center justify-center">{errorLine}</div>
        </div>
        <div className="bottom-bar mt-auto flex flex-col items-center gap-2.5 bg-bg px-4 pt-2.5">
          {people.length && !target ? (
            <div
              id={listOpen ? "mention-list" : undefined}
              role={listOpen ? "listbox" : "group"}
              aria-label={labels.mentionList}
              className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startMention}
                aria-label={labels.mention}
                className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-edge bg-white px-3 text-[16.2px]"
              >
                @
              </button>
              {row.map((p, i) => {
                const on = listOpen ? i === activeIndex : who.some((w) => w.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    id={listOpen ? `mention-${p.id}` : undefined}
                    role={listOpen ? "option" : undefined}
                    aria-selected={listOpen ? on : undefined}
                    aria-pressed={listOpen ? undefined : on}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (listOpen ? pick(field.current, p) : togglePerson(p))}
                    className={`flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-edge pl-[4.5px] pr-3.5 text-[12.6px] transition-colors ${on ? "bg-sky" : "bg-white"}`}
                  >
                    <Avatar config={p.avatar} size={28} label={mentionLabel(p)} />
                    {mentionLabel(p)}
                  </button>
                );
              })}
            </div>
          ) : null}
          <button disabled={pending || !text.trim()} aria-busy={pending} className={SAVE_PILL}>
            <Icon name="check" size={17} strokeWidth={1.8} />
            {labels.save}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit(text, heard.current.trim() ? "voice" : "text");
      }}
    >
      {tagBar}
      {toggle}
      {tourPrompt}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 pb-4">
        <div className="relative flex shrink-0">
          <button
            type="button"
            onClick={() => void listen()}
            aria-pressed={listening}
            aria-label={listening ? labels.stop : labels.speak}
            disabled={pending || settling || !canListen}
            className="shrink-0 rounded-full transition-transform active:scale-95 disabled:active:scale-100"
          >
            <WaterDrop active={listening || settling} live={listening} measure={!nativeSpeech()} cue={cue} beat={shown.length} />
          </button>
          {/* 아직 아무 말도 안 했을 때: 구슬을 가리키는 화살표(누르면 사라진다) */}
          {cue ? <PointArrow w={76} className="cue-nudge left-[149.4px] top-[149.4px]" /> : null}
        </div>
        {/* 상태 줄: 처음엔 누르라는 한 줄, 듣는 동안 '듣고 있어요', 스스로 멈추면 '다 들었어요'(스크린리더에도 읽힌다) */}
        <p role="status" aria-live="polite" className="hand-written mt-1 flex h-9 items-center justify-center gap-2 text-[19.4px] leading-none text-ink">
          {listening ? (
            <>
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-mango-deep motion-safe:animate-pulse" />
              <span className="hl px-1">{labels.listening}</span>
            </>
          ) : settling || nudgeSave ? (
            <>
              <Icon name="check" size={20} strokeWidth={2.6} className="text-accent" />
              <span className="hl px-1">{labels.heard}</span>
            </>
          ) : cue ? (
            <span className="hl px-1">{labels.cue}</span>
          ) : null}
        </p>
        <div className="card mt-5 w-full px-3.5 py-2.5">
          <textarea
            ref={box}
            value={shown}
            onChange={onType}
            {...mentionProps}
            rows={2}
            maxLength={500}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            className="hand-written block max-h-[30vh] min-h-[54px] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[19.4px] leading-[27px] outline-none [background-image:repeating-linear-gradient(180deg,transparent_0_26px,#d5e1f3_26px_27px)] placeholder:text-muted/80"
          />
        </div>
        {mentionList("box")}
        <div className="flex h-8 items-center">
          {error || flash ? (
            errorLine
          ) : idle ? (
            <button type="button" onClick={() => setText("")} className="relative text-[12.6px] text-muted underline underline-offset-4 before:absolute before:-inset-x-3 before:-inset-y-3.5">
              {labels.clear}
            </button>
          ) : null}
        </div>
      </div>

      <div className="bottom-bar mt-auto flex items-center justify-center gap-3 bg-bg px-5 pt-3">
        {canListen ? (
          <button
            type="button"
            onClick={() => void listen()}
            aria-pressed={listening}
            aria-label={listening ? labels.stop : labels.speak}
            disabled={pending || settling}
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-edge transition-colors ${listening ? "bg-ink text-white" : "bg-white text-ink"}`}
          >
            {/* 듣는 동안 마이크 둘레로 퍼지는 고리. 처음 들어왔을 때는 망고빛 맥박 */}
            {listening || settling ? (
              <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-sky opacity-0 motion-safe:animate-[drop-ripple_1.8s_ease-out_infinite]" />
            ) : cue ? (
              <span aria-hidden="true" className="cue-ring" style={{ "--to": 1.4 } as React.CSSProperties} />
            ) : null}
            {/* 듣는 동안은 멈춤(네모), 아니면 마이크 */}
            <Icon name={listening ? "stop" : "mic"} size={listening ? 20 : 22} strokeWidth={1.8} className="relative" />
          </button>
        ) : null}
        <button disabled={pending || listening || settling || !text.trim()} aria-busy={pending} className={`${SAVE_PILL} ${nudgeSave ? "save-ready" : ""}`}>
          <Icon name="check" size={17} strokeWidth={1.8} />
          {labels.save}
        </button>
      </div>
    </form>
  );
}
