"use client";

import {
  AVATAR_BG_FILLS,
  AVATAR_BGS,
  AVATAR_BODIES,
  AVATAR_CLOTHS,
  AVATAR_FACES,
  AVATAR_GLASSES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRS,
  AVATAR_ITEMS,
  AVATAR_SKINS,
  type AvatarConfig,
  type Locale,
} from "@readme/core";
import { useState } from "react";
import { AvatarArt, avatarBackground } from "../Avatar";
import { Heart, Tape, type TapeColor } from "../diary";
import { useT } from "./shared";

type Tab = "hair" | "face" | "body" | "item" | "glasses" | "color";
const TABS: Tab[] = ["hair", "face", "body", "item", "glasses", "color"];
const TAB_KEY = { hair: "avatar.hair", face: "avatar.face", body: "avatar.body", item: "avatar.item", glasses: "avatar.glasses", color: "avatar.colors" } as const;

const CLOTH_LABELS = {
  ko: ["흰색", "남색", "망고", "잎", "분홍", "하늘", "보라", "주황", "빨강", "회색", "베이지", "갈색"],
  en: ["White", "Navy", "Mango", "Leaf", "Pink", "Sky", "Violet", "Orange", "Red", "Gray", "Beige", "Brown"],
};
const HAIR_COLOR_LABELS = {
  ko: ["검정", "갈색", "회색", "밝은 갈색", "흰머리", "금발", "적갈색", "분홍", "파랑"],
  en: ["Black", "Brown", "Gray", "Light brown", "White", "Blonde", "Auburn", "Pink", "Blue"],
};
const SKIN_LABELS = { ko: ["하양", "아주 밝게", "밝게", "중간", "진하게", "아주 진하게"], en: ["White", "Very light", "Light", "Medium", "Tan", "Deep"] };

const any = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

/** 색 동그라미: 누르는 칸은 40×44, 동그라미는 28. 골랐을 땐 바탕색(ringBg) 틈을 두고 남색 테두리 */
function Swatch({ fill, on, label, ringBg, onPick }: { fill: string; on: boolean; label: string; ringBg: string; onPick: () => void }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onPick} className="flex h-[42px] w-10 items-center justify-center">
      <span
        className="h-7 w-7 rounded-full transition-shadow"
        style={{ background: fill, boxShadow: on ? `inset 0 0 0 1.5px rgba(31,35,64,0.14), 0 0 0 2.5px ${ringBg}, 0 0 0 4.5px var(--color-ink)` : "inset 0 0 0 1.5px rgba(31,35,64,0.14)" }}
      />
    </button>
  );
}

/** 이름 칸(폼 필드 name="name"): 미리보기 오른쪽 위. hideLabel이면 글자는 스크린리더용이고 칸 안 안내글(placeholder)로 보인다 */
export function NameField({
  label,
  value,
  required = true,
  hideLabel = false,
  placeholder,
  autoFocus = false,
  invalid = false,
}: {
  label: string;
  value: string;
  required?: boolean;
  hideLabel?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={hideLabel ? "sr-only" : "text-[17px] text-muted"}>{label}</span>
      <input
        name="name"
        defaultValue={value}
        required={required}
        maxLength={40}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className="h-[52px] w-full min-w-0 rounded-2xl bg-white px-3.5 text-[24px] shadow-[inset_0_0_0_1.5px_var(--color-ink),0_3px_0_var(--color-sky)] outline-none placeholder:text-[19px]"
      />
    </label>
  );
}

/**
 * 캐릭터 만들기(한 화면에 다 보이게): 작은 폴라로이드 미리보기 + 오른쪽에 이름 칸·아무거나 → 머리·얼굴·옷·소품·안경·색깔 탭 → 4열 고르기 칸.
 * paper: 종이 시트(온보딩) 위인지 — 색 동그라미 고른 테두리의 틈 색을 바탕에 맞춘다
 */
export function AvatarBuilder({
  value,
  onChange,
  locale,
  side,
  tape = "pink",
  paper = false,
}: {
  value: AvatarConfig;
  onChange: (v: AvatarConfig) => void;
  locale: Locale;
  /** 미리보기 오른쪽 위에 놓는 칸들(NameField, 사람 추가는 폴더 칸까지). 아래에 '아무거나'가 붙는다 */
  side: React.ReactNode;
  tape?: TapeColor;
  paper?: boolean;
}) {
  const t = useT(locale);
  const [tab, setTab] = useState<Tab>("hair");
  const set = (patch: Partial<AvatarConfig>) => onChange({ ...value, ...patch });
  const ringBg = paper ? "var(--color-paper)" : "var(--color-bg)";
  const shuffle = () =>
    onChange({
      hair: any(AVATAR_HAIRS),
      face: any(AVATAR_FACES),
      body: any(AVATAR_BODIES),
      item: any(AVATAR_ITEMS),
      glasses: any(AVATAR_GLASSES),
      bg: any(AVATAR_BGS),
      cloth: any(AVATAR_CLOTHS),
      hairColor: any(AVATAR_HAIR_COLORS),
      skin: any(AVATAR_SKINS),
    });

  const options: { key: Exclude<Tab, "color">; list: readonly string[] } | null =
    tab === "hair"
      ? { key: "hair", list: AVATAR_HAIRS }
      : tab === "face"
        ? { key: "face", list: AVATAR_FACES }
        : tab === "body"
          ? { key: "body", list: AVATAR_BODIES }
          : tab === "item"
            ? { key: "item", list: AVATAR_ITEMS }
            : tab === "glasses"
              ? { key: "glasses", list: AVATAR_GLASSES }
              : null;

  const groups = [
    { title: t("avatar.bg"), swatches: AVATAR_BGS.map((bg) => { const [a, b] = AVATAR_BG_FILLS[bg]; return { id: bg, fill: a === b ? a : `linear-gradient(140deg, ${a}, ${b})`, on: value.bg === bg, label: t(`avatar.bg.${bg}` as "avatar.bg.sky"), pick: () => set({ bg }) }; }) },
    { title: t("avatar.cloth"), swatches: AVATAR_CLOTHS.map((c, i) => ({ id: c, fill: c, on: value.cloth === c, label: CLOTH_LABELS[locale][i]!, pick: () => set({ cloth: c }) })) },
    { title: t("avatar.hairColor"), swatches: AVATAR_HAIR_COLORS.map((c, i) => ({ id: c, fill: c, on: value.hairColor === c, label: HAIR_COLOR_LABELS[locale][i]!, pick: () => set({ hairColor: c }) })) },
    { title: t("avatar.skin"), swatches: AVATAR_SKINS.map((c, i) => ({ id: c, fill: c, on: value.skin === c, label: SKIN_LABELS[locale][i]!, pick: () => set({ skin: c }) })) },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-stretch gap-4">
        <div className="relative h-[160px] w-[150px] shrink-0 -rotate-[1.5deg] bg-white px-2 pb-[18px] pt-2 shadow-[0_1px_2px_rgb(31_35_64/0.12),0_10px_20px_-12px_rgb(31_35_64/0.5)]">
          <div className="relative flex h-[134px] w-[134px] items-end justify-center overflow-hidden" style={{ background: avatarBackground(value) }}>
            <span aria-hidden="true" className="absolute left-3 top-3 h-[34px] w-[34px] rounded-full bg-white/50" />
            <span aria-hidden="true" className="absolute right-[22px] top-7 h-3 w-3 rounded-full bg-white/50" />
            <AvatarArt config={value} size={128} />
          </div>
          <Tape color={tape} w={84} h={20} rotate={-3} alpha={tape === "pink" ? 0.6 : 0.62} className="-top-[9px] left-1/2 -ml-[42px]" />
          <Heart size={22} rotate={16} className="-right-2.5 top-[62px]" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex flex-col gap-1.5">{side}</div>
          <button
            type="button"
            onClick={shuffle}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white text-[18px] shadow-[inset_0_0_0_1.5px_var(--color-ink)] active:scale-95"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="4" />
              <circle cx="9" cy="9" r="1.3" fill="currentColor" />
              <circle cx="15" cy="15" r="1.3" fill="currentColor" />
              <circle cx="15" cy="9" r="1.3" fill="currentColor" />
              <circle cx="9" cy="15" r="1.3" fill="currentColor" />
            </svg>
            {t("avatar.shuffle")}
          </button>
        </div>
      </div>

      {/* 여섯 칸: 영어(Glasses·Extras)가 칸을 넘지 않게 영어는 15px */}
      <div role="tablist" aria-label={t("avatar.parts")} className="mt-3.5 grid grid-cols-[repeat(6,minmax(0,1fr))] border-b-[1.5px] border-dashed border-rule-strong">
        {TABS.map((k) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(k)}
              className={`relative h-11 whitespace-nowrap ${locale === "en" ? "text-[15px]" : "text-[18px]"} ${on ? "text-ink" : "text-muted"}`}
            >
              {t(TAB_KEY[k])}
              <span aria-hidden="true" className={`absolute inset-x-[22%] -bottom-px h-1 rounded-full ${on ? "bg-sky" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      {/* 칸 높이를 고정해 탭을 옮겨도 아래 단추·메뉴가 흔들리지 않게(가장 많은 머리·소품 13개 = 4줄, 색깔은 7줄) */}
      <div role="tabpanel" className="mt-2.5 min-h-[312px]">
        {options ? (
          <div className="grid grid-cols-4 content-start gap-2">
            {options.list.map((id) => {
              const on = value[options.key] === id;
              const label = t(`avatar.${options.key}.${id}` as "avatar.hair.bob");
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  aria-label={label}
                  onClick={() => set({ [options.key]: id } as Partial<AvatarConfig>)}
                  className={`flex h-[72px] flex-col items-center justify-end overflow-hidden rounded-[14px] pb-[3px] transition-colors ${on ? "bg-sky-soft shadow-[inset_0_0_0_2px_var(--color-ink)]" : "bg-white shadow-[inset_0_0_0_1.5px_var(--color-rule-strong)]"}`}
                >
                  <AvatarArt config={{ ...value, [options.key]: id } as AvatarConfig} size={50} bold />
                  <span className={`max-w-full truncate px-1 text-[14px] leading-[1.2] ${on ? "text-ink" : "text-muted"}`}>{label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          // 이름표 + 색 동그라미를 한 줄에(배경 10·옷 12·머리 9·피부 6개가 7줄로 들어간다)
          <div className="flex flex-col gap-1">
            {groups.map((g) => (
              <div key={g.title} className="flex items-start gap-1">
                <span className={`shrink-0 pt-2.5 text-[17px] ${locale === "en" ? "w-[96px]" : "w-[62px]"}`}>{g.title}</span>
                <div className="flex min-w-0 flex-1 flex-wrap">
                  {g.swatches.map((s) => (
                    <Swatch key={s.id} fill={s.fill} on={s.on} label={s.label} ringBg={ringBg} onPick={s.pick} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
