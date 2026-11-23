import { SECTIONS_BY_IMPORTANCE } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { Heart, SKY_STAR, Squiggle, Star, Tape } from "@/components/diary";
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
      <div className="relative flex items-center gap-[22px] pb-1 pl-[26px] pr-4 pt-[26px]">
        <Link
          href="/me/avatar"
          className="relative block shrink-0 -rotate-3 bg-white px-[7px] pb-5 pt-[7px] shadow-[0_1px_2px_rgb(31_35_64/0.12),0_8px_16px_-10px_rgb(31_35_64/0.5)]"
        >
          <span className="flex h-[86px] w-[86px] items-center justify-center bg-[#f1ecff]">
            <Avatar config={avatar} size={80} label={t("avatar.of", { name })} />
          </span>
          <Tape color="pink" w={48} h={18} rotate={-6} className="-top-[9px] left-[22px]" />
        </Link>
        <div className="flex min-w-0 items-center">
          <h1 className="hl truncate px-1 text-[40px] leading-[1.15]">{name}</h1>
          <Link href="/me/avatar" aria-label={t("me.face")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-fill">
            <Icon name="pencil" size={19} strokeWidth={1.9} />
          </Link>
        </div>
        {/* 화면 위 오른쪽: 내 기록 링크로 보내기 */}
        <ShareMyRecord
          parts={shareable}
          className="absolute right-2.5 top-1.5"
          labels={{ open: t("share.record"), title: t("share.recordTitle"), send: t("share.send"), shared: t("share.done"), copied: t("share.copied"), failed: t("share.failed"), busy: t("share.busy"), text: t("share.linkText"), close: t("common.close") }}
        />
        <Star size={22} rotate={14} className="right-[72px] top-9" />
        <Heart size={24} rotate={-14} className="left-[100px] top-28" />
      </div>

      <section aria-labelledby="me-title" className="relative mx-4 mt-[18px] flex flex-col">
        <div className="flex min-h-11 items-center justify-between pl-2">
          <h2 id="me-title" className="text-[22px]">
            {t("me.title")}
          </h2>
          <div className="flex items-center gap-1">
            <Link href="/me/edit" aria-label={t("me.edit")} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 active:bg-fill">
              <Icon name="pencil" size={21} strokeWidth={1.9} />
            </Link>
          </div>
        </div>
        {filled.length ? (
          <div className="card relative mt-1 px-4">
            <Tape color="mint" className="-left-2.5 -top-1.5" />
            <ul className="flex flex-col">
            {filled.map(({ section, body }) => (
              <li key={section} className="border-t border-dashed border-rule first:border-t-0">
                <Link href={`/me/edit?open=${section}`} className="flex min-h-[56px] items-center gap-3 pt-2">
                  <SectionIcon section={section} size={40} />
                  <span className={`min-w-0 flex-1 text-[20px] ${section === "safety" ? "text-red" : ""}`}>{t(`section.${section}`)}</span>
                  <Icon name="chevron" size={18} className="shrink-0 text-muted" />
                </Link>
                <div className="pb-3.5 pt-1">{body}</div>
              </li>
            ))}
            </ul>
            <Star size={20} rotate={12} color={SKY_STAR} className="-right-1.5 top-[210px]" />
            <Squiggle w={54} width={2.4} color="#F59BAE" className="-bottom-2 right-[30px]" />
          </div>
        ) : (
          <Link href="/me/edit" className="card mt-1 flex min-h-[72px] items-center justify-center gap-1.5 text-[19px] text-accent">
            <Icon name="plus" size={17} strokeWidth={2.4} />
            {t("person.write")}
          </Link>
        )}
      </section>

      <div className="h-8" />
    </>
  );
}
