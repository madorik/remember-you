"use client";

import { translate, type Locale } from "@readme/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./marks";

// 지운 뒤 5초 동안 '되돌리기'를 띄우는 아래 토스트. 한 번에 하나만 뜨고, 새로 지우면 앞의 것은 그대로 확정된다.
//  - onUndo: 되돌리기를 눌렀을 때
//  - onCommit: 되돌리지 않고 끝났을 때(시간이 지남·새 토스트로 바뀜·화면을 떠남·앱이 가려짐). 지연 삭제는 여기서 보낸다
// 위치: 휴대폰 아래 막대(--pb)와 키보드(--kb) 위, 떠 있는 탭 막대 위

const SHOW_MS = 5000;

export interface UndoOffer {
  onUndo: () => void;
  onCommit?: () => void;
  /** 토스트 글(안 주면 "지웠어요"). 지우는 게 아닌 일(폴더에서 빼기 등)은 맞는 말로 */
  text?: string;
}

/** 늘 가장 새 값을 가리키는 ref(되돌리기가 몇 초 뒤에 눌려도 그때의 값·함수로 되살리게) */
export function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** 화면 언어(문구가 서버 문구를 못 받는 곳용). 지울 때(클라이언트)만 읽는다 */
function pageLocale(): Locale {
  return document.documentElement.lang === "en" ? "en" : "ko";
}

export function useUndoToast(locale?: Locale): { show: (offer: UndoOffer) => void; toast: React.ReactNode } {
  const [shown, setShown] = useState<{ id: number; text: string; undo: string } | null>(null);
  const current = useRef<(UndoOffer & { id: number }) | null>(null);
  const timer = useRef(0);
  const seq = useRef(0);

  // 지금 떠 있는 것을 확정(되돌리지 않는다)
  const commit = useCallback(() => {
    window.clearTimeout(timer.current);
    const c = current.current;
    current.current = null;
    setShown(null);
    c?.onCommit?.();
  }, []);

  const show = useCallback(
    (offer: UndoOffer) => {
      commit();
      const id = ++seq.current;
      const l = locale ?? pageLocale();
      current.current = { ...offer, id };
      setShown({ id, text: offer.text ?? translate(l, "common.deleted"), undo: translate(l, "common.undo") });
      timer.current = window.setTimeout(commit, SHOW_MS);
    },
    [commit, locale],
  );

  const undo = useCallback(() => {
    window.clearTimeout(timer.current);
    const c = current.current;
    current.current = null;
    setShown(null);
    c?.onUndo();
  }, []);

  // 화면을 떠나거나 앱이 가려지면 남은 삭제를 바로 보낸다(잃지 않게)
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") commit();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", commit);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", commit);
      commit();
    };
  }, [commit]);

  // 알림 영역(role=status)은 늘 달아 두고 그 안에 토스트가 나타나야 스크린리더가 읽어 준다
  const toast = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
      style={{ bottom: "calc(max(var(--pb), var(--kb, 0px)) + 72px)" }}
    >
      {shown ? <UndoToast key={shown.id} text={shown.text} undoLabel={shown.undo} onUndo={undo} /> : null}
    </div>
  );
  return { show, toast };
}

function UndoToast({ text, undoLabel, onUndo }: { text: string; undoLabel: string; onUndo: () => void }) {
  // 처음 그릴 때 한 프레임 뒤에 나타나게(움직임 줄이기를 켠 사람은 바로)
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(f);
  }, []);
  return (
    <div
      className={`pointer-events-auto flex min-h-12 w-full max-w-[378px] items-center gap-2 rounded-2xl bg-ink pl-4 pr-1 text-white shadow-[0_8px_24px_rgba(31,35,64,0.28)] motion-safe:transition-[opacity,transform] motion-safe:duration-200 ${
        on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <span className="min-w-0 flex-1 text-[15.3px]">{text}</span>
      <button type="button" onClick={onUndo} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[15.3px] text-sky active:opacity-70">
        <Icon name="undo" size={16} strokeWidth={2} />
        {undoLabel}
      </button>
    </div>
  );
}
