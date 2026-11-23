"use client";

import { emptySection, type CardData, type Locale, type Section } from "@readme/core";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveSection, type SaveState } from "@/app/actions/card";
import { savePersonSection } from "@/app/actions/people";
import { DatesEditor } from "@/components/editors/DatesEditor";
import { CultureEditor } from "@/components/editors/CultureEditor";
import { FavoritesEditor } from "@/components/editors/FavoritesEditor";
import { GiftsEditor } from "@/components/editors/GiftsEditor";
import { LifeEditor } from "@/components/editors/LifeEditor";
import { PetsEditor } from "@/components/editors/PetsEditor";
import { SafetyEditor } from "@/components/editors/SafetyEditor";
import { SizesEditor } from "@/components/editors/SizesEditor";
import { TasteEditor } from "@/components/editors/TasteEditor";
import { useT } from "@/components/editors/shared";
import { Icon } from "@/components/marks";

// 저장 상태 줄이 붙을 아래 위치: 하단 메뉴가 늘 떠 있으니 그 바로 위, 키보드가 뜨면 키보드 위
export const ABOVE_TAB_BAR = "var(--above-tab)";

/** 지금 글자를 적고 있는 칸인지(이때는 칸을 벗어날 때 저장한다) */
function typingInField(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(el.type);
}

type AutoStatus = "idle" | "saving" | "saved" | "error";

/**
 * 리드미 항목 하나 고치기. contactId가 있으면 내가 직접 적어 둔 그 사람의 카드에, 없으면 내 리드미에 저장한다.
 * inline: 목록 안에서 펼쳐 고칠 때(바깥 여백은 목록이 주고, 상태 줄은 탭 막대 위에 붙는다)
 * autoSave: 저장 버튼 없이 바로 저장. 고르는 것(칩·드롭다운·체크)은 누르면 바로, 적는 칸은 칸을 벗어날 때, 접어서 사라질 때 남은 것도
 */
export function SectionForm<S extends Section>({
  section,
  initial,
  locale,
  contactId,
  inline = false,
  autoSave = false,
  stickTo = ABOVE_TAB_BAR,
  header,
}: {
  section: S;
  initial: CardData[S] | null;
  locale: Locale;
  contactId?: string;
  inline?: boolean;
  autoSave?: boolean;
  /** inline일 때 저장 상태 줄이 붙을 아래 위치(기본: 하단 메뉴·키보드 바로 위) */
  stickTo?: string;
  /** 있으면 form 맨 위에 그린다(머리 줄 + 제목, 안에 SaveButton). 이때 아래 저장 단추는 없다(플래너 시안의 고치기 화면) */
  header?: React.ReactNode;
}) {
  const t = useT(locale);
  const save = contactId ? savePersonSection : saveSection;
  const [value, setValue] = useState<CardData[Section]>(initial ?? emptySection(section));
  const [state, action, pending] = useActionState<SaveState, FormData>(save, { saved: false, error: false });
  const [dirty, setDirty] = useState(false);

  // ── 바로 저장 ──
  const [status, setStatus] = useState<AutoStatus>("idle");
  const latest = useRef(value);
  const unsaved = useRef(false);
  // 저장은 하나씩 차례로(늦게 보낸 것이 먼저 끝나 예전 값으로 덮지 않게)
  const queue = useRef<Promise<void>>(Promise.resolve());
  const flush = useRef<() => void>(() => {});
  useEffect(() => {
    flush.current = () => {
      if (!unsaved.current) return;
      unsaved.current = false;
      const fd = new FormData();
      fd.set("section", section);
      fd.set("data", JSON.stringify(latest.current));
      if (contactId) fd.set("contactId", contactId);
      setStatus("saving");
      queue.current = queue.current.then(async () => {
        const r = await save({ saved: false, error: false }, fd).catch(() => ({ saved: false, error: true }));
        // 그사이 또 고쳤으면 다음 저장이 상태를 정한다
        if (!unsaved.current) setStatus(r.saved ? "saved" : "error");
      });
    };
  });
  // 접혀서 사라질 때 아직 안 보낸 것을 보낸다
  useEffect(() => {
    const f = flush;
    return () => f.current();
  }, []);

  const change = (v: CardData[Section]) => {
    setValue(v);
    setDirty(true);
    if (!autoSave) return;
    latest.current = v;
    unsaved.current = true;
    // 적는 중이면 칸을 벗어날 때(onBlur) 저장, 고른 거면 바로
    if (!typingInField()) flush.current();
  };

  const editors = (
    <div className={inline ? "pt-1" : `card relative mx-4 mt-5 px-3.5 pb-3.5 ${section === "safety" || section === "dates" ? "pt-0.5" : "pt-3"}`}>
      {section === "safety" ? <SafetyEditor value={value as CardData["safety"]} onChange={change} locale={locale} /> : null}
      {section === "taste" ? <TasteEditor value={value as CardData["taste"]} onChange={change} locale={locale} /> : null}
      {section === "sizes" ? <SizesEditor value={value as CardData["sizes"]} onChange={change} locale={locale} /> : null}
      {section === "gifts" ? <GiftsEditor value={value as CardData["gifts"]} onChange={change} locale={locale} forOther={!!contactId} /> : null}
      {section === "dates" ? <DatesEditor value={value as CardData["dates"]} onChange={change} locale={locale} /> : null}
      {section === "favorites" ? <FavoritesEditor value={value as CardData["favorites"]} onChange={change} locale={locale} /> : null}
      {section === "culture" ? <CultureEditor value={value as CardData["culture"]} onChange={change} locale={locale} /> : null}
      {section === "life" ? <LifeEditor value={value as CardData["life"]} onChange={change} locale={locale} /> : null}
      {section === "pets" ? <PetsEditor value={value as CardData["pets"]} onChange={change} locale={locale} /> : null}
    </div>
  );

  if (autoSave) {
    return (
      <div className="flex flex-col" onBlur={() => flush.current()}>
        {editors}
        {/* 저장 상태는 저장 중·저장됨·실패일 때만. 쓰는 법 설명은 두지 않는다 */}
        <div className={`sticky z-10 min-h-11 items-center justify-center bg-paper pb-3 pt-3 ${status === "idle" ? "hidden" : "flex"}`} style={{ bottom: stickTo }}>
          <p role="status" aria-live="polite" className={`flex items-center gap-1 text-[12px] ${status === "error" ? "text-red" : "text-muted"}`}>
            {status === "saving" ? t("me.saving") : null}
            {status === "saved" ? (
              <>
                <Icon name="check" size={14} strokeWidth={2.4} className="text-[#5DBB9A]" />
                {t("me.saved")}
              </>
            ) : null}
            {status === "error" ? t("common.error") : null}
          </p>
          {status === "error" ? (
            <button
              type="button"
              onClick={() => {
                unsaved.current = true;
                flush.current();
              }}
              className="ml-3 flex min-h-11 items-center px-2 text-[14px] text-accent"
            >
              {t("me.retry")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        setDirty(false);
        return action(fd);
      }}
      className={inline ? "flex flex-col" : "flex flex-1 flex-col"}
    >
      <input type="hidden" name="section" value={section} />
      {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}
      <input type="hidden" name="data" value={JSON.stringify(value)} />
      {header}
      {editors}
      {header ? (
        <div className="page-end flex min-h-11 flex-col items-center justify-center gap-1 pt-3">
          {state.saved && !dirty ? (
            <p role="status" className="flex items-center gap-1 text-[12px] text-muted">
              <Icon name="check" size={14} strokeWidth={2.4} className="text-[#5DBB9A]" />
              {t("me.saved")}
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-[13px] text-red">
              {t("common.error")}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className={inline ? "sticky z-10 flex flex-col gap-2 bg-paper pb-3 pt-4" : "bottom-bar mt-auto flex flex-col gap-2 bg-bg px-6 pt-3.5"}
          style={inline ? { bottom: stickTo } : undefined}
        >
          {state.saved && !dirty ? (
            <p role="status" className="text-[15px] text-ok">
              {t("me.saved")}
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-[15px] text-red">
              {t("common.error")}
            </p>
          ) : null}
          <button disabled={pending} className="btn-primary">
            {t("common.save")}
          </button>
        </div>
      )}
    </form>
  );
}
