"use client";

import { useEffect, useRef, useState } from "react";
import { beacon } from "@/components/beacon";
import { TornTape } from "@/components/TornTape";
import { CheckGlyph, Icon } from "@/components/marks";

// 이런 선물은 어때요(목록 방식): 가격대 칩을 누르거나 목록을 좌우로 밀면 그 가격대에서 고른 선물들.
// 칸마다 그 상품 사진과 '왜'. 누르면 쿠팡 상품 페이지(파트너스 링크)로, 누른 것은 이용 기록으로(source: reminder·plan·card)

export interface LinkBand {
  band: string;
  label: string;
  /** basis: 이 사람의 어떤 점을 보고 골랐는지(등산, 60대 아빠). 가족 카드에는 없다 */
  items: { id: string; title: string; reason: string; url: string; image: string; name?: string; basis?: string[]; badge?: "pick" | "top" }[];
}

const SWIPE = 56;

export interface BadgeLabels {
  pick: string;
  top: string;
}

/** 추천(은은한 노란색) · 강력추천(망고색 + 하트) 알약 */
function Badge({ kind, labels }: { kind: "pick" | "top"; labels: BadgeLabels }) {
  return kind === "top" ? (
    <span data-badge="top" className="flex h-[26px] w-fit items-center gap-1 rounded-full border-[1.5px] border-ink bg-sky px-2.5 pb-px text-[11px] text-ink">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="#1F2340" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20 C4 14 2 9 5.5 6.5 C8 4.7 11 6 12 8.5 C13 6 16 4.7 18.5 6.5 C22 9 20 14 12 20 Z" />
      </svg>
      {labels.top}
    </span>
  ) : (
    <span data-badge="pick" className="flex h-[26px] w-fit items-center rounded-full border-[1.5px] border-mango-deep bg-sky-soft px-2.5 pb-px text-[11px] text-ink">
      {labels.pick}
    </span>
  );
}

/** 라벨 자리 폭만큼 상품명 오른쪽을 비운다(제목이 스티커 밑으로 들어가지 않게) */
const STICKER_ROOM = { top: "pr-[72px]", pick: "pr-[44px]" } as const;

/** 선물 박스의 제목 줄 오른쪽 끝에 스티커처럼 붙은 라벨(상품 정보와 따로 얹힌다). 누르는 건 박스가 받는다 */
function Sticker({ kind, labels, className }: { kind: "pick" | "top"; labels: BadgeLabels; className: string }) {
  return (
    <span className={`pointer-events-none absolute z-10 rotate-[3deg] ${className}`}>
      <Badge kind={kind} labels={labels} />
    </span>
  );
}

/**
 * badges: 주면 고른 선물의 라벨(추천·강력추천)이 제목 위에 보인다(글자는 화면 언어로)
 * look="paper": 가족 카드(/g)처럼 한 칸씩 종이 카드에 상품 사진을 폴라로이드 틀로
 */
export function GiftLinkTabs({ bands, initial, pad = "px-6", label, badges, source, look = "list" }: { bands: LinkBand[]; initial: string; pad?: string; label: string; badges?: BadgeLabels; source: "reminder" | "plan" | "card"; look?: "list" | "paper" }) {
  const paper = look === "paper";
  const [index, setIndex] = useState(() => Math.max(0, bands.findIndex((b) => b.band === initial)));
  const [enter, setEnter] = useState<"left" | "right" | null>(null);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; lock: "x" | "y" | null } | null>(null);
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const cur = bands[index] ?? bands[0];

  useEffect(() => {
    chips.current[index]?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [index]);

  if (!cur) return null;
  const go = (to: number) => {
    if (to < 0 || to >= bands.length || to === index) return;
    setEnter(to > index ? "right" : "left");
    setIndex(to);
  };

  const inner = paper ? "" : pad;
  return (
    <div className={paper ? "card relative mx-4 mt-8 flex flex-col px-3.5 pb-1.5 pt-3" : "flex flex-col"}>
      {paper ? <TornTape color="mango" w={68} h={21} rotate={-6} className="-top-3.5 left-[26px]" /> : null}
      <div role="tablist" aria-label={label} className={`flex gap-1.5 overflow-x-auto ${paper ? "pb-3" : "pb-1 pt-3"} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${inner}`}>
        {bands.map((b, i) => {
          const on = i === index;
          return (
            <button
              key={b.band}
              ref={(el) => {
                chips.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => go(i)}
              className={`flex h-8 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-ink px-3 text-[13px] ${on ? "bg-sky text-ink" : "bg-white text-ink"}`}
            >
              {on ? <CheckGlyph size={13} /> : null}
              {b.label}
            </button>
          );
        })}
      </div>
      <div
        data-no-swipe
        className="touch-pan-y overflow-hidden"
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) drag.current = { x: t.clientX, y: t.clientY, lock: null };
        }}
        onTouchMove={(e) => {
          const d = drag.current;
          const t = e.touches[0];
          if (!d || !t) return;
          const mx = t.clientX - d.x;
          const my = t.clientY - d.y;
          if (!d.lock) {
            if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) d.lock = "x";
            else if (Math.abs(my) > 8) d.lock = "y";
          }
          // 끝 가격대에서는 고무줄처럼 덜 밀린다
          if (d.lock === "x") setDx((mx < 0 && index === bands.length - 1) || (mx > 0 && index === 0) ? mx / 4 : mx);
        }}
        onTouchEnd={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.lock === "x" && Math.abs(dx) > SWIPE) go(index + (dx < 0 ? 1 : -1));
          setDx(0);
        }}
      >
        <ul
          key={cur.band}
          role="tabpanel"
          aria-label={cur.label}
          style={dx ? { transform: `translateX(${dx}px)` } : undefined}
          className={`flex flex-col ${paper ? "" : "pt-1"} ${inner} ${dx ? "" : "transition-transform duration-200"} ${enter === "right" ? "motion-safe:animate-[picks-in-right_240ms_ease-out]" : enter === "left" ? "motion-safe:animate-[picks-in-left_240ms_ease-out]" : ""}`}
        >
          {cur.items.map((it, n) => (
            <li key={it.id} className="relative border-t-[1.5px] border-dashed border-ink/[0.18]">
              {it.badge && badges ? <Sticker kind={it.badge} labels={badges} className="right-0 top-[10px]" /> : null}
              <a
                href={it.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                draggable={false}
                onClick={() => beacon("gift_click", { i: it.id, b: cur.band, s: source })}
                className="relative flex items-center gap-3 py-2.5 active:bg-fill"
              >
                <span aria-hidden="true" className={`shrink-0 border-[1.5px] border-ink bg-white px-[5px] pb-1 pt-[5px] ${n % 2 ? "[transform:rotate(3deg)]" : "[transform:rotate(-3deg)]"}`}>
                  <span className="flex h-[50px] w-[50px] items-center justify-center overflow-hidden bg-[#fff1cc]">
                    {it.image ? (
                      // 쿠팡 이미지 주소를 그대로(이미지 최적화 서버를 거치지 않게)
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} className="h-full w-full bg-white object-contain" />
                    ) : (
                      <Icon name="gift" size={24} strokeWidth={1.8} className="text-accent" />
                    )}
                  </span>
                </span>
                {/* 제목(손글씨) 옆에 근거 꼬리표, 밑에 이유(없으면 상품명). 라벨 스티커는 오른쪽 위에 얹혀서 제목 줄이 그만큼 비켜 있다 */}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 ${it.badge && badges ? STICKER_ROOM[it.badge] : ""}`}>
                    <span className="hand-written min-w-0 truncate text-[25px] leading-[1.15]">{it.title}</span>
                    {it.basis?.length ? <BasisTags words={it.basis} /> : null}
                  </span>
                  {it.reason ? <span className="line-clamp-2 text-[12px] leading-[1.35] text-muted">{it.reason}</span> : it.name ? <span className="line-clamp-2 text-[12px] leading-[1.35] text-muted">{it.name}</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 고른 근거 꼬리표(이 사람 기록의 어느 부분 때문인지) */
export function BasisTags({ words }: { words: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {words.map((w) => (
        <span key={w} className="flex h-[18px] items-center rounded-full bg-[#e4ecfa] px-2 text-[11px] text-[#2f5fc4]">
          {w}
        </span>
      ))}
    </span>
  );
}
