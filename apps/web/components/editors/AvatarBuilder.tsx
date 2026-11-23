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
import { Avatar, AvatarArt, avatarBackground } from "../Avatar";
import { TornTape } from "../TornTape";
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

/** 색 동그라미: 누르는 칸은 40×44, 동그라미는 28. 골랐을 땐 흰 틈을 두고 남색 테두리 */
function Swatch({ fill, on, label, ringBg, onPick }: { fill: string; on: boolean; label: string; ringBg: string; onPick: () => void }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onPick} className="flex h-[37.8px] w-10 items-center justify-center">
      <span
        className="h-7 w-7 rounded-full transition-shadow"
        style={{ background: fill, boxShadow: on ? `inset 0 0 0 1.5px rgba(31,35,64,0.14), 0 0 0 2.5px ${ringBg}, 0 0 0 4.5px var(--color-ink)` : "inset 0 0 0 1.5px rgba(31,35,64,0.14)" }}
      />
    </button>
  );
}

/** 이름 칸(폼 필드 name="name"): 미리보기 오른쪽 위. 위에 작은 라벨, 칸은 점선 밑줄 + 손글씨(사람이 적은 글) */
export function NameField({
  label,
  value,
  required = true,
  placeholder,
  autoFocus = false,
  invalid = false,
}: {
  label: string;
  value: string;
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10.8px] text-muted">{label}</span>
      <input
        name="name"
        defaultValue={value}
        required={required}
        maxLength={40}
        autoFocus={autoFocus}
        placeholder={placeholder ?? label}
        aria-invalid={invalid || undefined}
        className="hand-written h-10 w-full min-w-0 border-0 border-b border-dashed border-ink/30 bg-transparent p-0 text-[20.3px] outline-none placeholder:font-sans placeholder:text-[16px] placeholder:text-muted aria-invalid:border-red"
      />
    </label>
  );
}

/**
 * 캐릭터 만들기(플래너 시안, 흰 카드 하나): 작은 폴라로이드 미리보기(오른쪽 아래에 망고 주사위 단추 '아무거나') + 오른쪽에 이름 칸 → 머리·얼굴·옷·소품·안경·색깔 탭 → 4열 고르기 칸.
 * paper: 온보딩에서 쓰는지 — 카드 윗변에 망고 테이프를 붙인다
 */
export function AvatarBuilder({
  value,
  onChange,
  locale,
  side,
  paper = false,
}: {
  value: AvatarConfig;
  onChange: (v: AvatarConfig) => void;
  locale: Locale;
  /** 미리보기 오른쪽에 놓는 칸들(NameField, 사람 추가는 폴더 칸까지) */
  side: React.ReactNode;
  /** 예전 호출 호환용(테이프 색은 시안대로 정해져 있다) */
  tape?: unknown;
  paper?: boolean;
}) {
  const t = useT(locale);
  const [tab, setTab] = useState<Tab>("hair");
  const set = (patch: Partial<AvatarConfig>) => onChange({ ...value, ...patch });
  const ringBg = "#ffffff";
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
    <div className="card relative flex flex-col p-3.5">
      {paper ? <TornTape color="mango" w={72} h={22} rotate={-4} className="-top-3 left-[40%]" /> : null}
      <div className="flex items-center gap-4 px-1 pt-1.5">
        <div className="relative shrink-0">
          <span className="relative block -rotate-3 border border-edge bg-white px-1.5 pb-[21.6px] pt-1.5">
            <span className="flex h-[144px] w-[144px] items-center justify-center overflow-hidden bg-[#FFF0C9]">
              <span className="block overflow-hidden rounded-full shadow-[0_0_0_3px_#1F2340]" style={{ width: 128, height: 128, background: avatarBackground(value) }}>
                <AvatarArt config={value} size={142} />
              </span>
            </span>
            <TornTape color="pink" w={72} h={21.6} rotate={-8} className="-top-3 left-8" />
          </span>
          {/* 아무거나: 망고 동그라미 주사위. 누르면 머리·옷·색을 아무렇게나 바꾼다 */}
          <button
            type="button"
            aria-label={t("avatar.shuffle")}
            onClick={shuffle}
            className="absolute -bottom-2 -right-2.5 flex h-10 w-10 before:absolute before:-inset-[3.6px] items-center justify-center rounded-full border border-edge bg-sky shadow-[2px_2px_0_#1F2340] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1F2340]"
          >
            <svg aria-hidden="true" width="19.8" height="19.8" viewBox="0 0 24 24" fill="none" stroke="#1F2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="3.5" />
              <circle cx="9" cy="9" r="1.2" fill="#1F2340" />
              <circle cx="15" cy="15" r="1.2" fill="#1F2340" />
              <circle cx="15" cy="9" r="1.2" fill="#1F2340" />
              <circle cx="9" cy="15" r="1.2" fill="#1F2340" />
            </svg>
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">{side}</div>
      </div>

      {/* 여섯 칸: 고른 탭은 손글씨 + 밑줄 낙서, 나머지는 흐린 글 */}
      <div role="tablist" aria-label={t("avatar.parts")} className="mt-3.5 grid grid-cols-[repeat(6,minmax(0,1fr))] border-b border-dashed border-ink/30">
        {TABS.map((k) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(k)}
              className={`flex h-[34.2px] items-center justify-center whitespace-nowrap ${on ? "hand text-[17.8px] text-ink" : "text-[11.3px] text-muted"}`}
            >
              {on ? <span className="scribble leading-none">{t(TAB_KEY[k])}</span> : t(TAB_KEY[k])}
            </button>
          );
        })}
      </div>

      {/* 칸 높이를 고정해 탭을 옮겨도 아래 단추·메뉴가 흔들리지 않게(가장 많은 머리·소품 13개 = 한 줄에 3개씩 5줄, 색깔은 7줄) */}
      <div role="tabpanel" className="mt-3 min-h-[540px]">
        {options ? (
          <div className="grid grid-cols-3 content-start gap-2.5">
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
                  className={`flex h-[100px] flex-col items-center gap-1 overflow-hidden rounded-xl border border-edge pt-2 text-[12.6px] transition-colors ${on ? "bg-sky-soft shadow-[inset_0_0_0_1px_#1F2340]" : "bg-white"}`}
                >
                  <Avatar config={{ ...value, [options.key]: id } as AvatarConfig} size={64} label={label} decorative />
                  <span className="max-w-full truncate px-1 leading-[1.2]">{label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          // 이름표 + 색 동그라미를 한 줄에(배경 10·옷 12·머리 9·피부 6개가 7줄로 들어간다)
          <div className="flex flex-col gap-1">
            {groups.map((g) => (
              <div key={g.title} className="flex items-start gap-1">
                <span className={`shrink-0 pt-3 text-[12.6px] ${locale === "en" ? "w-[75.6px]" : "w-[46.8px]"}`}>{g.title}</span>
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
