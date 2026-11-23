import { SECTIONS, type Section } from "@readme/core";
import Link from "@/components/AppLink";
import { leaveTour } from "@/app/actions/tour";
import { VoiceCapture } from "@/app/(app)/voice/VoiceCapture";
import { TopBar } from "@/components/chrome";
import { Heart, Star } from "@/components/diary";
import { Icon } from "@/components/marks";
import type { VoiceData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 말로 적기: 말하면(또는 적으면) 누구의 어느 칸인지 나눠서 바로 넣는다. 없는 사람은 새로, 맞는 칸이 없으면 메모로
export function VoiceView({ locale, people, tour }: VoiceData) {
  const t = makeT(locale);
  return (
    <div className="flex flex-1 flex-col">
      {/* 가입 직후 체험이면 닫기 대신 오른쪽 위 '건너뛰기'(체험을 접고 홈으로) */}
      <TopBar
        close={tour ? undefined : "/home"}
        label={t("common.close")}
        right={
          tour ? (
            <form action={leaveTour}>
              <input type="hidden" name="kind" value="skip" />
              <input type="hidden" name="source" value="voice" />
              <button className="flex min-h-11 items-center px-3 text-[19px] text-muted">{t("common.skip")}</button>
            </form>
          ) : (
            // 가운데 구슬에서도: 적어 둔 메모를 통째로 가져오기(쓰기·말하기)
            <Link href="/import" className="flex min-h-11 items-center gap-1 px-3 text-[19px] text-accent">
              <Icon name="pencil" size={18} strokeWidth={2} />
              {t("import.open")}
            </Link>
          )
        }
      />
      {/* 키보드가 뜨면(적는 동안) 제목은 숨겨 적는 칸과 사람 줄이 한 화면에. 체험이면 제목 대신 아래 안내(이렇게 말해보세요) */}
      {tour ? null : (
        <div className="relative px-6 pt-2 text-center [html[data-kb]_&]:hidden">
          <h1 className="text-[34px] leading-[1.25]">
            {t("voice.headline")
              .split("\n")
              .map((line, i, all) => (
                <span key={i} className="block">
                  {i === all.length - 1 ? <span className="hl px-1">{line}</span> : line}
                </span>
              ))}
          </h1>
          <Star size={22} rotate={14} className="right-[42px] top-0.5" />
          <Heart size={22} rotate={-14} className="left-[38px] top-[54px]" />
        </div>
      )}
      <VoiceCapture
        locale={locale}
        people={people}
        tour={tour ? { page: t("tour.page", { n: tour.n, total: tour.total }), say: t("tour.say"), write: t("tour.write"), example: t("tour.example"), next: t("common.next") } : null}
        labels={{
          mode: t("voice.mode"),
          modeVoice: t("voice.modeVoice"),
          modeText: t("voice.modeText"),
          speak: t("voice.speak"),
          same: t("voice.same"),
          gone: t("voice.gone"),
          changed: t("voice.changed"),
          removed: t("voice.removed"),
          clear: t("voice.clear"),
          cue: t("voice.cue"),
          listening: t("voice.listening"),
          heard: t("voice.heard"),
          stop: t("voice.stop"),
          placeholder: tour ? t("tour.example") : t("voice.placeholder"),
          placeholderText: tour ? t("tour.example") : t("voice.placeholderText"),
          mention: t("voice.mention"),
          mentionList: t("voice.mentionList"),
          save: t("voice.save"),
          saved: t("voice.saved"),
          confirm: t("common.save"),
          savedDone: t("common.saved"),
          steps: [t("voice.step1"), t("voice.step2"), t("voice.step3")],
          removeLine: t("voice.removeLine"),
          isNew: t("voice.newPerson"),
          target: {
            title: t("voice.pickTitle"),
            close: t("common.close"),
            search: t("people.search"),
            empty: t("people.searchEmpty"),
            sameName: t("voice.sameName"),
            asNew: t("voice.asNew"),
            all: t("voice.applyAll"),
          },
          changeField: t("voice.changeField"),
          memo: t("voice.memo"),
          wishMe: t("gift.wishTitle"),
          sections: Object.fromEntries(SECTIONS.map((x) => [x, t(`section.${x}`)])) as Record<Section, string>,
          more: t("voice.more"),
          aiOff: t("voice.aiOff"),
          failed: t("voice.failed"),
          limit: t("voice.limit"),
          nothing: t("voice.nothing"),
          micError: t("voice.micError"),
        }}
      />
    </div>
  );
}
