"use client";

import { ASK_DEFAULT_TOPICS, QUESTIONS, QUESTION_SECTION, SECTIONS, SECTIONS_BY_IMPORTANCE, aboutPrompt, askMinutes, defaultAskTopics, type AvatarConfig, type DailyQuestion, type Locale, type Section } from "@readme/core";
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
import { ReplyAlert } from "@/components/ReplyAlert";
import { LinkField, ShareButtons } from "@/components/ShareButtons";
import { Stamp, Star } from "@/components/diary";
import { requestPreview } from "@/lib/og";
import { matchesPerson } from "@/lib/search";
import { SITE_URL } from "@/lib/site";
import { AIRMAIL, FacePolaroid, LinkPreview, PostMark, PostageStamp, SpeechBubble } from "./RequestParts";

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
export function RequestForm({
  locale,
  people,
  fixed,
  initialName,
  defaults,
  xmas = false,
  initialMessage = "",
  focus = null,
  question = null,
  sender,
  webPushKey = null,
  tour = false,
}: {
  locale: Locale;
  people: AskPerson[];
  fixed: string | null;
  initialName: string;
  defaults: Section[];
  xmas?: boolean;
  initialMessage?: string;
  focus?: Section | null;
  /** 오늘의 질문 하나만 묻는다(?q=) */
  question?: DailyQuestion["id"] | null;
  /** 물어보는 사람(나): 엽서의 From과 링크 미리보기 */
  sender: { name: string; avatar: AvatarConfig };
  webPushKey?: string | null;
  tour?: boolean;
}) {
  const t = useT(locale);
  // 한 질문만 묻는 물어보기(question)는 항목을 고르지 않고 그 질문 하나만(서버가 그 질문이 속한 항목으로 저장한다)
  // 그 밖에는 누구에게든 같은 규칙: 아직 안 적힌 것 중 중요한 것부터 3개까지만 골라 두고(나머지는 직접 고른다), 다 적혀 있으면 기본 항목
  const topicsFor = (p: AskPerson | null): Section[] => {
    if (question) return [QUESTION_SECTION[question]];
    if (focus) return [focus];
    if (xmas) return defaults;
    const picked = p ? defaultAskTopics(p.missing) : [];
    return picked.length ? picked : defaults;
  };
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
  const q = query.replace(/\s+/g, " ").trim();
  const matches = (q ? people.filter((p) => matchesPerson(q, p.name, p.tag)) : people).slice(0, 12);
  const exact = people.some((p) => [p.name, p.tag, p.label].some((x) => x && x.replace(/\s+/g, "") === q.replace(/\s+/g, "")));
  // 적은 이름이 아무와도 안 맞으면 새 사람으로 친다('새로' 칩을 따로 누르지 않아도 된다)
  const typedNew = !who && !!q && !matches.length;
  const target: Who | null = who ?? (typedNew ? { kind: "new", name: q.slice(0, 40) } : null);
  const name = target ? (target.kind === "person" ? target.person.label : target.name) : "";
  const targetKind = target?.kind;
  const made = useRef(false);
  useEffect(() => {
    if (!tour || !state.url || made.current) return;
    made.current = true;
    void trackTour("ask", targetKind === "person" ? "person" : "new");
  }, [tour, state.url, targetKind]);
  const choose = (p: AskPerson) => {
    setWho({ kind: "person", person: p });
    setTopics(topicsFor(p));
  };
  const chooseNew = () => {
    setWho({ kind: "new", name: q.slice(0, 40) });
    setTopics(topicsFor(null));
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
  // 폴라로이드에 담을 얼굴: 아는 사람이면 그 얼굴, 새 이름이면 첫 글자, 아직 아무도 없으면 비어 있다
  const who0 = target ? { avatar: target.kind === "person" ? target.person.avatar : null, label: name } : null;

  const topicLabel = (x: Section) => t(`request.topic.${x}` as "request.topic.dates");

  // 링크가 만들어지면: 누구에게·무엇을 묻는지와 보낼 메시지를 보여 주고, 아래에서 보낸다
  if (state.url) {
    return (
      <div className="flex flex-1 flex-col">
        <section className="card relative mx-4 mt-7 flex flex-col items-center px-3.5 pb-4 pt-5">
          <TornTape color="pink" w={66} h={21} rotate={-38} className="-left-[15px] top-[8px]" />
          <Stamp size={68} fontSize={19} className="right-3 top-3 bg-sky-soft">
            <span className="whitespace-pre-line text-center leading-[1.15]">{t("request.stampReady").replace(" ", "\n")}</span>
          </Stamp>
          {/* 폴라로이드(시안): 남색 선 + 흰 바탕, 안에 얼굴(새 이름이면 첫 글자), 옆에서 웃는 캐릭터 */}
          <div className="flex items-end gap-1">
            <FacePolaroid who={who0} photo={98} rotate={-4} />
            <Mascot pose={11} size={92} className="mb-1" />
          </div>
          <h2 className="hand-written mt-3.5 text-center !font-normal text-[21.1px] leading-[1.15]">{t("request.ready", { name: name.trim() })}</h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-2 gap-y-1.5">
            {question ? (
              <li className="hand flex min-h-[27px] items-center rounded-full border border-edge bg-[#e4ecfa] px-2.5 py-1 text-[13px] leading-[1.2]">{QUESTIONS.find((x) => x.id === question)?.prompt[locale]}</li>
            ) : (
              SECTIONS_BY_IMPORTANCE.filter((x) => topics.includes(x)).map((x) => (
                <li key={x} className="hand flex h-[27px] items-center rounded-full border border-edge bg-[#e4ecfa] px-2.5 text-[13px] leading-none">
                  {topicLabel(x)}
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="card relative mx-4 mt-3.5 flex flex-col px-3.5 pb-3.5 pt-2.5">
          <div className="flex min-h-[30.6px] items-center">
            <h3 className="scribble text-[19.4px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
              {t("request.message")}
            </h3>
          </div>
          <p className="mt-3 whitespace-pre-line rounded-[18px] border border-edge bg-[#e4ecfa] px-3.5 py-3 text-[12.6px] leading-[1.55]">
            {state.text}
            {message.trim() ? (
              <>
                {"\n"}
                <span className="hand-written text-[17.8px] leading-[1.3]">{message.trim()}</span>
              </>
            ) : null}
          </p>
          <div className="pt-3">
            <LinkField url={state.url} label={t("common.copyLink")} />
          </div>
        </section>
        <ReplyAlert locale={locale} publicKey={webPushKey} />
        <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
          <ShareButtons locale={locale} url={state.url} text={shareText} sendLabel={t("request.send")} big />
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

  // 링크 만들기가 막혀 있는 까닭(짧게)
  const reason = pending ? null : !name.trim() ? (q && !typedNew ? "request.pickWho" : "request.needName") : !topics.length ? "request.pickOne" : null;
  const chip = "flex h-9 items-center gap-1.5 rounded-full border border-edge bg-white pl-[4.5px] pr-3.5 text-[12.6px]";
  const h2 = "hand scribble text-[19.4px] leading-none";
  const mint = { "--scribble": "#5dbb9a" } as React.CSSProperties;

  // 링크를 받는 사람이 메신저에서 보는 미리보기(/r/<토큰>의 링크 미리보기와 같은 함수)
  const preview = requestPreview(locale, sender.name || undefined, { question, sections: topics });
  const host = new URL(SITE_URL).host;

  return (
    <form action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="sections" value={JSON.stringify(topics)} />
      {question ? <input type="hidden" name="questions" value={JSON.stringify([question])} /> : null}
      {target?.kind === "person" ? <input type="hidden" name="to" value={target.person.id} /> : null}
      <input type="hidden" name="name" value={name} />

      {/* 받는 사람: 폴라로이드 + 이름 + 편지 든 캐릭터의 한마디. 정해져 있지 않으면 아래에서 찾아 고른다 */}
      <section className="card relative mx-4 mt-6 px-3.5 pb-3.5 pt-4">
        <TornTape color="pink" w={66} h={21} rotate={-38} className="-left-[15px] top-[8px]" />
        <div className="flex items-center gap-3.5">
          <FacePolaroid who={who0} photo={72} rotate={-4} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {name ? (
              <div className="flex min-h-[27px] items-center gap-1.5 pr-8">
                <span className="hand-written min-w-0 truncate text-[24px] leading-[1.15]">{name}</span>
                {target?.kind === "new" ? <TagChip>{t("voice.newPerson")}</TagChip> : null}
              </div>
            ) : null}
            <div className="flex items-center gap-2.5">
              <SpeechBubble>{name ? t("request.bubbleTo", { name }) : t("request.bubbleWho")}</SpeechBubble>
              <Mascot pose={6} size={66} />
            </div>
          </div>
        </div>
        {who && !fixed ? (
          <button
            type="button"
            aria-label={t("request.whoAgain")}
            onClick={() => {
              setWho(null);
              setQuery("");
              setTopics(topicsFor(null));
            }}
            className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center"
          >
            <Icon name="close" size={15} strokeWidth={2.2} />
          </button>
        ) : null}
        {fixed || who ? null : (
          <div className="mt-3.5 border-t border-dashed border-edge pt-2.5">
            <div className="flex min-h-[30.6px] items-center">
              <label htmlFor="request-who" className={h2} style={mint}>
                {t("request.who")}
              </label>
            </div>
            <div className="relative mt-2.5">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16.2" height="16.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="pointer-events-none absolute left-[13.5px] top-[15.3px] text-muted">
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
                placeholder={t(people.length ? "people.search" : "request.whoPlaceholder")}
                className="field !pl-[37.8px] [&::-webkit-search-cancel-button]:appearance-none"
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
                  <button
                    type="button"
                    onClick={chooseNew}
                    className={`flex h-9 items-center gap-1.5 rounded-full border pl-3 pr-3.5 text-[12.6px] ${typedNew ? "border-edge bg-sky text-ink" : "border-dashed border-edge text-accent"}`}
                  >
                    <Icon name="personAdd" size={15} strokeWidth={2} />
                    {q}
                    <TagChip>{t("voice.newPerson")}</TagChip>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="card relative mx-4 mt-3.5 px-3.5 pb-3.5 pt-2.5">
        <div className="flex min-h-[30.6px] items-center justify-between gap-2">
          <h2 className={h2} style={mint}>
            {t("request.topics")}
          </h2>
          {question ? null : (
            <span className="flex items-center gap-2">
              {/* 많이 고르면 받는 사람이 드는 시간만 슬쩍 보여 준다(기본 3개 안쪽에서는 숨김) */}
              {topics.length > ASK_DEFAULT_TOPICS ? <span className="text-[11.7px] text-muted">{t("request.burden", { n: askMinutes(topics) })}</span> : null}
              <span className="hand inline-flex h-[27px] items-center rounded-[9px] border border-edge bg-sky-soft px-2.5 text-[13.8px] leading-none">{topics.length}</span>
            </span>
          )}
        </div>
        {question ? (
          // 오늘의 질문 하나만 묻는 물어보기: 항목 대신 그 질문 하나(눈에 띄는 카드)
          <div className="relative mt-3 flex items-center gap-3 rounded-[14px] border-[2.5px] border-ink bg-[#e4ecfa] px-3.5 py-4">
            <Star size={22} rotate={14} className="-right-2 -top-3" />
            <SectionIcon section={QUESTION_SECTION[question]} size={46} outline />
            <span className="min-w-0 flex-1 text-[15px] leading-[1.45]">{aboutPrompt(question, name, locale)}</span>
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {SECTIONS_BY_IMPORTANCE.map((x) => {
              const on = topics.includes(x);
              return (
                <button
                  key={x}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTopics(on ? topics.filter((y) => y !== x) : SECTIONS.filter((y) => y === x || topics.includes(y)))}
                  className={`relative flex h-[90px] flex-col items-center justify-center gap-2 rounded-[14px] text-[13.5px] leading-none ${on ? "border-[2.5px] border-ink bg-[#e4ecfa]" : "border border-edge bg-white"}`}
                >
                  <SectionIcon section={x} size={44} outline />
                  {topicLabel(x)}
                  {on ? (
                    <span aria-hidden="true" className="absolute -right-[4.5px] -top-[6.3px] flex h-5 w-5 items-center justify-center rounded-full border border-edge bg-sky text-ink">
                      <CheckGlyph size={12} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 같이 보낼 말: 우표 붙은 엽서. To·From 사이 줄 노트에 적는다 */}
      <section className="relative mx-4 mt-3.5 overflow-hidden rounded-[10px] border border-edge bg-[#FFFDF6]">
        <div aria-hidden="true" className="h-[6px] border-b border-edge" style={{ backgroundImage: AIRMAIL }} />
        <div className="relative px-3.5 pb-3 pt-3">
          <PostageStamp className="right-3 top-3" />
          <PostMark className="right-[64px] top-4" />
          <div className="flex min-h-[48px] items-end pr-[64px]">
            <p className="hand-written flex h-[30px] min-w-0 flex-1 items-end truncate border-b border-dashed border-edge text-[19px] leading-none">
              <span className="truncate">{t("request.postTo", { name: name.trim() || "" })}</span>
            </p>
          </div>
          <textarea
            id="request-message"
            name="message"
            aria-label={t("request.message")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder={t("request.messagePlaceholder")}
            className="hand-written mt-1.5 h-[81px] w-full resize-none border-0 bg-transparent p-0 text-[17.8px] leading-[27px] outline-none placeholder:font-sans placeholder:text-[13.5px] placeholder:text-muted [background-image:repeating-linear-gradient(180deg,transparent_0_26px,#d5e1f3_26px_27px)]"
          />
          {sender.name ? <p className="hand-written mt-1.5 truncate text-right text-[18px] leading-[1.2]">{t("request.postFrom", { name: sender.name })}</p> : null}
        </div>
      </section>

      {/* 받는 사람이 메신저에서 보는 모양 */}
      <section className="card relative mx-4 mt-3.5 px-3.5 pb-3.5 pt-2.5">
        <div className="flex min-h-[30.6px] items-center">
          <p className={h2} style={mint}>
            {name ? t("request.preview", { name }) : t("request.previewAnon")}
          </p>
        </div>
        <div className="mt-2.5">
          <LinkPreview avatar={sender.avatar} name={sender.name} title={preview.title} description={preview.description} host={host} />
        </div>
      </section>

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {state.error ? (
          <p role="alert" className="w-full px-1 text-[12.6px] text-red">
            {t(state.error === "pickOne" ? "request.pickOne" : name.trim() ? "common.error" : "request.needName")}
          </p>
        ) : null}
        {reason ? <p className="w-full px-1 text-[12.6px] text-muted">{t(reason)}</p> : null}
        <button disabled={pending || !!reason} className="hand inline-flex h-[48px] w-full items-center justify-center gap-1.5 rounded-full border border-edge bg-sky px-4 text-[18px] disabled:border-ink/[0.22] disabled:bg-[#e8e1cf] disabled:text-[#5a5f78]">
          <Icon name="link" size={19} strokeWidth={1.7} />
          {t("request.make")}
        </button>
      </div>
    </form>
  );
}
