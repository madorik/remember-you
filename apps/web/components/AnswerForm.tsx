"use client";

import { emptySection, isEmptySection, sanitizeSection, type AvatarConfig, type CardData, type GiftsData, type Locale, type PartialCard, type Section } from "@readme/core";
import { useActionState, useEffect, useRef, useState } from "react";
import type { AnswerState } from "@/app/actions/request";
import { AnswerSent } from "@/components/AnswerSent";
import { AnswerIntro } from "@/components/AnswerIntro";
import { AnswerDates } from "@/components/AnswerDates";
import { CuteTopicIcon } from "@/components/CuteTopicIcon";
import { CultureEditor } from "@/components/editors/CultureEditor";
import { FavoritesEditor } from "@/components/editors/FavoritesEditor";
import { LifeEditor } from "@/components/editors/LifeEditor";
import { PetsEditor } from "@/components/editors/PetsEditor";
import { SafetyEditor } from "@/components/editors/SafetyEditor";
import { SizesEditor } from "@/components/editors/SizesEditor";
import { TasteEditor } from "@/components/editors/TasteEditor";
import { CircleOption, SectionHeading, TextField, joinList, splitList, useT } from "@/components/editors/shared";
import { DrawnCheck, Icon } from "@/components/marks";
import { TornTape } from "@/components/TornTape";
import { Mascot } from "@/components/Mascot";
import { summarize } from "@/lib/summary";

type Mode = "ok" | "fix" | "new" | "none";
const INITIAL: AnswerState = { sent: false, savedMine: false, error: null };

function GiftsLite({ value, onChange, locale }: { value: GiftsData; onChange: (v: GiftsData) => void; locale: Locale }) {
  const t = useT(locale);
  const [skip, setSkip] = useState(joinList(value.skip));
  const [wish, setWish] = useState(joinList(value.wishlist.map((w) => w.title)));
  return (
    <div className="flex flex-col gap-6">
      <TextField
        label={t("gift.wishTitle")}
        value={wish}
        onChange={(v) => {
          setWish(v);
          // 같은 이름이 이미 있으면 그 링크는 그대로 둔다
          onChange({ ...value, wishlist: splitList(v).slice(0, 10).map((title) => ({ title, url: value.wishlist.find((w) => w.title === title)?.url ?? "" })) });
        }}
        placeholder={t("gift.wishPlaceholder")}
      />
      <div className="flex flex-col gap-1.5">
        <SectionHeading>{t("gift.giftCard")}</SectionHeading>
        <div className="flex flex-wrap gap-2 pt-1">
          <CircleOption label={t("gift.giftCardYes")} on={value.giftCard === "yes"} onToggle={() => onChange({ ...value, giftCard: value.giftCard === "yes" ? null : "yes" })} />
          <CircleOption color="ink" label={t("gift.giftCardNo")} on={value.giftCard === "no"} onToggle={() => onChange({ ...value, giftCard: value.giftCard === "no" ? null : "no" })} />
        </div>
      </div>
      <TextField
        label={t("gift.skip")}
        value={skip}
        onChange={(v) => {
          setSkip(v);
          onChange({ ...value, skip: splitList(v) });
        }}
        placeholder={t("gift.skipPlaceholder")}
      />
    </div>
  );
}

/** 제목 속 '3가지' · '3 things'에 형광펜 */
function highlightCount(text: string): React.ReactNode {
  const m = /^(.*?)(\d+\s?(?:가지|things?))(.*)$/.exec(text);
  if (!m) return text;
  return (
    <>
      {m[1]}
      <span className="hl">{m[2]}</span>
      {m[3]}
    </>
  );
}

export function AnswerForm({
  locale,
  token,
  from,
  fromAvatar,
  message,
  sections,
  prefill,
  mine,
  signedIn,
  submit,
}: {
  locale: Locale;
  token: string;
  from: string;
  /** 물어본 사람이 꾸민 얼굴(없으면 캐릭터) */
  fromAvatar: AvatarConfig | null;
  message: string;
  sections: Section[];
  /** 물어본 사람이 이미 알고 있는 값(그 사람 기록에서) */
  prefill: PartialCard;
  /** 로그인하고 답할 때 내 리드미 값(물어본 사람이 모르는 항목의 처음 값) */
  mine: PartialCard;
  signedIn: boolean;
  /** 보내기(서버 액션 submitAnswer) */
  submit: (prev: AnswerState, form: FormData) => Promise<AnswerState>;
}) {
  const t = useT(locale);
  const [answers, setAnswers] = useState<PartialCard>(() => Object.fromEntries(sections.map((s) => [s, prefill[s] ?? mine[s] ?? emptySection(s)])) as PartialCard);
  const [modes, setModes] = useState<Record<string, Mode | null>>(() => Object.fromEntries(sections.map((s) => [s, prefill[s] ? "fix" : "new"])));
  const [consent, setConsent] = useState(false);
  const [saveMine, setSaveMine] = useState(true);
  const [step, setStep] = useState(0);
  const [state, action, pending] = useActionState(submit, INITIAL);
  const form = useRef<HTMLFormElement>(null);

  // 새로고침·뒤로 가기에도 쓰던 답이 남게 이 탭에만 임시로 둔다(보내면 지운다). 하이드레이션이 어긋나지 않게 마운트 뒤에 되살린다
  const draftKey = `readme:answer:${token}`;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { answers?: Record<string, unknown>; modes?: Record<string, unknown>; step?: unknown; saveMine?: unknown };
      const back: PartialCard = {};
      for (const x of sections) if (d.answers?.[x] != null) (back as Record<string, unknown>)[x] = sanitizeSection(x, d.answers[x]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswers((a) => ({ ...a, ...back }));
      const m = Object.fromEntries(sections.filter((x) => d.modes && x in d.modes && (d.modes[x] === null || ["ok", "fix", "new", "none"].includes(String(d.modes[x])))).map((x) => [x, d.modes![x] as Mode | null]));
      setModes((cur) => ({ ...cur, ...m }));
      if (typeof d.step === "number" && sections.length > 1) setStep(Math.max(0, Math.min(sections.length, Math.round(d.step))));
      if (typeof d.saveMine === "boolean") setSaveMine(d.saveMine);
    } catch {
      /* 저장소를 못 쓰면 그냥 처음부터 */
    }
  }, [draftKey, sections]);
  useEffect(() => {
    try {
      if (state.sent) sessionStorage.removeItem(draftKey);
      else if (restored.current) sessionStorage.setItem(draftKey, JSON.stringify({ answers, modes, step, saveMine }));
    } catch {
      /* 저장소를 못 쓰면 넘어간다 */
    }
  }, [answers, modes, step, saveMine, state.sent, draftKey]);

  // 답한 항목: 없어요를 눌렀거나 값이 있는 것(미리 채운 값을 그대로 두고 '다음'을 누르면 그 값이 맞다는 뜻). 건드리지 않고 '다음'만 누른 빈 항목은 답이 아니다(보내면 물어본 사람 기록에 빈 값이 저장되고 '답했다'는 알림만 간다)
  const isAnswered = (x: Section) => {
    const m = modes[x];
    return m === "ok" || m === "none" || ((m === "new" || m === "fix") && !isEmptySection(x, answers[x]));
  };
  const answered = sections.filter(isAnswered);
  const none = sections.filter((x) => modes[x] === "none");

  if (state.sent) return <AnswerSent locale={locale} from={from} topics={answered} signedIn={signedIn} savedMine={state.savedMine} />;

  const set = <S extends Section>(s: S, v: CardData[S]) => {
    setAnswers((a) => ({ ...a, [s]: v }));
    if (modes[s] == null || modes[s] === "none") setModes((m) => ({ ...m, [s]: prefill[s] ? "fix" : "new" }));
  };
  const payload = Object.fromEntries(answered.map((s) => [s, modes[s] === "none" ? emptySection(s) : modes[s] === "ok" ? prefill[s] : answers[s]]));
  const needsConsent = answered.includes("safety");
  // 한 화면에 한 항목씩, 마지막 화면(sections.length)은 동의·보내기.
  // 하나만 물었으면 화면 하나: 항목 아래에 동의를 두고 바로 보내기(진행 막대 없음)
  const single = sections.length === 1;
  const total = sections.length + 1;
  const last = !single && step === sections.length;
  const canSend = single || last;
  const go = (n: number) => {
    if (single) return;
    setStep(Math.max(0, Math.min(sections.length, n)));
    window.scrollTo({ top: 0 });
  };
  const s = last ? null : sections[step]!;
  const finish = (
    <>
      {signedIn ? (
        <button type="button" aria-pressed={saveMine} onClick={() => setSaveMine(!saveMine)} className="flex min-h-11 items-start gap-3 text-left">
          <DrawnCheck on={saveMine} />
          <span className="text-[12.6px] leading-[1.45]">{t("answer.saveMine")}</span>
        </button>
      ) : null}
      {needsConsent ? (
        <button type="button" aria-pressed={consent} onClick={() => setConsent(!consent)} className="flex min-h-11 items-start gap-3 text-left">
          <DrawnCheck on={consent} />
          <span className="text-[12.6px] leading-[1.45]">{t("answer.consent", { from })}</span>
        </button>
      ) : null}
      <span className="text-[10.8px] leading-[1.45] text-muted">{t("answer.footer", { from })}</span>
    </>
  );

  // 지금 화면에서 적는 칸들(입력·글상자) 순서대로
  const fieldsOf = () =>
    Array.from(form.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea:not([disabled])') ?? []).filter((x) => x.getClientRects().length > 0);

  return (
    <form
      ref={form}
      action={action}
      className="flex flex-1 flex-col"
      // 키보드의 엔터 글쇠 모양: 다음 칸이 있으면 '다음', 마지막 화면의 마지막 칸이면 '완료'
      onFocusCapture={(e) => {
        const el = e.target;
        if (!(el instanceof HTMLInputElement)) return;
        const all = fieldsOf();
        el.enterKeyHint = canSend && all.indexOf(el) === all.length - 1 ? "done" : "next";
      }}
      onKeyDown={(e) => {
        // 엔터로는 보내지지 않고, 다음 칸으로(마지막 칸이면 다음 화면으로, 마지막 화면이면 키보드를 접는다). 글상자의 엔터는 줄바꿈, 한글 조합 중 엔터는 글자를 끝내는 것뿐
        const el = e.target;
        if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229 || !(el instanceof HTMLInputElement)) return;
        e.preventDefault();
        const all = fieldsOf();
        const next = all[all.indexOf(el) + 1];
        if (next) next.focus();
        else if (!canSend) go(step + 1);
        else el.blur();
      }}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="data" value={JSON.stringify(payload)} />
      <input type="hidden" name="none" value={JSON.stringify(none)} />
      <input type="hidden" name="consent" value={consent ? "1" : "0"} />
      <input type="hidden" name="saveMine" value={signedIn && saveMine ? "1" : "0"} />

      {/* 진행: 칸 막대(지난 칸·지금 칸은 망고, 남은 칸은 흰색) · 몇 번째(하나만 물었으면 없음). 되돌아가는 건 아래 '이전' 단추 */}
      {single ? null : (
        <div className="sticky top-0 z-20 flex items-center gap-2 bg-bg px-5 pb-1.5 pt-1.5" style={{ top: "var(--sat)" }}>
          <div className="flex flex-1 gap-[4.5px]" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-[2.7px] border ${i <= step ? "border-transparent bg-sky" : "border-ink/20 bg-white"}`} />
            ))}
          </div>
          <span className="hand shrink-0 text-right text-[14.4px] leading-none text-muted">
            {step + 1}/{total}
          </span>
        </div>
      )}

      {step === 0 ? <AnswerIntro title={highlightCount(t("answer.title", { from, n: sections.length }))} from={from} fromAvatar={fromAvatar} message={message} onlyFrom={t("answer.onlyFrom", { from })} /> : null}

      {s ? (
        <section key={s} className={`card relative mx-4 flex flex-col gap-3.5 p-3.5 ${step === 0 ? "mt-3.5" : "mt-6"}`}>
          <TornTape color={step % 2 ? "pink" : "mint"} w={66} h={21} rotate={6} className="-top-3 right-6" />
          <div className="flex min-h-[38px] items-center gap-2.5">
            <CuteTopicIcon section={s} size={38} />
            <h2 className={`hand scribble text-[21.6px] leading-none ${s === "safety" ? "text-red" : ""}`} style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
              {t(`request.topic.${s}` as "request.topic.dates")}
            </h2>
          </div>
          {prefill[s] ? <p className="text-[11.7px] text-muted">{t("answer.prefilledHint", { from })}</p> : null}
          {modes[s] !== "none" ? (
            <div className="flex flex-col gap-4">
              {s === "dates" ? <AnswerDates value={answers.dates ?? emptySection("dates")} onChange={(v) => set("dates", v)} locale={locale} /> : null}
              {s === "safety" ? <SafetyEditor flush value={answers.safety ?? emptySection("safety")} onChange={(v) => set("safety", v)} locale={locale} /> : null}
              {s === "taste" ? <TasteEditor value={answers.taste ?? emptySection("taste")} onChange={(v) => set("taste", v)} locale={locale} /> : null}
              {s === "sizes" ? <SizesEditor value={answers.sizes ?? emptySection("sizes")} onChange={(v) => set("sizes", v)} locale={locale} /> : null}
              {s === "gifts" ? <GiftsLite value={answers.gifts ?? emptySection("gifts")} onChange={(v) => set("gifts", v)} locale={locale} /> : null}
              {s === "favorites" ? <FavoritesEditor value={answers.favorites ?? emptySection("favorites")} onChange={(v) => set("favorites", v)} locale={locale} /> : null}
              {s === "culture" ? <CultureEditor value={answers.culture ?? emptySection("culture")} onChange={(v) => set("culture", v)} locale={locale} /> : null}
              {s === "life" ? <LifeEditor value={answers.life ?? emptySection("life")} onChange={(v) => set("life", v)} locale={locale} /> : null}
              {s === "pets" ? <PetsEditor value={answers.pets ?? emptySection("pets")} onChange={(v) => set("pets", v)} locale={locale} /> : null}
            </div>
          ) : null}
          {!prefill[s] ? (
            <button
              type="button"
              aria-pressed={modes[s] === "none"}
              onClick={() => {
                const none = modes[s] !== "none";
                setModes((x) => ({ ...x, [s]: none ? "none" : "new" }));
                if (none) go(step + 1);
              }}
              className={`relative inline-flex h-[30.6px] items-center self-end rounded-full border border-edge px-3.5 text-[11.7px] before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] ${modes[s] === "none" ? "bg-sky" : "bg-white"}`}
            >
              {t("answer.none")}
            </button>
          ) : null}
          {single ? finish : null}
        </section>
      ) : (
        <section className="card relative mx-4 mt-6 flex flex-col gap-3.5 p-3.5">
          <TornTape color="mint" w={66} h={21} rotate={6} className="-top-3 right-6" />
          <div className="flex items-center gap-3">
            <Mascot pose={6} size={52} />
            <h2 className="text-[23.4px] leading-none">
              <span className="hl">{t("answer.almost")}</span>
            </h2>
          </div>
          {/* 보내기 전에 무엇이 가는지 한눈에 */}
          {answered.length ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="hand text-[16.2px] leading-none">{t("answer.willSend", { from })}</h3>
              <ul className="flex flex-col">
                {answered.map((x) => (
                  <li key={x} className="flex items-baseline gap-2 border-t border-dashed border-ink/30 py-2 text-[12.6px] first:border-t-0">
                    <span className="w-[92px] shrink-0 text-muted">{t(`request.topic.${x}` as "request.topic.dates")}</span>
                    <span className="hand-written min-w-0 flex-1 truncate text-[17.8px] leading-[1.2]">
                      {modes[x] === "none" ? t("answer.none") : summarize(x, (modes[x] === "ok" ? prefill[x] : answers[x]) as CardData[Section], locale, t) || t("answer.empty")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {finish}
        </section>
      )}

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {state.error ? (
          <p role="alert" className="px-1 text-[12.6px] text-red">
            {t(state.error === "consent" ? "answer.needConsent" : state.error === "closed" ? "accept.expired" : state.error === "self" ? "answer.self" : state.error === "empty" ? "answer.needOne" : "common.error")}
          </p>
        ) : last && !answered.length ? (
          // 마지막 화면인데 답한 게 하나도 없다(전부 건드리지 않고 넘겼다): 보낼 수 없는 까닭
          <p className="px-1 text-[12.6px] text-muted">{t("answer.needOne")}</p>
        ) : null}
        <div className="flex gap-2.5">
          {single || step === 0 ? null : (
            <button type="button" onClick={() => go(step - 1)} className="btn-outline btn-outline-lift basis-[34%] shrink-0 !gap-1">
              <Icon name="back" size={19} strokeWidth={2} />
              {t("answer.prev")}
            </button>
          )}
          {canSend ? (
            // key: '다음'을 누른 그 클릭이 끝나기 전에 같은 자리 단추가 '보내기'로 바뀌어 곧바로 보내지는 일이 없게, 두 단추를 다른 요소로 둔다
            <button key="send" type="submit" disabled={pending || !answered.length || (needsConsent && !consent)} className="btn-primary min-w-0 flex-1">
              {t("answer.send")}
            </button>
          ) : (
            <button key="next" type="button" onClick={() => go(step + 1)} className="btn-primary min-w-0 flex-1 !gap-1">
              {t("answer.next")}
              <Icon name="chevron" size={19} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
