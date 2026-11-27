import { SECTIONS_BY_IMPORTANCE, type Locale, type PartialCard, type Section, type YMD } from "@readme/core";
import Link from "@/components/AppLink";
import { Icon } from "@/components/marks";
import { SectionBody } from "@/components/SectionBody";
import { SectionIcon } from "@/components/SectionIcon";
import { TornTape } from "@/components/TornTape";
import type { T } from "@/lib/i18n";

/** 적어 둔 항목만(중요한 순서)과 그 풀 본문. 생일·기념일도 이 목록의 첫 칸 */
export function filledSections({ card, today, locale, t }: { card: PartialCard; today: YMD; locale: Locale; t: T }) {
  return SECTIONS_BY_IMPORTANCE.map((section) => ({ section, body: SectionBody({ section, card, today, locale, t, variant: "rich" }) })).filter((x) => x.body != null);
}

/**
 * 사람 화면의 '기억해 둔 것'과 나 화면의 '나에 대한 기록'이 같이 쓰는 목록.
 * 적어 둔 항목마다 제목 줄(누르면 그 항목이 펼쳐진 고치는 화면)과 그 밑에 적어 둔 내용 전부. 연필(수정)은 모든 항목을 고치는 화면
 */
export function RememberedList({
  title,
  filled,
  editHref,
  sectionHref,
  editLabel,
  t,
  empty,
  className = "mt-[19.8px]",
  plain = false,
}: {
  title: string;
  filled: { section: Section; body: React.ReactNode }[];
  /** 연필: 모든 항목을 고치는 화면 */
  editHref: string;
  /** 항목 줄: 그 항목이 펼쳐진 고치는 화면 */
  sectionHref: (section: Section) => string;
  editLabel: string;
  t: T;
  /** 아무것도 적어 두지 않았을 때 */
  empty: React.ReactNode;
  className?: string;
  /** 사람 화면의 바인더 속지 안에 넣는다: 제목 줄·연필·카드 틀·테이프 없이 목록만(같은 항목 모양) */
  plain?: boolean;
}) {
  const list = (
    <ul className="flex flex-col">
      {filled.map(({ section, body }) => (
        <li key={section} className="border-t border-dashed border-ink/30 first:border-t-0">
          <Link href={sectionHref(section)} className="flex min-h-[48.6px] items-center gap-[10.8px] pt-[5.4px]">
            <SectionIcon section={section} size={38} cake={section === "dates"} />
            <span className={`min-w-0 flex-1 text-[16.2px] ${section === "safety" ? "text-red" : ""}`}>{t(`section.${section}` as "section.safety")}</span>
            <Icon name="chevron" size={16} strokeWidth={2} className="shrink-0 text-muted" />
          </Link>
          <div className="pb-[12.6px] pt-[3.6px]">{body}</div>
        </li>
      ))}
    </ul>
  );
  if (plain) return <div className="pb-[7.2px] pt-[5.4px]">{filled.length ? list : <div className="pb-2 pt-3">{empty}</div>}</div>;
  return (
    <section aria-labelledby="mine-title" className={`relative mx-4 flex flex-col ${className}`}>
      <div className="flex h-11 items-center justify-between pl-[7.2px]">
        <h2 id="mine-title" className="text-[23.4px] leading-none">
          {title}
        </h2>
        <Link href={editHref} aria-label={editLabel} className="-mr-0 flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center">
          <Icon name="pencil" size={21} strokeWidth={1.8} />
        </Link>
      </div>
      {filled.length ? (
        <div className="card relative px-4">
          <TornTape color="pink" w={59.4} h={18} rotate={34} className="-right-[9px] -top-[7.2px]" />
          {list}
        </div>
      ) : (
        empty
      )}
    </section>
  );
}
