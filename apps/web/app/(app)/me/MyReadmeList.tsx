"use client";

import type { Locale, PartialCard, Section } from "@readme/core";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/marks";
import { SectionIcon } from "@/components/SectionIcon";
import { TornTape } from "@/components/TornTape";

// 편집기(여덟 가지)는 항목을 펼칠 때만 쓴다. 따로 받아 오고, 목록이 뜨면 바로 미리 받아 둬서 누를 때 기다리지 않게
const loadForm = () => import("@/components/editors/SectionForm").then((m) => ({ default: m.SectionForm }));
const SectionForm = lazy(loadForm);

/** 편집기를 받는 동안 자리(펼친 모양과 비슷한 높이, 글자 없음) */
function FormPlaceholder() {
  return (
    <div aria-hidden="true" className="flex min-h-[198px] flex-col gap-3 pt-1">
      <div className="h-12 rounded-2xl bg-fill" />
      <div className="h-12 w-2/3 rounded-2xl bg-fill" />
      <div className="h-12 w-1/2 rounded-2xl bg-fill" />
    </div>
  );
}

export interface MyRow {
  section: Section;
  title: string;
  /** 제목 아래: 이 항목에서 무엇을 고르고 적을 수 있는지(적은 값은 보이지 않는다) */
  sub: string;
}

/**
 * 내 리드미 항목 목록. 누르면 화면을 옮기지 않고 그 항목 아래에 편집기를 펼친다(한 번에 하나).
 * 펼친 항목은 머리(주제와 설명)가 화면 위에 붙어 고치는 동안 계속 보인다. 고치면 바로 저장된다(저장 버튼 없음).
 * 펼친 항목은 주소(?open=)에도 적어 두어, 저장 후 다시 그려지거나 새로고침·뒤로가기를 해도 펼친 채로 있다.
 */
export function MyReadmeList({
  rows,
  card,
  locale,
  initialOpen = null,
  contactId,
  stickyTop = "var(--sat)",
  stickTo,
}: {
  rows: MyRow[];
  card: PartialCard;
  locale: Locale;
  initialOpen?: Section | null;
  /** 있으면 그 사람 기록에 저장(사람 정보 수정 화면) */
  contactId?: string;
  /** 펼친 항목 머리가 붙을 위치(기본: 상태바 바로 아래) */
  stickyTop?: string;
  /** 저장 상태 줄이 붙을 아래 위치(기본: 하단 메뉴·키보드 바로 위) */
  stickTo?: string;
}) {
  const [open, setOpen] = useState<Section | null>(initialOpen);
  const items = useRef<Partial<Record<Section, HTMLLIElement | null>>>({});
  const first = useRef(true);

  // 편집기 조각을 한가할 때 미리 받아 둔다
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    idle(() => void loadForm());
  }, []);

  // 연 항목 머리를 화면 맨 위로(위에 펼쳐 있던 항목이 접힌 뒤 자리에서) + 주소에 적기
  useEffect(() => {
    const url = new URL(window.location.href);
    if (open) url.searchParams.set("open", open);
    else url.searchParams.delete("open");
    // 첫 인자는 null이어야 Next 라우터가 바뀐 주소를 안다(저장 후 다시 그릴 때 ?open=이 지워지지 않게)
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (open && !(first.current && !initialOpen)) items.current[open]?.scrollIntoView({ behavior: first.current ? "auto" : "smooth", block: "start" });
    first.current = false;
  }, [open, initialOpen]);

  return (
    <div className="relative mx-4 mt-6">
    <ul className="card flex flex-col px-3.5 py-1.5">
      {rows.map(({ section, title, sub }) => {
        const isOpen = open === section;
        return (
          <li
            key={section}
            ref={(el) => {
              items.current[section] = el;
            }}
            className="border-t border-dashed border-ink/30 first:border-t-0"
            style={{ scrollMarginTop: stickyTop }}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`edit-${section}`}
              onClick={() => setOpen(isOpen ? null : section)}
              className={`flex min-h-12 w-full items-center gap-2.5 py-1.5 text-left ${isOpen ? "sticky z-20 bg-white" : ""}`}
              style={isOpen ? { top: stickyTop } : undefined}
            >
              <SectionIcon section={section} size={36} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={`hand text-[18.6px] leading-[1.1] ${section === "safety" ? "text-red" : ""}`}>{title}</span>
                <span className="text-[10.8px] text-muted">{sub}</span>
              </span>
              <Icon name="chevron" size={15} strokeWidth={2} className={`shrink-0 text-muted ${isOpen ? "-rotate-90" : ""}`} />
            </button>
            {isOpen ? (
              <div id={`edit-${section}`} className="pt-3">
                <Suspense fallback={<FormPlaceholder />}>
                  <SectionForm section={section} initial={card[section] ?? null} locale={locale} contactId={contactId} inline autoSave stickTo={stickTo} />
                </Suspense>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
    <TornTape color="pink" w={72} h={22} rotate={-6} className="-top-3 left-5" />
    <TornTape color="mint" w={60} h={18} rotate={5} className="-bottom-2.5 right-[19.8px]" />
    </div>
  );
}
