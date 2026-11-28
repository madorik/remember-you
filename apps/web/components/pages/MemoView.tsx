import { MemoPad, type MemoLabels } from "@/app/(app)/voice/MemoPad";
import type { Locale, YMD } from "@readme/core";
import type { VoiceData } from "@/lib/pages/types";
import { makeT, type T } from "@/lib/t";

/** 메모지 화면의 문구(메모 쓰기와 온보딩의 첫 메모가 같이 쓴다) */
export function memoLabels(t: T, locale: Locale, today: YMD): MemoLabels {
  return {
    close: t("common.close"),
    importNotes: t("import.open"),
    save: t("common.save"),
    placeholderOf: t("person.quickPlaceholder", { name: "{name}" }),
    placeholder: t("memo.placeholder"),
    addPerson: t("memo.addPerson"),
    name: t("memo.name"),
    people: t("memo.people"),
    newOption: t("memo.addNew", { name: "{name}" }),
    newBadge: t("memo.newBadge"),
    removeTag: t("memo.removeTag", { name: "{name}" }),
    pickWho: t("memo.pickWho"),
    savedTo: t("memo.savedTo", { names: "{names}" }),
    card: {
      organizing: t("memo.card.organizing"),
      added: t("memo.card.added"),
      nothing: t("memo.card.nothing"),
      known: t("memo.card.known"),
      failed: t("memo.card.failed"),
      limit: t("memo.card.limit"),
      reverted: t("memo.card.reverted"),
      view: t("memo.card.view", { name: "{name}" }),
      undo: t("common.undo"),
      more: t("memo.card.continue"),
    },
    error: t("common.error"),
    micError: t("voice.micError"),
    mic: t("voice.title"),
    stopListening: t("memo.stopListening"),
    sharedClipped: t("memo.sharedClipped"),
    menu: { menu: t("import.open"), fromNotes: t("memo.fromNotes"), fromPhoto: t("memo.fromPhoto") },
    paste: t("memo.paste"),
    pasteEmpty: t("memo.pasteEmpty"),
    pasteFailed: t("memo.pasteFailed"),
    photoReading: t("memo.photoReading"),
    photoErrors: {
      sensitive: t("import.sensitive"),
      not_memo: t("import.notMemo"),
      unreadable: t("import.unreadable"),
      bad_image: t("import.badImage"),
      limit: t("import.limit"),
      failed: t("import.failed"),
      ai_off: t("import.aiOff"),
    },
    photoProblems: {
      type: t("import.img.type"),
      big: t("import.img.big"),
      unreadable: t("import.img.unreadable"),
      small: t("import.img.small"),
      ratio: t("import.img.ratio"),
      blank: t("import.img.blank"),
      heavy: t("import.img.heavy"),
      many: t("import.img.many"),
    },
    photoSkipped: t("import.skipped", { n: "{n}" }),
    month: locale === "ko" ? `${today.m}월` : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][today.m - 1]!,
  };
}

// 메모 쓰기(하단 가운데 메모 단추): 바인더 속지에 적는 메모
export function MemoView({ locale, today, people, fixed, shared }: VoiceData) {
  const t = makeT(locale);
  const face = (p: NonNullable<VoiceData["fixed"]>) => ({ id: p.id, name: p.name, tag: p.tag, avatar: p.avatar, hint: p.hint });
  return <MemoPad locale={locale} today={today} people={people.map(face)} fixed={fixed ? face(fixed) : null} shared={shared} labels={memoLabels(t, locale, today)} />;
}
