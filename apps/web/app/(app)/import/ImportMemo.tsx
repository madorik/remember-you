"use client";

import { IMAGE_MAX_COUNT, type AvatarConfig, type Locale } from "@readme/core";
import Link from "@/components/AppLink";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { draftImport, draftImportImages, saveImport, undoCapture, type CaptureDraftLine, type CaptureState, type ImportError, type UndoOp } from "@/app/actions/capture";
import { Avatar } from "@/components/Avatar";
import { CaptureBadge } from "@/components/CaptureBadge";
import { Heart, Squiggle, Star, Tape } from "@/components/diary";
import { DrawnCheck, Icon } from "@/components/marks";
import { OrganizeScene } from "@/components/OrganizeScene";
import type { CaptureItem } from "@/lib/capture-ai";
import { nameKey, retarget, whoOf, type CaptureTarget } from "@/lib/capture-target";
import { prepareImage, type PrepProblem } from "@/lib/image-prep";
import type { ImportScopeData } from "@/lib/pages/import.data";
import { startListenGuard, type ListenGuard } from "@/lib/listen-guard";
import { startDictation, type Dictation, type NativeSpeech } from "@/lib/speech";

type Method = "write" | "speak" | "image";
type Step = "input" | "reading" | "review" | "saving" | "done";
type FailCode = ImportError;

interface Labels {
  method: string;
  write: string;
  speak: string;
  image: string;
  pickImage: string;
  imageNotice: string;
  removeImage: string;
  preparing: string;
  imageChip: string;
  /** "읽지 못한 사진 {n}장은 건너뛰었어요" */
  skipped: string;
  micDenied: string;
  imageProblems: Record<PrepProblem | "many", string>;
  placeholder: string;
  /** "{n} / 6000자" 모양(n 자리를 채운다) */
  count: string;
  analyze: string;
  steps: string[];
  review: string;
  name: string;
  nameNeeded: string;
  pickNeeded: string;
  listen: string;
  listening: string;
  micError: string;
  /** "{n}줄 적기" */
  saveN: string;
  /** "{n}줄을 적었어요" */
  savedN: string;
  undo: string;
  undone: string;
  done: string;
  again: string;
  same: string;
  newPerson: string;
  /** "같은 이름 {n}명" */
  sameName: string;
  asNew: string;
  pickTitle: string;
  memo: string;
  wishMe: string;
  me: string;
  allSame: string;
  avatarOf: string;
  errors: Record<FailCode, string>;
}

/** 줄 하나의 확인 상태: 줄을 뺄 수 있고, 같은 이름이 여럿이면 누구인지 정하기 전에는 저장할 수 없다 */
interface Row {
  key: number;
  line: CaptureDraftLine;
  item: CaptureItem;
  target: CaptureTarget;
  spoken: string;
  candidates: string[];
  on: boolean;
}

// 음성 인식: 앱(Capacitor)은 SpeechRecognition 플러그인, 브라우저는 Web Speech API. 둘 다 없으면 글로 적는다
type WebRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
};

function webCtor(): (new () => WebRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function nativeSpeech(): NativeSpeech | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { SpeechRecognition?: NativeSpeech } } }).Capacitor;
  return cap?.isNativePlatform?.() && cap.Plugins?.SpeechRecognition ? cap.Plugins.SpeechRecognition : null;
}

const join = (base: string, said: string) => (base ? `${base}\n${said}` : said).trim();

/** 묶음: 같은 사람(대상)의 줄들 */
function groupKey(r: Row): string {
  const t = r.target;
  return t.kind === "me" ? "me" : t.kind === "person" ? `p:${t.id}` : t.kind === "new" ? `n:${nameKey(t.name)}` : `?:${nameKey(r.spoken)}`;
}

/**
 * 메모 가져오기: ① 넣기(쓰기·말하기. 이미지는 다음 단계) ② 읽는 중 ③ 확인(사람별로 묶어서, 줄을 빼거나 같은 이름을 고른다) ④ 저장(더하기만) ⑤ 끝(되돌리기).
 * scope: any 메모에 여러 사람 / person 그 사람 이야기뿐(누구인지 따지지 않는다) / new 아직 없는 한 사람(이름을 정한다)
 */
export function ImportMemo({
  locale,
  scope,
  people,
  max,
  labels,
}: {
  locale: Locale;
  scope: ImportScopeData;
  people: { id: string; name: string; avatar: AvatarConfig | null }[];
  max: number;
  labels: Labels;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("write");
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState<{ lines: CaptureState["lines"]; undo: UndoOp[] } | null>(null);
  const [undone, setUndone] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<"" | "denied" | "other">("");
  const [images, setImages] = useState<{ id: number; blob: Blob; url: string }[]>([]);
  const [imgError, setImgError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const picker = useRef<HTMLInputElement>(null);
  const imageId = useRef(0);
  const urls = useRef<string[]>([]);
  const guard = useRef<ListenGuard | null>(null);
  const native = useRef<Dictation | null>(null);
  const web = useRef<WebRecognition | null>(null);
  const base = useRef("");
  const alive = useRef(true);
  const byId = new Map(people.map((p) => [p.id, p]));

  // 사진 미리보기 주소는 사진이 빠지거나 화면을 떠날 때 거둔다
  useEffect(() => {
    urls.current = images.map((i) => i.url);
  }, [images]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      guard.current?.dispose();
      native.current?.cancel();
      web.current?.abort();
    };
  }, []);

  const endGuard = () => {
    guard.current?.dispose();
    guard.current = null;
  };

  const stopListening = () => {
    endGuard();
    native.current?.stop();
    web.current?.stop();
    setListening(false);
  };

  /** 마이크를 못 쓰는 이유: 허락이 없으면 그 안내, 그 밖에는 일반 안내. 글로 적게 한다 */
  const micFailed = (why: "denied" | "other") => {
    endGuard();
    native.current = null;
    web.current = null;
    setListening(false);
    setMicError(why);
    setMethod("write");
  };

  const listen = async () => {
    if (listening) return stopListening();
    setMicError("");
    base.current = text.trim();
    const lang = locale === "ko" ? "ko-KR" : "en-US";
    const plugin = nativeSpeech();
    if (plugin) {
      try {
        const perm = await plugin.requestPermissions();
        if (perm.speechRecognition !== "granted") throw new Error("denied");
        setListening(true);
        // 말이 끝난 뒤 한참 새 글이 없으면 스스로 멈춘다(말로 적기와 같은 규칙)
        guard.current = startListenGuard({ onStop: () => native.current?.stop() });
        native.current = await startDictation(plugin, {
          language: lang,
          onText: (t) => {
            if (!alive.current) return;
            setText(join(base.current, t).slice(0, max));
            guard.current?.heard(t);
          },
          onDone: (t) => {
            native.current = null;
            endGuard();
            if (!alive.current) return;
            if (t) setText(join(base.current, t).slice(0, max));
            setListening(false);
          },
        });
      } catch (e) {
        micFailed(e instanceof Error && e.message === "denied" ? "denied" : "other");
      }
      return;
    }
    const Ctor = webCtor();
    if (!Ctor) return micFailed("other");
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ");
      setText(join(base.current, said).slice(0, max));
      guard.current?.heard(said);
    };
    r.onerror = (e) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      micFailed(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "other");
    };
    r.onend = () => {
      endGuard();
      if (web.current === r) web.current = null;
      if (alive.current) setListening(false);
    };
    web.current = r;
    try {
      setListening(true);
      r.start();
      guard.current = startListenGuard({ onStop: () => web.current?.stop() });
    } catch {
      micFailed("other");
    }
  };

  /** 사진을 골랐다: 하나씩 걸러 내고 줄여서 담는다(걸린 사진은 이유를 보인다) */
  const pick = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (picker.current) picker.current.value = "";
    if (!list.length) return;
    setImgError("");
    setPreparing(true);
    const room = IMAGE_MAX_COUNT - images.length;
    const added: { id: number; blob: Blob; url: string }[] = [];
    let problem: PrepProblem | "many" | null = list.length > room ? "many" : null;
    for (const file of list.slice(0, Math.max(0, room))) {
      const r = await prepareImage(file);
      if (r.ok) added.push({ id: ++imageId.current, blob: r.blob, url: URL.createObjectURL(r.blob) });
      else problem = r.problem;
    }
    if (!alive.current) return added.forEach((x) => URL.revokeObjectURL(x.url));
    setPreparing(false);
    if (added.length) setImages((cur) => [...cur, ...added].slice(0, IMAGE_MAX_COUNT));
    if (problem) setImgError(labels.imageProblems[problem]);
  };

  const analyze = async () => {
    const withImages = method === "image";
    if (withImages ? !images.length || preparing : !text.trim()) return;
    if (step === "reading") return;
    if (listening) stopListening();
    setError("");
    setStep("reading");
    const scopeArg = scope.kind === "person" ? scope.id : scope.kind;
    let draft;
    try {
      if (withImages) {
        // 줄인 사진을 파일로(글자로 바꾸지 않는다: 서버 동작 인자의 배열 글자 수 한도와 본문 크기를 피한다)
        const form = new FormData();
        form.set("scope", scopeArg);
        images.forEach((im, n) => form.append("image", im.blob, `photo-${n + 1}.jpg`));
        draft = await draftImportImages(form);
      } else draft = await draftImport(text, scopeArg);
    } catch {
      draft = { lines: [], error: "failed" as FailCode, name: "", skipped: 0 };
    }
    if (!alive.current) return;
    if (draft.error || !draft.lines.length) {
      setError(labels.errors[draft.error ?? "nothing"]);
      setStep("input");
      return;
    }
    setNewName(draft.name);
    setSkipped(draft.skipped);
    setRows(
      draft.lines.map((line, key) => ({
        key,
        line,
        item: line.item,
        target: line.target,
        spoken: line.spoken,
        candidates: line.candidates,
        // 이미 적혀 있는 줄과 아직 누구인지 못 정한 줄은 처음에는 꺼 둔다
        on: !line.same && line.target.kind !== "pick",
      })),
    );
    setStep("review");
  };

  const toggle = (key: number) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, on: !r.on } : r)));
  const toggleGroup = (g: string, on: boolean) => setRows((cur) => cur.map((r) => (groupKey(r) === g && !r.line.same && r.target.kind !== "pick" ? { ...r, on } : r)));

  /** 같은 이름이 여럿인 묶음의 대상을 정한다(그 묶음 줄 모두) */
  const choose = (key: number, to: CaptureTarget) =>
    setRows((cur) => {
      const next = retarget(cur, key, to, true);
      // 정한 묶음은 저장할 줄로 켠다
      return next.rows.map((r) => (next.changed.includes(r.key) && !r.line.same ? { ...r, on: true } : r));
    });

  const chosen = rows.filter((r) => r.on && !r.line.same);
  const unresolved = rows.some((r) => r.on && r.target.kind === "pick");
  const nameOk = scope.kind !== "new" || newName.trim().length > 0;
  const total = chosen.length;

  const save = async () => {
    if (step === "saving" || !total) return;
    if (unresolved) return setError(labels.pickNeeded);
    if (!nameOk) return setError(labels.nameNeeded);
    setError("");
    setStep("saving");
    const items = chosen.map((r) => ({ ...r.item, who: scope.kind === "new" ? whoOf({ kind: "new", name: newName.trim() }) : whoOf(r.target, r.spoken) }));
    let res: CaptureState;
    try {
      res = await saveImport(items);
    } catch {
      res = { lines: [], undo: [], error: "failed" };
    }
    if (!alive.current) return;
    if (res.error || !res.lines.length) {
      setError(labels.errors[res.error ?? "nothing"]);
      setStep("review");
      return;
    }
    setSaved({ lines: res.lines, undo: res.undo });
    setStep("done");
  };

  const undo = async () => {
    if (!saved || undone || undoing) return;
    setUndoing(true);
    setError("");
    const r = await undoCapture(saved.undo).catch(() => ({ ok: false }));
    if (!alive.current) return;
    setUndoing(false);
    // 되돌렸다고 알리는 것은 실제로 되돌린 뒤에
    if (r.ok) setUndone(true);
    else setError(labels.errors.failed);
  };

  const leave = () => {
    // 사람 한 명 이야기였으면 그 사람 화면으로, 새 사람이면 만든 그 사람(되돌렸으면 사람들)으로
    const first = saved?.lines.find((l) => l.href && l.href !== "/me")?.href;
    router.push(scope.kind === "person" ? `/people/${scope.id}` : scope.kind === "new" && !undone && first ? first : "/people");
  };

  if (step === "reading") return <OrganizeScene text={method === "image" ? labels.imageChip : text.trim().slice(0, 120)} steps={labels.steps} />;

  if (step === "done" && saved) {
    const touched = new Map<string, string>();
    for (const l of saved.lines) if (l.href && !touched.has(l.href)) touched.set(l.href, l.who);
    return (
      <div className="flex flex-1 flex-col">
        <section className="card relative mx-4 mt-6 -rotate-[0.4deg] px-5 pb-5 pt-[22px]" aria-live="polite">
          <Tape color="mint" w={104} h={26} rotate={-3} alpha={0.62} className="-top-3 left-1/2 -ml-[52px]" />
          <h2 className="flex items-center gap-2 pb-3 text-[24px]">
            <Icon name="check" size={22} strokeWidth={2.4} className="text-accent" />
            {undone ? labels.undone : labels.savedN.replace("{n}", String(saved.lines.length))}
          </h2>
          {undone ? null : (
            <ul className="flex flex-col gap-1.5">
              {[...touched].map(([href, who]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-[20px] text-accent underline underline-offset-4">
                    {who}
                    <Icon name="chevron" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Heart size={22} rotate={-14} className="-bottom-2 -left-2" />
          <Star size={20} rotate={14} className="-right-1.5 top-5" />
        </section>
        <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
          {error ? (
            <p role="alert" className="px-1 text-[17px] text-red">
              {error}
            </p>
          ) : null}
          {undone ? null : (
            <button type="button" onClick={undo} disabled={undoing} className="btn-outline btn-outline-lift !min-h-[54px] w-full !text-[20px] disabled:opacity-60">
              {labels.undo}
            </button>
          )}
          <button type="button" onClick={leave} className="btn-primary !min-h-[58px] w-full !text-[22px]">
            {labels.done}
          </button>
        </div>
      </div>
    );
  }

  // 확인: 사람별로 묶어서 보여 주고, 줄을 빼거나 같은 이름을 고른다
  if (step === "review" || step === "saving") {
    const groups: { key: string; rows: Row[] }[] = [];
    for (const r of rows) {
      const g = groupKey(r);
      const cur = groups.find((x) => x.key === g);
      if (cur) cur.rows.push(r);
      else groups.push({ key: g, rows: [r] });
    }
    const allSame = rows.length > 0 && rows.every((r) => r.line.same);
    const locked = step === "saving";
    return (
      <div className="flex flex-1 flex-col">
        <h2 className="px-6 pb-1 pt-3 text-[24px] [html[data-kb]_&]:hidden">{labels.review}</h2>
        {skipped > 0 ? <p className="px-6 text-[16px] text-muted">{labels.skipped.replace("{n}", String(skipped))}</p> : null}
        {scope.kind === "new" ? (
          <label className="mx-4 mt-2 flex flex-col gap-2 px-2">
            <span className="text-[19px]">{labels.name}</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} autoComplete="off" className="field !text-[21px]" aria-invalid={!nameOk || undefined} />
          </label>
        ) : null}
        <div className="mx-4 mt-3 flex flex-col gap-4">
          {groups.map(({ key, rows: list }) => {
            const first = list[0]!;
            const t = first.target;
            const person = t.kind === "person" ? byId.get(t.id) : undefined;
            const editable = list.filter((r) => !r.line.same && r.target.kind !== "pick");
            const allOn = editable.length > 0 && editable.every((r) => r.on);
            const header = scope.kind === "new" ? newName.trim() || first.line.who : first.line.who;
            return (
              <section key={key} className="card relative px-4 pb-1 pt-3">
                <div className="flex min-h-11 items-center gap-2.5">
                  {person ? <Avatar config={person.avatar} size={36} label={labels.avatarOf.replace("{name}", person.name)} decorative /> : null}
                  <h3 className="min-w-0 flex-1 truncate text-[21px]">{t.kind === "me" ? labels.me : header}</h3>
                  {first.line.isNew || t.kind === "new" ? <span className="chip-on shrink-0 rounded-full px-2.5 pb-px text-[14px]">{labels.newPerson}</span> : null}
                  {editable.length > 1 ? (
                    <button type="button" disabled={locked} aria-pressed={allOn} onClick={() => toggleGroup(key, !allOn)} className="flex h-11 w-11 shrink-0 items-center justify-center">
                      <DrawnCheck on={allOn} />
                    </button>
                  ) : null}
                </div>
                {/* 같은 이름이 여럿이면 누구인지 고른다(고르기 전에는 저장할 수 없다) */}
                {t.kind === "pick" ? (
                  <label className="mb-2 flex flex-col gap-1.5">
                    <span className="text-[16px] text-red">{labels.sameName.replace("{n}", String(first.candidates.length))}</span>
                    <select
                      aria-label={labels.pickTitle}
                      defaultValue=""
                      disabled={locked}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) choose(first.key, v === "new" ? { kind: "new", name: first.spoken } : { kind: "person", id: v });
                      }}
                      className="field !min-h-12 !text-[19px]"
                    >
                      <option value="" disabled>
                        {labels.pickTitle}
                      </option>
                      {first.candidates.map((id) => (
                        <option key={id} value={id}>
                          {byId.get(id)?.name ?? id}
                        </option>
                      ))}
                      <option value="new">{labels.asNew}</option>
                    </select>
                  </label>
                ) : null}
                <ul className="flex flex-col">
                  {list.map((r) => {
                    const dim = r.line.same || !r.on;
                    return (
                      <li key={r.key} className="border-t border-dashed border-rule first:border-t-0">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={r.on}
                          disabled={locked || r.line.same || r.target.kind === "pick"}
                          onClick={() => toggle(r.key)}
                          className={`flex min-h-[52px] w-full items-center gap-3 py-2 text-left ${dim ? "opacity-60" : ""}`}
                        >
                          <DrawnCheck on={r.on} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-[15px] text-muted">{r.line.field}</span>
                            <span className="break-words text-[19px] leading-[1.3]">{r.line.value}</span>
                          </span>
                          <CaptureBadge line={{ ...r.line, op: "add", same: r.line.same }} labels={{ same: labels.same, gone: labels.same, changed: "", removed: "" }} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        {allSame ? <p className="px-6 pt-4 text-[19px] text-muted">{labels.allSame}</p> : null}
        <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
          {error ? (
            <p role="alert" className="px-1 text-[17px] text-red">
              {error}
            </p>
          ) : null}
          <button type="button" onClick={save} disabled={locked || !total} className="btn-primary !min-h-[58px] w-full !text-[22px] disabled:opacity-50">
            {labels.saveN.replace("{n}", String(total))}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              setStep("input");
              setError("");
            }}
            className="min-h-11 text-[18px] text-muted"
          >
            {labels.again}
          </button>
        </div>
      </div>
    );
  }

  // 넣기: 쓰기·말하기·사진
  const err = error || (micError === "denied" ? labels.micDenied : micError ? labels.micError : "");
  const methods = [
    { id: "write", label: labels.write },
    { id: "speak", label: labels.speak },
    { id: "image", label: labels.image },
  ] as const;
  const canRead = method === "image" ? images.length > 0 && !preparing : text.trim().length > 0;
  return (
    <div className="flex flex-1 flex-col">
      <div role="tablist" aria-label={labels.method} className="mx-6 mt-4 flex gap-6">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={method === m.id}
            onClick={() => {
              if (listening) stopListening();
              setMicError("");
              setMethod(m.id);
            }}
            className={`relative flex min-h-11 items-center px-1 text-[22px] ${method === m.id ? "text-ink" : "text-muted"}`}
          >
            <span className={method === m.id ? "hl px-1" : "px-1"}>{m.label}</span>
          </button>
        ))}
      </div>

      {method === "image" ? (
        <div className="mx-4 mt-3 flex flex-col gap-3">
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-label={labels.pickImage} onChange={(e) => void pick(e.target.files)} />
          {images.length ? (
            <ul className="flex flex-wrap gap-3 px-1">
              {images.map((im, n) => (
                <li key={im.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" className="h-[104px] w-[104px] rounded-[12px] border-[1.5px] border-ink bg-white object-cover" />
                  <button
                    type="button"
                    aria-label={`${labels.removeImage} ${n + 1}`}
                    onClick={() => {
                      URL.revokeObjectURL(im.url);
                      setImages((cur) => cur.filter((x) => x.id !== im.id));
                    }}
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-ink bg-white"
                  >
                    <Icon name="close" size={16} strokeWidth={2.2} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {images.length < IMAGE_MAX_COUNT ? (
            <button
              type="button"
              disabled={preparing}
              onClick={() => picker.current?.click()}
              className="card relative flex min-h-[96px] w-full items-center justify-center gap-2 border-dashed text-[20px] disabled:opacity-60"
            >
              <PhotoGlyph />
              {preparing ? labels.preparing : labels.pickImage}
            </button>
          ) : null}
          {imgError ? (
            <p role="alert" className="px-1 text-[17px] text-red">
              {imgError}
            </p>
          ) : null}
          <p className="px-1 text-[15px] leading-[1.4] text-muted">{labels.imageNotice}</p>
        </div>
      ) : (
        <>
          {/* 말하기: 마이크를 입력 칸 위에 크게(작은 화면에서 아래 단추 줄에 가리지 않게) */}
          {method === "speak" ? (
            <div className="flex flex-col items-center gap-1.5 pt-4">
              <button
                type="button"
                onClick={() => void listen()}
                aria-pressed={listening}
                className={`relative flex h-[84px] w-[84px] items-center justify-center rounded-full border-[1.8px] border-ink ${listening ? "bg-sky" : "bg-white"}`}
              >
                {listening ? <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border-2 border-ink/30" /> : null}
                {listening ? <Icon name="stop" size={30} strokeWidth={2} /> : <MicGlyph />}
                <span className="sr-only">{listening ? labels.listening : labels.listen}</span>
              </button>
              <p className="text-[17px] text-muted" aria-live="polite">
                {listening ? labels.listening : labels.listen}
              </p>
            </div>
          ) : null}
          <div className="card ruled relative mx-4 mt-3 pb-3 pl-5 pr-4 pt-3 [background-position:0_12px]">
            <Squiggle w={50} width={2.4} color="#F59BAE" className="-bottom-2 right-8" />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, max))}
              maxLength={max}
              rows={method === "speak" ? 6 : 11}
              placeholder={labels.placeholder}
              aria-label={labels.placeholder}
              className="block w-full resize-none bg-transparent text-[19px] leading-8 outline-none placeholder:text-muted"
            />
            <p className="pt-1 text-right text-[14px] text-muted">{labels.count.replace("{n}", String(text.length))}</p>
          </div>
        </>
      )}
      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {err ? (
          <p role="alert" className="px-1 text-[17px] text-red">
            {err}
          </p>
        ) : null}
        <button type="button" onClick={analyze} disabled={!canRead} className="btn-primary !min-h-[58px] w-full !text-[22px] disabled:opacity-50">
          {labels.analyze}
        </button>
      </div>
    </div>
  );
}

/** 사진 그림(사진 고르기 단추) */
function PhotoGlyph() {
  return (
    <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4" />
    </svg>
  );
}

/** 마이크 그림(말하기 단추) */
function MicGlyph() {
  return (
    <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}
