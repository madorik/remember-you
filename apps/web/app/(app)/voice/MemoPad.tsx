"use client";

import { weekday, weekdayLong, weekdayNames, type AvatarConfig, type Locale, type YMD } from "@readme/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { saveMemo } from "@/app/actions/capture";
import AppLink from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { BinderPage } from "@/components/Binder";
import { Icon } from "@/components/marks";
import { markSaved } from "@/components/ReviewAsk";
import { startListenGuard, type ListenGuard, type StopReason } from "@/lib/listen-guard";
import { mentionLabel } from "@/lib/mention";
import { nativeSpeech, startDictation, webCtor, type Dictation, type WebRecognition } from "@/lib/speech";
import { u } from "@/lib/ui-scale";

/** 이름 칩에 쓰는 사람 한 명 */
export interface MemoPerson {
  id: string;
  name: string;
  /** 내가 붙인 태그(부르는 말). 이름과 같거나 없으면 "" */
  tag: string;
  avatar: AvatarConfig | null;
}

export interface MemoLabels {
  close: string;
  importNotes: string;
  save: string;
  /** 한 사람을 골랐을 때의 안내 글({name}) */
  placeholderOf: string;
  placeholder: string;
  addPerson: string;
  addNew: string;
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
}

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

/** 받아 적는 글: 확정된 부분과 아직 바뀔 수 있는 부분(중간 결과) */
interface Heard {
  final: string;
  interim: string;
}
const NOTHING: Heard = { final: "", interim: "" };

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
export function MemoPad({ locale, today, people, fixed, shared = false, labels }: { locale: Locale; today: YMD; people: MemoPerson[]; fixed: MemoPerson | null; /** 앱의 '공유 받기'로 열렸다(?shared=1): 받은 글을 본문에 채우고 사람은 비워 둔다 */ shared?: boolean; labels: MemoLabels }) {
  const router = useRouter();
  const canListen = useSyncExternalStore(
    () => () => {},
    () => !!webCtor() || !!nativeSpeech(),
    () => false,
  );
  const [text, setText] = useState("");
  const [tagged, setTagged] = useState<string[]>(fixed && !shared ? [fixed.id] : []);
  // 이미 고른 사람이 있어도 '+'로 다른 사람을 더 고를 때만 펼치는 목록
  const [picking, setPicking] = useState(false);
  const [listening, setListening] = useState(false);
  // 앱: 멈춘 뒤 마지막 말까지 든 최종 결과를 기다리는 중
  const [settling, setSettling] = useState(false);
  const [heard, setHeard] = useState<Heard>(NOTHING);
  const [micError, setMicError] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string; error: boolean } | null>(null);
  const [saving, startSave] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(false);
  const guard = useRef<ListenGuard | null>(null);
  const web = useRef<WebRecognition | null>(null);
  const native = useRef<Dictation | null>(null);
  const liveRef = useRef<Heard>(NOTHING);
  // 말로 적은 글이 들어 있나(저장 기록에 말로·글로를 가른다)
  const voiced = useRef(false);
  const toastTimer = useRef(0);

  const byId = new Map(people.map((p) => [p.id, p]));
  const chosen = tagged.map((id) => byId.get(id)).filter((p): p is MemoPerson => !!p);
  const rest = people.filter((p) => !tagged.includes(p.id));
  // 아무도 안 골랐으면 목록을 바로 보이고, 골랐으면 '+'를 눌렀을 때만
  const listOpen = rest.length > 0 && (!chosen.length || picking);
  const busy = listening || settling;
  // 지금 화면에 보이는 글 전부(받아 적는 중인 말까지)
  const shown = join(join(text, heard.final), heard.interim);
  const hasText = !!shown.trim();
  // 듣는 동안 이미 확정된 글(본문 + 확정된 받아쓰기)
  const settled = join(text, heard.final);

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

  const say = (message: string, error = false) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text: message, error });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  // 앱이 '공유 받기'로 넘긴 글(sessionStorage)을 꺼내 본문에 채우고, 키와 주소의 shared=1을 지운다(새로고침해도 다시 채우지 않게).
  // 이 화면이 이미 열려 있을 때 두 번째 공유가 와도(같은 주소로 다시 /voice?shared=1) shared=1이 다시 나타나는 때마다 읽는다:
  // 본문이 비었으면 그 글로 채우고, 쓰던 글이 있으면 빈 줄 하나 띄우고 뒤에 붙인다(합쳐 1000자를 넘으면 앞에서부터 1000자만 담고 알린다).
  // 저장소는 화면을 그릴 때 읽을 수 없어(서버 그림과 어긋난다) 열린 뒤에 읽는다
  const sharedNow = useSearchParams().get("shared") === "1";
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
      const joined = text.trim() ? `${text.replace(/\s+$/, "")}\n\n${got.trimEnd()}` : got;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(joined.slice(0, MAX));
      if (joined.length > MAX) say(labels.sharedClipped);
    }
    const q = new URLSearchParams(window.location.search);
    q.delete("shared");
    router.replace(q.size ? `/voice?${q}` : "/voice");
    // say·labels·text는 shared=1이 나타난 그때의 값을 한 번 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedNow, router]);

  // 본문 칸은 글이 늘어나는 만큼 키운다
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, listening]);

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
    // 아무도 안 골랐으면 추천 사람 칩이 이미 보이는 상태라(listOpen) 알리기만 한다
    if (!chosen.length) return say(labels.pickWho, true);
    if (listening) {
      halt();
      web.current = null;
      native.current?.cancel();
      native.current = null;
      setListening(false);
      hear(NOTHING);
      setText(body);
    }
    const ids = chosen.map((p) => p.id);
    const via = voiced.current ? "voice" : "text";
    startSave(async () => {
      const r = await saveMemo(body, ids, via).catch(() => null);
      if (!r?.ok) return say(labels.error, true);
      markSaved();
      voiced.current = false;
      if (r.ids.length === 1) return router.push(`/people/${r.ids[0]}`);
      // 여러 사람이면 이 화면에 남아 누구 메모장에 적었는지 알리고, 다음 메모를 위해 비운다
      const names = r.ids.map((id) => byId.get(id)).filter((p): p is MemoPerson => !!p).map(nameOf);
      setText("");
      setTagged([]);
      setPicking(false);
      say(labels.savedTo.replace("{names}", names.join(", ")));
    });
  };

  const add = (id: string) => setTagged((cur) => (cur.includes(id) ? cur : [...cur, id]));
  const drop = (id: string) => setTagged((cur) => cur.filter((x) => x !== id));
  const placeholder = chosen.length === 1 ? labels.placeholderOf.replace("{name}", nameOf(chosen[0]!)) : labels.placeholder;
  const [month, day, weekdayName] = [labels.month, today.d, weekdayLong(today, locale)];

  return (
    <div className="flex flex-1 flex-col">
      {/* 위 줄: 닫기 · (글이 없으면) 메모 가져오기 알약 / (글이 있으면) 가져오기 아이콘 + 저장 */}
      <div className="flex h-12 shrink-0 items-center justify-between pl-1.5 pr-3">
        <AppLink href={fixed ? `/people/${fixed.id}` : "/home"} aria-label={labels.close} className="relative flex h-11 w-11 items-center justify-center before:absolute before:-inset-[2.2px]">
          <Icon name="close" size={22} strokeWidth={1.8} />
        </AppLink>
        {hasText ? (
          <div className="flex items-center gap-1">
            <AppLink href="/import" aria-label={labels.importNotes} className="relative flex h-11 w-11 items-center justify-center before:absolute before:-inset-[2.2px]">
              <Svg size={21}>{IMPORT_ICON}</Svg>
            </AppLink>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="hand inline-flex items-center gap-[4.5px] rounded-full border border-edge bg-sky text-[17.1px] leading-none disabled:opacity-60"
              style={{ height: u(36), padding: `0 ${u(15)}px 0 ${u(11)}px` }}
            >
              <Svg size={16} strokeWidth={2.2}>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </Svg>
              {labels.save}
            </button>
          </div>
        ) : (
          <AppLink href="/import" className="inline-flex items-center gap-[4.5px] whitespace-nowrap rounded-full border border-edge bg-white text-[12.15px]" style={{ height: u(34), padding: `0 ${u(13)}px 0 ${u(10)}px` }}>
            <Svg size={17}>{IMPORT_ICON}</Svg>
            {labels.importNotes}
          </AppLink>
        )}
      </div>

      <div className="relative mb-[16.2px] ml-[21.6px] mr-[14.4px] mt-[14.4px] flex flex-1 flex-col">
        {/* 모서리에 붙은 해 스티커 */}
        <svg aria-hidden="true" viewBox="0 0 40 40" className="absolute z-[4]" width={u(38)} height={u(38)} style={{ right: u(14), top: -u(16), transform: "rotate(10deg)" }}>
          <circle cx="20" cy="20" r="8" fill="#FFD978" stroke={INK} strokeWidth="1.4" />
          <path d="M20 4v5M20 31v5M4 20h5M31 20h5M8.7 8.7l3.5 3.5M27.8 27.8l3.5 3.5M8.7 31.3l3.5-3.5M27.8 12.2l3.5-3.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <BinderPage className="flex flex-1 flex-col" pageClassName="flex flex-1 flex-col">
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

          {/* @ 이야기의 주인공: 고른 사람 칩 · + · (고르는 목록) */}
          <div className="-mr-[14.4px] flex items-center gap-[6.3px] overflow-x-auto overflow-y-hidden [-webkit-mask-image:linear-gradient(90deg,#000_80%,transparent)] [mask-image:linear-gradient(90deg,#000_80%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ height: u(52) }}>
            <span aria-hidden="true" className="hand shrink-0 pr-[0.9px] text-[24.3px] leading-none text-mango-deep">
              @
            </span>
            {chosen.map((p) => (
              <span key={p.id} className="inline-flex shrink-0 items-center gap-[5.4px] rounded-full border border-edge bg-sky-soft pl-[2.7px] pr-[2.7px]" style={{ height: u(30) }}>
                <Face p={p} />
                <span className="hand text-[18px] leading-none">{nameOf(p)}</span>
                <button type="button" aria-label={labels.removeTag.replace("{name}", nameOf(p))} onClick={() => drop(p.id)} className="relative flex items-center justify-center rounded-full before:absolute before:-inset-[6px]" style={{ width: u(24), height: u(24) }}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" width={u(12)} height={u(12)} fill="none" stroke="#5B5F78" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </span>
            ))}
            {chosen.length && rest.length ? (
              <button
                type="button"
                aria-label={labels.addPerson}
                aria-expanded={picking}
                onClick={() => setPicking((v) => !v)}
                className={`relative flex shrink-0 items-center justify-center rounded-full border border-dashed border-ink/40 before:absolute before:-inset-[6px] ${picking ? "bg-sky-soft" : ""}`}
                style={{ width: u(30), height: u(30) }}
              >
                <Svg size={14} strokeWidth={2}>
                  <path d="M12 6v12M6 12h12" />
                </Svg>
              </button>
            ) : null}
            {!people.length ? (
              <AppLink href="/people/new" aria-label={labels.addNew} className="relative flex shrink-0 items-center justify-center rounded-full border border-dashed border-ink/40 before:absolute before:-inset-[6px]" style={{ width: u(30), height: u(30) }}>
                <Svg size={14} strokeWidth={2}>
                  <path d="M12 6v12M6 12h12" />
                </Svg>
              </AppLink>
            ) : null}
            {listOpen
              ? rest.map((p) => (
                  <button key={p.id} type="button" onClick={() => add(p.id)} className="inline-flex shrink-0 items-center gap-[5.4px] rounded-full border border-edge bg-white pl-[2.7px] pr-[9.9px]" style={{ height: u(30) }}>
                    <Face p={p} />
                    <span className="hand text-[18px] leading-none">{nameOf(p)}</span>
                  </button>
                ))
              : null}
          </div>

          {/* 본문: 점 모눈 위에 손글씨로. 듣는 동안은 받아 적는 말(아직 바뀔 수 있는 부분은 연하게 + 망고 밑줄)이 보이는 글로 */}
          <div className="relative flex-1 cursor-text pb-[28px]" onClick={() => box.current?.focus()}>
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
                }}
                rows={1}
                maxLength={MAX}
                placeholder={placeholder}
                aria-label={placeholder}
                className="hand-written block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[20.7px] leading-[30.6px] caret-mango-deep outline-none placeholder:text-ink/40"
              />
            )}
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
        <div className="memo-mic sticky z-20 h-0 w-full">
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

      {toast ? <Toast key={toast.id} text={toast.text} error={toast.error} /> : null}
    </div>
  );
}
