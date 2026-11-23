import { COLORS, METALS, PATTERNS, STYLES, describeShoe, describeTop, labelOf, type UpcomingEvent } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/chrome";
import { Heart, SKY_STAR, Squiggle, Star, Tape } from "@/components/diary";
import { Icon } from "@/components/marks";
import type { Person } from "@/lib/data";
import { eventName, eventsFor } from "@/lib/events";
import type { PlanGiftData } from "@/lib/pages/plan-gift.data";
import { displayName } from "@/lib/person";
import { makeT } from "@/lib/t";

/** 선물 추천 자리. 웹은 AI·쿠팡을 부르는 서버 컴포넌트를 Suspense로 나중에 채워 넣고, 없으면(토스 번들) 그리지 않는다 */
export interface PlanGiftPicks {
  /** 사람 카드 아래 한 줄 */
  row: (p: Person, name: string, next: UpcomingEvent | undefined) => React.ReactNode;
  /** 목록 아래 고지 */
  disclosure: React.ReactNode;
}

/** 같이 고르기 > 선물 고르기: 고른 사람마다 선물 힌트 한 장 */
export function PlanGiftView({ locale, today, people, back, picksOn, picks }: PlanGiftData & { picks?: PlanGiftPicks }) {
  const t = makeT(locale);
  const and = t("common.and");

  const hints = (p: Person) => {
    const { gifts: g, sizes: z, favorites: f, life: l, taste: tt, culture: c } = p.card;
    const style = [...(f?.patterns ?? []).map((x) => labelOf(PATTERNS, x, locale)), ...(f?.styles ?? []).map((x) => labelOf(STYLES, x, locale)), ...(f?.metals ?? []).map((x) => labelOf(METALS, x, locale))].join(and);
    const top = describeTop(z?.top ?? "", locale);
    const shoe = describeShoe(z?.shoe ?? null, locale);
    const sizes = [top ? `${t("size.top")} ${top.value}${top.unit}` : "", z?.bottom ? `${t("size.bottom")} ${z.bottom}` : "", shoe ? `${t("size.shoe")} ${shoe.value}mm` : "", z?.ring ? `${t("size.ring")} ${z.ring}` : ""].filter(Boolean).join(and);
    return [
      l?.hobbies.length ? { label: t("life.hobbies"), value: l.hobbies.join(and) } : null,
      g?.wishlist.length ? { label: t("gift.ideas"), value: g.wishlist.map((w) => w.title).join(and) } : null,
      g?.brands?.length ? { label: t("gift.brands"), value: g.brands.join(and) } : null,
      f?.idol ? { label: t("fav.idol"), value: f.idol } : null,
      f?.character ? { label: t("fav.character"), value: f.character } : null,
      f?.team ? { label: t("fav.team"), value: f.team } : null,
      f?.animal ? { label: t("fav.animal"), value: f.animal } : null,
      style ? { label: t("fav.style"), value: style } : null,
      f?.colors?.length ? { label: t("gift.colors"), value: f.colors.map((x) => labelOf(COLORS, x, locale)).join(and) } : null,
      f?.flowers ? { label: t("gift.flowers"), value: f.flowers } : null,
      f?.scent ? { label: t("gift.scent"), value: f.scent } : null,
      f?.places?.length ? { label: t("fav.places"), value: f.places.join(and) } : null,
      tt?.dessert ? { label: t("fav.dessert"), value: tt.dessert } : null,
      c?.book ? { label: t("fav.book"), value: c.book } : null,
      g?.giftCard ? { label: t("gift.giftCard"), value: t(g.giftCard === "yes" ? "gift.giftCardYes" : "gift.giftCardNo") } : null,
      sizes ? { label: t("person.sizes"), value: sizes } : null,
      g?.skip.length ? { label: t("gift.skip"), value: g.skip.join(and), strike: true } : null,
    ].filter((x): x is { label: string; value: string; strike?: boolean } => !!x);
  };

  // 선물 힌트는 글로 만들어 내보내지 않는다(취향·사이즈 같은 사람 정보가 그대로 나가는 길이라 공유하기를 뺐다, 2026-11-21)
  return (
    <div className="page-end flex flex-1 flex-col">
      <TopBar back={back} label={t("common.back")} />
      <div className="relative px-6 pt-1.5">
        <h1 className="hl inline-block px-1 text-[34px] leading-[1.2]">{t("plan.giftTitle")}</h1>
        <Star size={22} rotate={14} className="left-[154px] top-0.5" />
      </div>
      <div className="flex flex-col gap-7 px-4 pt-[26px]">
        {people.map((p, idx) => {
          const name = displayName(p);
          const next = eventsFor([p], today)[0];
          const rows = hints(p);
          return (
            <section key={p.contactId} className={`card relative flex flex-col px-5 pb-3.5 pt-[26px] ${idx % 2 ? "rotate-[0.4deg]" : "-rotate-[0.4deg]"}`}>
              {idx % 2 ? (
                <>
                  <Tape color="pink" className="-left-2.5 -top-1.5" />
                  <Tape color="mint" className="-bottom-1 -right-2.5" />
                </>
              ) : (
                <Tape color="mango" w={108} h={26} rotate={-3} alpha={0.62} className="-top-[13px] left-1/2 -ml-[54px]" />
              )}
              <div className="flex min-h-14 items-center gap-3">
                <Avatar config={p.avatar} size={54} label={t("avatar.of", { name })} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[26px] leading-[1.2]">{name}</span>
                  {next ? <span className={`text-[17px] ${next.daysUntil <= 30 ? "text-accent" : "text-muted"}`}>{t("plan.nextDate", { event: eventName(next, t, locale), n: next.daysUntil })}</span> : null}
                </div>
                <Link href={`/people/${p.contactId}/reminder`} className="flex min-h-11 items-center gap-px pl-2 text-[17px] text-muted">
                  {t("plan.seeHints")}
                  <Icon name="chevron" size={18} />
                </Link>
              </div>
              <div className="mt-2.5">
                {rows.length ? (
                  rows.map((r) => (
                    <div key={r.label} className="flex gap-3 border-t border-dashed border-rule-strong pb-3 pt-[11px]">
                      <span className="w-[84px] shrink-0 text-[16px] leading-[1.5] text-muted">{r.label}</span>
                      <span className={`min-w-0 flex-1 text-[20px] leading-[1.4] ${r.strike ? "text-muted line-through decoration-red decoration-2" : ""}`}>{r.value}</span>
                    </div>
                  ))
                ) : (
                  <p className="border-t border-dashed border-rule-strong py-3 text-[17px] text-muted">{t("plan.giftNone")}</p>
                )}
              </div>
              {picksOn && picks ? <div className="-mx-5 border-t border-dashed border-rule-strong pb-2">{picks.row(p, name, next)}</div> : null}
              {idx % 2 ? (
                <>
                  <Star size={20} rotate={-12} color="#FFC23D" className="-top-2.5 right-[70px]" />
                  <Squiggle w={54} width={2.4} color="#F59BAE" className="-bottom-[9px] left-6" />
                </>
              ) : (
                <>
                  <Heart size={28} rotate={16} className="-right-[9px] top-11" />
                  <Star size={20} rotate={-12} color={SKY_STAR} className="-left-2 top-[190px]" />
                </>
              )}
            </section>
          );
        })}
      </div>
      {picksOn && picks ? picks.disclosure : null}
    </div>
  );
}
