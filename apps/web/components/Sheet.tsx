"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./marks";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const NOT_VISUAL = new Set(["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE", "NOSCRIPT"]);

/** el 가는 길에 있는 것만 두고 화면의 나머지를 inert로 막는다(뒤 화면이 탭·스크린리더·포커스에 안 잡히게). 되돌리는 함수를 준다 */
function inertOthers(el: HTMLElement): () => void {
  const blocked: HTMLElement[] = [];
  let node: HTMLElement = el;
  while (node !== document.body && node.parentElement) {
    const parent: HTMLElement = node.parentElement;
    for (const sib of Array.from(parent.children)) {
      if (sib === node || !(sib instanceof HTMLElement) || NOT_VISUAL.has(sib.tagName) || sib.inert) continue;
      sib.inert = true;
      blocked.push(sib);
    }
    node = parent;
  }
  return () => {
    for (const b of blocked) b.inert = false;
  };
}

/**
 * 위로 뜨는 창(시트·서랍)의 포커스 관리. 돌려받은 ref를 role="dialog" 요소에 달면 된다.
 * 열리면 창(이미 안쪽 칸에 포커스가 있으면 그대로)으로 포커스를 옮기고, Tab이 창 안에서만 돌고, 뒤 화면은 inert로 막고,
 * Esc로 닫고, 몸 스크롤을 잠근다. 닫히면 열 때 누른 단추로 포커스를 돌려준다. 열려 있을 때만 그려지는 컴포넌트에서 쓴다
 */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  // 안쪽 칸의 autoFocus가 먼저 포커스를 가져가기 전, 처음 그릴 때의 포커스가 누른 단추다
  const [trigger] = useState<HTMLElement | null>(() => (typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null));

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const release = inertOthers(root);
    if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // 한글 조합 중 Esc는 조합만 취소한다
        if (!e.isComposing) close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const cur = document.activeElement;
      const outside = !cur || !root.contains(cur) || cur === root;
      if (e.shiftKey ? cur === first || outside : cur === last || outside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
      document.body.style.overflow = prevOverflow;
      if (trigger?.isConnected && trigger !== document.body) trigger.focus({ preventScroll: true });
    };
  }, [trigger]);

  return ref;
}

/**
 * 아래에서 올라오는 시트(메모 시트와 같은 모양). 바깥을 누르거나 Esc면 닫힌다.
 * 아래 버튼 줄(footer)은 휴대폰 아래 막대 위로 띄운다(--pb), 키보드가 뜨면 그 위로(--kb).
 * 키보드가 뜨면 그만큼 시트 높이도 줄여(max-h) 제목·닫기·첫 칸이 화면 밖으로 밀리지 않고, 안쪽은 스크롤된다
 */
export function Sheet({
  id,
  title,
  icon,
  closeLabel,
  onClose,
  children,
  footer,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const dialog = useDialog(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-[rgba(31,35,64,0.32)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="mx-auto flex max-h-[calc(90dvh-var(--kb,0px))] w-full max-w-[432px] flex-col rounded-t-[25.2px] bg-paper outline-none"
        style={{ marginBottom: "var(--kb, 0px)" }}
      >
        <div className="flex shrink-0 items-center gap-2.5 pb-1 pl-6 pr-2 pt-3">
          {icon}
          <h2 id={id} className="min-w-0 flex-1 truncate text-[17px]">
            {title}
          </h2>
          <button type="button" aria-label={closeLabel} onClick={onClose} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center text-muted">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? (
          <div className="sheet-foot flex shrink-0 flex-col gap-1 px-6 pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
