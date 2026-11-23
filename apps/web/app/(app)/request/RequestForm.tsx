"use client";

import { SECTIONS, SECTIONS_BY_IMPORTANCE, type AvatarConfig, type Locale, type Section } from "@readme/core";
import { useActionState, useEffect, useRef, useState } from "react";
import { createRequest, type InviteState } from "@/app/actions/request";
import { leaveTour, trackTour } from "@/app/actions/tour";
import { useT } from "@/components/editors/shared";
import { Avatar } from "@/components/Avatar";
import { TornTape } from "@/components/TornTape";
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
        <section className="card relative mx-4 mt-9 px-3 py-[18px]">
          <div className="flex items-center gap-[18px]">
            {/* 폴라로이드(시안): 남색 선 + 흰 바탕, 안에 얼굴(없으면 편지 든 캐릭터), 위에 분홍 테이프 */}
            <figure className="relative m-0 flex shrink-0 -rotate-[4deg] flex-col items-center border-[1.5px] border-ink bg-white px-[6px] pb-[18px] pt-[6px]">
              <TornTape color="pink" w={58} h={20} rotate={-6} className="-top-[13px] left-[18px]" />
              <span className="flex h-[98px] w-[98px] items-center justify-center overflow-hidden bg-white">
                {who?.kind === "person" ? <Avatar config={who.person.avatar} size={92} label={who.person.label} decorative /> : <Mascot pose={6} size={84} />}
              </span>
              <figcaption className="sr-only">{name.trim()}</figcaption>
            </figure>
            <div className="min-w-0 flex-1">
              <h2 className="hand-written !font-normal text-[26px] leading-[1.15]">{t("request.ready", { name: name.trim() })}</h2>
              <ul className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1.5">
                {SECTIONS_BY_IMPORTANCE.filter((x) => topics.includes(x)).map((x) => (
                  <li key={x} className="hand flex h-[30px] items-center rounded-full border-[1.5px] border-ink bg-[#e4ecfa] px-2.5 text-[16px] leading-none">
                    {topicLabel(x)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section className="card relative mx-4 mt-9 flex flex-col px-3.5 pb-3.5 pt-2.5">
          <div className="flex min-h-[34px] items-center">
            <h3 className="scribble text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
              {t("request.message")}
            </h3>
          </div>
          <p className="mt-3 whitespace-pre-line rounded-[20px] border-[1.5px] border-ink bg-[#e4ecfa] px-3.5 py-3 text-[14px] leading-[1.55]">
            {state.text}
            {message.trim() ? (
              <>
                {"\n"}
                <span className="hand-written text-[22px] leading-[1.3]">{message.trim()}</span>
              </>
            ) : null}
          </p>
          <div className="pt-3">
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

  const chip = "flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-white pl-[5px] pr-3.5 text-[14px]";
  const h2 = "hand scribble text-[24px] leading-none";
  const mint = { "--scribble": "#5dbb9a" } as React.CSSProperties;

  return (
    <form action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="sections" value={JSON.stringify(topics)} />
      {who?.kind === "person" ? <input type="hidden" name="to" value={who.person.id} /> : null}
      <input type="hidden" name="name" value={name} />

      {fixed ? null : (
        <section className="card relative mx-4 mt-5 flex flex-col px-3.5 pb-3.5 pt-2.5">
          <TornTape color="pink" w={66} h={21} rotate={6} className="-top-3 right-6" />
          <div className="flex min-h-[34px] items-center">
            <label htmlFor="request-who" className={h2} style={mint}>
              {t("request.who")}
            </label>
          </div>
          {who ? (
            <div className="mt-2.5 flex items-center">
              <span className="flex h-9 min-w-0 items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-sky pl-[5px] pr-1 text-[14px]">
                {who.kind === "person" ? (
                  <Avatar config={who.person.avatar} size={26} label={who.person.label} />
                ) : (
                  <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white">
                    <Icon name="personAdd" size={15} strokeWidth={2} />
                  </span>
                )}
                <span className="truncate">{name}</span>
                {who.kind === "new" ? <TagChip>{t("voice.newPerson")}</TagChip> : null}
                <button
                  type="button"
                  aria-label={t("request.whoAgain")}
                  onClick={() => {
                    setWho(null);
                    setQuery("");
                    setTopics(defaults);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center"
                >
                  <Icon name="close" size={14} strokeWidth={2.2} />
                </button>
              </span>
            </div>
          ) : (
            <>
              <div className="relative mt-2.5">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="pointer-events-none absolute left-[15px] top-[17px] text-muted">
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
                  className="field !pl-[42px] [&::-webkit-search-cancel-button]:appearance-none"
                />
              </div>
              {matches.length || (q && !exact) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {matches.map((p) => (
                    <button key={p.id} type="button" onClick={() => choose(p)} className={chip}>
                      <Avatar config={p.avatar} size={26} label={p.label} />
                      {p.label}
                    </button>
                  ))}
                  {q && !exact ? (
                    <button type="button" onClick={chooseNew} className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-ink pl-3 pr-3.5 text-[14px] text-accent">
                      <Icon name="personAdd" size={15} strokeWidth={2} />
                      {q}
                      <TagChip>{t("voice.newPerson")}</TagChip>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </section>
      )}

      <section className={`card relative mx-4 px-3.5 pb-3.5 pt-2.5 ${fixed ? "mt-5" : "mt-3.5"}`}>
        <div className="flex min-h-[34px] items-center justify-between">
          <h2 className={h2} style={mint}>
            {t("request.topics")}
          </h2>
          <span className="hand inline-flex h-[30px] items-center rounded-[10px] border-[1.5px] border-ink bg-sky-soft px-2.5 text-[17px] leading-none">{topics.length}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SECTIONS_BY_IMPORTANCE.map((x) => {
            const on = topics.includes(x);
            return (
              <button
                key={x}
                type="button"
                aria-pressed={on}
                onClick={() => setTopics(on ? topics.filter((y) => y !== x) : SECTIONS.filter((y) => y === x || topics.includes(y)))}
                className={`relative flex h-[58px] flex-col items-center justify-center gap-[3px] rounded-xl text-[12px] leading-none ${on ? "border-[2.5px] border-ink bg-[#e4ecfa]" : "border-[1.5px] border-ink bg-white"}`}
              >
                <SectionIcon section={x} size={30} outline />
                {topicLabel(x)}
                {on ? (
                  <span aria-hidden="true" className="absolute -right-[5px] -top-[7px] flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-sky text-ink">
                    <CheckGlyph size={12} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card relative mx-4 mt-3.5 flex flex-col px-3.5 pb-3 pt-2.5">
        <div className="flex min-h-[34px] items-center">
          <label htmlFor="request-message" className={h2} style={mint}>
            {t("request.message")}
          </label>
        </div>
        <textarea
          id="request-message"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          maxLength={300}
          className="hand-written mt-1 h-[60px] w-full resize-none border-0 bg-transparent p-0 text-[22px] leading-[30px] outline-none [background-image:repeating-linear-gradient(180deg,transparent_0_29px,#d5e1f3_29px_30px)]"
        />
      </section>

      <div className="bottom-bar mt-auto flex flex-col items-end gap-2 bg-bg px-4 pt-4">
        {state.error ? (
          <p role="alert" className="w-full px-1 text-[14px] text-red">
            {t(state.error === "pickOne" ? "request.pickOne" : name.trim() ? "common.error" : "request.needName")}
          </p>
        ) : null}
        <button disabled={pending || !topics.length || !name.trim()} className="inline-flex h-11 items-center gap-[5px] rounded-full border-[1.5px] border-ink bg-sky pl-2.5 pr-3.5 text-[16px] disabled:border-ink/[0.22] disabled:bg-[#e8e1cf] disabled:text-[#5a5f78]">
          <Icon name="link" size={17} strokeWidth={1.7} />
          {t("request.make")}
        </button>
      </div>
    </form>
  );
}
