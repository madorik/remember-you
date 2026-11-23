import { SECTIONS_BY_IMPORTANCE } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { TornTape } from "@/components/TornTape";
import { Icon } from "@/components/marks";
import { SectionBody } from "@/components/SectionBody";
import { SectionIcon } from "@/components/SectionIcon";
import { ShareMyRecord } from "@/components/ShareMyRecord";
import type { MeData } from "@/lib/pages/types";
import { shareParts } from "@/lib/share-record";
import { makeT } from "@/lib/t";

// 나: 적어 둔 것을 미리보기로(사람 화면과 같은 모양). 고치기는 /me/edit에서 항목을 펼쳐서
export function MeView({ locale, name, avatar, card, today }: MeData) {
  const t = makeT(locale);
  // 적어 둔 항목만(중요한 순서)
  const filled = SECTIONS_BY_IMPORTANCE.map((section) => ({ section, body: SectionBody({ section, card, today, locale, t }) })).filter((x) => x.body != null);
  // 내가 적어 둔 것을 가족·친구에게 링크로 보내기(선물 칸은 '받고 싶은 것'이라 같이 보낸다). 링크에는 정보가 없고 받는 사람이 앱에서 연다
  const shareable = shareParts(SECTIONS_BY_IMPORTANCE, card, locale, t, { wishlist: true });

  return (
    <>
      {/* 위 줄: 오른쪽에 내 기록 링크로 보내기(시안은 테두리 없는 아이콘) */}
      <div className="flex h-12 shrink-0 items-center justify-end pr-2.5">
        <ShareMyRecord
          parts={shareable}
          className="!bg-transparent !text-ink !shadow-none"
          labels={{ open: t("share.record"), title: t("share.recordTitle"), send: t("share.send"), shared: t("share.done"), copied: t("share.copied"), failed: t("share.failed"), busy: t("share.busy"), text: t("share.linkText"), close: t("common.close") }}
        />
      </div>

      <div className="relative flex items-center gap-4 px-5 pt-1">
        <Link href="/me/avatar" className="relative block shrink-0 -rotate-3 border-[1.5px] border-ink bg-white px-1.5 pb-[18px] pt-1.5">
          <span className="flex h-[86px] w-[86px] items-center justify-center overflow-hidden bg-[#f1ecfd]">
            <Avatar config={avatar} size={80} label={t("avatar.of", { name })} />
          </span>
          <TornTape color="pink" w={56} h={17} rotate={-8} className="-top-3 left-[18px]" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <h1 className="min-w-0 truncate text-[48px] leading-none">
            <span className="hl">{name}</span>
          </h1>
          <Link href="/me/avatar" aria-label={t("me.face")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-fill">
            <Icon name="pencil" size={19} strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      <section aria-labelledby="me-title" className="relative mx-4 mt-8 flex flex-col">
        <div className="card relative flex flex-col px-3.5 pb-3 pt-2.5">
          <TornTape color="mint" w={68} h={21} rotate={6} className="-top-3 right-6" />
          <div className="flex min-h-[34px] items-center justify-between gap-2">
            <h2 id="me-title" className="scribble text-[24px] leading-none" style={{ "--scribble": "#5dbb9a" } as React.CSSProperties}>
              {t("me.title")}
            </h2>
            <Link href="/me/edit" aria-label={t("me.edit")} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-fill">
              <Icon name="pencil" size={19} strokeWidth={1.8} />
            </Link>
          </div>
          {filled.length ? (
            <ul className="mt-1.5 flex flex-col">
              {filled.map(({ section, body }) => (
                <li key={section} className="border-t-[1.5px] border-dashed border-ink/[0.18] first:border-t-0">
                  <Link href={`/me/edit?open=${section}`} className="flex min-h-10 items-center gap-2.5">
                    <SectionIcon section={section} size={34} outline />
                    <span className={`hand min-w-0 flex-1 text-[23px] leading-[1.1] ${section === "safety" ? "text-red" : ""}`}>{t(`section.${section}`)}</span>
                    <Icon name="chevron" size={15} strokeWidth={2} className="shrink-0 text-muted" />
                  </Link>
                  <div className="pb-2.5 pl-[44px]">{body}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Link href="/me/edit" className="hand mt-1 flex min-h-[72px] items-center justify-center gap-1.5 text-[24px]">
              <Icon name="plus" size={17} strokeWidth={2.4} />
              {t("person.write")}
            </Link>
          )}
        </div>
      </section>

      <div className="h-8" />
    </>
  );
}
