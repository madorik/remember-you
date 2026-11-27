"use client";

import { ASK_DEFAULT_TOPICS, QUESTION_SECTION, SECTIONS, SECTIONS_BY_IMPORTANCE, aboutPrompt, askMinutes, defaultAskTopics, type AvatarConfig, type DailyQuestion, type Locale, type Section } from "@readme/core";
import { useEffect, useRef, useState } from "react";
import { createRequest, type InviteState } from "@/app/actions/request";
import { useT } from "@/components/editors/shared";
import { Avatar } from "@/components/Avatar";
import { TornTape } from "@/components/TornTape";
import { CheckGlyph, Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { CuteTopicIcon } from "@/components/CuteTopicIcon";
import { SectionIcon } from "@/components/SectionIcon";
import { TagChip } from "@/components/PersonRow";
import { ReplyAlert } from "@/components/ReplyAlert";
import { canShare, shareLink } from "@/components/ShareButtons";
import { Star } from "@/components/diary";
import { u } from "@/lib/ui-scale";
import { matchesPerson } from "@/lib/search";
import { AskShareSheet } from "./AskShareSheet";
import { FacePolaroid, SpeechBubble } from "./RequestParts";

const INITIAL: InviteState = { url: null, text: "", error: null };

type Link = { url: string; text: string };
/** 아래에 잠깐 뜨는 알림: 물어봤어요 · 그 밖의 한 줄(보낼 수 없는 까닭·실패) */
type Toast = { kind: "asked" } | { kind: "notice"; text: string };

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
  const whoRef = useRef<HTMLInputElement>(null);
  // 만든 링크(같은 사람·같은 항목이면 한 번만 만든다: 머리말 공유 아이콘·공유 팝업이 모두 이걸 쓴다. 사람이나 항목을 바꾸면 다음에 새로 만든다 — 앞 링크는 그대로 열린다)
  const stored = useRef<{ sig: string; link: Link } | null>(null);
  const creating = useRef<{ sig: string; promise: Promise<InviteState> } | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  // 보내지 못했거나 공유창을 못 열면 우리 공유 팝업이 뜬다
  const [sheet, setSheet] = useState<Link | null>(null);
  // 보낸 뒤(또 못 보내는 까닭을 알릴 때) 잠깐 뜨는 아래 알림, 보낸 뒤 처음 한 번은 '답장 오면 알려 드릴까요?'도 곁들인다
  const [toast, setToast] = useState<Toast | null>(null);
  const [alertOffer, setAlertOffer] = useState(false);
  const offered = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const alertTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(alertTimer.current);
    },
    [],
  );
  const q = query.replace(/\s+/g, " ").trim();
  const matches = (q ? people.filter((p) => matchesPerson(q, p.name, p.tag)) : people).slice(0, 12);
  const exact = people.some((p) => [p.name, p.tag, p.label].some((x) => x && x.replace(/\s+/g, "") === q.replace(/\s+/g, "")));
  // 적은 이름이 아무와도 안 맞으면 새 사람으로 친다('새로' 칩을 따로 누르지 않아도 된다)
  const typedNew = !who && !!q && !matches.length;
  const target: Who | null = who ?? (typedNew ? { kind: "new", name: q.slice(0, 40) } : null);
  const name = target ? (target.kind === "person" ? target.person.label : target.name) : "";
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

  // 아직 못 보내는 까닭(짧게): 공유 아이콘을 누르면 이 글을 알린다
  const reason = pending ? null : !name.trim() ? (q && !typedNew ? "request.pickWho" : "request.needName") : !topics.length ? "request.pickOne" : null;

  // 같은 사람·같은 항목인지(바뀌면 앞서 만든 링크는 두고 다음에 새로 만든다)
  const sig = JSON.stringify([target?.kind === "person" ? target.person.id : null, name, topics, question]);
  const sigRef = useRef(sig);
  useEffect(() => {
    sigRef.current = sig;
  });
  const mine = (): Link | null => (stored.current?.sig === sigRef.current ? stored.current.link : null);

  // 링크는 같은 사람·항목이면 한 번만 만든다(두 번 눌러도, 공유창이 막혀 팝업에서 다시 눌러도 같은 링크). 서버 동작은 예전 '링크 만들기'와 같다
  const create = (s: string): Promise<InviteState> => {
    if (creating.current?.sig === s) return creating.current.promise;
    const promise: Promise<InviteState> = (async () => {
      try {
        return await createRequest(INITIAL, new FormData(formRef.current!));
      } catch {
        return { url: null, text: "", error: "common" } satisfies InviteState;
      }
    })().then((r) => {
      if (!r.url && creating.current?.promise === promise) creating.current = null;
      return r;
    });
    creating.current = { sig: s, promise };
    return promise;
  };
  const keep = (r: InviteState, s: string): Link | null => {
    if (!r.url) {
      notice(t(r.error === "pickOne" ? "request.pickOne" : name.trim() ? "common.error" : "request.needName"), 4000);
      return null;
    }
    const link = { url: r.url, text: r.text };
    stored.current = { sig: s, link };
    return link;
  };
  const showToast = (next: Toast, ms: number) => {
    setToast(next);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const notice = (text: string, ms = 2600) => showToast({ kind: "notice", text }, ms);
  const flash = () => {
    showToast({ kind: "asked" }, 2200);
    // 답장 알림은 처음 한 번만 슬쩍 권한다(공유 팝업을 열었다면 팝업 맨 아래에 이미 있었다)
    if (offered.current) return;
    offered.current = true;
    setAlertOffer(true);
    alertTimer.current = setTimeout(() => setAlertOffer(false), 8000);
  };
  const openSheet = (link: Link) => {
    offered.current = true;
    setAlertOffer(false);
    setSheet(link);
  };
  /**
   * 머리말의 공유 아이콘: 눌러 링크를 만든 다음 곧바로 보낸다. 화면은 그대로 두고 '물어봤어요'만 잠깐 알린다.
   * 링크는 서버에서 만들어져 오래 걸릴 수 있어서 브라우저의 '방금 눌렀다'는 허락이 지나기 쉽다:
   *  - 공유창은 만든 뒤에 연다. 브라우저가 막으면(NotAllowedError)·공유창이 없는 곳(PC)이면 우리 공유 팝업을 띄운다(거기 단추를 누르면 바로 열린다)
   */
  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setToast(null);
    const s = sigRef.current;
    try {
      const link = mine() ?? keep(await create(s), s);
      // 만드는 동안 사람·항목을 바꿨으면 그 링크는 보내지 않는다
      if (!link || sigRef.current !== s) return;
      if (!canShare()) return openSheet(link);
      const res = await shareLink(link.text, link.url);
      if (res === "shared") flash();
      else if (res !== "closed") openSheet(link);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  // 공유 아이콘은 늘 눌린다: 아직 못 보내면 까닭을 알리고(사람이 없으면 '누구에게' 칸으로), 보낼 수 있으면 만들어 보낸다
  const onShare = () => {
    if (reason) {
      notice(t(reason));
      if (!name.trim()) whoRef.current?.focus();
      return;
    }
    void run();
  };
  // 보냈어요 · 못 보내는 까닭(+ 처음 한 번 답장 알림): 하단 메뉴 바로 위에 잠깐 뜬다(아래에 붙은 단추가 없으니 화면에 떠 있다)
  const status = (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ bottom: "calc(var(--above-tab) + 8px)" }}>
      <div role="status" aria-live="polite" className="max-w-full">
        {toast ? (
          <span className="flex min-h-10 items-center gap-1.5 rounded-2xl bg-ink px-3.5 py-1.5 text-[14px] text-white shadow-[0_8px_24px_rgba(31,35,64,0.28)]">
            {toast.kind === "asked" ? <Icon name="check" size={16} strokeWidth={2.2} className="shrink-0 text-sky" /> : null}
            {toast.kind === "asked" ? t("request.asked") : toast.text}
          </span>
        ) : null}
      </div>
      {alertOffer ? <ReplyAlert locale={locale} publicKey={webPushKey} className="pointer-events-auto shadow-[0_8px_24px_rgba(31,35,64,0.18)]" /> : null}
    </div>
  );

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
                ref={whoRef}
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
          <span className="flex items-center gap-2">
            {/* 많이 고르면 받는 사람이 드는 시간만 슬쩍 보여 준다(기본 3개 안쪽에서는 숨김) */}
            {!question && topics.length > ASK_DEFAULT_TOPICS ? <span className="text-[11.7px] text-muted">{t("request.burden", { n: askMinutes(topics) })}</span> : null}
            {/* 보내는 단 하나의 길(주 동작): 링크를 만들어(한 번만) 공유창을 연다. 아직 못 보내면 눌렀을 때 까닭을 알린다 */}
            <button
              type="button"
              aria-label={t("request.share")}
              aria-busy={pending}
              onClick={onShare}
              className={`-my-[7px] -mr-2.5 flex h-[44px] w-[44px] shrink-0 items-center justify-center ${reason || pending ? "opacity-60" : ""}`}
            >
              <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full border border-edge bg-sky">
                <Icon name="share" size={21} strokeWidth={1.8} />
              </span>
            </button>
          </span>
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

      {/* 아래에 붙는 단추가 없으니 마지막 카드가 하단 메뉴에 가리지 않게 화면 끝 여백 */}
      <div className="page-end" />
      {status}
      {sheet ? (
        <AskShareSheet
          locale={locale}
          name={name.trim()}
          face={who0?.avatar ?? null}
          link={sheet}
          webPushKey={webPushKey}
          onClose={() => setSheet(null)}
          onShared={() => {
            setSheet(null);
            flash();
          }}
        />
      ) : null}
    </form>
  );
}
