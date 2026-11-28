"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RULE } from "@/components/Binder";
import { canReadClipboard, clipboardHasText, watchAppReturn } from "@/components/native";
import { offerPaste, PASTE_SHOW_MS, probeVerdict, type ClipboardProbe } from "@/lib/clipboard-paste";
import { u } from "@/lib/ui-scale";

const INK = "#1F2340";

const wait = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));

/** 돌아온 직후 클립보드를 본다. 안드로이드는 앱이 막 앞으로 나온 때 아직 글을 못 보여 줄 수 있어서, 없다고 나오면 잠깐 뒤에 두 번 더 본다 */
async function probeBack(): Promise<ClipboardProbe | null> {
  let last = await clipboardHasText();
  for (let i = 0; i < 2 && last && !last.has; i++) {
    await wait(300);
    last = await clipboardHasText();
  }
  return last;
}

/**
 * '복사한 글 붙여 넣기' 알약을 보일지 정한다(메모 쓰기·온보딩 첫 메모가 같이 쓴다).
 * 메모 앱에서 글을 복사하고 이 화면으로 돌아오면(visibilitychange · 앱의 appStateChange) 10분 안의 돌아옴에 알약을 보이고, 2분이 지나거나 dismiss()하면 걷는다.
 * - 앱 안쪽이 클립보드를 읽지 않고 볼 수 있으면(새 앱 빌드): 이 화면을 연 뒤 새로 복사한 글이 있을 때만(같은 글을 다시 권하지 않는다)
 * - 볼 수 없으면(웹·예전 앱 빌드): 메모 앱에서 열고 나갔다(hop) 돌아왔을 때만. 한 번 연 길은 한 번만 권한다
 * - 클립보드를 못 읽는 기기(앱 안쪽 읽기 없는 안드로이드 빌드: 웹뷰가 readText를 막는다)에서는 보이지 않는다(canReadClipboard)
 * 클립보드 글은 여기서 읽지 않는다(읽는 건 사람이 알약을 누른 때뿐)
 */
export function usePasteOffer() {
  const [shown, setShown] = useState(false);
  const leftAt = useRef<number | null>(null);
  const hopAt = useRef<number | null>(null);
  // 이미 권한 글·이 화면을 열 때 있던 글의 stamp
  const seen = useRef<number | null>(null);
  // 새 돌아옴·dismiss가 올 때마다 올려서, 아직 보는 중이던 앞의 확인이 뒤늦게 알약을 켜지 못하게 한다
  const epoch = useRef(0);

  const dismiss = useCallback(() => {
    epoch.current += 1;
    setShown(false);
  }, []);

  /** 메모 앱을 열러 나간다(곧바로 떠난 것으로 센다: 웹 화면이 멈춰 떠남 신호가 늦게 올 수 있다) */
  const hop = useCallback(() => {
    const now = Date.now();
    hopAt.current = now;
    leftAt.current = now;
  }, []);

  useEffect(() => {
    let gone = false;
    // 이 화면을 열 때 이미 있던 클립보드는 '새로 복사한 글'이 아니다
    void clipboardHasText().then((p) => {
      if (!gone && p?.has && seen.current == null) seen.current = p.stamp;
    });
    const stop = watchAppReturn({
      onLeave: () => {
        leftAt.current ??= Date.now();
      },
      onReturn: () => {
        const left = leftAt.current;
        leftAt.current = null;
        // 이 기기가 클립보드를 못 읽으면(앱 안쪽 읽기 없는 안드로이드 빌드) 눌러도 안 되는 알약은 보이지 않는다
        if (left == null || !canReadClipboard()) return;
        const mine = ++epoch.current;
        void (async () => {
          const probe = await probeBack();
          if (gone || mine !== epoch.current) return;
          if (!offerPaste({ leftAt: left, hopAt: hopAt.current, now: Date.now(), probe: probeVerdict(probe, seen.current) })) return;
          // 한 번 연 길(hop)은 한 번만, 본 글은 다시 권하지 않는다
          hopAt.current = null;
          if (probe?.has) seen.current = probe.stamp;
          setShown(true);
        })();
      },
    });
    return () => {
      gone = true;
      stop();
    };
  }, []);

  // 안 쓰면 2분 뒤 걷는다(새로 돌아오면 다시 2분)
  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => setShown(false), PASTE_SHOW_MS);
    return () => window.clearTimeout(id);
  }, [shown]);

  return { shown, hop, dismiss };
}

/** 클립보드 */
const CLIPBOARD = (
  <>
    <rect x="5.5" y="5" width="13" height="15.5" rx="2.4" fill="#FFF4D6" />
    <path d="M9 5V4.2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V5" />
    <path d="M9 10.5h6M9 14h4" />
  </>
);

/**
 * 본문 첫 줄 자리의 작은 알약(글줄 한 칸 높이를 차지해 밑의 글이 줄 위에 그대로 앉는다). 누르면 클립보드의 글을 붙인다.
 * 본문 칸을 누르면 글 칸에 커서가 가므로, 눌림이 위로 퍼지지 않게 막는다
 */
export function PastePill({ label, onPaste }: { label: string; onPaste: () => void }) {
  return (
    <div className="flex items-start" style={{ height: RULE }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPaste();
        }}
        className="hand relative inline-flex items-center gap-[7px] rounded-full border border-edge bg-sky-soft text-[17.1px] leading-none before:absolute before:-inset-x-1 before:-inset-y-1"
        style={{ height: u(32), padding: `0 ${u(14)}px 0 ${u(11)}px` }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width={u(18)} height={u(18)} fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          {CLIPBOARD}
        </svg>
        {label}
      </button>
    </div>
  );
}
