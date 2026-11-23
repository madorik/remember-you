"use client";

import { emptySection, isEmptySection, sanitizeSection, type CardData, type GiftsData, type Locale, type PartialCard, type Section } from "@readme/core";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { AnswerState } from "@/app/actions/request";
import { GetAppLink } from "@/components/GetAppLink";
import { useIsNative } from "@/components/native";
import { DateSpecPicker } from "@/components/editors/DatesEditor";
import { CultureEditor } from "@/components/editors/CultureEditor";
import { FavoritesEditor } from "@/components/editors/FavoritesEditor";
import { LifeEditor } from "@/components/editors/LifeEditor";
import { PetsEditor } from "@/components/editors/PetsEditor";
import { SafetyEditor } from "@/components/editors/SafetyEditor";
import { SizesEditor } from "@/components/editors/SizesEditor";
import { TasteEditor } from "@/components/editors/TasteEditor";
import { CircleOption, TextField, joinList, splitList, useT } from "@/components/editors/shared";
import { DrawnCheck, Icon } from "@/components/marks";
import { AnswerDone } from "@/components/AnswerDone";
import { TornTape } from "@/components/TornTape";
import { Mascot } from "@/components/Mascot";
import { SectionIcon } from "@/components/SectionIcon";
import { summarize } from "@/lib/summary";

type Mode = "ok" | "fix" | "new" | "none";
const INITIAL: AnswerState = { sent: false, savedMine: false, error: null };

function GiftsLite({ value, onChange, locale }: { value: GiftsData; onChange: (v: GiftsData) => void; locale: Locale }) {
  const t = useT(locale);
  const [skip, setSkip] = useState(joinList(value.skip));
  const [wish, setWish] = useState(joinList(value.wishlist.map((w) => w.title)));
  return (
    <div className="flex flex-col gap-5">
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
      <div className="flex flex-col gap-1">
        <span className="text-[15px]">{t("gift.giftCard")}</span>
        <div className="flex flex-wrap gap-2">
          <CircleOption large label={t("gift.giftCardYes")} on={value.giftCard === "yes"} onToggle={() => onChange({ ...value, giftCard: value.giftCard === "yes" ? null : "yes" })} />
          <CircleOption large color="ink" label={t("gift.giftCardNo")} on={value.giftCard === "no"} onToggle={() => onChange({ ...value, giftCard: value.giftCard === "no" ? null : "no" })} />
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

/** 편지 봉투(나도 물어보기 단추) */
function Envelope() {
  return (
    <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
    </svg>
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
  const [modes, setModes] = useState<Record<string, Mode | null>>(() => Object.fromEntries(sections.map((s) => [s, prefill[s] ? null : "new"])));
  const [consent, setConsent] = useState(false);
  const [saveMine, setSaveMine] = useState(true);
  const [step, setStep] = useState(0);
  const [state, action, pending] = useActionState(submit, INITIAL);
  const inApp = useIsNative();

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

  // 답한 항목: 맞아요·없어요를 눌렀거나 값을 적은 것. 건드리지 않고 '다음'만 누른 빈 항목은 답이 아니다(보내면 물어본 사람 기록에 빈 값이 저장되고 '답했다'는 알림만 간다)
  const isAnswered = (x: Section) => {
    const m = modes[x];
    return m === "ok" || m === "none" || ((m === "new" || m === "fix") && !isEmptySection(x, answers[x]));
  };
  const answered = sections.filter(isAnswered);
  const none = sections.filter((x) => modes[x] === "none");

  if (state.sent) {
    const sent = answered;
    // 답한 뒤: 나도 그 사람에게 물어보기. 웹에서는 앱 받기(아이폰은 App Store, 안드로이드는 앱이 있으면 앱을 열고 없으면 Play 공개 전엔 웹), 앱 안에서는 바로 물어보기(로그인 안 했으면 로그인부터)
    const askBack = `/request?name=${encodeURIComponent(from)}`;
    const here = signedIn ? askBack : `/?next=${encodeURIComponent(askBack)}`;
    return (
      <AnswerDone
        title={t("answer.sent.title")}
        body={t("answer.sentShort", { from })}
        topics={sent}
        labels={{ sentTitle: t("answer.sentTopics", { from }), topic: (x) => t(`request.topic.${x}` as "request.topic.dates"), perksTitle: t("answer.perksTitle") }}
        perks={
          signedIn
            ? []
            : [
                { icon: "pencil", text: t("answer.perk.edit") },
                { icon: "people", text: t("answer.perk.see") },
                { icon: "bell", text: t("answer.perk.remind") },
              ]
        }
      >
        {inApp ? (
          <Link href={here} className="btn-primary w-full !text-[26px]">
            <Envelope />
            {t("answer.askBack")}
          </Link>
        ) : (
          <GetAppLink href={`/get?from=answer&next=${encodeURIComponent(here)}`} appPath={askBack} className="btn-primary w-full !text-[26px]">
            <Envelope />
            {t("answer.askBack")}
          </GetAppLink>
        )}
        {state.savedMine ? (
          <Link href="/me" className="flex min-h-11 items-center justify-center text-[14px] text-muted">
            {t("answer.openApp")}
          </Link>
        ) : null}
      </AnswerDone>
    );
  }

  const set = <S extends Section>(s: S, v: CardData[S]) => {
    setAnswers((a) => ({ ...a, [s]: v }));
    if (modes[s] === "none") setModes((m) => ({ ...m, [s]: "new" }));
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
          <span className="text-[14px] leading-[1.45]">{t("answer.saveMine")}</span>
        </button>
      ) : null}
      {needsConsent ? (
        <button type="button" aria-pressed={consent} onClick={() => setConsent(!consent)} className="flex min-h-11 items-start gap-3 text-left">
          <DrawnCheck on={consent} />
          <span className="text-[14px] leading-[1.45]">{t("answer.consent", { from })}</span>
        </button>
      ) : null}
      <span className="text-[12px] leading-[1.45] text-muted">{t("answer.footer", { from })}</span>
    </>
  );

  return (
    <form
      action={action}
      className="flex flex-1 flex-col"
      onKeyDown={(e) => {
        // 마지막 화면 전에는 엔터로 보내지지 않게
        if (e.key === "Enter" && !canSend && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="data" value={JSON.stringify(payload)} />
      <input type="hidden" name="none" value={JSON.stringify(none)} />
      <input type="hidden" name="consent" value={consent ? "1" : "0"} />
      <input type="hidden" name="saveMine" value={signedIn && saveMine ? "1" : "0"} />

      {/* 진행: 뒤로 · 칸 막대 · 몇 번째(하나만 물었으면 없음) */}
      {single ? (
        <div className="h-3" />
      ) : (
        <div className="sticky top-0 z-20 flex items-center gap-2 bg-bg pb-1.5 pl-1 pr-4 pt-1.5" style={{ top: "var(--sat)" }}>
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0} aria-label={t("common.back")} className="flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-0">
            <Icon name="back" size={24} strokeWidth={2} />
          </button>
          <div className="flex flex-1 gap-2" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full border-[1.5px] border-ink ${i <= step ? "bg-sky" : "bg-white"}`} />
            ))}
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] text-muted">
            {step + 1}/{total}
          </span>
        </div>
      )}

      {step === 0 ? (
        <section className="relative flex flex-col gap-5 px-5 pt-5">
          <div className="flex items-center gap-4">
            <figure className="m-0 shrink-0 -rotate-[4deg] border-[1.5px] border-ink bg-white px-[6px] pb-[18px] pt-[6px]">
              <span className="flex h-[81px] w-[81px] items-center justify-center overflow-hidden bg-white">
                <Mascot pose={6} size={70} />
              </span>
            </figure>
            <h1 className="hand-written !font-normal min-w-0 flex-1 text-[29px] leading-[1.2]">{highlightCount(t("answer.title", { from, n: sections.length }))}</h1>
          </div>
          {message ? <p className="-rotate-[0.6deg] whitespace-pre-line rounded-[4px_4px_16px_4px] border-[1.5px] border-ink bg-[#fff3b0] px-3.5 py-2.5 hand-written text-[23px] leading-[1.3]">{message}</p> : null}
          {signedIn ? null : (
            // 앱을 쓰는 사람이 로그인 안 된 브라우저에서 열었으면: 로그인하고 답하면 내 리드미 값이 미리 채워지고, 물어본 사람 목록에 내 얼굴로 보인다
            <Link href={`/?next=${encodeURIComponent(`/r/${token}`)}`} className="flex min-h-11 items-center gap-1 self-start text-[14px] text-accent underline decoration-[1.5px] underline-offset-4">
              {t("answer.signInFirst")}
              <Icon name="chevron" size={15} strokeWidth={2} />
            </Link>
          )}
        </section>
      ) : null}

      {s ? (
        <section key={s} className="card relative mx-4 mt-9 flex flex-col gap-3.5 px-3.5 pb-3.5 pt-3.5">
          <TornTape color={step % 2 ? "pink" : "mint"} w={66} h={21} rotate={6} className="-top-3 right-6" />
          <div className="flex items-center gap-2.5">
            <SectionIcon section={s} size={44} outline />
            <h2 className="flex-1 text-[26px] leading-[1.15]">{t(`request.topic.${s}` as "request.topic.dates")}</h2>
          </div>
          {prefill[s] ? (
            <>
              <div className="flex flex-col gap-1.5 rounded-xl border-[1.5px] border-ink bg-sky-soft px-3 pb-3 pt-2.5">
                <span className="text-[12px]">{t("answer.prefilled", { from })}</span>
                <span className={`hand-written text-[34px] leading-[1.1] ${modes[s] === "fix" ? "text-muted line-through decoration-red decoration-2" : ""}`}>
                  {summarize(s, prefill[s], locale, t) || t("answer.empty")}
                </span>
              </div>
              <div className="flex gap-2">
                {(["ok", "fix"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={modes[s] === m}
                    onClick={() => {
                      setModes((x) => ({ ...x, [s]: m }));
                      // 맞으면 바로 다음 항목으로
                      if (m === "ok") go(step + 1);
                    }}
                    className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-ink text-[15px] ${modes[s] === m ? "bg-sky" : "bg-white"}`}
                  >
                    {modes[s] === m ? <Icon name="check" size={16} strokeWidth={2} /> : null}
                    {t(m === "ok" ? "answer.right" : "answer.fix")}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {modes[s] === "fix" || modes[s] === "new" ? (
            <div className="flex flex-col gap-4">
              {s === "dates" ? (
                <DateSpecPicker
                  large
                  year="birth"
                  value={answers.dates?.birthday ?? null}
                  onChange={(birthday) => set("dates", { birthday, anniversaries: answers.dates?.anniversaries ?? [] })}
                  locale={locale}
                />
              ) : null}
              {s === "safety" ? <SafetyEditor large value={answers.safety ?? emptySection("safety")} onChange={(v) => set("safety", v)} locale={locale} /> : null}
              {s === "taste" ? <TasteEditor large value={answers.taste ?? emptySection("taste")} onChange={(v) => set("taste", v)} locale={locale} /> : null}
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
              className={`inline-flex h-8 items-center self-end rounded-full border-[1.5px] border-ink px-4 text-[13px] ${modes[s] === "none" ? "bg-sky" : "bg-white"}`}
            >
              {t("answer.none")}
            </button>
          ) : null}
        </section>
      ) : (
        <section className="card relative mx-4 mt-9 flex flex-col gap-4 px-3.5 pb-4 pt-3.5">
          <TornTape color="mint" w={66} h={21} rotate={6} className="-top-3 right-6" />
          <div className="flex items-center gap-3">
            <Mascot pose={6} size={52} />
            <h2 className="text-[28px] leading-[1.2]">
              <span className="hl">{t("answer.almost")}</span>
            </h2>
          </div>
          {finish}
        </section>
      )}
      {single ? <div className="mx-5 mt-4 flex flex-col gap-3">{finish}</div> : null}

      <div className="bottom-bar mt-auto flex flex-col gap-2 bg-bg px-4 pt-4">
        {state.error ? (
          <p role="alert" className="px-1 text-[14px] text-red">
            {t(state.error === "consent" ? "answer.needConsent" : state.error === "closed" ? "accept.expired" : state.error === "self" ? "answer.self" : state.error === "empty" ? "answer.needOne" : "common.error")}
          </p>
        ) : last && !answered.length ? (
          // 마지막 화면인데 답한 게 하나도 없다(전부 건드리지 않고 넘겼다): 보낼 수 없는 까닭
          <p className="px-1 text-[14px] text-muted">{t("answer.needOne")}</p>
        ) : null}
        {canSend ? (
          <button disabled={pending || !answered.length || (needsConsent && !consent)} className="btn-primary !min-h-[50px] w-full !text-[24px]">
            {t("answer.send")}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                // 건너뛰면 이 항목은 보내지 않는다
                setModes((x) => ({ ...x, [s!]: prefill[s!] ? null : x[s!] === "none" ? "none" : null }));
                go(step + 1);
              }}
              className="btn-outline !min-h-[50px] w-[40%] shrink-0 !text-[23px]"
            >
              {t("answer.skip")}
            </button>
            <button type="button" onClick={() => go(step + 1)} className="btn-primary !min-h-[50px] flex-1 !text-[24px]">
              <Icon name="chevron" size={19} strokeWidth={2} />
              {t("answer.next")}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
