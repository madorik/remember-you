"use client";

import { PETS_MAX, PET_KINDS, type Locale, type Pet, type PetsData } from "@readme/core";
import { useState } from "react";
import { Icon } from "../marks";
import { useLatest, useUndoToast } from "../UndoToast";
import { ADD_PILL, CircleOption, SectionHeading, TextField, joinList, splitList, useT } from "./shared";

const blank = (): Pet => ({ name: "", kind: null, breed: "", treats: [], note: "" });

/** 반려동물: 마리마다 이름 · 종류 · 품종 · 좋아하는 간식·장난감 · 메모. 없으면 '키우지 않아요' */
export function PetsEditor({ value, onChange, locale }: { value: PetsData; onChange: (v: PetsData) => void; locale: Locale }) {
  const t = useT(locale);
  const pets = value.pets ?? [];
  // 간식 칸은 쉼표를 치는 동안 글 그대로 둔다(나눈 목록은 따로 저장)
  const [treats, setTreats] = useState<string[]>(() => pets.map((p) => joinList(p.treats)));
  const set = (i: number, patch: Partial<Pet>) => onChange({ pets: pets.map((p, j) => (j === i ? { ...p, ...patch } : p)), none: false });
  const latest = useLatest({ value, onChange });
  const undo = useUndoToast(locale);
  // 지우기: 바로 지우고, 5초 안에 되돌리면 그때의 목록 제자리에 다시 넣는다
  const remove = (i: number) => {
    const gone = pets[i]!;
    const goneTreats = treats[i] ?? "";
    onChange({ pets: pets.filter((_, j) => j !== i), none: false });
    setTreats((x) => x.filter((_, j) => j !== i));
    undo.show({
      onUndo: () => {
        const cur = latest.current.value.pets ?? [];
        const at = Math.min(i, cur.length);
        latest.current.onChange({ pets: [...cur.slice(0, at), gone, ...cur.slice(at)], none: false });
        setTreats((x) => [...x.slice(0, at), goneTreats, ...x.slice(at)]);
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {!pets.length ? (
        <div className="flex flex-wrap gap-2">
          <CircleOption label={t("pets.none")} color="ink" on={value.none} onToggle={() => onChange({ pets: [], none: !value.none })} />
        </div>
      ) : null}
      {pets.map((p, i) => (
        <section key={i} className="flex flex-col gap-4 border-t-[1.5px] border-dashed border-ink/20 pt-4">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField label={t("pets.name")} value={p.name} onChange={(v) => set(i, { name: v })} placeholder={t("pets.namePlaceholder")} />
            </div>
            <button
              type="button"
              aria-label={t("common.delete")}
              onClick={() => remove(i)}
              className="flex h-12 w-11 shrink-0 items-center justify-center text-muted"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <SectionHeading>{t("pets.kind")}</SectionHeading>
            <div className="flex flex-wrap gap-2 pt-1">
              {PET_KINDS.map((k) => (
                <CircleOption key={k.code} label={k.label[locale]} color="ink" on={p.kind === k.code} onToggle={() => set(i, { kind: p.kind === k.code ? null : k.code })} textClass="whitespace-nowrap" />
              ))}
            </div>
          </div>
          <TextField label={t("pets.breed")} value={p.breed} onChange={(v) => set(i, { breed: v })} placeholder={t("pets.breedPlaceholder")} />
          <TextField
            label={t("pets.treats")}
            value={treats[i] ?? ""}
            onChange={(v) => {
              setTreats((x) => x.map((s, j) => (j === i ? v : s)));
              set(i, { treats: splitList(v) });
            }}
            placeholder={t("pets.treatsPlaceholder")}
          />
          <TextField label={t("pets.note")} value={p.note} onChange={(v) => set(i, { note: v })} placeholder={t("pets.notePlaceholder")} />
        </section>
      ))}
      {pets.length < PETS_MAX ? (
        <button
          type="button"
          onClick={() => {
            onChange({ pets: [...pets, blank()], none: false });
            setTreats((x) => [...x, ""]);
          }}
          className={ADD_PILL}
        >
          <Icon name="plus" size={17} />
          {t("pets.add")}
        </button>
      ) : null}
      {undo.toast}
    </div>
  );
}
