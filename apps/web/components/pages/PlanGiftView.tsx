import { COLORS, METALS, PATTERNS, STYLES, describeShoe, describeTop, labelOf, type UpcomingEvent } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { TornTape } from "@/components/TornTape";
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
      <div className="flex h-12 shrink-0 items-center gap-0.5 pl-1.5 pr-4">
        <Link href={back} prefetch={false} aria-label={t("common.back")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center">
          <Icon name="back" size={24} />
        </Link>
        <h1 className="min-w-0 truncate text-[27.5px] leading-none">{t("plan.giftTitle")}</h1>
      </div>
      <div className="flex flex-col gap-6 px-4 pt-6">
        {people.map((p, idx) => {
          const name = displayName(p);
          const next = eventsFor([p], today)[0];
          const rows = hints(p);
          return (
            <section key={p.contactId} className={`card relative flex flex-col px-3.5 pb-1.5 pt-3.5 ${idx % 2 ? "rotate-[0.4deg]" : "-rotate-[0.4deg]"}`}>
              <TornTape color={idx % 2 ? "mint" : "pink"} w={66} h={21} rotate={-6} className="-top-3 left-[19.8px]" />
              <div className="flex min-h-[46.8px] items-center gap-3">
                <Avatar config={p.avatar} size={49} label={t("avatar.of", { name })} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="hand-written truncate text-[23.5px] leading-[1.15]">{name}</span>
                  {next ? <span className={`text-[10.8px] ${next.daysUntil <= 30 ? "text-accent" : "text-muted"}`}>{t("plan.nextDate", { event: eventName(next, t, locale), n: next.daysUntil })}</span> : null}
                </div>
                <Link href={`/people/${p.contactId}/reminder`} className="flex min-h-11 items-center gap-px pl-2 text-[11.7px] text-muted">
                  {t("plan.seeHints")}
                  <Icon name="chevron" size={13} strokeWidth={2} />
                </Link>
              </div>
              <div className="mt-1">
                {rows.length ? (
                  rows.map((r) => (
                    <div key={r.label} className="flex items-center gap-2.5 border-t border-dashed border-ink/30 py-2.5">
                      <span className="w-[86.4px] shrink-0 text-[10.8px] leading-[1.3] text-muted">{r.label}</span>
                      <span className={`hand-written min-w-0 flex-1 text-[17.8px] leading-[1.2] ${r.strike ? "text-red line-through decoration-2" : ""}`}>{r.value}</span>
                    </div>
                  ))
                ) : (
                  <p className="border-t border-dashed border-ink/30 py-3 text-[12.6px] text-muted">{t("plan.giftNone")}</p>
                )}
              </div>
              {picksOn && picks ? <div className="-mx-3.5 border-t border-dashed border-ink/30 pb-2">{picks.row(p, name, next)}</div> : null}
            </section>
          );
        })}
      </div>
      {picksOn && picks ? picks.disclosure : null}
    </div>
  );
}
