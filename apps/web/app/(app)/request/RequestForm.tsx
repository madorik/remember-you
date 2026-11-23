"use client";

import { ASK_DEFAULT_TOPICS, QUESTIONS, QUESTION_SECTION, SECTIONS, SECTIONS_BY_IMPORTANCE, aboutPrompt, askMinutes, defaultAskTopics, type AvatarConfig, type DailyQuestion, type Locale, type Section } from "@readme/core";
import { useEffect, useRef, useState } from "react";
import { createRequest, type InviteState } from "@/app/actions/request";
import { leaveTour, trackTour } from "@/app/actions/tour";
import { useT } from "@/components/editors/shared";
import { Avatar } from "@/components/Avatar";
import { TornTape } from "@/components/TornTape";
import { CheckGlyph, Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { CuteTopicIcon } from "@/components/CuteTopicIcon";
import { SectionIcon } from "@/components/SectionIcon";
import { TagChip } from "@/components/PersonRow";
import { ReplyAlert } from "@/components/ReplyAlert";
import { canShare, copyText, copyTextLater, shareLink } from "@/components/ShareButtons";
import { Stamp, Star } from "@/components/diary";
import { u } from "@/lib/ui-scale";
import { matchesPerson } from "@/lib/search";
import { FacePolaroid, SpeechBubble } from "./RequestParts";

const INITIAL: InviteState = { url: null, text: "", error: null };

/** 누른 단추: 물어보기(공유창) · 링크 복사 */
type Act = "share" | "copy";

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
  focus = null,
  question = null,
  webPushKey = null,
  tour = false,
}: {
  locale: Locale;
  people: AskPerson[];
  fixed: string | null;
  initialName: string;
  defaults: Section[];
  xmas?: boolean;
  focus?: Section | null;
  /** 오늘의 질문 하나만 묻는다(?q=) */
  question?: DailyQuestion["id"] | null;
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
  const formRef = useRef<HTMLFormElement>(null);
  // 만든 링크(한 번만 만든다: 물어보기·링크 복사·다시 보내기가 모두 이걸 쓴다)
  const [link, setLink] = useState<{ url: string; text: string } | null>(null);
  const linkRef = useRef<{ url: string; text: string } | null>(null);
  const creating = useRef<Promise<InviteState> | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<InviteState["error"]>(null);
  // 링크는 만들었는데 보내지 못했다(누른 지 오래돼 브라우저가 공유창을 막음·클립보드가 막힘): 그 단추를 한 번 더 누르면 바로 보낸다
  const [ready, setReady] = useState<Act | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
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
    if (!tour || !link || made.current) return;
    made.current = true;
    void trackTour("ask", targetKind === "person" ? "person" : "new");
  }, [tour, link, targetKind]);
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
  // 폴라로이드에 담을 얼굴: 아는 사람이면 그 얼굴, 새 이름이면 첫 글자, 아직 아무도 없으면 비어 있다
  const who0 = target ? { avatar: target.kind === "person" ? target.person.avatar : null, label: name } : null;

  const topicLabel = (x: Section) => t(`request.topic.${x}` as "request.topic.dates");

  // 물어보기가 막혀 있는 까닭(짧게)
  const reason = pending ? null : !name.trim() ? (q && !typedNew ? "request.pickWho" : "request.needName") : !topics.length ? "request.pickOne" : null;

  // 링크는 한 번만 만든다(두 번 눌러도, 물어보기와 링크 복사를 번갈아 눌러도 같은 링크). 서버 동작은 예전 '링크 만들기'와 같다
  const create = (): Promise<InviteState> => {
    creating.current ??= (async () => {
      try {
        return await createRequest(INITIAL, new FormData(formRef.current!));
      } catch {
        return { url: null, text: "", error: "common" } satisfies InviteState;
      }
    })().then((r) => {
      if (!r.url) creating.current = null;
      return r;
    });
    return creating.current;
  };
  const keep = (r: InviteState): { url: string; text: string } | null => {
    if (!r.url) {
      setError(r.error ?? "common");
      return null;
    }
    const made = { url: r.url, text: r.text };
    linkRef.current = made;
    setLink(made);
    return made;
  };
  const flashCopied = () => {
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);
  };
  /**
   * 물어보기(공유창) · 링크 복사. 눌러 링크를 만든 다음 곧바로 보낸다.
   * 링크는 서버에서 만들어져 오래 걸릴 수 있어서 브라우저의 '방금 눌렀다'는 허락이 지나기 쉽다:
   *  - 복사는 클립보드 쓰기를 누르는 순간 시작하고 글은 약속으로 넘긴다(사파리도 통과). 안 되면 만든 뒤 일반 복사로 한 번 더
   *  - 공유창은 만든 뒤에 연다. 브라우저가 막으면(NotAllowedError) 링크는 그대로 두고 그 단추를 '준비됨'으로 바꾼다. 한 번 더 누르면 바로(기다림 없이) 열린다
   *  - 공유창이 없는 곳은 복사로 대신한다
   */
  const run = async (act: Act) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    setReady(null);
    try {
      const have = linkRef.current;
      if (act === "share" && canShare()) {
        const made = have ?? keep(await create());
        if (!made) return;
        const res = await shareLink(made.text, made.url);
        if (res === "blocked") setReady("share");
        else if (res === "unavailable") {
          if (await copyText(`${made.text}\n${made.url}`)) flashCopied();
          else setReady("share");
        }
        return;
      }
      const created = have ? Promise.resolve<InviteState>({ ...have, error: null }) : create();
      const ok = await copyTextLater(
        created.then((r) => {
          if (!r.url) throw new Error("not created");
          return `${r.text}\n${r.url}`;
        }),
      );
      const made = have ?? keep(await created);
      if (!made) return;
      if (ok) flashCopied();
      else setReady(act);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  // 누르면 바로 만들어 보내는 두 단추(만든 뒤에도 다시 보내려고 그대로 둔다). 높이 48px
  const actions = (
    <div className="flex w-full items-center gap-2">
      {(
        [
          { act: "share", icon: "share", label: t("request.askNow"), tone: "bg-sky" },
          { act: "copy", icon: copied ? "check" : "copy", label: t("common.copyLink"), tone: "bg-white" },
        ] as const
      ).map((b) => (
        <button
          key={b.act}
          type="button"
          onClick={() => void run(b.act)}
          disabled={pending || (!link && !!reason)}
          aria-busy={pending}
          className={`hand inline-flex h-[48px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-edge px-3 text-[18px] disabled:border-ink/[0.22] disabled:bg-[#e8e1cf] disabled:text-[#5a5f78] ${b.tone} ${ready === b.act ? "chip-flash" : ""}`}
        >
          <Icon name={b.icon} size={19} strokeWidth={1.7} />
          {b.label}
        </button>
      ))}
    </div>
  );
  // 복사했어요 · 링크가 준비됐어요(한 번 더): 아래 막대 바로 위에 잠깐 뜬다(단추 자리를 밀지 않게 떠 있다)
  const status = (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center px-4 pb-2">
      {copied || ready ? (
        <span className="flex min-h-10 items-center gap-1.5 rounded-2xl bg-ink px-3.5 text-[14px] text-white shadow-[0_8px_24px_rgba(31,35,64,0.28)]">
          <Icon name="check" size={16} strokeWidth={2.2} className="shrink-0 text-sky" />
          {copied ? t("common.copied") : t("request.tapAgain")}
        </span>
      ) : null}
    </div>
  );

  // 링크가 만들어지면: 누구에게·무엇을 묻는지 보여 주고, 아래에서 다시 보낼 수 있다(링크 글자는 보이지 않는다)
  if (link) {
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
        <ReplyAlert locale={locale} publicKey={webPushKey} />
        <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
          {status}
          {actions}
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

  const chip = "flex h-9 items-center gap-1.5 rounded-full border border-edge bg-white pl-[4.5px] pr-3.5 text-[12.6px]";
  const h2 = "hand scribble text-[19.4px] leading-none";
  const mint = { "--scribble": "#5dbb9a" } as React.CSSProperties;
  // 물어볼 항목: 처음 골라 두는 것(그 사람에게 아직 안 적힌 것부터 3개)은 큰 카드로, 나머지는 '더 물어볼 것' 칩으로. 고르고 끄는 건 둘 다 같은 토글
  const suggested = SECTIONS_BY_IMPORTANCE.filter((x) => topicsFor(target?.kind === "person" ? target.person : null).includes(x));
  const more = SECTIONS_BY_IMPORTANCE.filter((x) => !suggested.includes(x));
  const toggle = (x: Section) => setTopics(topics.includes(x) ? topics.filter((y) => y !== x) : SECTIONS.filter((y) => y === x || topics.includes(y)));
  const topicEg = (x: Section) => t(`request.eg.${x}` as "request.eg.dates");

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="flex flex-1 flex-col">
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
          <>
            <div className="mt-2.5 mb-2 flex items-center gap-2">
              <h3 className="hand text-[16.2px] leading-none">{t(suggested.length === ASK_DEFAULT_TOPICS ? "request.first3" : "request.first")}</h3>
              {name.trim() ? <span className="inline-flex h-5.5 max-w-[60%] items-center -rotate-3 rounded-full bg-[#FDE6EB] px-2 text-[9.9px] leading-none text-red"><span className="truncate">{t("request.fitFor", { name: name.trim() })}</span></span> : null}
            </div>
            <ul className="flex flex-col gap-2">
              {suggested.map((x) => {
                const on = topics.includes(x);
                return (
                  <li key={x}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={topicLabel(x)}
                      aria-describedby={`topic-eg-${x}`}
                      onClick={() => toggle(x)}
                      className={`flex min-h-15 w-full items-center gap-3 rounded-[12.6px] border border-edge py-2 pr-3 pl-2.5 text-left ${on ? "bg-sky-soft" : "bg-white"}`}
                    >
                      <CuteTopicIcon section={x} size={40} />
                      <span className="flex min-w-0 flex-1 flex-col gap-[2.7px]">
                        <span className={`hand text-[19.8px] leading-[1.05] ${x === "safety" ? "text-red" : ""}`}>{topicLabel(x)}</span>
                        <span id={`topic-eg-${x}`} className="text-[10.8px] leading-[1.3] text-muted">
                          {topicEg(x)}
                        </span>
                      </span>
                      <span aria-hidden="true" className={`flex h-[23.4px] w-[23.4px] shrink-0 items-center justify-center rounded-full border border-edge ${on ? "bg-sky text-ink" : "bg-white"}`}>
                        {on ? <CheckGlyph size={14} /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {more.length ? (
              <>
                <div className="mt-4 mb-2 flex items-center gap-2">
                  <h3 className="hand text-[16.2px] leading-none">{t("request.more")}</h3>
                  <span aria-hidden="true" className="h-0 flex-1 border-t border-dashed border-edge" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {more.map((x) => {
                    const on = topics.includes(x);
                    return (
                      <button
                        key={x}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(x)}
                        className={`inline-flex h-9.5 items-center gap-1.5 rounded-full border border-edge pr-3 pl-2 text-[12.2px] leading-none ${on ? "bg-sky-soft" : "bg-white"}`}
                      >
                        <CuteTopicIcon section={x} size={24} />
                        {topicLabel(x)}
                        {on ? (
                          <CheckGlyph size={13} />
                        ) : (
                          <svg aria-hidden="true" width={u(13)} height={u(13)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-muted">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </>
        )}
      </section>

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {error ? (
          <p role="alert" className="w-full px-1 text-[12.6px] text-red">
            {t(error === "pickOne" ? "request.pickOne" : name.trim() ? "common.error" : "request.needName")}
          </p>
        ) : null}
        {reason ? <p className="w-full px-1 text-[12.6px] text-muted">{t(reason)}</p> : null}
        {actions}
      </div>
    </form>
  );
}
