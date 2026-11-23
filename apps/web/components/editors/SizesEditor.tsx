"use client";

import { describeRing, describeShoe, describeTop, type Locale, type SizesData } from "@readme/core";
import { useT } from "./shared";

function NumberCell({ label, value, onChange, placeholder, unit, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; unit: string; hint: string | null }) {
  return (
    <label className="flex flex-col gap-1 border-b-[1.5px] border-dashed border-ink/20 py-3">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="text" className="hand-written h-10 w-full min-w-0 bg-transparent text-[28px] outline-none placeholder:font-sans placeholder:text-[14px] placeholder:tracking-[-0.035em] placeholder:text-muted" />
        <span className="shrink-0 text-[14px]">{unit}</span>
      </span>
      <span className="min-h-[16px] text-[12px] text-muted">{hint ?? ""}</span>
    </label>
  );
}

export function SizesEditor({ value, onChange, locale }: { value: SizesData; onChange: (v: SizesData) => void; locale: Locale }) {
  const t = useT(locale);
  const num = (v: string) => {
    const n = Number(v.replace(/[^\d]/g, ""));
    return v.trim() && Number.isFinite(n) ? n : null;
  };
  const top = describeTop(value.top, locale);
  const shoe = describeShoe(value.shoe, locale);
  const ring = describeRing(value.ring, locale);
  return (
    <div className="grid grid-cols-2 gap-x-5">
      <NumberCell label={t("size.top")} value={value.top} onChange={(v) => onChange({ ...value, top: v.slice(0, 20) })} placeholder={t("size.topPlaceholder")} unit={top?.unit ?? ""} hint={top?.hint ?? null} />
      <NumberCell label={t("size.bottom")} value={value.bottom} onChange={(v) => onChange({ ...value, bottom: v.slice(0, 20) })} placeholder={t("size.bottomPlaceholder")} unit={t("size.bottomUnit")} hint={null} />
      <NumberCell label={t("size.shoe")} value={value.shoe?.toString() ?? ""} onChange={(v) => onChange({ ...value, shoe: num(v) })} placeholder={t("size.shoePlaceholder")} unit="mm" hint={shoe?.hint ?? null} />
      <NumberCell label={t("size.ring")} value={value.ring?.toString() ?? ""} onChange={(v) => onChange({ ...value, ring: num(v) })} placeholder={t("size.ringPlaceholder")} unit={locale === "ko" ? "호" : "KR"} hint={ring?.hint ?? null} />
    </div>
  );
}
