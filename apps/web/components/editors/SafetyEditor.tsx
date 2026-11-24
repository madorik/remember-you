"use client";

import { ALLERGENS, ALLERGEN_ORDER, DIETS, DISLIKES, DISLIKE_ORDER, NONE, NONE_LABEL, customTags, ordered, type Locale, type SafetyData } from "@readme/core";
import { useState } from "react";
import { CircleOption, SectionHeading, TextField, UNDERLINE_INPUT, toggleWithNone, useT } from "./shared";

/** 목록에 없는 음식 직접 더하기: 누르면 그 자리에 칸이 열린다. 엔터로 더하면 칸이 열린 채로 남아 이어서 더한다 */
function AddTag({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const take = () => {
    const v = text.replace(/\s+/g, " ").trim().slice(0, 30);
    if (v) onAdd(v);
    setText("");
  };
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-dashed border-ink/30 px-3 text-[12.6px] text-muted before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
      >
        <span aria-hidden="true" className="leading-none">
          +
        </span>
        {label}
      </button>
    );
  return (
    <span className="flex w-full items-center gap-1.5">
      <input
        autoFocus
        value={text}
        maxLength={30}
        enterKeyHint="done"
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            take();
          } else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => {
          if (!text.trim()) setOpen(false);
        }}
        className={`${UNDERLINE_INPUT} h-10 flex-1`}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          take();
          setOpen(false);
        }}
        className="flex min-h-11 shrink-0 items-center px-3 text-[12.6px]"
      >
        {label}
      </button>
    </span>
  );
}

/** 알레르기(빨간 동그라미)와 안 먹는 것(남색 동그라미). 목록에 없는 음식은 직접 더한다. 온보딩·내 리드미·요청 답하기에서 같이 쓴다 */
export function SafetyEditor({
  value,
  onChange,
  locale,
  showNote = true,
  flush = false,
}: {
  value: SafetyData;
  onChange: (v: SafetyData) => void;
  locale: Locale;
  showNote?: boolean;
  /** 이미 카드 안이라 맨 위 점선(항목 머리와 나누는 줄)이 필요 없을 때(온보딩) */
  flush?: boolean;
}) {
  const t = useT(locale);
  const allergens = ordered(ALLERGENS, ALLERGEN_ORDER[locale]);
  const dislikes = ordered(DISLIKES, DISLIKE_ORDER[locale]);
  const hiddenPicked = allergens.rest.some((i) => value.allergens.includes(i.code)) || dislikes.rest.some((i) => value.dislikes.includes(i.code)) || value.diets.length > 0;
  const [more, setMore] = useState(hiddenPicked);

  const toggle = (key: "allergens" | "dislikes" | "diets", code: string) => {
    onChange({ ...value, [key]: toggleWithNone(value[key], code) });
  };
  // 직접 더한 이름: 켠 칩으로 보이고, 누르면 빠진다
  const add = (key: "allergens" | "dislikes", name: string) => {
    const real = value[key].filter((c) => c !== NONE);
    if (!real.some((c) => c.toLowerCase() === name.toLowerCase())) onChange({ ...value, [key]: [...real, name] });
  };
  const custom = (key: "allergens" | "dislikes") =>
    customTags(key === "allergens" ? ALLERGENS : DISLIKES, value[key]).map((name) => (
      <CircleOption key={`custom-${name}`} label={name} color={key === "allergens" ? "warn" : "ink"} on onToggle={() => toggle(key, name)} />
    ));
  const addTag = (key: "allergens" | "dislikes") => <AddTag label={t("safety.add")} placeholder={t("safety.addPlaceholder")} onAdd={(name) => add(key, name)} />;
  // 첫 칸 '없음'(알레르기 없음 · 안 먹는 것 없음 · 식단 없음)
  const none = (key: "allergens" | "dislikes" | "diets") => (
    <CircleOption label={NONE_LABEL[locale]} color="ink" on={value[key].includes(NONE)} onToggle={() => toggle(key, NONE)} />
  );

  return (
    <div className="flex flex-col">
      <div className={`flex flex-col gap-2 pb-3 ${flush ? "" : "border-t border-dashed border-ink/30 pt-2.5"}`}>
        <SectionHeading tone="red">
          {t("safety.allergens")}
        </SectionHeading>
        <div className="flex flex-wrap gap-1.5">
          {none("allergens")}
          {[...allergens.first, ...(more ? allergens.rest : [])].map((i) => (
            <CircleOption key={i.code} label={i.label[locale]} color="warn" on={value.allergens.includes(i.code)} onToggle={() => toggle("allergens", i.code)} />
          ))}
          {custom("allergens")}
          {addTag("allergens")}
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="relative inline-flex h-9 items-center gap-0.5 whitespace-nowrap px-2.5 text-[11.7px] text-muted before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']">
            {more ? t("safety.less") : t("safety.more")}
            <span aria-hidden="true" className={more ? "rotate-180" : ""}>
              ⌄
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-dashed border-ink/30 pb-3 pt-2.5">
        <SectionHeading>{t("safety.dislikes")}</SectionHeading>
        <div className="flex flex-wrap gap-1.5">
          {none("dislikes")}
          {[...dislikes.first, ...(more ? dislikes.rest : [])].map((i) => (
            <CircleOption key={i.code} label={i.label[locale]} color="ink" on={value.dislikes.includes(i.code)} onToggle={() => toggle("dislikes", i.code)} />
          ))}
          {custom("dislikes")}
          {addTag("dislikes")}
        </div>
      </div>

      {more ? (
        <div className="flex flex-col gap-2 border-t border-dashed border-ink/30 pb-3 pt-2.5">
          <SectionHeading>{t("safety.diets")}</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {none("diets")}
            {DIETS.map((i) => (
              <CircleOption key={i.code} label={i.label[locale]} color="ink" on={value.diets.includes(i.code)} onToggle={() => toggle("diets", i.code)} />
            ))}
          </div>
        </div>
      ) : null}

      {showNote ? (
        <div className="border-t border-dashed border-ink/30 pt-2">
        <TextField label={t("safety.note")} value={value.allergyNote} onChange={(v) => onChange({ ...value, allergyNote: v })} placeholder={t("safety.notePlaceholder")} multiline />
        </div>
      ) : null}
    </div>
  );
}
