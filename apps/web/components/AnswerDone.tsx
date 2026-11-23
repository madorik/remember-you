import { SECTIONS_BY_IMPORTANCE, type Section } from "@readme/core";
import { TornTape } from "./TornTape";
import { Icon } from "./marks";
import { Mascot } from "./Mascot";
import { SectionIcon } from "./SectionIcon";

type IconName = Parameters<typeof Icon>[0]["name"];

/**
 * 물어보기에 답한 뒤 화면(마음이 전해졌어요): 하트 든 캐릭터 · 보낸 항목 타일 · 리드미를 쓰면 되는 것(로그인 안 한 사람만) · 아래 고정 버튼(children)
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
  const h2 = "hand scribble text-[24px] leading-none";
  return (
    <div className="flex flex-1 flex-col">
      <section className="card relative mx-4 mt-3 flex flex-col items-center px-5 pb-6 pt-5 text-center">
        <figure className="relative m-0 rotate-[3deg] border-[1.5px] border-ink bg-white px-2 pb-[18px] pt-2">
          <TornTape color="pink" w={62} h={22} rotate={-8} className="-top-4 left-7" />
          <span className="flex h-[95px] w-[95px] items-center justify-center overflow-hidden bg-white">
            <Mascot pose={4} size={80} />
          </span>
        </figure>
        <h1 className="mt-4 text-[36px] leading-[1.1]">
          <span className="hl">{title}</span>
        </h1>
        <p className="mt-3 text-[14px] leading-[1.45]">{body}</p>
      </section>

      {shown.length ? (
        <section className="card relative mx-4 mt-3.5 px-3.5 pb-3.5 pt-2.5">
          <div className="flex min-h-[34px] items-center">
            <h2 className={h2} style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
              {labels.sentTitle}
            </h2>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {shown.map((s) => (
              <li key={s} className="relative flex min-h-[48px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink bg-white py-1.5 pl-2.5 pr-2.5 text-[13px] leading-[1.2]">
                <SectionIcon section={s} size={28} outline />
                <span className="min-w-0 flex-1">{labels.topic(s)}</span>
                <Icon name="check" size={15} strokeWidth={2.4} className="shrink-0 text-[#5dbb9a]" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {perks.length ? (
        <section className="card relative mx-4 mt-3.5 px-3.5 pb-1 pt-2.5">
          <div className="flex min-h-[34px] items-center">
            <h2 className={h2}>{labels.perksTitle}</h2>
          </div>
          <ul className="mt-1.5 flex flex-col">
            {perks.map((p) => (
              <li key={p.text} className="hand-written border-b border-[#d5e1f3] text-[24px] leading-[30px] last:border-b-0">
                {p.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {alert ? (
          <p role="alert" className="px-1 text-[14px] text-red">
            {alert}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
