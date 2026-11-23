import { ALCOHOL_KINDS, ALLERGENS, ALLERGY_NOTE_CODE, DIETS, DISLIKES, SPICY_LEVELS, alcoholLabel, groupMemo, judgeMenus, labelOf, mealBrief, orderNote, uncheckedAllergies, type MenuReason, type MenuVerdict, type WhoCode } from "@readme/core";
import { ShareBar } from "@/app/(app)/plan/ShareBar";
import { ChiliMeter } from "@/components/Chili";
import { TopBar } from "@/components/chrome";
import { Heart, SKY_STAR, Squiggle, Star, Tape } from "@/components/diary";
import { CopyButton } from "@/components/CopyButton";
import { Icon, MarkerCircle } from "@/components/marks";
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
        <span className="w-[76px] shrink-0 pt-[3px] text-[16px] text-muted">{label}</span>
        <span className={`flex min-w-0 flex-1 flex-wrap ${red ? "gap-x-6 gap-y-3 pl-1.5" : "gap-x-4 gap-y-2"}`}>
          {list.map((x) => (
            <span key={x.code} className="flex items-baseline gap-2">
              <span className={`relative ${red ? "text-[24px] leading-[1.3] text-red" : "text-[22px] leading-[1.3]"}`}>
                {labelOf(catalog, x.code, locale)}
                {red ? <MarkerCircle color="warn" pad={[7, 4]} /> : null}
              </span>
              <span className="text-[16px] text-muted">{x.who.join(", ")}</span>
            </span>
          ))}
        </span>
      </div>
    ) : null;
  const menuRow = (v: MenuVerdict) => {
    const label = v.item.label[locale];
    return (
      <li key={v.item.code} className="flex min-h-[68px] flex-col justify-center border-t border-dashed border-rule-strong first:border-t-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-px py-2">
            <span className="text-[22px] leading-[1.25]">{label}</span>
            <span className="flex flex-wrap gap-x-2.5 text-[16px] leading-[1.35]">
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
              <a href={mapUrl(label, locale)} target="_blank" rel="noopener noreferrer" aria-label={`${label} · ${t("plan.findPlace")}`} className="flex h-11 w-11 items-center justify-center text-muted">
                <Icon name="map" size={22} />
              </a>
              <ShareTextButton text={t("plan.proposal", { menu: label })} label={t("plan.propose")} doneLabel={t("plan.proposed")} className="flex h-11 items-center whitespace-nowrap px-2 text-[17px] text-ink underline underline-offset-[5px]" />
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <TopBar back={back} label={t("common.back")} />
      <div className="relative px-6 pt-1.5">
        <h1 className="hl inline-block px-1 text-[34px] leading-[1.2]">{t("plan.menuTitle")}</h1>
        <p className="mx-1 mt-2 text-[19px] text-muted">{diners.map((d) => d.name).join(", ")}</p>
        <Star size={22} rotate={14} className="right-11 top-1" />
      </div>

      <section aria-labelledby="avoid" className="relative flex flex-col">
        <h2 id="avoid" className="px-6 pb-3 pt-[26px] text-[24px]">
          {t("plan.mustAvoid")}
        </h2>
        {brief.allergens.length || brief.dislikes.length || brief.diets.length || brief.spicy || check.length ? (
          <div className="card relative mx-4 px-4 py-1">
            {avoidRow(t("plan.allergy"), brief.allergens, ALLERGENS, true)}
            {check.length ? (
              <div className="row">
                <span className="w-[76px] shrink-0 pt-[3px] text-[16px] text-muted">{t("plan.reasonCheckAllergy")}</span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-2">
                  {check.map((x) => (
                    <span key={x.code} className="flex items-baseline gap-2">
                      <span className="text-[22px] leading-[1.3]">{x.code === ALLERGY_NOTE_CODE ? t("safety.note") : labelOf(ALLERGENS, x.code, locale)}</span>
                      <span className="text-[16px] text-muted">{x.who.join(", ")}</span>
                    </span>
                  ))}
                </span>
              </div>
            ) : null}
            {avoidRow(t("plan.dislike"), brief.dislikes, DISLIKES)}
            {avoidRow(t("plan.diet"), brief.diets, DIETS)}
            {brief.spicy ? (
              <div className="row">
                <span className="w-[76px] shrink-0 pt-[3px] text-[16px] text-muted">{t("plan.spicy")}</span>
                <span className="flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <ChiliMeter level={brief.spicy.level} size={22} />
                  <span className="text-[22px] leading-[1.3]">{t("plan.spicyUpTo", { level: SPICY_LEVELS[brief.spicy.level]?.[locale] ?? "" })}</span>
                  <span className="text-[16px] text-muted">{brief.spicy.who.join(", ")}</span>
                </span>
              </div>
            ) : null}
            {brief.alcohol.length ? (
              <div className="row">
                <span className="w-[76px] shrink-0 pt-0.5 text-[16px] text-muted">{t("plan.alcohol")}</span>
                <span className="flex flex-1 flex-col gap-1 text-[19px] leading-[1.4]">
                  {brief.alcohol.map((a) => (
                    <span key={a.who}>
                      <span>{a.who}</span> <span className="text-muted">{[alcoholLabel(a.level, locale), ...a.kinds.map((k) => labelOf(ALCOHOL_KINDS, k, locale))].join(" · ")}</span>
                    </span>
                  ))}
                </span>
              </div>
            ) : null}
            <Tape color="pink" w={66} h={20} rotate={5} alpha={0.6} vertical className="-top-[9px] right-[26px]" />
            <Heart size={24} rotate={16} className="-right-2 bottom-[26px]" />
          </div>
        ) : (
          <p className="row card mx-4 !px-4 text-[17px] text-muted">{t("plan.nothingToAvoid")}</p>
        )}
      </section>

      {note ? (
        <section className="relative mx-4 mt-[22px] flex rotate-[0.6deg] flex-col rounded-[3px] bg-postit pb-3.5 pl-4 pr-3.5 pt-2.5 shadow-[0_6px_12px_-9px_rgb(31_35_64/0.45)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[17px] text-[#8a3b4e]">{t("plan.order")}</span>
            <CopyButton text={note} label={t("plan.copy")} doneLabel={t("plan.copied")} className="flex min-h-11 items-center px-1 text-[17px] underline underline-offset-[5px]" />
          </div>
          <p className="text-[21px] leading-[1.5]">{note}</p>
        </section>
      ) : null}

      <section aria-labelledby="ok" className="relative flex flex-col">
        <h2 id="ok" className="flex items-baseline gap-2 px-6 pb-3 pt-[30px] text-[24px]">
          {t("plan.okMenus")} <span className="text-[18px] text-muted">{ok.length}</span>
        </h2>
        <ul className="card mx-4 flex flex-col pl-4 pr-2">{ok.slice(0, 8).map(menuRow)}</ul>
        <Tape color="mint" className="left-1.5 top-[66px]" />
        <Star size={22} rotate={12} color={SKY_STAR} className="right-1.5 top-9" />
        <Squiggle w={54} width={2.4} className="-bottom-[7px] left-[34px]" />
      </section>

      {soft.length ? (
        <div className="card relative mx-4 mt-[22px] px-4">
          <details>
            <summary className="flex min-h-[54px] cursor-pointer list-none items-center justify-between text-[21px]">
              {t("plan.softMenus")} <span className="text-[18px] text-muted">{soft.length}</span>
            </summary>
            <ul className="flex flex-col pb-1.5">{soft.map(menuRow)}</ul>
          </details>
          {avoid.length ? (
            <details className="border-t border-dashed border-rule-strong">
              <summary className="flex min-h-[54px] cursor-pointer list-none items-center justify-between text-[21px]">
                {t("plan.avoidMenus")} <span className="text-[18px] text-muted">{avoid.length}</span>
              </summary>
              <ul className="flex flex-col pb-1.5">{avoid.map(menuRow)}</ul>
            </details>
          ) : null}
          <Tape color="mango" w={54} h={18} rotate={-34} className="-left-[9px] -top-2" />
        </div>
      ) : avoid.length ? (
        <div className="card relative mx-4 mt-[22px] px-4">
          <details>
            <summary className="flex min-h-[54px] cursor-pointer list-none items-center justify-between text-[21px]">
              {t("plan.avoidMenus")} <span className="text-[18px] text-muted">{avoid.length}</span>
            </summary>
            <ul className="flex flex-col pb-1.5">{avoid.map(menuRow)}</ul>
          </details>
          <Tape color="mango" w={54} h={18} rotate={-34} className="-left-[9px] -top-2" />
        </div>
      ) : null}

      <p className="mx-6 pb-6 pt-[18px] text-[15px] leading-[1.5] text-muted">{t("plan.menuNote")}</p>
      <ShareBar plain={memo} named={memoNamed} label={t("plan.share")} doneLabel={t("plan.sent")} namesLabel={t("plan.withNames")} />
    </div>
  );
}
