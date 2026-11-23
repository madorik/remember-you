"use client";

import { SECTIONS, SECTIONS_BY_IMPORTANCE, type AvatarConfig, type Locale, type Section } from "@readme/core";
import { useActionState, useEffect, useRef, useState } from "react";
import { createRequest, type InviteState } from "@/app/actions/request";
import { leaveTour, trackTour } from "@/app/actions/tour";
import { useT } from "@/components/editors/shared";
import { Avatar } from "@/components/Avatar";
import { Heart, MarginLine, Polaroid, Sparkle, Squiggle, SKY_STAR, Star, Tape } from "@/components/diary";
import { CheckGlyph, Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { SectionIcon } from "@/components/SectionIcon";
import { TagChip } from "@/components/PersonRow";
import { LinkField, ShareButtons } from "@/components/ShareButtons";
import { matchesPerson } from "@/lib/search";

const INITIAL: InviteState = { url: null, text: "", error: null };

export interface AskPerson {
  id: string;
  name: string;
  /** 내가 붙인 태그(부르는 말). 이름과 같거나 없으면 "" */
  tag: string;
  /** 부르는 이름(태그가 있으면 태그) */
  label: string;
  avatar: AvatarConfig | null;
  /** 아직 안 적힌 항목(고르면 이걸 먼저 묻는다) */
  missing: Section[];
}

type Who = { kind: "person"; person: AskPerson } | { kind: "new"; name: string };

/**
 * 누구에게: 주소록 사람을 이름·태그로 찾아 고르면 그 사람에게 묻고 답은 그 사람 기록에 들어간다(내 기록에 적힌 값은 서버가 미리 채워 보낸다).
 * 없는 사람이면 적은 이름으로 새로. fixed(사람 화면에서 왔을 때)면 그 사람으로 정해져 있다
 */
export function RequestForm({ locale, people, fixed, initialName, defaults, xmas = false, initialMessage = "", focus = null, tour = false }: { locale: Locale; people: AskPerson[]; fixed: string | null; initialName: string; defaults: Section[]; xmas?: boolean; initialMessage?: string; focus?: Section | null; tour?: boolean }) {
  const t = useT(locale);
  // 오늘의 질문에서 온 물어보기(focus)는 그 질문이 속한 항목 하나만 묻는다
  const topicsFor = (p: AskPerson | null) => (focus ? [focus] : !xmas && p && p.missing.length ? p.missing : defaults);
  const fixedPerson = fixed ? (people.find((p) => p.id === fixed) ?? null) : null;
  const [who, setWho] = useState<Who | null>(fixedPerson ? { kind: "person", person: fixedPerson } : initialName ? { kind: "new", name: initialName } : null);
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState<Section[]>(topicsFor(fixedPerson));
  const [message, setMessage] = useState(initialMessage);
  const [state, action, pending] = useActionState(createRequest, INITIAL);
  // 가입 직후 체험이면: 이 화면을 봤다는 기록(한 번), 링크를 만들면 그 기록(누구에게: 있는 사람/새로)
  const seen = useRef(false);
  useEffect(() => {
    if (!tour || seen.current) return;
    seen.current = true;
    void trackTour("view", "ask");
  }, [tour]);
  const made = useRef(false);
  useEffect(() => {
    if (!tour || !state.url || made.current) return;
    made.current = true;
    void trackTour("ask", who?.kind === "person" ? "person" : "new");
  }, [tour, state.url, who]);
  const name = who ? (who.kind === "person" ? who.person.label : who.name) : "";
  const q = query.replace(/\s+/g, " ").trim();
  const matches = (q ? people.filter((p) => matchesPerson(q, p.name, p.tag)) : people).slice(0, 12);
  const exact = people.some((p) => [p.name, p.tag, p.label].some((x) => x && x.replace(/\s+/g, "") === q.replace(/\s+/g, "")));
  const choose = (p: AskPerson) => {
    setWho({ kind: "person", person: p });
    setTopics(topicsFor(p));
  };
  const chooseNew = () => {
    setWho({ kind: "new", name: q.slice(0, 40) });
    setTopics(defaults);
  };
  // 이름 칸에서 엔터: 하나만 걸렸으면 그 사람, 아니면 지금 적은 이름으로 새로(아래 '새로' 칩과 같다). 한글 조합 중 엔터는 글자를 끝내는 것뿐
  const onNameKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (matches.length === 1) choose(matches[0]!);
    else if (q && !exact) chooseNew();
    else {
      const same = matches.find((p) => [p.name, p.tag, p.label].some((x) => x && x.replace(/\s+/g, "") === q.replace(/\s+/g, "")));
      if (same) choose(same);
    }
  };
  const shareText = message.trim() ? `${state.text}\n${message.trim()}` : state.text;

  const topicLabel = (x: Section) => t(`request.topic.${x}` as "request.topic.dates");

  // 링크가 만들어지면: 누구에게·무엇을 묻는지와 보낼 메시지를 보여 주고, 아래에서 보낸다
  if (state.url) {
    return (
      <div className="flex flex-1 flex-col">
        <section className="card relative mx-4 mt-[22px] -rotate-[0.5deg] px-5 pb-[22px] pt-[30px]">
          <Tape color="mango" w={108} h={26} rotate={-3} alpha={0.62} className="-top-[13px] left-1/2 -ml-[54px]" />
          <div className="flex items-center gap-[18px]">
            <Polaroid
              photo={80}
              rotate={-4}
              caption={<span className="max-w-[80px] truncate">{name.trim()}</span>}
            >
              {who?.kind === "person" ? (
                <Avatar config={who.person.avatar} size={74} label={who.person.label} decorative />
              ) : (
                <Mascot pose={6} size={68} />
              )}
            </Polaroid>
            <h2 className="min-w-0 text-[26px] leading-[1.3]">{t("request.ready", { name: name.trim() })}</h2>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2">
            {SECTIONS_BY_IMPORTANCE.filter((x) => topics.includes(x)).map((x) => (
              <li key={x} className="flex h-[38px] items-center gap-1.5 rounded-full bg-white pl-[5px] pr-3.5 text-[17px] shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
                <SectionIcon section={x} size={28} round />
                {topicLabel(x)}
              </li>
            ))}
          </ul>
          <Heart size={28} rotate={16} className="-right-2 top-[26px]" />
          <Star size={20} rotate={-12} className="-left-[7px] bottom-6" />
        </section>
        <section className="card ruled relative mx-4 mt-[22px] flex flex-col pb-5 pl-10 pr-5 pt-[22px] [background-position:0_26px]">
          <MarginLine left={26} />
          <Tape color="mint" w={74} h={22} rotate={-8} alpha={0.55} vertical className="-top-2.5 left-3.5" />
          <h3 className="pb-3 text-[18px] leading-[26px] text-muted">{t("request.message")}</h3>
          <p className="whitespace-pre-line rounded-[6px_20px_20px_20px] bg-[#d3e9ff] px-4 pb-[15px] pt-3.5 text-[20px] leading-[1.5]">{shareText}</p>
          <div className="pt-4">
            <LinkField url={state.url} label={t("common.copyLink")} />
          </div>
        </section>
        <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
          <ShareButtons locale={locale} url={state.url} text={shareText} sendLabel={t("request.send")} />
          {/* 체험의 끝: 링크를 만들었으면 시작하기로 마치고 홈으로 */}
          {tour ? (
            <form action={leaveTour}>
              <input type="hidden" name="kind" value="done" />
              <input type="hidden" name="source" value="ask" />
              <button className="btn-outline btn-outline-lift w-full">{t("tour.start")}</button>
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="sections" value={JSON.stringify(topics)} />
      {who?.kind === "person" ? <input type="hidden" name="to" value={who.person.id} /> : null}
      <input type="hidden" name="name" value={name} />

      {fixed ? null : (
        <section className="card relative mx-4 mt-5 flex flex-col px-5 pb-5 pt-[22px]">
          <Tape color="mango" w={100} h={24} rotate={-3} alpha={0.62} className="-top-[11px] left-1/2 -ml-[50px]" />
          <label htmlFor="request-who" className="pb-3 text-[21px] leading-[26px]">
            {t("request.who")}
          </label>
          {who ? (
            <div className="flex items-center gap-1.5">
              <span className="flex h-[54px] min-w-0 items-center gap-2 rounded-full bg-[#fff0c9] pl-1.5 pr-5 text-[22px] shadow-[inset_0_0_0_1.5px_var(--color-ink),0_3px_0_var(--color-mango-deep)]">
                {who.kind === "person" ? (
                  <Avatar config={who.person.avatar} size={40} label={who.person.label} />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                    <Icon name="personAdd" size={18} strokeWidth={2} />
                  </span>
                )}
                <span className="truncate">{name}</span>
                {who.kind === "new" ? <TagChip>{t("voice.newPerson")}</TagChip> : null}
              </span>
              <button
                type="button"
                aria-label={t("request.whoAgain")}
                onClick={() => {
                  setWho(null);
                  setQuery("");
                  setTopics(defaults);
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
              >
                <Icon name="close" size={18} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="pointer-events-none absolute left-[15px] top-4 text-muted">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-4-4" />
                </svg>
                <input
                  id="request-who"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onNameKey}
                  maxLength={40}
                  enterKeyHint="go"
                  placeholder={t("people.search")}
                  className="field !pl-[44px] [&::-webkit-search-cancel-button]:appearance-none"
                />
              </div>
              {matches.length || (q && !exact) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {matches.map((p) => (
                    <button key={p.id} type="button" onClick={() => choose(p)} className="flex h-12 items-center gap-1.5 rounded-full bg-white pl-[5px] pr-4 text-[19px] shadow-[inset_0_0_0_1.5px_var(--color-edge)]">
                      <Avatar config={p.avatar} size={36} label={p.label} />
                      {p.label}
                    </button>
                  ))}
                  {q && !exact ? (
                    <button type="button" onClick={chooseNew} className="flex h-12 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-ink pl-3 pr-3.5 text-[19px] text-accent">
                      <Icon name="personAdd" size={17} strokeWidth={2} />
                      {q}
                      <TagChip>{t("voice.newPerson")}</TagChip>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
          <Heart size={26} rotate={16} className="-right-2 top-[18px]" />
        </section>
      )}

      <section className={`card relative mx-4 px-4 py-[18px] ${fixed ? "mt-5" : "mt-4"}`}>
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[21px]">{t("request.topics")}</h2>
          <span className="num text-[18px] text-muted">{topics.length}</span>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-x-2 gap-y-2.5 pb-[3px]">
          {SECTIONS_BY_IMPORTANCE.map((x) => {
            const on = topics.includes(x);
            return (
              <button
                key={x}
                type="button"
                aria-pressed={on}
                onClick={() => setTopics(on ? topics.filter((y) => y !== x) : SECTIONS.filter((y) => y === x || topics.includes(y)))}
                className={`relative flex min-h-[60px] items-center gap-2 rounded-[14px] py-2 pl-2 pr-2.5 text-left transition-shadow ${on ? "bg-sky-soft shadow-[inset_0_0_0_1.5px_var(--color-ink),0_3px_0_var(--color-mango-deep)]" : "bg-white shadow-[inset_0_0_0_1.5px_var(--color-ink)]"}`}
              >
                <SectionIcon section={x} size={36} />
                <span className="min-w-0 flex-1 text-[19px] leading-[1.2]">{topicLabel(x)}</span>
                {on ? (
                  <span aria-hidden="true" className="absolute -right-[5px] -top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-sky text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
                    <CheckGlyph size={13} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <Star size={20} rotate={-12} color={SKY_STAR} className="-left-[7px] top-[22px]" />
        <Squiggle w={54} width={2.4} className="-bottom-2 right-[30px]" />
      </section>

      <section className="card ruled relative mx-4 mt-4 flex flex-col pb-5 pl-10 pr-5 pt-[22px] [background-position:0_26px]">
        <MarginLine left={26} />
        <Tape color="mint" w={74} h={22} rotate={-8} alpha={0.55} vertical className="-top-2.5 left-3.5" />
        <label htmlFor="request-message" className="mb-2.5 text-[21px] leading-[26px]">
          {t("request.message")}
        </label>
        <textarea id="request-message" name="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={300} className="h-24 resize-none border-0 bg-transparent p-0 text-[20px] leading-8 outline-none" />
        <Star size={22} rotate={12} className="-right-1.5 bottom-[26px]" />
        <Sparkle size={18} className="right-[30px] top-[18px]" />
      </section>

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {state.error ? (
          <p role="alert" className="px-1 text-[17px] text-red">
            {t(state.error === "pickOne" ? "request.pickOne" : name.trim() ? "common.error" : "request.needName")}
          </p>
        ) : null}
        <button disabled={pending || !topics.length || !name.trim()} className="btn-primary w-full">
          {t("request.make")}
        </button>
      </div>
    </form>
  );
}
