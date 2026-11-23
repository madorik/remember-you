"use client";

import { beacon } from "@/components/beacon";
import { TornTape } from "@/components/TornTape";
import { Icon } from "@/components/marks";

// 선물 가이드의 가격대별 목록: 검색에 다 보이도록 가격대를 칩으로 숨기지 않고 모두 펼친다. 누르면 쿠팡 상품 페이지(파트너스 링크), 누른 것은 이용 기록(source: guide)

export interface GuideBand {
  band: string;
  title: string;
  items: { id: string; title: string; name: string; url: string; image: string }[];
}

// 가격대마다 돌아가며: 제목 형광펜 색(시안: 망고 #ffd978 · 민트 #c0e8d6 · 분홍 · 하늘)
const MARKS = ["#ffd978", "#c0e8d6", "#f9cbd5", "#cfe6f5"];

export function GuideList({ bands }: { bands: GuideBand[] }) {
  return (
    <div className="flex flex-col gap-[26px]">
      {bands.map((b, bi) => {
        const mark = MARKS[bi % MARKS.length]!;
        return (
          <section key={b.band} aria-labelledby={`band-${b.band}`} className="card relative flex flex-col px-3.5 pb-1 pt-3">
            <h2
              id={`band-${b.band}`}
              className="mb-2.5 self-start px-0.5 text-[25px] leading-[1.15]"
              style={{ backgroundImage: `linear-gradient(transparent 55%, ${mark} 55%, ${mark} 92%, transparent 92%)` }}
            >
              {b.title}
            </h2>
            <ol className="flex flex-col">
              {b.items.map((it, n) => (
                <li key={it.id} className="border-t-[1.5px] border-dashed border-ink/[0.18]">
                  <a
                    href={it.url}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    onClick={() => beacon("gift_click", { i: it.id, b: b.band, s: "guide" })}
                    className="flex items-center gap-3 py-2.5 active:bg-fill"
                  >
                    <span aria-hidden="true" className={`shrink-0 border-[1.5px] border-ink bg-white px-[5px] pb-1 pt-[5px] ${n % 2 ? "[transform:rotate(3deg)]" : "[transform:rotate(-3deg)]"}`}>
                      <span className="flex h-[50px] w-[50px] items-center justify-center overflow-hidden bg-[#fff1cc]">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full bg-white object-contain" />
                        ) : (
                          <Icon name="gift" size={24} strokeWidth={1.8} className="text-accent" />
                        )}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <span className="hand-written truncate text-[25px] leading-[1.15]">{it.title}</span>
                        <Icon name="external" size={15} strokeWidth={2} className="shrink-0 text-muted" />
                      </span>
                      {it.name ? <span className="line-clamp-2 text-[12px] leading-[1.35] text-muted">{it.name}</span> : null}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
            <TornTape color={b.band === "1" ? "mango" : "mint"} w={62} h={21} rotate={-4} className="-top-3 right-8" />
          </section>
        );
      })}
    </div>
  );
}
