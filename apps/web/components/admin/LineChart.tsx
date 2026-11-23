"use client";

import { useState } from "react";

// 통계 화면의 날마다 추이(한 계열, 한 색). 대면 세로선 + 점 + 날짜·값, 아래에 표로 보기
const W = 640;
const H = 180;
const PAD = { l: 34, r: 10, t: 12, b: 24 };

export function LineChart({ title, unit, data }: { title: string; unit: string; data: { day: string; n: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.n));
  const nice = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const x = (i: number) => PAD.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / nice) * (H - PAD.t - PAD.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.n).toFixed(1)}`).join("");
  const area = data.length ? `${line}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const total = data.reduce((a, d) => a + d.n, 0);
  const h = hover != null ? data[hover] : null;
  const label = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return (
    <figure className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-rule">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[13.1px] font-bold">{title}</span>
        <span className="text-[11.3px] text-muted">
          {h ? (
            <>
              {label(h.day)} · <b className="num text-ink">{h.n.toLocaleString("ko-KR")}</b>
              {unit}
            </>
          ) : (
            <>
              기간 합계 <b className="num text-ink">{total.toLocaleString("ko-KR")}</b>
              {unit}
            </>
          )}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`${title}: 기간 합계 ${total}${unit}`}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(nice * f)} y2={y(nice * f)} stroke="#E4E6EE" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(nice * f) + 4} textAnchor="end" fontSize="11" fill="#6B7089">
                {Math.round(nice * f)}
              </text>
            </g>
          ))}
          <path d={area} fill="#FFF4D6" />
          <path d={line} fill="none" stroke="#8F5A00" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {h && hover != null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#3A3F5C" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(h.n)} r={4.5} fill="#8F5A00" stroke="#FFFFFF" strokeWidth={2} />
            </g>
          ) : null}
          {data.length ? (
            <>
              <text x={x(0)} y={H - 6} fontSize="11" fill="#6B7089">
                {label(data[0]!.day)}
              </text>
              <text x={x(data.length - 1)} y={H - 6} textAnchor="end" fontSize="11" fill="#6B7089">
                {label(data[data.length - 1]!.day)}
              </text>
            </>
          ) : null}
        </svg>
      </div>
      <details className="text-[11.3px]">
        <summary className="cursor-pointer text-muted">표로 보기</summary>
        <table className="mt-1.5 w-full">
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-rule">
                <td className="py-1">{d.day}</td>
                <td className="num py-1 text-right">{d.n.toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
