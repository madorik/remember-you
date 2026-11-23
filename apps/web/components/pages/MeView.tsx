import { SECTIONS_BY_IMPORTANCE } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { TornTape } from "@/components/TornTape";
import { Icon } from "@/components/marks";
import { filledSections, RememberedList } from "@/components/RememberedList";
import { ShareMyRecord } from "@/components/ShareMyRecord";
import type { MeData } from "@/lib/pages/types";
import { shareParts } from "@/lib/share-record";
import { makeT } from "@/lib/t";

// 나: 적어 둔 것을 사람 화면의 '기억해 둔 것'과 같은 모양으로. 고치기는 /me/edit에서 항목을 펼쳐서
export function MeView({ locale, name, avatar, card, today }: MeData) {
  const t = makeT(locale);
  // 적어 둔 항목만(중요한 순서). 사람 화면과 같은 풀 본문
  const filled = filledSections({ card, today, locale, t });
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
        <Link href="/me/avatar" className="relative block shrink-0 -rotate-3 border border-edge bg-white px-1.5 pb-[16.2px] pt-1.5">
          <span className="flex h-[77.4px] w-[77.4px] items-center justify-center overflow-hidden bg-[#f1ecfd]">
            <Avatar config={avatar} size={80} label={t("avatar.of", { name })} />
          </span>
          <TornTape color="pink" w={56} h={17} rotate={-8} className="-top-3 left-[16.2px]" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <h1 className="min-w-0 truncate text-[38.9px] leading-none">
            <span className="hl">{name}</span>
          </h1>
          <Link href="/me/avatar" aria-label={t("me.face")} className="flex h-11 w-11 relative before:absolute before:-inset-[2.2px] shrink-0 items-center justify-center rounded-full active:bg-fill">
            <Icon name="pencil" size={19} strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      {/* 나에 대한 기록: 사람 화면의 '기억해 둔 것'과 같은 목록(RememberedList). 항목을 누르면 그 항목이 펼쳐진 고치는 화면 */}
      <RememberedList
        title={t("me.title")}
        filled={filled}
        editHref="/me/edit"
        sectionHref={(section) => `/me/edit?open=${section}`}
        editLabel={t("me.edit")}
        t={t}
        className="mt-6"
        empty={
          <Link href="/me/edit" className="btn-outline">
            <Icon name="plus" size={17} strokeWidth={2.2} />
            {t("person.write")}
          </Link>
        }
      />

      <div className="page-end" />
    </>
  );
}
