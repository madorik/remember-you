import { SECTIONS_BY_IMPORTANCE, type Section } from "@readme/core";
import { Heart, MarginLine, Polaroid, Squiggle, Star, Tape, SKY_STAR } from "./diary";
import { Icon } from "./marks";
import { Mascot } from "./Mascot";
import { SECTION_TILE, SectionIcon } from "./SectionIcon";

type IconName = Parameters<typeof Icon>[0]["name"];

/**
 * 물어보기에 답한 뒤 화면: 축하 머리 · 보낸 항목 타일 · 리드미를 쓰면 되는 것(로그인 안 한 사람만) · 아래 고정 버튼(children)
 */
export function AnswerDone({
  title,
  body,
  topics,
  labels,
  perks,
  alert,
  children,
}: {
  title: string;
  body: string;
  topics: Section[];
  labels: { sentTitle: string; topic: (s: Section) => string; perksTitle: string };
  /** 리드미를 쓰면 되는 것. 로그인한 사람에게는 비운다 */
  perks: { icon: IconName; text: string }[];
  alert?: string;
  children: React.ReactNode;
}) {
  const shown = SECTIONS_BY_IMPORTANCE.filter((s) => topics.includes(s));
  return (
    <div className="flex flex-1 flex-col">
      <section className="card relative mx-4 mt-[18px] flex flex-col items-center px-5 pb-6 pt-[30px] text-center [transform:rotate(-0.5deg)]">
        <Tape color="mango" w={108} h={26} rotate={-3} alpha={0.62} className="-top-[13px] left-1/2 -ml-[54px]" />
        <Polaroid photo={96} rotate={3} className="!px-2 !pb-[7px] !pt-2">
          <Mascot pose={4} size={80} />
        </Polaroid>
        <h1 className="hl mt-[18px] text-[32px] leading-[1.2]">{title}</h1>
        <p className="mt-2.5 text-[20px] leading-[1.45] text-muted">{body}</p>
        <Heart size={30} rotate={-14} className="-left-[9px] top-[70px]" />
        <Star size={24} rotate={14} className="right-[22px] top-[30px]" />
        <Squiggle w={58} className="-bottom-[7px] right-[26px]" />
      </section>

      {shown.length ? (
        <section className="card relative mx-4 mt-5 px-3.5 pb-4 pt-[18px]">
          <h2 className="px-1 text-[21px]">{labels.sentTitle}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {shown.map((s) => (
              <li key={s} className="relative flex min-h-[58px] items-center gap-2 rounded-xl py-1.5 pl-2 pr-6 text-[17px] leading-[1.2]" style={{ background: SECTION_TILE[s] }}>
                <SectionIcon section={s} size={32} bare />
                <span className="min-w-0 flex-1">{labels.topic(s)}</span>
                <span aria-hidden="true" className="absolute right-[5px] top-[5px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-sky text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
                  <Icon name="check" size={11} strokeWidth={3.4} />
                </span>
              </li>
            ))}
          </ul>
          <Tape color="mint" w={58} h={20} rotate={-34} alpha={0.6} className="-bottom-1 -right-2.5" />
        </section>
      ) : null}

      {perks.length ? (
        <section className="card ruled relative mx-4 mt-5 pb-2 pl-10 pr-3.5 pt-[18px] [background-position:0_16px]">
          <MarginLine left={26} />
          <Tape color="pink" w={58} h={20} rotate={-34} alpha={0.6} className="-left-2.5 -top-1.5" />
          <h2 className="px-1 text-[21px]">{labels.perksTitle}</h2>
          <ul className="mt-1.5 flex flex-col">
            {perks.map((p) => (
              <li key={p.text} className="flex min-h-14 items-center gap-3 text-[19px] leading-[1.3]">
                <span aria-hidden="true" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#d3e9ff] shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
                  <Icon name={p.icon} size={20} strokeWidth={1.9} />
                </span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
          <Star size={22} rotate={12} color={SKY_STAR} className="-right-1 -top-2.5" />
        </section>
      ) : null}

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {alert ? (
          <p role="alert" className="px-1 text-[17px] text-red">
            {alert}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
