import { ALCOHOL_KINDS, ALLERGENS, ALLERGY_NOTE_CODE, DIETS, DISLIKES, SPICY_LEVELS, alcoholLabel, groupMemo, judgeMenus, labelOf, mealBrief, orderNote, uncheckedAllergies, type MenuReason, type MenuVerdict, type WhoCode } from "@readme/core";
import Link from "next/link";
import { ShareBar } from "@/app/(app)/plan/ShareBar";
import { ChiliMeter } from "@/components/Chili";
import { TornTape } from "@/components/TornTape";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/marks";
import { ShareTextButton } from "@/components/ShareButtons";
import type { PlanMenuData } from "@/lib/pages/plan-menu.data";
import { makeT, type T } from "@/lib/t";

function mapUrl(menu: string, locale: "ko" | "en"): string {
  const q = encodeURIComponent(menu);
  return locale === "ko" ? `https://map.naver.com/p/search/${q}` : `https://www.google.com/maps/search/${q}`;
}

function reasonText(r: MenuReason, locale: "ko" | "en", t: T): string {
  const who = r.who.join(", ");
  if (r.kind === "allergy") return `${labelOf(ALLERGENS, r.code, locale)} ${t("person.allergy")} · ${who}`;
  if (r.kind === "diet") return `${labelOf(DIETS, r.code, locale)} · ${who}`;
  if (r.kind === "dislike") return `${labelOf(DISLIKES, r.code, locale)} · ${who}`;
  return `${t("plan.reasonSpicy")} · ${who}`;
}

/** 같이 고르기 > 메뉴 고르기 */
export function PlanMenuView({ locale, diners, back }: PlanMenuData) {
  const t = makeT(locale);
  const brief = mealBrief(diners);
  const verdicts = judgeMenus(diners);
  // 메뉴 표로는 안전하다고 말할 수 없는 알레르기(복숭아·직접 적은 이름·꼭 알려 둘 말): 메뉴를 내리지 않고 여기서 한 번 알린다
  const check = uncheckedAllergies(brief);
  const ok = verdicts.filter((v) => v.status === "ok");
  const soft = verdicts.filter((v) => v.status === "soft");
  const avoid = verdicts.filter((v) => v.status === "avoid");
  const note = orderNote(brief, locale);
  const picks = ok.slice(0, 3).map((v) => v.item.label[locale]);
  const recommend = picks.length ? `\n${t("plan.recommend", { menus: picks.join(", ") })}` : "";
  const memo = groupMemo(brief, locale, false) + recommend;
  const memoNamed = groupMemo(brief, locale, true) + recommend;
  const avoidRow = (label: string, list: WhoCode[], catalog: Parameters<typeof labelOf>[0], red = false) =>
    list.length ? (
      <div className="row">
        <span className="w-[68.4px] shrink-0 pt-[2.7px] text-[10.8px] text-muted">{label}</span>
        <span className={`flex min-w-0 flex-1 flex-wrap ${red ? "gap-x-3 gap-y-2" : "gap-x-3 gap-y-1"}`}>
          {list.map((x) => (
            <span key={x.code} className="flex items-center gap-1.5">
              <span className={red ? "hand-written rounded-full border border-red px-[8.1px] py-0.5 text-[16.2px] leading-none text-red" : "hand-written text-[17.8px] leading-[1.2]"}>{labelOf(catalog, x.code, locale)}</span>
              <span className="text-[10.8px] text-muted">{x.who.join(", ")}</span>
            </span>
          ))}
        </span>
      </div>
    ) : null;
  const menuRow = (v: MenuVerdict) => {
    const label = v.item.label[locale];
    return (
      <li key={v.item.code} className="flex min-h-[44.1px] flex-col justify-center border-t border-dashed border-ink/30 first:border-t-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-px py-2">
            <span className="hand-written text-[21.1px] leading-[1.15]">{label}</span>
            <span className="flex flex-wrap gap-x-2.5 text-[10.8px] leading-[1.35]">
              {v.likedBy.length ? <span className="text-accent">{t("plan.likedBy", { names: v.likedBy.join(", ") })}</span> : null}
              {v.milder ? <span className="text-muted">{t("plan.milder")}</span> : null}
              {v.reasons.map((r, i) => (
                <span key={i} className="text-muted">
                  {reasonText(r, locale, t)}
                </span>
              ))}
            </span>
          </div>
          {v.status === "ok" ? (
            <div className="flex shrink-0 items-center">
              <a href={mapUrl(label, locale)} target="_blank" rel="noopener noreferrer" aria-label={`${label} · ${t("plan.findPlace")}`} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] items-center justify-center text-muted">
                <Icon name="map" size={19} strokeWidth={1.8} />
              </a>
              <ShareTextButton text={t("plan.proposal", { menu: label })} label={t("plan.propose")} doneLabel={t("plan.proposed")} className="flex h-11 items-center whitespace-nowrap px-1 text-[11.7px] text-ink underline underline-offset-[4.5px]" />
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  const h2 = "hand scribble text-[19.4px] leading-none";
  const mint = { "--scribble": "#5dbb9a" } as React.CSSProperties;
  const count = "hand inline-flex h-[27px] items-center rounded-[9px] border border-edge bg-sky-soft px-2.5 text-[13.8px] leading-none";
  const sum = "flex min-h-[41.4px] cursor-pointer list-none items-center justify-between text-[12.6px]";
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-0.5 pl-1.5 pr-4">
        <Link href={back} prefetch={false} aria-label={t("common.back")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center">
          <Icon name="back" size={24} />
        </Link>
        <h1 className="min-w-0 truncate text-[25.1px] leading-none">{t("plan.menuTitle")}</h1>
      </div>
      <ul className="flex flex-wrap gap-2 px-5 pt-0.5">
        {diners.map((d) => (
          <li key={d.key} className="inline-flex h-[27px] items-center rounded-full border border-edge bg-white px-3 text-[12.6px]">
            {d.name}
          </li>
        ))}
      </ul>

      <section aria-labelledby="avoid" className="relative mx-4 mt-7 flex flex-col">
        {brief.allergens.length || brief.dislikes.length || brief.diets.length || brief.spicy || check.length ? (
          <div className="card relative px-3.5 pb-1.5 pt-2.5">
            <TornTape color="pink" w={64} h={20} rotate={6} className="-top-3 right-[19.8px]" />
            <h2 id="avoid" className={`${h2} mb-3 w-fit`} style={mint}>
              {t("plan.mustAvoid")}
            </h2>
            {avoidRow(t("plan.allergy"), brief.allergens, ALLERGENS, true)}
            {check.length ? (
              <div className="row">
                <span className="w-[68.4px] shrink-0 pt-[2.7px] text-[10.8px] text-muted">{t("plan.reasonCheckAllergy")}</span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
                  {check.map((x) => (
                    <span key={x.code} className="flex items-center gap-1.5">
                      <span className="hand-written text-[17.8px] leading-[1.2]">{x.code === ALLERGY_NOTE_CODE ? t("safety.note") : labelOf(ALLERGENS, x.code, locale)}</span>
                      <span className="text-[10.8px] text-muted">{x.who.join(", ")}</span>
                    </span>
                  ))}
                </span>
              </div>
            ) : null}
            {avoidRow(t("plan.dislike"), brief.dislikes, DISLIKES)}
            {avoidRow(t("plan.diet"), brief.diets, DIETS)}
            {brief.spicy ? (
              <div className="row">
                <span className="w-[68.4px] shrink-0 pt-[2.7px] text-[10.8px] text-muted">{t("plan.spicy")}</span>
                <span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <ChiliMeter level={brief.spicy.level} size={16} />
                  <span className="text-[10.8px] leading-[1.3] text-muted">{t("plan.spicyUpTo", { level: SPICY_LEVELS[brief.spicy.level]?.[locale] ?? "" })}</span>
                  <span className="text-[10.8px] text-muted">{brief.spicy.who.join(", ")}</span>
                </span>
              </div>
            ) : null}
            {brief.alcohol.length ? (
              <div className="row">
                <span className="w-[68.4px] shrink-0 pt-0.5 text-[10.8px] text-muted">{t("plan.alcohol")}</span>
                <span className="flex flex-1 flex-col gap-1 text-[12.6px] leading-[1.4]">
                  {brief.alcohol.map((a) => (
                    <span key={a.who}>
                      <span>{a.who}</span> <span className="text-muted">{[alcoholLabel(a.level, locale), ...a.kinds.map((k) => labelOf(ALCOHOL_KINDS, k, locale))].join(" · ")}</span>
                    </span>
                  ))}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <h2 id="avoid" className="sr-only">
              {t("plan.mustAvoid")}
            </h2>
            <p className="row card !px-4 text-[12.6px] text-muted">{t("plan.nothingToAvoid")}</p>
          </>
        )}
      </section>

      {note ? (
        <section className="relative mx-4 mt-6 flex -rotate-[0.4deg] flex-col rounded-[9.7px_11.3px_11.3px_9.7px] border border-edge bg-postit px-3.5 pb-2.5 pt-2.5">
          <span className="text-[12.6px] font-bold">{t("plan.order")}</span>
          <p className="text-[12.6px] leading-[1.55]">
            {note}{" "}
            <CopyButton text={note} label={t("plan.copy")} doneLabel={t("plan.copied")} className="inline-flex min-h-8 items-center text-[12.6px] underline underline-offset-[4.5px]" />
          </p>
        </section>
      ) : null}

      <section aria-labelledby="ok" className="relative mx-4 mt-6 flex flex-col">
        <div className="card relative px-3.5 pb-1.5 pt-2.5">
          <div className="mb-1.5 flex min-h-[30.6px] items-center justify-between">
            <h2 id="ok" className={h2} style={mint}>
              {t("plan.okMenus")}
            </h2>
            <span className={count}>{ok.length}</span>
          </div>
          <ul className="flex flex-col">{ok.slice(0, 8).map(menuRow)}</ul>
        </div>
      </section>

      {soft.length ? (
        <div className="card relative mx-4 mt-6 px-3.5">
          <details>
            <summary className={sum}>
              {t("plan.softMenus")} <span className="text-[11.7px] text-muted">{soft.length}</span>
            </summary>
            <ul className="flex flex-col pb-1.5">{soft.map(menuRow)}</ul>
          </details>
          {avoid.length ? (
            <details className="border-t border-dashed border-ink/30">
              <summary className={sum}>
                {t("plan.avoidMenus")} <span className="text-[11.7px] text-muted">{avoid.length}</span>
              </summary>
              <ul className="flex flex-col pb-1.5">{avoid.map(menuRow)}</ul>
            </details>
          ) : null}
        </div>
      ) : avoid.length ? (
        <div className="card relative mx-4 mt-6 px-3.5">
          <details>
            <summary className={sum}>
              {t("plan.avoidMenus")} <span className="text-[11.7px] text-muted">{avoid.length}</span>
            </summary>
            <ul className="flex flex-col pb-1.5">{avoid.map(menuRow)}</ul>
          </details>
        </div>
      ) : null}

      <p className="mx-6 pb-6 pt-[16.2px] text-[11.7px] leading-[1.5] text-muted">{t("plan.menuNote")}</p>
      <ShareBar plain={memo} named={memoNamed} label={t("plan.share")} doneLabel={t("plan.sent")} namesLabel={t("plan.withNames")} />
    </div>
  );
}
