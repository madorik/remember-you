// 앱(Capacitor SpeechRecognition 플러그인) 받아쓰기 한 번.
// 기기는 '멈춤'(말이 끝남, 또는 멈춰 달라고 함)을 먼저 알리고, 마지막 말까지 든 최종 결과는 조금 뒤에 보낸다
// (안드로이드: onEndOfSpeech → onResults, iOS: stop → endAudio → isFinal). 멈춤을 듣자마자 끝내면 문장 끝이 빠진다.
// 그래서 멈춘 뒤에도 결과를 계속 받다가, 멈춘 뒤 결과가 오고 잠잠해지면(quietMs) 또는 길어야 maxMs 뒤에 한 번 끝낸다.

export type NativeSpeech = {
  available: () => Promise<{ available: boolean }>;
  requestPermissions: () => Promise<{ speechRecognition: string }>;
  start: (o: { language: string; partialResults: boolean; popup: boolean; maxResults: number }) => Promise<unknown>;
  stop: () => Promise<void>;
  addListener: (event: "partialResults" | "listeningState", fn: (d: { matches?: string[]; status?: string }) => void) => Promise<{ remove: () => Promise<void> }>;
};

export const SETTLE_QUIET_MS = 350;
export const SETTLE_MAX_MS = 1500;

export interface Dictation {
  /** 멈춰 달라고 하고 최종 결과를 기다려 끝낸다 */
  stop: () => void;
  /** 결과를 기다리지 않고 버린다(화면을 떠날 때) */
  cancel: () => void;
}

export interface DictationOptions {
  language: string;
  /** 받아 적는 중인 글(바뀔 때마다) */
  onText: (text: string) => void;
  /** 멈춤을 들었다(이제 최종 결과를 기다리는 중) */
  onSettling?: () => void;
  /** 끝(한 번만): 받아 적은 글 전부 */
  onDone: (text: string) => void;
  quietMs?: number;
  maxMs?: number;
}

export async function startDictation(plugin: NativeSpeech, o: DictationOptions): Promise<Dictation> {
  const quietMs = o.quietMs ?? SETTLE_QUIET_MS;
  const maxMs = o.maxMs ?? SETTLE_MAX_MS;
  let text = "";
  let results = 0;
  let lastAt = 0;
  let over = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const subs: { remove: () => Promise<void> }[] = [];
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    for (const s of subs.splice(0)) void s.remove().catch(() => {});
  };
  const finish = (ask: boolean) => {
    if (over) return;
    over = true;
    // 안드로이드 플러그인의 stop()은 끝났다는 답을 주지 않는다. 기다리지 않는다
    if (ask) void plugin.stop().catch(() => {});
    o.onSettling?.();
    const stopAt = Date.now();
    const before = results;
    const tick = () => {
      const now = Date.now();
      if ((results > before && now - lastAt >= quietMs) || now - stopAt >= maxMs) {
        cleanup();
        o.onDone(text);
      } else timer = setTimeout(tick, 60);
    };
    timer = setTimeout(tick, 60);
  };
  subs.push(
    await plugin.addListener("partialResults", (d) => {
      const t = d.matches?.[0];
      if (typeof t !== "string") return;
      text = t;
      results += 1;
      lastAt = Date.now();
      o.onText(t);
    }),
  );
  // 말이 끝나 기기가 스스로 멈춰도(조용해지면) 최종 결과를 받아 끝낸다
  subs.push(
    await plugin.addListener("listeningState", (d) => {
      if (d.status === "stopped") finish(false);
    }),
  );
  try {
    await plugin.start({ language: o.language, partialResults: true, popup: false, maxResults: 1 });
  } catch (e) {
    over = true;
    cleanup();
    throw e;
  }
  return {
    stop: () => finish(true),
    cancel: () => {
      over = true;
      cleanup();
      void plugin.stop().catch(() => {});
    },
  };
}

// ── 음성 인식 찾기 ─────────────────────────────────────────────
// 브라우저는 Web Speech API, 앱(Capacitor)은 SpeechRecognition 플러그인이 있으면 그것. 둘 다 없으면 글로 적는다(휴대폰 키보드의 받아쓰기 마이크로도 말할 수 있다).
// 화면 컴포넌트(VoiceCapture·MemoPad)가 같이 쓴다. 브라우저에서만 부른다(서버에서는 null)

export type WebRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function webCtor(): (new () => WebRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function nativeSpeech(): NativeSpeech | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { SpeechRecognition?: NativeSpeech } } }).Capacitor;
  return cap?.isNativePlatform?.() && cap.Plugins?.SpeechRecognition ? cap.Plugins.SpeechRecognition : null;
}

// ── 받아 적는 글을 타자 치듯 보이기 ─────────────────────────────

/** 두 글의 같은 앞부분 길이 */
export function commonPrefix(a: string, b: string): number {
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  return k;
}

/** 한 걸음: 같은 앞부분 뒤로 한 글자씩(고쳐 들어 달라진 뒤쪽은 버리고), 많이 밀리면 두세 글자씩 */
export function nextTyped(cur: string, target: string): string {
  const k = commonPrefix(cur, target);
  const left = target.length - k;
  if (left <= 0) return target;
  return target.slice(0, k + (left > 30 ? 3 : left > 12 ? 2 : 1));
}
